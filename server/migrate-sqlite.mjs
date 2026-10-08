import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './db.mjs';
import { createMediaStorage, mimeFor } from './storage.mjs';
import { enqueueAnalysis } from './discovery/ai.mjs';
const TABLES=['users','shop_profiles','uploads','products','orders','comments','reviews','conversations','messages'];
const canonical = rows => JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const digest = value => createHash('sha256').update(value).digest('hex');
export async function migrateSqlite({ source, db, apply=false, backupDir='server/data/backups', uploadDir='server/data/uploads', storage=createMediaStorage({uploadDir}) }) {
  const sqlite=new DatabaseSync(source,{readOnly:true});
  try {
    sqlite.exec('BEGIN');
    if (sqlite.prepare('PRAGMA integrity_check').get().integrity_check!=='ok' || sqlite.prepare('PRAGMA foreign_key_check').all().length) throw new Error('SQLite integrity checks failed.');
    const tables=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
    const rows=Object.fromEntries(TABLES.map(name=>[name,tables.has(name)?sqlite.prepare(`SELECT * FROM ${name}`).all():[]]));
    if ((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n) throw new Error('Target database must be empty. Existing users will never be overwritten.');
    let backupPath;
    if(apply) { await mkdir(backupDir,{recursive:true});backupPath=path.resolve(backupDir,`swipe-${Date.now()}.db`);await backup(sqlite,backupPath); }
    const urls=new Map(), assets=[];
    for (const upload of rows.uploads) {
      if (!/^\/uploads\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4|mov)$/.test(upload.url)) continue;
      const buffer=await readFile(path.join(uploadDir,path.basename(upload.url)));
      const target=apply ? (await storage.put(path.basename(upload.url),buffer)).url : upload.url;
      urls.set(upload.url,target);assets.push({url:target,hash:digest(buffer),mime:mimeFor(upload.url),size:buffer.length});upload.url=target;
    }
    for (const p of rows.products) { const data=JSON.parse(p.data); if(urls.has(data.media))data.media=urls.get(data.media); if(urls.has(data.poster))data.poster=urls.get(data.poster); p.data=JSON.stringify(data); }
    const report={mode:apply?'apply':'dry-run',backup:backupPath,counts:Object.fromEntries(TABLES.map(t=>[t,rows[t].length])),checksums:{},sessionsInvalidated:tables.has('sessions')?sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get().n:0};
    const rollback = new Error('DRY_RUN_ROLLBACK');
    try {
      await db.transaction(async () => {
        // Import into an empty target only; serialize concurrent migration attempts.
        await db.exec('LOCK TABLE users IN ACCESS EXCLUSIVE MODE');
        if((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n) throw new Error('Target is no longer empty.');
        for (const name of TABLES) {
          for (const row of rows[name]) { const columns=Object.keys(row); if(columns.some(c=>!/^[a-z_]+$/.test(c))) throw new Error('Unexpected column.'); await db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...Object.values(row)); }
          const imported=await db.prepare(`SELECT * FROM ${name}`).all();
          if(canonical(imported)!==canonical(rows[name])) throw new Error(`Migration verification failed: ${name}`);
          report.checksums[name]=digest(canonical(imported));
        }
        await db.exec("SELECT setval(pg_get_serial_sequence('messages','id'), COALESCE((SELECT MAX(id) FROM messages),1), EXISTS(SELECT 1 FROM messages))");
        for (const a of assets) await db.prepare('INSERT INTO media_assets VALUES (?,?,?,?)').run(a.url,a.hash,a.mime,a.size);
        for (const p of rows.products) await enqueueAnalysis(db,JSON.parse(p.data));
        if(!apply) throw rollback;
      });
    } catch(error) { if(error!==rollback) throw error; }
    return report;
  } finally { sqlite.close(); }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const source=process.env.SQLITE_SOURCE || 'server/data/swipe.db';
  const db=await openDatabase({dataDir:process.env.PGLITE_DIR || 'server/data/postgres'});
  try { console.log(JSON.stringify(await migrateSqlite({source,db,apply:process.argv.includes('--apply'),uploadDir:process.env.UPLOAD_DIR || 'server/data/uploads'}),null,2)); }
  catch(error) { console.error(error.message);process.exitCode=1; }
  finally { await db.close(); }
}

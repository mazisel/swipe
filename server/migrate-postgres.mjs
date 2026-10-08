import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from './db.mjs';
import { createMediaStorage } from './storage.mjs';

const ident = value => { if (!/^[a-z_]+$/.test(value)) throw new Error('Invalid identifier'); return `"${value}"`; };
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const canonical = rows => JSON.stringify(rows.map(r => JSON.stringify(stable(r))).sort());
const hash = data => createHash('sha256').update(data).digest('hex');

export async function snapshot(db) {
  return db.transaction(async () => {
    const names = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='swipe' ORDER BY tablename")).rows.map(r => r.tablename);
    const dependencies = (await db.query("SELECT c.relname AS child,p.relname AS parent FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_class p ON p.oid=f.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE f.contype='f' AND n.nspname='swipe'")).rows;
    const tables = {};
    for (const name of names) tables[name] = (await db.query(`SELECT to_jsonb(t) AS row FROM swipe.${ident(name)} t`)).rows.map(r => r.row);
    return { format: 1, createdAt: new Date().toISOString(), dependencies, tables };
  });
}

function transform(value, urls, found) {
  if (Array.isArray(value)) return value.map(v => transform(v, urls, found));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,transform(v,urls,found)]));
  if (typeof value !== 'string') return value;
  if (/^\/(uploads|demo-media)\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4|mov)$/.test(value)) { found?.add(value); return urls?.get(value) || value; }
  if (/^[\[{]/.test(value)) { try { return JSON.stringify(transform(JSON.parse(value),urls,found)); } catch { /* Ordinary text, not serialized JSON. */ } }
  return value;
}

export async function transfer({ source, db, apply=false, storage=createMediaStorage(), uploadDir='server/data/uploads' }) {
  if (source.format !== 1) throw new Error('Unsupported snapshot');
  const expected = source.tables.schema_migrations.map(r=>r.version).sort();
  const actual = (await db.query('SELECT version FROM swipe.schema_migrations')).rows.map(r=>r.version).sort();
  if (JSON.stringify(expected)!==JSON.stringify(actual)) throw new Error('Migration versions differ');
  const names = Object.keys(source.tables).filter(n=>n!=='schema_migrations');
  const order=[];
  while(order.length<names.length) {
    const next=names.find(n=>!order.includes(n) && source.dependencies.filter(d=>d.child===n && d.parent!==n).every(d=>order.includes(d.parent)));
    if(!next)throw new Error('Unsupported dependency cycle');
    order.push(next);
  }
  const found=new Set(); transform(source.tables,null,found);
  const urls=new Map(), media=[];
  for(const url of found) {
    const demo=url.startsWith('/demo-media/');
    const bytes=await readFile(path.join(demo?'server/demo-media':uploadDir,path.basename(url)));
    const filename=`${hash(bytes)}${path.extname(url)}`;
    const target=`${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET||'product-media'}/${filename}`;
    urls.set(url,target);media.push({filename,bytes,target});
  }
  // Session credentials are deliberately invalidated; actor tokens/history are preserved.
  const tables=structuredClone(source.tables); tables.sessions=[];
  for(const name of names) tables[name]=transform(tables[name],urls);
  const report={mode:apply?'apply':'dry-run',counts:{},checksums:{},media:media.length,sessionsInvalidated:source.tables.sessions.length};
  const rollback=new Error('DRY_RUN');
  try { await db.transaction(async()=>{
    await db.exec('SELECT pg_advisory_xact_lock(47291022)');
    await db.exec(`LOCK TABLE ${names.map(n=>`swipe.${ident(n)}`).join(',')} IN ACCESS EXCLUSIVE MODE`);
    for(const name of names) if((await db.query(`SELECT 1 FROM swipe.${ident(name)} LIMIT 1`)).rows.length)throw new Error(`Target must be empty: ${name}`);
    if(apply) for(const asset of media) { const result=await storage.put(asset.filename,asset.bytes);if(result.url!==asset.target)throw new Error('Unexpected media URL'); }
    for(const name of order) {
      const rows=tables[name];
      if(rows.length) await db.query(`INSERT INTO swipe.${ident(name)} SELECT * FROM jsonb_populate_recordset(NULL::swipe.${ident(name)}, $1::jsonb)`,[JSON.stringify(rows)]);
      const loaded=(await db.query(`SELECT to_jsonb(t) AS row FROM swipe.${ident(name)} t`)).rows.map(r=>r.row);
      // Compare typed records on the destination: float JSON formatting can differ
      // between PostgreSQL builds without the stored double value changing.
      const expectedRows=(await db.query(`SELECT to_jsonb(t) AS row FROM jsonb_populate_recordset(NULL::swipe.${ident(name)}, $1::jsonb) t`,[JSON.stringify(rows)])).rows.map(r=>r.row);
      if(canonical(loaded)!==canonical(expectedRows))throw new Error(`Verification failed: ${name}`);
      report.counts[name]=rows.length; report.checksums[name]=hash(canonical(loaded));
    }
    if(!apply)throw rollback;
    await db.exec("SELECT setval(pg_get_serial_sequence('swipe.messages','id'),COALESCE((SELECT MAX(id) FROM swipe.messages),1),EXISTS(SELECT 1 FROM swipe.messages))");
  }); } catch(e) {if(e!==rollback)throw e;}
  return report;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    const file=process.argv[3];
    if(!file)throw new Error('Usage: --snapshot FILE or --dry-run FILE or --apply FILE');
    if(process.argv[2]==='--snapshot') {
      db=await openDatabase({databaseUrl:'',dataDir:process.env.PGLITE_DIR||'server/data/postgres'});
      const data=await snapshot(db);await mkdir(path.dirname(file),{recursive:true});
      await writeFile(file,JSON.stringify(data),{mode:0o600,flag:'wx'});
      console.log(JSON.stringify({snapshot:file,counts:Object.fromEntries(Object.entries(data.tables).map(([k,v])=>[k,v.length]))}));
    } else {
      if(!['--dry-run','--apply'].includes(process.argv[2]) || !process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Cloud settings or mode missing');
      db=await openDatabase();
      const report=await transfer({source:JSON.parse(await readFile(file,'utf8')),db,apply:process.argv[2]==='--apply'});
      await writeFile(`${file}.${report.mode}.json`,JSON.stringify(report,null,2),{mode:0o600});
      console.log(JSON.stringify(report));
    }
  } catch(e) { console.error(JSON.stringify({error:e.code||e.name,message:/^(Verification|Target|Migration|Unsupported|Cloud|Usage|Unexpected)/.test(e.message)?e.message:'Migration failed; credentials omitted.'}));process.exitCode=1; }
  finally {await db?.close();}
}

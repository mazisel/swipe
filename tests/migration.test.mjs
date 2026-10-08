import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp,rm,stat,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.mjs';
import { migrateSqlite } from '../server/migrate-sqlite.mjs';
import { seedProducts } from '../server/seed.mjs';
test('SQLite dry run rolls back, apply backs up and verifies identities, media and social relations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'swipe-migrate-test-')),source=join(dir,'source.db'),sqlite=new DatabaseSync(source),db=await openDatabase({dataDir:':memory:'});
 try {
  sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,password TEXT,shop TEXT);CREATE TABLE sessions(hash TEXT,user_id TEXT,expires INTEGER);
   CREATE TABLE products(id TEXT PRIMARY KEY,seller_id TEXT REFERENCES users(id),data TEXT,stock INTEGER);
   CREATE TABLE uploads(url TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),type TEXT);
   CREATE TABLE comments(id TEXT,product_id TEXT REFERENCES products(id),user_id TEXT REFERENCES users(id),body TEXT,created_at TEXT);
   CREATE TABLE conversations(id TEXT,product_id TEXT,buyer_id TEXT,seller_id TEXT,buyer_read INTEGER,seller_read INTEGER);
   CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id TEXT,sender_id TEXT,body TEXT,request_key TEXT,created_at TEXT);`);
  sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('s','s@example.invalid','Seller','salt:hash','Store');
  sqlite.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('b','b@example.invalid','Buyer','salt:buyer',null);
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?)').run('old-session','b',9999999999999);
  sqlite.prepare('INSERT INTO uploads VALUES (?,?,?)').run('/uploads/test.jpg','s','image');
  await writeFile(join(dir,'test.jpg'),Buffer.from([255,216,255,0]));
  const product={...seedProducts[0],id:'p',sellerId:'s',media:'/uploads/test.jpg'};
  sqlite.prepare('INSERT INTO products VALUES (?,?,?,?)').run('p','s',JSON.stringify(product),10);
  sqlite.prepare('INSERT INTO comments VALUES (?,?,?,?,?)').run('c','p','b','Test comment','2026-10-06');
  sqlite.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?)').run('conv','p','b','s',42,42);
  sqlite.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run(42,'conv','b','Private test message','request','2026-10-06');sqlite.close();
  const dry=await migrateSqlite({source,db,uploadDir:dir});assert.equal(dry.mode,'dry-run');assert.equal(dry.counts.messages,1);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM users').get()).n,0);
  const applied=await migrateSqlite({source,db,apply:true,uploadDir:dir,backupDir:join(dir,'backup')});assert.ok((await stat(applied.backup)).size>0);assert.equal(applied.sessionsInvalidated,1);
  assert.equal((await db.prepare('SELECT password FROM users WHERE id=?').get('s')).password,'salt:hash');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).n,0);
  assert.equal((await db.prepare('SELECT body FROM messages WHERE id=?').get(42)).body,'Private test message');
  const newMessage=await db.prepare('INSERT INTO messages(conversation_id,sender_id,body,request_key,created_at) VALUES (?,?,?,?,?) RETURNING id').get('conv','s','Reply','reply','2026-10-06');assert.equal(newMessage.id,43);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ai_jobs').get()).n,1);
  await assert.rejects(()=>migrateSqlite({source,db,apply:true}),/must be empty/);
 } finally { await db.close();await rm(dir,{recursive:true}); }
});

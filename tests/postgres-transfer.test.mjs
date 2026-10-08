import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.mjs';
import { snapshot, transfer } from '../server/migrate-postgres.mjs';

test('PostgreSQL transfer rolls back rehearsal, preserves social relations and refuses nonempty targets', async () => {
  const source=await openDatabase({databaseUrl:'',dataDir:':memory:'});
  const target=await openDatabase({databaseUrl:'',dataDir:':memory:'});
  try {
    await source.exec(`INSERT INTO users VALUES ('seller','seller@example.invalid','Seller','hash','Shop');
      INSERT INTO products VALUES ('p','seller','{"id":"p","title":"A"}',2);
      INSERT INTO feed_actors(id,token_hash) VALUES ('a','token-a'),('b','token-b');
      UPDATE feed_actors SET merged_into='a' WHERE id='b';
      INSERT INTO product_likes(actor_id,product_id) VALUES ('a','p');
      INSERT INTO shop_follows(actor_id,seller_id) VALUES ('a','seller');
      INSERT INTO feed_metrics VALUES ('2026-10-08','test',1,1198.0097939814768,147.95737499999814);
      INSERT INTO sessions VALUES ('session','seller',9999999999999);
      INSERT INTO conversations(id,product_id,buyer_id,seller_id) VALUES ('c','p','seller','seller');
      INSERT INTO messages(id,conversation_id,sender_id,body,request_key,created_at) VALUES (9,'c','seller','Private message','r','2026-10-08');`);
    const data=await snapshot(source);
    const dry=await transfer({source:data,db:target});
    assert.equal(dry.counts.product_likes,1);
    assert.equal((await target.query('SELECT * FROM users')).rows.length,0);
    const applied=await transfer({source:data,db:target,apply:true});
    assert.deepEqual(applied.checksums,dry.checksums);
    assert.equal(applied.sessionsInvalidated,1);
    assert.equal((await target.query("SELECT merged_into FROM feed_actors WHERE id='b'")).rows[0].merged_into,'a');
    assert.equal((await target.query('SELECT * FROM sessions')).rows.length,0);
    assert.equal((await target.query("SELECT nextval('messages_id_seq') AS n")).rows[0].n,10);
    await assert.rejects(transfer({source:data,db:target,apply:true}),/Target must be empty/);
    assert.equal((await target.query('SELECT * FROM messages')).rows.length,1);
  } finally {await source.close();await target.close();}
});

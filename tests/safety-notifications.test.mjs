import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';
import {notify,notifyFollowers} from '../server/notifications.mjs';
import {readFile} from 'node:fs/promises';

test('reports protect private messages; blocks stop both directions; notifications are private and replay-safe',async()=>{
 const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',demo:true});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try {
  const [admin,buyer,seller,other]=await Promise.all(['admin','buyer','seller','other'].map(name=>call('/auth/register',{name:`${name} Test`,email:`${name}@safety.invalid`,password:'test-password'})));
  await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?)').run(admin.user.id);
  await call('/shop',{name:'Test Shop'},seller.token);
  const seed=JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get('soft-knit')).data);
  const product={...seed,id:'safety-product',sellerId:seller.user.id,shop:'Test Shop'};
  await db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(product.id,seller.user.id,JSON.stringify(product),5);
  const c=(await call('/conversations/start',{productId:product.id},buyer.token)).conversation;
  const send={body:'Only this reported message may be disclosed.',requestKey:randomUUID()};
  const m=(await call(`/conversations/${c.id}/messages`,send,buyer.token)).message;
  await call(`/conversations/${c.id}/messages`,send,buyer.token);
  const notices=await call('/notifications',null,seller.token);assert.equal(notices.items.length,1);assert.equal(notices.unread,1);assert.ok(!JSON.stringify(notices).includes(send.body));
  await call('/notifications/read',{ids:[notices.items[0].id]},other.token);
  assert.equal((await call('/notifications',null,seller.token)).unread,1);
  await call('/notifications/read',{ids:[notices.items[0].id]},seller.token);
  assert.equal((await call('/notifications',null,seller.token)).unread,0);
  const report={kind:'message',targetId:String(m.id),reason:'Spam mesaj bildirimi'};
  assert.equal((await call('/reports',report,other.token)).status,404);
  assert.equal((await call('/reports',report,buyer.token)).status,400);
  assert.equal((await call('/reports',report,seller.token)).status,202);
  await call('/reports',report,seller.token);
  assert.equal((await call('/admin/list/reports',null,buyer.token)).status,403);
  const reports=(await call('/admin/list/reports',null,admin.token)).items;
  assert.equal(reports.length,1);assert.equal(reports[0].snapshot.body,send.body);
  assert.equal((await call(`/admin/reports/${reports[0].id}`,{status:'resolved',resolution:'İncelendi',version:0},admin.token)).status,200);
  assert.equal((await call(`/admin/reports/${reports[0].id}`,{status:'dismissed',resolution:'Eski kayıt',version:0},admin.token)).status,409);
  assert.equal((await call('/blocks',{userId:seller.user.id,block:true},buyer.token)).status,200);
  assert.equal((await call(`/conversations/${c.id}/messages`,{body:'blocked',requestKey:randomUUID()},buyer.token)).status,403);
  assert.equal((await call(`/conversations/${c.id}/messages`,{body:'blocked',requestKey:randomUUID()},seller.token)).status,403);
  assert.equal((await call('/conversations/start',{productId:product.id},buyer.token)).status,403);
  const thread=await call(`/conversations/${c.id}`,null,buyer.token);assert.equal(thread.conversation.blockedByMe,true);assert.equal(thread.messages.length,1);
  await call('/blocks',{userId:buyer.user.id,block:false},seller.token);
  assert.equal((await call(`/conversations/${c.id}`,null,buyer.token)).conversation.blocked,true);
  assert.equal((await call('/reports',{kind:'product',targetId:product.id,reason:'Ürün bildirimi'},buyer.token)).status,202);
  assert.equal((await call('/reports',{kind:'shop',targetId:seller.user.id,reason:'Mağaza bildirimi'},buyer.token)).status,202);
  await call('/blocks',{userId:seller.user.id,block:false},buyer.token);
  assert.equal((await call(`/conversations/${c.id}/messages`,{body:'after unblock',requestKey:randomUUID()},seller.token)).status,200);
  const actor=await db.prepare('SELECT id FROM feed_actors WHERE user_id=?').get(buyer.user.id);
  await db.prepare('INSERT INTO shop_follows(actor_id,seller_id) VALUES (?,?)').run(actor.id,seller.user.id);
  await notifyFollowers(db,product);await notifyFollowers(db,product);
  const products=(await call('/notifications',null,buyer.token)).items.filter(n=>n.kind==='product');assert.equal(products.length,1);
  assert.deepEqual((await call('/notifications',null,other.token)).items,[]);
  for(let i=0;i<35;i++)await notify(db,{userId:other.user.id,eventKey:`page:${i}`,kind:'shipping',title:'Test',route:'/profile'});
  const page1=await call('/notifications',null,other.token),page2=await call(`/notifications?before=${page1.nextCursor}`,null,other.token);
  assert.equal(page1.items.length,30);assert.equal(page2.items.length,5);assert.equal(new Set([...page1.items,...page2.items].map(n=>n.id)).size,35);
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});

test('multi-shop shipping changes only selected shipment and preserves historical single-shop tracking',async()=>{
 const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',demo:true});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try {
  const a=await call('/auth/register',{name:'Test Buyer',email:'multi@shipping.invalid',password:'test-password'});await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?)').run(a.user.id);
  const products=(await db.query('SELECT DISTINCT ON(seller_id) data FROM products ORDER BY seller_id')).rows.slice(0,2).map(r=>JSON.parse(r.data));
  const order=(await call('/checkout',{name:'Test Buyer',address:'Demo shipping address',demoAcknowledged:true,requestKey:randomUUID(),items:products.map(p=>({productId:p.id,size:p.sizes[0],quantity:1}))},a.token)).order;
  const row=(await call('/orders',null,a.token)).orders[0];assert.equal(row.shipments.length,2);
  const [one,two]=row.shipments;const data={status:'shipped',carrier:'Test',trackingNumber:'TEST-1',version:0};
  assert.equal((await call(`/admin/orders/${order.id}/shipping`,data,a.token)).status,409);
  assert.equal((await call(`/admin/orders/${order.id}/shipments/${one.id}`,data,a.token)).status,200);
  const updated=(await call('/orders',null,a.token)).orders[0];assert.equal(updated.shipments.find(s=>s.id===one.id).status,'shipped');assert.equal(updated.shipments.find(s=>s.id===two.id).status,'preparing');
  assert.equal((await call('/notifications',null,a.token)).items.filter(n=>n.kind==='shipping').length,1);
  const legacy={...order,id:'legacy-single',items:[order.items[0]]};
  await db.prepare('INSERT INTO orders VALUES (?,?,?,?)').run(legacy.id,a.user.id,'legacy',JSON.stringify(legacy));
  await db.prepare('INSERT INTO order_shipping(order_id,status,carrier,tracking_number,version) VALUES (?,?,?,?,?)').run(legacy.id,'delivered','Legacy Carrier','OLD-123',4);
  // Run the migration backfill on historical fixtures, leaving existing shipments intact.
  const sql=await readFile(new URL('../server/migrations/009_safety_notifications_shipments.sql',import.meta.url),'utf8');
  await db.exec(sql.slice(sql.indexOf('WITH grouped'),sql.indexOf('REVOKE ALL')).trim().replace(/;$/,' ON CONFLICT DO NOTHING;'));
  const migrated=(await call('/orders',null,a.token)).orders.find(o=>o.id===legacy.id).shipments[0];
  assert.equal(migrated.status,'delivered');assert.equal(migrated.version,4);assert.equal(migrated.trackingNumber,'OLD-123');
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app.mjs';

test('shipping is admin-only, buyer-private, versioned and audited without changing payment',async()=>{
  const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',demo:true});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  async function call(route,body,token) {const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
  try {
    const accounts=await Promise.all(['admin','buyer','other'].map(name=>call('/auth/register',{name:`${name} Test`,email:`${name}@shipping.invalid`,password:'test-password'})));
    const [admin,buyer,other]=accounts;
    await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?)').run(admin.user.id);
    const order=await call('/checkout',{requestKey:randomUUID(),demoAcknowledged:true,address:'Test shipping address',name:'Buyer',items:[{productId:'soft-knit',size:'S',quantity:1}]},buyer.token);
    assert.equal(order.status,201);
    const id=order.order.id,route=`/admin/orders/${id}/shipping`;
    const original=await db.prepare('SELECT data FROM orders WHERE id=?').get(id);
    assert.equal((await call('/orders',null,buyer.token)).orders[0].shipping.status,'preparing');
    const data={status:'shipped',carrier:'Test Kargo',trackingNumber:'TEST-123',version:0};
    assert.equal((await call(route,data)).status,401);
    assert.equal((await call(route,data,buyer.token)).status,403);
    assert.equal((await call(route,{...data,status:'invalid'},admin.token)).status,400);
    assert.equal((await call(route,{...data,trackingNumber:''},admin.token)).status,400);
    assert.equal((await call('/admin/orders/missing/shipping',data,admin.token)).status,404);
    const results=await Promise.all([1,2].map(()=>call(route,data,admin.token)));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const shipping=(await call('/orders',null,buyer.token)).orders[0].shipping;
    assert.equal(shipping.status,'shipped');assert.equal(shipping.trackingNumber,'TEST-123');assert.equal(shipping.version,1);assert.ok(shipping.updatedAt);
    assert.deepEqual((await call('/orders',null,other.token)).orders,[]);
    assert.equal((await call('/admin/list/orders',null,admin.token)).items[0].shipping.carrier,'Test Kargo');
    assert.equal((await call(route,{...data,status:'delivered',version:1},admin.token)).status,200);
    assert.equal((await call('/orders',null,buyer.token)).orders[0].shipping.status,'delivered');
    assert.equal((await db.prepare('SELECT data FROM orders WHERE id=?').get(id)).data,original.data);
    const audits=(await call('/admin/list/audit',null,admin.token)).items;
    assert.equal(audits.length,2);assert.ok(audits.every(a=>a.title==='order:shipping'));
  } finally {await new Promise(resolve=>server.close(resolve));await db.close();}
});

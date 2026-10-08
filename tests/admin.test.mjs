import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
test('admin authorization, moderation, checkout exclusion, session revocation and audit',async()=>{
 const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',demo:true});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try {
  const admin=await call('/auth/register',{name:'Admin',email:'admin@example.com',password:'test-password'});
  const buyer=await call('/auth/register',{name:'Buyer',email:'buyer@example.com',password:'test-password'});
  assert.equal((await call('/admin/overview')).status,401);
  assert.equal((await call('/admin/overview',null,admin.token)).status,403);
  await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?)').run(admin.user.id);
  assert.equal((await call('/admin/overview',null,admin.token)).status,200);
  for(const kind of ['users','shops','products','orders','jobs','audit'])assert.equal((await call('/admin/list/'+kind,null,admin.token)).status,200,kind);
  assert.equal((await call('/admin/list/users?page=-1',null,admin.token)).status,400);
  const listing=await call('/admin/list/users',null,admin.token);assert.ok(!JSON.stringify(listing).includes('password'));
  const cmd={kind:'product',id:'soft-knit',disabled:true,reason:'Test moderation'};
  assert.equal((await call('/admin/moderate',cmd,buyer.token)).status,403);
  assert.equal((await call('/admin/moderate',{...cmd,reason:''},admin.token)).status,400);
  assert.equal((await call('/admin/moderate',cmd,admin.token)).status,200);
  assert.ok(!(await call('/products')).products.some(p=>p.id==='soft-knit'));
  assert.equal((await call('/checkout',{requestKey:randomUUID(),demoAcknowledged:true,address:'Test address for demo only',name:'Buyer',items:[{productId:'soft-knit',size:'S',quantity:1}]},buyer.token)).status,400);
  assert.equal((await call('/admin/moderate',{...cmd,disabled:false},admin.token)).status,200);
  assert.ok((await call('/products')).products.some(p=>p.id==='soft-knit'));
  assert.equal((await call('/admin/moderate',{kind:'user',id:admin.user.id,disabled:true,reason:'Test'},admin.token)).status,409);
  assert.equal((await call('/admin/moderate',{kind:'user',id:buyer.user.id,disabled:true,reason:'Test'},admin.token)).status,200);
  assert.equal((await call('/me',null,buyer.token)).status,401);
  assert.equal((await call('/auth/login',{email:'buyer@example.com',password:'test-password'})).status,403);
  assert.equal((await call('/admin/moderate',{kind:'user',id:'studio-m',disabled:true,reason:'Test'},admin.token)).status,200);
  assert.ok(!(await call('/products')).products.some(p=>p.sellerId==='studio-m'));
  const audits=await call('/admin/list/audit',null,admin.token);assert.equal(audits.items.length,4);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});

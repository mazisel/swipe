import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.mjs';

test('admin creates independent shops and publishes owned media without seller impersonation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'swipe-catalog-'));
 const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',uploadDir:dir,demo:true});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 async function upload(id,token){const form=new FormData();form.append('file',new Blob([Buffer.from([137,80,78,71,13,10,26,10,0,0])],{type:'image/png'}),'test.png');const r=await fetch(`${base}/admin/shops/${id}/uploads`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});return {status:r.status,...await r.json()};}
 try{
 const admin=await call('/auth/register',{name:'Admin Test',email:'admin@catalog.invalid',password:'test-password'});
 const buyer=await call('/auth/register',{name:'Buyer Test',email:'buyer@catalog.invalid',password:'test-password'});
 await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?)').run(admin.user.id);
 assert.equal((await call('/admin/shops',{name:'Denied'},buyer.token)).status,403);
 assert.equal((await call('/admin/shops',{name:'Denied'})).status,401);
 const a=await call('/admin/shops',{name:'First Shop',bio:'Studio collection'},admin.token);
 const b=await call('/admin/shops',{name:'Second Shop'},admin.token);
 assert.equal(a.status,201);assert.equal(b.status,201);assert.notEqual(a.shop.id,b.shop.id);
 assert.equal((await call('/me',null,admin.token)).user.shop,null);
 assert.equal((await call(`/shops/${a.shop.id}`)).shop.bio,'Studio collection');
 assert.equal((await upload(a.shop.id,buyer.token)).status,403);
 assert.equal((await upload('missing',admin.token)).status,404);
 const asset=await upload(a.shop.id,admin.token);assert.equal(asset.status,201);
 const row=await db.prepare('SELECT * FROM uploads WHERE url=?').get(asset.url);assert.equal(row.user_id,a.shop.id);
 const data={title:'Admin Product',description:'New collection product.',price:129990,category:'Giyim',gallery:[asset.url],sizes:['S','M'],stock:4,color:'Ekru'};
 assert.equal((await call(`/admin/shops/${a.shop.id}/products`,data,buyer.token)).status,403);
 assert.equal((await call(`/admin/shops/${b.shop.id}/products`,data,admin.token)).status,400);
 assert.equal((await call('/products',data,admin.token)).status,403);
 const result=await call(`/admin/shops/${a.shop.id}/products`,data,admin.token);assert.equal(result.status,201);assert.equal(result.product.sellerId,a.shop.id);assert.equal(result.product.shop,'First Shop');
 assert.ok((await call('/products')).products.some(p=>p.id===result.product.id));
 assert.ok(await db.prepare('SELECT 1 FROM ai_jobs WHERE product_id=?').get(result.product.id));
 assert.equal((await db.prepare("SELECT count(*) AS n FROM admin_audit WHERE admin_id=? AND action IN ('shop:create','product:create')").get(admin.user.id)).n,3);
 await call('/admin/moderate',{kind:'user',id:a.shop.id,disabled:true,reason:'Test suspension'},admin.token);
 assert.equal((await upload(a.shop.id,admin.token)).status,409);
 assert.equal((await call(`/admin/shops/${a.shop.id}/products`,data,admin.token)).status,409);
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();await rm(dir,{recursive:true,force:true});}
});

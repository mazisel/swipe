import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { seedProducts } from '../server/seed.mjs';
import { rankProducts, buildProfile, selectPage, explainCandidate } from '../server/discovery/ranking.mjs';
import { ViewingClock } from '../shared/viewing.ts';
const dir=await mkdtemp(join(tmpdir(),'swipe-feed-test-'));
const {app,db}=await createApp({dbPath:':memory:',uploadDir:dir,demo:true});
let server,base,guest,other,page,buyer;
async function call(route,body,identity=guest,auth) {
 const r=await fetch(`${base}/api${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(identity?.token?{'X-Feed-Token':identity.token}:{}),...(auth?{Authorization:`Bearer ${auth}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,...await r.json()};
}
const event=(kind,extra={})=>({id:randomUUID(),productId:'soft-knit',kind,...extra});
before(async()=>{
 server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});base=`http://127.0.0.1:${server.address().port}`;
 guest=await call('/feed/identity',{},null);other=await call('/feed/identity',{},null);
 for(let i=0;i<60;i++) {const p={...seedProducts[i%5],id:`fixture-${i}`,createdAt:new Date().toISOString()};await db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(p.id,p.sellerId,JSON.stringify(p),p.stock);}
});
after(async()=>{await new Promise(r=>server.close(r));await db.close();await rm(dir,{recursive:true});});
test('anonymous identity persists without exposing tokens from database',async()=>{
 assert.equal(guest.status,201);assert.notEqual(guest.actorId,other.actorId);
 const same=await call('/feed/identity',{});assert.equal(same.actorId,guest.actorId);assert.equal(same.token,undefined);
 const row=await db.prepare('SELECT * FROM feed_actors WHERE id=?').get(guest.actorId);assert.notEqual(row.token_hash,guest.token);
 assert.equal((await call('/feed',undefined,null)).status,401);
});
test('cursor pages are owned, stable on retries, diverse and never repeat',async()=>{
 page=await call('/feed');assert.equal(page.status,200);assert.equal(page.items.length,20);assert.ok(page.nextCursor);
 assert.equal(new Set(page.items.map(p=>p.id)).size,20);
 for(let i=1;i<page.items.length;i++)assert.notEqual(page.items[i].sellerId,page.items[i-1].sellerId);
 const second=await call(`/feed?cursor=${page.nextCursor}`);const retry=await call(`/feed?cursor=${page.nextCursor}`);
 assert.deepEqual(second.items.map(p=>p.id),retry.items.map(p=>p.id));assert.equal(second.nextCursor,retry.nextCursor);
 assert.ok(!second.items.some(p=>page.items.some(q=>q.id===p.id)));
 assert.equal((await call(`/feed?cursor=${page.nextCursor}`,undefined,other)).status,409);
 assert.equal((await call('/feed?cursor=bad')).status,400);
 let all=[...page.items,...second.items],next=second.nextCursor;
 while(next){const p=await call(`/feed?cursor=${next}`);all.push(...p.items);next=p.nextCursor;}
 assert.equal(all.length,60+seedProducts.length);assert.equal(new Set(all.map(p=>p.id)).size,60+seedProducts.length);
});
test('events are idempotent, daily bounded, use server identity and reject purchases/DM text',async()=>{
 const data={generation:1,events:[event('cart')]};
 assert.equal((await call('/feed/events',data)).status,200);await call('/feed/events',data);
 await call('/feed/events',{generation:1,events:[event('cart')]});
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=? AND kind='cart'").get(guest.actorId)).n,1);
 assert.equal((await call('/feed/events',{generation:1,userId:other.actorId,events:[]})).status,400);
 assert.equal((await call('/feed/events',{generation:1,events:[event('purchase')]})).status,400);
 assert.equal((await call('/feed/events',{generation:1,events:[event('detail',{body:'Private message'})]})).status,400);
});
test('only served impressions count; duration is capped and pause is not a skip',async()=>{
 const productId=page.items[0].id,impressionId=randomUUID(),sessionId=page.sessionId;
 const send=events=>call('/feed/events',{generation:1,events});
 await send([event('view',{productId,impressionId,sessionId})]);
 await db.prepare("UPDATE feed_impressions SET created_at=now()-interval '5 seconds' WHERE id=?").run(impressionId);
 await send([event('progress',{productId,impressionId,sessionId,durationMs:120000,completion:.5})]);
 const imp=await db.prepare('SELECT * FROM feed_impressions WHERE id=?').get(impressionId);assert.ok(imp.duration_ms<8000);assert.equal(imp.qualified,true);
 const paused=randomUUID();await send([event('view',{productId,impressionId:paused,sessionId}),event('finish',{productId,impressionId:paused,sessionId,durationMs:500,endReason:'pause'})]);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=? AND product_id=? AND kind='skip'").get(guest.actorId,productId)).n,0);
 const skipped=randomUUID();await send([event('view',{productId,impressionId:skipped,sessionId}),event('finish',{productId,impressionId:skipped,sessionId,durationMs:500,endReason:'swipe'})]);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=? AND product_id=? AND kind='skip'").get(guest.actorId,productId)).n,1);
 const forged=randomUUID();await send([event('view',{productId,impressionId:forged,sessionId:randomUUID()})]);assert.equal(await db.prepare('SELECT * FROM feed_impressions WHERE id=?').get(forged),undefined);
});
test('hide and stock filtering apply even to a cached page',async()=>{
 const second=await call(`/feed?cursor=${page.nextCursor}`),id=second.items[0].id;
 assert.equal((await call('/feed/preferences',{kind:'product',targetId:id})).status,200);
 await db.prepare('UPDATE products SET stock=0 WHERE id=?').run(second.items[1].id);
 const retry=await call(`/feed?cursor=${page.nextCursor}`);assert.ok(retry.items.every(p=>p.id!==id && p.stock>0));
 const seller=second.items[2].sellerId;await call('/feed/preferences',{kind:'seller',targetId:seller});
 assert.ok((await call('/feed')).items.every(p=>p.sellerId!==seller && p.id!==id));
});
test('reset invalidates stale queued events and cursors and clears hidden preferences',async()=>{
 const reset=await call('/feed/reset',{});assert.equal(reset.generation,2);
 assert.equal((await call('/feed/events',{generation:1,events:[event('save')]})).status,409);
 assert.equal((await call(`/feed?cursor=${page.nextCursor}`)).status,409);
 for(const table of ['feed_events','feed_preferences','feed_profiles'])assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE actor_id=?`).get(guest.actorId)).n,0);
 guest.generation=2;await call('/feed/events',{generation:2,events:[event('save')]});
});
test('login merges anonymous history once; consumed token cannot read account history',async()=>{
 buyer=await call('/auth/register',{email:'feed@example.invalid',name:'Feed Buyer',password:'local-password-123'},null);
 const identity=await call('/feed/identity',{},guest,buyer.token);assert.notEqual(identity.actorId,guest.actorId);
 await call('/feed/identity',{},guest,buyer.token);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=? AND kind='save'").get(identity.actorId)).n,1);
 assert.equal((await call('/feed',undefined,guest)).status,401);
 const afterLogout=await call('/feed/identity',{},guest);assert.notEqual(afterLogout.actorId,guest.actorId);assert.notEqual(afterLogout.actorId,identity.actorId);
 assert.equal((await call('/feed/events',{generation:2,events:[event('cart')]},guest,buyer.token)).status,409);
 const before=(await db.prepare('SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=?').get(identity.actorId)).n;
 await call('/checkout',{requestKey:randomUUID(),demoAcknowledged:true,name:'Feed Buyer',address:'Örnek adres Kadıköy İstanbul',items:[{productId:'soft-knit',size:'M',quantity:1}]},null,buyer.token);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=?').get(identity.actorId)).n,before);
});
test('different interests produce different recommendations and old signals decay',()=>{
 const products=Array.from({length:40},(_,i)=>({...seedProducts[i%2],id:`rank-${i}`,sellerId:`shop-${i%10}`,createdAt:new Date().toISOString()}));
 const events=id=>[{product_id:id,weight:6,created_at:new Date().toISOString()}];
 const a=buildProfile(events('rank-0'),products,new Map()),b=buildProfile(events('rank-1'),products,new Map());
 const choose=profile=>selectPage(rankProducts({products,profile,seed:'fixed'}));
 assert.equal(choose(a)[0].category,products[0].category);assert.equal(choose(b)[0].category,products[1].category);
 const old=buildProfile([{...events('rank-0')[0],created_at:new Date(Date.now()-7*86400000).toISOString()}],products,new Map());assert.ok(Math.abs(old.mass-3)<.01);
 assert.ok(choose(a).slice(0,10).every(p=>choose(a).slice(0,10).filter(x=>x.sellerId===p.sellerId).length<=3));
});
test('viewing clock excludes pauses, buffering, seeks, hidden time and caps loops',()=>{
 const photo=new ViewingClock();photo.sample(0,true);photo.sample(500,true);photo.sample(1000,false);photo.sample(10000,true);photo.sample(10500,true);assert.equal(photo.durationMs,1000);
 const video=new ViewingClock();video.sample(0,true,0,10);video.sample(500,true,.5,10);video.sample(1000,true,.5,10);video.sample(1500,true,8,10);assert.equal(video.durationMs,500);assert.equal(video.completion,.05);
 video.sample(2000,false,8,10);video.sample(10000,true,8,10);assert.equal(video.durationMs,500);
 const loop=new ViewingClock();for(let i=0;i<100;i++)loop.sample(i*500,true,(i*.5)%2,2);assert.ok(loop.durationMs<=4000);assert.equal(loop.loops,2);
});

test('following is private, idempotent, validated and survives discovery reset', async () => {
 const a=await call('/feed/identity',{},null), b=await call('/feed/identity',{},null);
 assert.equal((await call('/following',{sellerId:'studio-m',following:true},null)).status,401);
 assert.equal((await call('/following',{sellerId:'missing',following:true},a)).status,404);
 assert.equal((await call('/following',{sellerId:'studio-m',following:true,actorId:b.actorId},a)).status,400);
 const results=await Promise.all([call('/following',{sellerId:'studio-m',following:true},a),call('/following',{sellerId:'studio-m',following:true},a)]);
 assert.ok(results.every(r=>r.status===200));
 assert.equal((await call('/following',undefined,a)).shops.length,1);
 assert.equal((await call('/following',undefined,b)).shops.length,0);
 await call('/feed/reset',{},a);
 assert.equal((await call('/following',undefined,a)).shops[0].id,'studio-m');
 await call('/feed/preferences',{kind:'seller',targetId:'studio-m'},a);
 assert.ok((await call('/feed',undefined,a)).items.every(p=>p.sellerId!=='studio-m'));
 await call('/following',{sellerId:'studio-m',following:false},a);
 await call('/following',{sellerId:'studio-m',following:false},a);
 assert.equal((await call('/following',undefined,a)).shops.length,0);
});
test('guest follows merge exactly once and logout cannot expose account follows',async()=>{
 const a=await call('/feed/identity',{},null);
 await call('/following',{sellerId:'form-atelier',following:true},a);
 const account=await call('/auth/register',{email:'follow@example.invalid',name:'Follow Test',password:'local-password-123'},null);
 await call('/feed/identity',{},a,account.token);await call('/feed/identity',{},a,account.token);
 assert.equal((await call('/following',undefined,null,account.token)).shops.length,1);
 assert.equal((await call('/following',undefined,a)).status,401);
 const fresh=await call('/feed/identity',{},a);assert.equal((await call('/following',undefined,fresh)).shops.length,0);
 await call('/shop',{name:'Follow Test Shop'},null,account.token);
 assert.equal((await call('/following',{sellerId:account.user.id,following:true},null,account.token)).status,400);
});
test('feed explanations persist with pages and do not leak across identities',async()=>{
 const a=await call('/feed/identity',{},null),b=await call('/feed/identity',{},null);
 await call('/following',{sellerId:'studio-m',following:true},a);
 const first=await call('/feed',undefined,a), second=await call(`/feed?cursor=${first.nextCursor}`,undefined,a);
 assert.deepEqual(Object.keys(first.reasons).sort(),first.items.map(p=>p.id).sort());
 assert.ok(first.items.some(p=>first.reasons[p.id].code==='following'));
 await call('/following',{sellerId:'studio-m',following:false},a);
 const retry=await call(`/feed?cursor=${first.nextCursor}`,undefined,a);
 assert.deepEqual(second.reasons,retry.reasons);
 assert.equal((await call(`/feed?cursor=${first.nextCursor}`,undefined,b)).status,409);
});
test('follow boost retains variety, rollback ignores it, explanations have evidence',()=>{
 const products=seedProducts.map(p=>({...p,createdAt:new Date().toISOString()}));
 const followed=new Set(['studio-m']);
 const base=rankProducts({products,seed:'fixed'}), ranked=rankProducts({products,seed:'fixed',followed});
 const ordinary=base.find(c=>c.product.sellerId==='studio-m'), boosted=ranked.find(c=>c.product.id===ordinary.product.id);
 assert.ok(boosted.score>ordinary.score);
 assert.equal(explainCandidate(boosted,'personal').code,'following');
 assert.equal(explainCandidate(boosted,'explore').code,'explore');
 assert.notEqual(explainCandidate(boosted,'trend').code,'trend');
 const now=Date.now();
 const balanced=rankProducts({products,seed:'fixed',followed,personalized:false,now});
 assert.deepEqual(balanced.map(p=>p.score),rankProducts({products,seed:'fixed',personalized:false,now}).map(p=>p.score));
 assert.equal(explainCandidate(balanced[0],'personal').code,'balanced');
 const selected=selectPage(ranked);for(let i=1;i<10;i++)assert.notEqual(selected[i].sellerId,selected[i-1].sellerId);
 const profile=buildProfile([{product_id:'soft-knit',weight:6,created_at:new Date().toISOString()}],products,new Map());
 const interest=rankProducts({products,seed:'fixed',profile}).find(p=>p.product.id==='soft-knit');
 assert.equal(explainCandidate(interest,'personal').code,'category');
});

test('likes are private per identity; public totals are real and duplicate writes are idempotent',async()=>{
 const a=await call('/feed/identity',{},null),b=await call('/feed/identity',{},null), productId='everyday-bag';
 assert.equal((await call('/likes',undefined,null)).status,401);
 assert.equal((await call('/likes',{productId,liked:true,actorId:b.actorId},a)).status,400);
 assert.equal((await call('/likes',{productId:'missing',liked:true},a)).status,404);
 const baseline=(await call('/products',undefined,null)).products.find(p=>p.id===productId).likeCount;
 const attempts=await Promise.all([call('/likes',{productId,liked:true},a),call('/likes',{productId,liked:true},a)]);
 assert.ok(attempts.every(r=>r.likeCount===baseline+1));
 assert.deepEqual((await call('/likes',undefined,a)).ids,[productId]);
 assert.deepEqual((await call('/likes',undefined,b)).ids,[]);
 assert.equal((await call('/likes',{productId,liked:true},b)).likeCount,baseline+2);
 assert.equal((await call('/products',undefined,null)).products.find(p=>p.id===productId).likeCount,baseline+2);
 const catalogue=(await call('/products',undefined,null)).products;
 assert.ok((await call('/feed',undefined,a)).items.every(p=>p.likeCount===catalogue.find(q=>q.id===p.id).likeCount));
 assert.equal((await call('/likes',{productId,liked:false},a)).likeCount,baseline+1);
 assert.equal((await call('/likes',{productId,liked:false},a)).likeCount,baseline+1);
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM feed_events WHERE actor_id=? AND product_id=? AND kind='save'").get(a.actorId,productId)).n,0);
 await call('/feed/reset',{},b);
 assert.ok((await call('/likes',undefined,b)).ids.includes(productId));
});
test('legacy saved import is bounded, replay safe after unlike and cannot migrate to another identity',async()=>{
 const a=await call('/feed/identity',{},null),b=await call('/feed/identity',{},null),importId=randomUUID();
 const body={importId,ids:['soft-knit','soft-knit','gold-detail','missing']};
 const first=await call('/likes/import',body,a);assert.equal(first.status,200);assert.equal(first.ids.length,2);
 await call('/likes/import',body,a);assert.equal((await call('/likes',undefined,a)).ids.length,2);
 await call('/likes',{productId:'soft-knit',liked:false},a);
 await call('/likes/import',body,a);assert.ok(!(await call('/likes',undefined,a)).ids.includes('soft-knit'));
 assert.equal((await call('/likes/import',body,b)).ids.length,0);
 assert.equal((await call('/likes/import',{importId:randomUUID(),ids:Array(1001).fill('soft-knit')},a)).status,400);
});
test('guest and account likes merge without double counting; consumed tokens and logout stay isolated',async()=>{
 const a=await call('/feed/identity',{},null),productId='slow-sound';
 const account=await call('/auth/register',{email:'likes@example.invalid',name:'Likes Test',password:'local-password-123'},null);
 const baseline=(await call('/products',undefined,null)).products.find(p=>p.id===productId).likeCount;
 await call('/likes',{productId,liked:true},a);
 await call('/likes',{productId,liked:true},null,account.token);
 assert.equal((await call('/products',undefined,null)).products.find(p=>p.id===productId).likeCount,baseline+2);
 await call('/feed/identity',{},a,account.token);await call('/feed/identity',{},a,account.token);
 const result=await call('/likes',undefined,null,account.token);
 assert.equal(result.ids.filter(id=>id===productId).length,1);assert.equal(result.counts[productId],baseline+1);
 assert.equal((await call('/likes',undefined,a)).status,401);
 const fresh=await call('/feed/identity',{},a);assert.deepEqual((await call('/likes',undefined,fresh)).ids,[]);
});

test('adaptive pages keep six-item cursors stable and incorporate new signals within the same session',async()=>{
 const a=await call('/feed/identity',{},null);
 assert.equal((await call('/feed?pageSize=7',undefined,a)).status,400);
 const first=await call('/feed?pageSize=6',undefined,a);
 assert.equal(first.items.length,6);assert.equal(first.pageSize,6);
 const productId=first.items[0].id;
 await call('/feed/events',{generation:1,events:[{id:randomUUID(),productId,kind:'cart',sessionId:first.sessionId}]},a);
 // Changing the query cannot enlarge an existing session or invalidate retries.
 const second=await call(`/feed?cursor=${first.nextCursor}&pageSize=20`,undefined,a);
 assert.equal(second.items.length,6);assert.equal(second.pageSize,6);assert.equal(second.sessionId,first.sessionId);
 const profile=await db.prepare('SELECT affinities FROM feed_profiles WHERE actor_id=?').get(a.actorId);
 assert.ok(profile.affinities[`category:${first.items[0].category}`]>0);
 await call('/feed/events',{generation:1,events:[{id:randomUUID(),productId:second.items[0].id,kind:'cart',sessionId:first.sessionId}]},a);
 const retry=await call(`/feed?cursor=${first.nextCursor}`,undefined,a);
 assert.deepEqual(retry.items.map(p=>p.id),second.items.map(p=>p.id));assert.deepEqual(retry.reasons,second.reasons);
 const third=await call(`/feed?cursor=${second.nextCursor}`,undefined,a);
 assert.equal(new Set([...first.items,...second.items,...third.items].map(p=>p.id)).size,18);
 const updated=await db.prepare('SELECT affinities FROM feed_profiles WHERE actor_id=?').get(a.actorId);
 assert.ok(updated.affinities[`category:${second.items[0].category}`]>0);
});

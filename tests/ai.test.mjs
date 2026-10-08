import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { openDatabase } from '../server/db.mjs';
import { enqueueAnalysis,reserveBudget,settleBudget,runAnalysisJob,RESERVATION_MICROS,createGeminiProvider } from '../server/discovery/ai.mjs';
import { seedProducts } from '../server/seed.mjs';
const db=await openDatabase({dataDir:':memory:'});after(()=>db.close());
const buffer=Buffer.from('owned-product-media'),hash=createHash('sha256').update(buffer).digest('hex');
await db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run('seller','ai@example.invalid','Seller','disabled','AI Store');
await db.prepare('INSERT INTO uploads VALUES (?,?,?)').run('/uploads/test.jpg','seller','image');
await db.prepare('INSERT INTO media_assets VALUES (?,?,?,?)').run('/uploads/test.jpg',hash,'image/jpeg',buffer.length);
const storage={read:async()=>({buffer,mime:'image/jpeg'})};
const features={productType:'Triko',styles:['minimal'],colors:['ekru'],contexts:['günlük'],description:'Ekru örgü üst.'};
const vector=Array.from({length:768},(_,i)=>i===0?1:0);
async function product(id,title='Triko'){const p={...seedProducts[0],id,sellerId:'seller',title,media:'/uploads/test.jpg'};await db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(p.id,p.sellerId,JSON.stringify(p),10);await enqueueAnalysis(db,p);return p;}
test('25 USD admission is atomic across concurrent reservations, retry settlement is safe',async()=>{
 const month='2099-01',results=await Promise.all(Array.from({length:50},()=>reserveBudget(db,null,{month})));
 const allowed=results.filter(Boolean);assert.equal(allowed.length,41);
 const b=await db.prepare('SELECT * FROM ai_budgets WHERE month=?').get(month);assert.ok(b.reserved_micros<=25000000);
 await settleBudget(db,allowed[0],1000);await settleBudget(db,allowed[0],1000);
 const updated=await db.prepare('SELECT * FROM ai_budgets WHERE month=?').get(month);assert.equal(updated.spent_micros,1000);assert.equal(updated.reserved_micros,40*RESERVATION_MICROS);
 await assert.rejects(()=>settleBudget(db,allowed[1],RESERVATION_MICROS+1));
});
test('missing keys make no provider calls; owned media analyses persist real pgvector values',async()=>{
 await product('ai-one');assert.equal((await runAnalysisJob(db,{provider:{configured:false}})).status,'unconfigured');
 let calls=0;const provider={configured:true,analyze:async()=>{calls++;return {features,embedding:vector,actualMicros:1000};}};
 assert.equal((await runAnalysisJob(db,{provider,storage})).status,'done');assert.equal(calls,1);
 const row=await db.prepare('SELECT status,vector_dims(embedding) AS dimensions FROM product_features WHERE product_id=?').get('ai-one');assert.deepEqual(row,{status:'ready',dimensions:768});
 await product('ai-two');assert.equal((await runAnalysisJob(db,{provider,storage})).status,'done');assert.equal(calls,1,'same media + metadata must hit cache');
 await enqueueAnalysis(db,JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get('ai-two')).data));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM ai_jobs WHERE product_id=?').get('ai-two')).n,1);
});
test('budget exhaustion pauses queued analysis without calling AI',async()=>{
 await product('ai-budget','Farklı ürün');let called=false;
 const result=await runAnalysisJob(db,{limitUsd:0,storage,provider:{configured:true,analyze:async()=>{called=true;}}});assert.equal(result.status,'budget_wait');assert.equal(called,false);
});
test('malformed output and timeouts retain reservations and retry at most three times',async()=>{
 await product('ai-failure','Başka ürün');
 const provider={configured:true,analyze:async()=>({features:{privateBody:'invalid'},embedding:vector,actualMicros:10})};
 for(let i=0;i<3;i++){const result=await runAnalysisJob(db,{provider,storage});assert.equal(result.status,'failed');assert.equal(result.reservationRetained,true);await db.prepare('UPDATE ai_jobs SET next_attempt=now() WHERE product_id=?').run('ai-failure');}
 assert.equal((await db.prepare('SELECT status,attempts FROM ai_jobs WHERE product_id=?').get('ai-failure')).status,'failed');
 const pending=await db.prepare("SELECT COUNT(*) AS n FROM ai_charges WHERE job_id=(SELECT id FROM ai_jobs WHERE product_id=?) AND status='reserved'").get('ai-failure');assert.equal(pending.n,3);
 await product('ai-timeout','Zaman aşımı');const result=await runAnalysisJob(db,{storage,provider:{configured:true,analyze:async()=>{throw new Error('request timed out');}}});assert.equal(result.status,'failed');assert.equal(result.reservationRetained,true);
});
test('Gemini adapter sends only product context, validates embedding, accounts usage',async()=>{
 const calls=[];const request=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,json:async()=>url.includes('embedContent')?{embedding:{values:vector}}:{candidates:[{content:{parts:[{text:JSON.stringify(features)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:100,thoughtsTokenCount:20}}};};
 const result=await createGeminiProvider({key:'test-only',request}).analyze({...seedProducts[0],userEmail:'must-not-send',dm:'private'}, {buffer,mime:'image/jpeg'});
 assert.equal(result.embedding.length,768);assert.equal(calls.length,2);assert.ok(!JSON.stringify(calls).includes('must-not-send'));assert.ok(!JSON.stringify(calls).includes('"dm"'));assert.equal(result.actualMicros,1844);
});

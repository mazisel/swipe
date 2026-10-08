import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProfile,rankProducts,selectPage,explainCandidate,DAY} from '../server/discovery/ranking.mjs';
const now=Date.UTC(2026,9,9);
const products=Array.from({length:80},(_,i)=>({id:`p${i}`,sellerId:`s${i%10}`,title:i%2?'Gümüş takı':'Pamuk gömlek',category:i%2?'Aksesuar':'Giyim',color:i%2?'Gümüş':'Beyaz',price:10000,createdAt:new Date(now).toISOString()}));
const features=new Map();
const signal=(i,weight=6,age=0)=>({product_id:`p${i}`,weight,created_at:new Date(now-age).toISOString()});

test('recent shopping intent changes ranking despite a larger historical interest; one skip stays weak',()=>{
 const old=Array.from({length:25},(_,i)=>signal(i*2,6,DAY));
 const fresh=[signal(1),signal(3)];
 const profile=buildProfile([...old,...fresh],products,features,now);
 const recentProfile=buildProfile(fresh,products,features,now);
 const candidates=products.slice(50);
 const rank=recent=>rankProducts({products:candidates,profile,recentProfile:recent,seed:'stable',now}).sort((a,b)=>b.score-a.score);
 assert.equal(rank(undefined)[0].product.category,'Giyim');
 assert.equal(rank(recentProfile)[0].product.category,'Aksesuar');
 assert.equal(explainCandidate(rank(recentProfile)[0],'personal').code,'recent');
 assert.equal(rank(buildProfile([signal(0,-1)],products,features,now))[0].product.category,'Giyim');
});

test('six-item pages preserve the 14/4/2 exploration schedule and cross-page seller diversity',()=>{
 const ranked=rankProducts({products,seed:'stable',now});
 const history=[],modes=[];
 for(let page=0;page<4;page++)history.push(...selectPage(ranked,history,6,(_,mode)=>modes.push(mode)));
 assert.equal(new Set(history.map(p=>p.id)).size,24);
 assert.deepEqual(Object.fromEntries(['personal','explore','trend'].map(mode=>[mode,modes.slice(0,20).filter(m=>m===mode).length])),{personal:14,explore:4,trend:2});
 for(let i=1;i<history.length;i++){
  assert.notEqual(history[i-1].sellerId,history[i].sellerId);
  assert.ok(history.slice(Math.max(0,i-9),i+1).filter(p=>p.sellerId===history[i].sellerId).length<=3);
 }
});

test('recently watched products lose priority, recover with time, and rollback ignores personal history',()=>{
 const options={products,seed:'stable',now};
 const baseline=rankProducts(options)[0];
 const score=lastSeen=>rankProducts({...options,exposures:new Map([['p0',{count:3,lastSeen}]])})[0].score;
 assert.ok(score(new Date(now))<baseline.score);
 assert.ok(score(new Date(now-7*DAY))>score(new Date(now)));
 const common={...options,personalized:false};
 assert.deepEqual(rankProducts(common).map(p=>p.score),rankProducts({...common,exposures:new Map([['p0',{count:3,lastSeen:new Date(now)}]]),recentProfile:buildProfile([signal(1)],products,features,now)}).map(p=>p.score));
});

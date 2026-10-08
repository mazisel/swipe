import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.mjs';
import { createMailer } from '../server/mailer.mjs';

test('account recovery protects identity, token purpose, expiry, replay and session revocation',async()=>{
  const sent=[];
  const mailer={configured:true,send:async item=>{sent.push(item);}};
  const {app,db}=await createApp({databaseUrl:'',dbPath:':memory:',seed:false,accountSecurity:{mailer,responseDelay:0}});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const call=async(route,body,token)=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};};
  const email='recovery@example.invalid',password='old-password-123';
  try {
    const user=await call('/auth/register',{name:'Recovery Test',email,password});
    assert.equal((await call('/auth/email-status',null,user.token)).verified,false);
    assert.equal((await call('/auth/verify-email/request',{})).status,401);
    await call('/auth/verify-email/request',{},user.token);
    assert.equal(sent.length,1);
    const verification=sent[0].token;
    const rows=(await db.query('SELECT * FROM account_tokens')).rows;
    assert.equal(rows[0].hash,createHash('sha256').update(verification).digest('hex'));
    assert.ok(!JSON.stringify(rows).includes(verification));
    assert.equal((await call('/auth/reset-password',{token:verification,password:'new-password-123'})).status,400);
    assert.equal((await call('/auth/verify-email',{token:verification})).status,200);
    assert.equal((await call('/auth/verify-email',{token:verification})).status,400);
    assert.equal((await call('/auth/email-status',null,user.token)).verified,true);
    const missing=await call('/auth/forgot-password',{email:'missing@example.invalid'});
    const found=await call('/auth/forgot-password',{email});
    assert.deepEqual(missing,found);
    assert.equal(found.status,202);
    assert.equal(sent.length,2);
    const reset=sent[1].token;
    assert.equal((await call('/auth/verify-email',{token:reset})).status,400);
    await call('/auth/forgot-password',{email});
    assert.equal(sent.length,2,'per-account cooldown prevents repeated emails');
    assert.equal((await call('/auth/reset-password',{token:reset,password:'short'})).status,400);
    await db.query("UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE purpose='reset'");
    assert.equal((await call('/auth/reset-password',{token:reset,password:'new-password-123'})).status,400);
    await db.query("UPDATE account_tokens SET expires_at=now()+interval '1 minute' WHERE purpose='reset'");
    const results=await Promise.all([1,2].map(()=>call('/auth/reset-password',{token:reset,password:'new-password-123'})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
    assert.equal((await call('/me',null,user.token)).status,401);
    assert.equal((await call('/auth/login',{email,password})).status,401);
    assert.equal((await call('/auth/login',{email,password:'new-password-123'})).status,200);
    mailer.configured=false;
    assert.equal((await call('/auth/forgot-password',{email})).status,503);
  } finally { await new Promise(resolve=>server.close(resolve));await db.close(); }
});

test('Resend adapter uses trusted origin, fragments, plain text and idempotency',async()=>{
  let request;
  const mail=createMailer({key:'test-secret',from:'Swipe <hello@example.invalid>',origin:'https://swipe.example.invalid',fetcher:async(url,options)=>{request={url,options};return {ok:true};}});
  assert.equal(mail.configured,true);
  await mail.send({to:'buyer@example.invalid',purpose:'reset',token:'test-token',id:'test-id'});
  assert.equal(request.url,'https://api.resend.com/emails');
  assert.equal(request.options.headers['Idempotency-Key'],'test-id');
  const body=JSON.parse(request.options.body);
  assert.deepEqual(body.to,['buyer@example.invalid']);
  assert.ok(body.text.includes('https://swipe.example.invalid/account/reset-password#token=test-token'));
  assert.equal(body.html,undefined);
  assert.equal(createMailer({key:'k',from:'f',origin:'http://public.example.invalid'}).configured,false);
  assert.equal(createMailer({key:'k',from:'f',origin:'https://u:p@example.invalid'}).configured,false);
  assert.equal(createMailer({key:'k',from:'f',origin:'https://example.invalid/evil'}).configured,false);
});

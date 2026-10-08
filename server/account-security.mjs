import { createHash, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createMailer } from './mailer.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const derive=promisify(scrypt);
const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/,'Bağlantı geçersiz. E-postandaki bağlantıyı tekrar aç veya yeni bir bağlantı iste.');
const message='Bu adres uygun bir hesaba aitse şifre yenileme bağlantısı gönderilecek. Gelen kutunu ve spam klasörünü kontrol et.';
export function installAccountSecurity({app,db,auth,fail,input,mailer=createMailer(),responseDelay=11000}) {
  const limit=rateLimit({windowMs:15*60_000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Çok fazla deneme. Lütfen daha sonra tekrar dene.'}});
  const available=()=>{if(!mailer.configured)throw fail(503,'E-posta servisi henüz hazır değil. Lütfen daha sonra tekrar dene.');};
  async function issue(user,purpose) {
    const token=randomBytes(32).toString('hex'), digest=hash(token);
    const issued=await db.transaction(async()=>{
      const fresh=await db.prepare('SELECT * FROM users WHERE id=? FOR UPDATE').get(user.id);
      if(!fresh || fresh.email!==user.email || await db.prepare('SELECT 1 FROM account_moderation WHERE user_id=? AND suspended').get(user.id))return false;
      if(purpose==='verify' && await db.prepare('SELECT 1 FROM account_verifications WHERE user_id=? AND email=?').get(user.id,user.email))return false;
      const recent=await db.prepare("SELECT count(*) AS total, count(*) FILTER (WHERE created_at>now()-interval '60 seconds') AS cooldown FROM account_tokens WHERE user_id=? AND purpose=? AND created_at>now()-interval '1 day'").get(user.id,purpose);
      if(recent.cooldown>0 || recent.total>=5)return false;
      // Keep older links valid until one succeeds, to avoid invalidating delayed emails.
      await db.prepare("INSERT INTO account_tokens(hash,user_id,email,purpose,expires_at) VALUES (?,?,?,?,now()+?::interval)").run(digest,user.id,user.email,purpose,purpose==='reset'?'30 minutes':'24 hours');
      return true;
    });
    if(!issued)return false;
    try { await mailer.send({to:user.email,purpose,token,id:digest});return true; }
    catch { console.error('Account email delivery failed; check mail provider configuration.');throw fail(503,'E-posta gönderilemedi. Lütfen daha sonra tekrar dene.'); }
  }
  app.get('/api/auth/email-status',auth,async(req,res)=>{
    const verified=!!await db.prepare('SELECT 1 FROM account_verifications WHERE user_id=? AND email=?').get(req.user.id,req.user.email);
    res.set('Cache-Control','no-store').json({verified,mailAvailable:mailer.configured});
  });
  app.post('/api/auth/forgot-password',limit,async(req,res)=>{
    available();
    const {email}=input(z.object({email:z.email().max(254).transform(v=>v.toLowerCase())}).strict(),req.body);
    // Provider success/failure and account existence use the same response and
    // minimum latency. The provider timeout is below this response window.
    await Promise.all([delay(responseDelay),(async()=>{
      const user=await db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if(user && user.password.includes(':')) { try { await issue(user,'reset'); } catch(error) { if(error.status!==503)throw error; } }
    })()]);
    res.set('Cache-Control','no-store').status(202).json({message});
  });
  app.post('/api/auth/verify-email/request',auth,limit,async(req,res)=>{
    available();
    const sent=await issue(req.user,'verify');
    res.set('Cache-Control','no-store').json({message:sent?'Doğrulama bağlantısı e-postana gönderildi.':'Adresin doğrulanmış olabilir veya yakın zamanda bağlantı istedin. Gelen kutunu kontrol et; yeniden denemeden önce biraz bekle.'});
  });
  async function consume(token,purpose,password) {
    const digest=hash(token);
    const candidate=await db.prepare('SELECT user_id FROM account_tokens WHERE hash=? AND purpose=?').get(digest,purpose);
    if(!candidate)throw fail(400,'Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir bağlantı iste.');
    return db.transaction(async()=>{
      const user=await db.prepare('SELECT * FROM users WHERE id=? FOR UPDATE').get(candidate.user_id);
      const row=await db.prepare('SELECT * FROM account_tokens WHERE hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>now() FOR UPDATE').get(digest,purpose);
      if(!row || !user || row.email!==user.email)throw fail(400,'Bağlantı geçersiz, kullanılmış veya süresi dolmuş. Yeni bir bağlantı iste.');
      if(await db.prepare('SELECT 1 FROM account_moderation WHERE user_id=? AND suspended').get(user.id))throw fail(400,'Bu hesap için işlem tamamlanamıyor.');
      if(purpose==='reset') {
        const salt=randomBytes(16).toString('hex');
        const derived=(await derive(password,salt,64)).toString('hex');
        await db.prepare('UPDATE users SET password=? WHERE id=?').run(`${salt}:${derived}`,user.id);
        await db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      } else {
        await db.prepare('INSERT INTO account_verifications(user_id,email) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,verified_at=now()').run(user.id,user.email);
      }
      await db.prepare('UPDATE account_tokens SET consumed_at=now() WHERE user_id=? AND purpose=? AND consumed_at IS NULL').run(user.id,purpose);
    });
  }
  app.post('/api/auth/reset-password',limit,async(req,res)=>{
    const {token,password}=input(z.object({token:tokenSchema,password:z.string().min(8).max(128)}).strict(),req.body);
    await consume(token,'reset',password);
    res.set('Cache-Control','no-store').json({message:'Şifren yenilendi. Tüm cihazlardaki oturumlar kapatıldı; yeni şifrenle giriş yap.'});
  });
  app.post('/api/auth/verify-email',limit,async(req,res)=>{
    const {token}=input(z.object({token:tokenSchema}).strict(),req.body);
    await consume(token,'verify');
    res.set('Cache-Control','no-store').json({message:'E-posta adresin doğrulandı.'});
  });
}

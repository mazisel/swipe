import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
export async function lockPeers(db,a,b) { await db.query('SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[a,b]]); }
export async function blocked(db,a,b) { return !!await db.prepare('SELECT 1 FROM dm_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(a,b,b,a); }
export function installSafety({app,db,auth,input,fail}) {
  app.get('/api/blocks',auth,async(req,res)=>res.set('Cache-Control','no-store').json({items:(await db.prepare('SELECT u.id,COALESCE(u.shop,u.name) AS name FROM dm_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC').all(req.user.id))}));
  app.post('/api/blocks',auth,async(req,res)=>{
    const {userId,block}=input(z.object({userId:z.string().min(1).max(100),block:z.boolean()}).strict(),req.body);
    if(userId===req.user.id)throw fail(400,'Kendini engelleyemezsin.');
    await db.transaction(async()=>{
      await lockPeers(db,req.user.id,userId);
      if(!await db.prepare('SELECT id FROM users WHERE id=?').get(userId))throw fail(404,'Hesap bulunamadı.');
      if(block)await db.prepare('INSERT INTO dm_blocks(blocker_id,blocked_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(req.user.id,userId);
      else await db.prepare('DELETE FROM dm_blocks WHERE blocker_id=? AND blocked_id=?').run(req.user.id,userId);
    });res.json({ok:true});
  });
  app.post('/api/reports',auth,rateLimit({windowMs:3600000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Çok fazla bildirim. Lütfen daha sonra tekrar dene.'}}),async(req,res)=>{
    const v=input(z.object({kind:z.enum(['product','shop','message']),targetId:z.string().min(1).max(100),reason:z.string().trim().min(5).max(1000)}).strict(),req.body);
    let owner,snapshot;
    if(v.kind==='product') {const p=await db.prepare('SELECT * FROM products WHERE id=?').get(v.targetId);if(p){owner=p.seller_id;const d=JSON.parse(p.data);snapshot={title:d.title,shop:d.shop,productId:p.id};}}
    if(v.kind==='shop') {const u=await db.prepare('SELECT id,shop FROM users WHERE id=? AND shop IS NOT NULL').get(v.targetId);if(u){owner=u.id;snapshot={title:u.shop};}}
    if(v.kind==='message') {const m=await db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id::text=? AND (c.buyer_id=? OR c.seller_id=?)').get(v.targetId,req.user.id,req.user.id);if(m){owner=m.sender_id;snapshot={title:'Bildirilen mesaj',body:m.body};}}
    if(!owner)throw fail(404,'Bildirilecek içerik bulunamadı.');
    if(owner===req.user.id)throw fail(400,'Kendi içeriğini bildiremezsin.');
    await db.prepare(`INSERT INTO reports(id,reporter_id,kind,target_id,target_user_id,reason,snapshot) VALUES (?,?,?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING`).run(randomUUID(),req.user.id,v.kind,v.targetId,owner,v.reason,JSON.stringify(snapshot));
    res.status(202).json({ok:true});
  });
}
export function installReportAdmin({app,db,input,fail}) {
  app.post('/api/admin/reports/:id',async(req,res)=>{
    const v=input(z.object({status:z.enum(['reviewing','resolved','dismissed']),resolution:z.string().trim().min(3).max(1000),version:z.number().int().min(0)}).strict(),req.body);
    await db.transaction(async()=>{
      const r=await db.prepare('SELECT * FROM reports WHERE id=? FOR UPDATE').get(req.params.id);if(!r)throw fail(404,'Şikâyet bulunamadı.');
      if(r.version!==v.version)throw fail(409,'Kayıt değişti; listeyi yenile.');
      await db.prepare('UPDATE reports SET status=?,resolution=?,version=version+1,updated_at=now() WHERE id=?').run(v.status,v.resolution,r.id);
      await db.prepare('INSERT INTO admin_audit(id,admin_id,action,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,`report:${v.status}`,r.id,v.resolution);
    });res.json({ok:true});
  });
}

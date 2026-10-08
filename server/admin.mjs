import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { installReportAdmin } from './safety.mjs';
import { installShipping, shippingSql, shipmentListSql } from './shipping.mjs';
export function installAdmin({app,db,auth,fail,input}) {
 const guard=async(req,res,next)=>{if(!(await db.prepare('SELECT 1 FROM admin_roles WHERE user_id=?').get(req.user.id)))throw fail(403,'Bu hesap yönetici yetkisine sahip değil.');res.set('Cache-Control','no-store');next();};
 app.use('/api/admin',auth,guard);
 app.post('/api/admin/shops',async(req,res)=>{
  const v=input(z.object({name:z.string().trim().min(2).max(60),bio:z.string().trim().max(500).default('')}).strict(),req.body);
  const id=randomUUID();
  await db.transaction(async()=>{
   // Internal account has no password and no deliverable email; it cannot sign in or reset a password.
   await db.prepare('INSERT INTO users(id,email,name,password,shop) VALUES (?,?,?,?,?)').run(id,`${id}@managed.swipe.invalid`,v.name,'',v.name);
   await db.prepare('INSERT INTO shop_profiles(user_id,bio) VALUES (?,?)').run(id,v.bio);
   await db.prepare('INSERT INTO admin_audit(id,admin_id,action,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,'shop:create',id,'Yönetim tarafından oluşturuldu');
  });res.status(201).json({shop:{id,name:v.name,bio:v.bio}});
 });
 installReportAdmin({app,db,input,fail});
 installShipping({app,db,fail,input});
 app.get('/api/admin/overview',async(req,res)=>{
  const counts=(await db.query(`SELECT (SELECT count(*) FROM users) AS users,(SELECT count(*) FROM users WHERE shop IS NOT NULL) AS shops,(SELECT count(*) FROM products) AS products,(SELECT count(*) FROM orders) AS orders,(SELECT count(*) FROM product_likes) AS likes,(SELECT count(*) FROM product_moderation WHERE hidden) AS hidden,(SELECT count(*) FROM account_moderation WHERE suspended) AS suspended`)).rows[0];
  const budget=(await db.query("SELECT spent_micros,reserved_micros FROM ai_budgets WHERE month=to_char(now() AT TIME ZONE 'UTC','YYYY-MM')")).rows[0]||{spent_micros:0,reserved_micros:0};
  res.json({counts,budget,limitUsd:Math.min(25,Math.max(0,Number(process.env.AI_MONTHLY_BUDGET_USD)||25)),personalized:process.env.FEED_PERSONALIZED!=='false',aiConfigured:!!process.env.GEMINI_API_KEY});
 });
 app.get('/api/admin/list/:kind',async(req,res)=>{
  const kind=input(z.enum(['users','shops','products','orders','jobs','audit','reports']),req.params.kind);
  const {q,page}=input(z.object({q:z.string().max(100).default(''),page:z.coerce.number().int().min(0).max(100000).default(0)}),req.query);
  const definitions={
   users:`SELECT u.id,u.name AS title,CASE WHEN u.email LIKE '%@managed.swipe.invalid' AND u.password='' THEN 'Yönetim tarafından yönetiliyor' ELSE u.email END AS subtitle,CASE WHEN a.suspended THEN 'Askıda' ELSE 'Aktif' END AS status,COALESCE(u.shop,'Alıcı') AS meta FROM users u LEFT JOIN account_moderation a ON a.user_id=u.id`,
   shops:`SELECT u.id,u.shop AS title,CASE WHEN u.email LIKE '%@managed.swipe.invalid' AND u.password='' THEN 'Yönetim tarafından yönetiliyor' ELSE u.email END AS subtitle,CASE WHEN a.suspended THEN 'Askıda' ELSE 'Aktif' END AS status,(SELECT count(*)::text || ' ürün' FROM products p WHERE p.seller_id=u.id) AS meta FROM users u LEFT JOIN account_moderation a ON a.user_id=u.id WHERE u.shop IS NOT NULL`,
   products:`SELECT p.id,p.data::jsonb->>'title' AS title,u.shop AS subtitle,CASE WHEN m.hidden THEN 'Gizli' WHEN a.suspended THEN 'Mağaza askıda' WHEN p.stock=0 THEN 'Stoksuz' ELSE 'Yayında' END AS status,p.stock::text || ' adet · ' || ((p.data::jsonb->>'price')::numeric/100)::numeric(14,2)::text || ' TL' AS meta FROM products p JOIN users u ON u.id=p.seller_id LEFT JOIN product_moderation m ON m.product_id=p.id LEFT JOIN account_moderation a ON a.user_id=u.id`,
   orders:`SELECT o.id,o.id AS title,u.name AS subtitle,'Demo' AS status,((o.data::jsonb->>'total')::numeric/100)::numeric(14,2)::text || ' TL · ' || (o.data::jsonb->>'createdAt') AS meta,${shippingSql} AS shipping,${shipmentListSql} AS shipments FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN order_shipping s ON s.order_id=o.id`,
   jobs:`SELECT j.id,p.data::jsonb->>'title' AS title,COALESCE(j.last_error,CASE WHEN j.status='done' THEN 'Görsel analiz tamamlandı' ELSE 'Analiz kuyruğu' END) AS subtitle,j.status,j.attempts::text || ' deneme' AS meta,c.features AS analysis,c.created_at AS analyzed_at FROM ai_jobs j JOIN products p ON p.id=j.product_id LEFT JOIN ai_cache c ON c.cache_key=j.cache_key AND j.status='done'`,
   reports:`SELECT r.id,r.created_at,r.snapshot->>'title' AS title,r.reason AS subtitle,r.status,r.kind || ' · ' || r.target_id AS meta,r.snapshot,r.target_user_id,r.kind,r.target_id,r.version,r.resolution FROM reports r`,
   audit:`SELECT a.id::text,a.created_at,a.action AS title,u.name AS subtitle,'Kaydedildi' AS status,a.reason || ' · ' || a.target_id || ' · ' || a.created_at::text AS meta FROM admin_audit a JOIN users u ON u.id=a.admin_id`
  };
  const result=await db.query(`SELECT * FROM (${definitions[kind]}) records WHERE title ILIKE $1 OR subtitle ILIKE $1 OR id ILIKE $1 ${kind==='jobs'?"OR analysis::text ILIKE $1":''} ORDER BY ${['audit','reports'].includes(kind)?'created_at DESC,id':'title,id'} LIMIT 31 OFFSET $2`,[`%${q}%`,page*30]);
  res.json({items:result.rows.slice(0,30),hasMore:result.rows.length>30});
 });
 app.post('/api/admin/moderate',async(req,res)=>{
  const v=input(z.object({kind:z.enum(['product','user']),id:z.string().min(1).max(100),disabled:z.boolean(),reason:z.string().trim().min(3).max(500)}).strict(),req.body);
  await db.transaction(async()=>{
   if(v.kind==='user') {
    const exists=await db.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').get(v.id);if(!exists)throw fail(404,'Hesap bulunamadı.');
    if(await db.prepare('SELECT 1 FROM admin_roles WHERE user_id=?').get(v.id))throw fail(409,'Yönetici hesapları bu panelden askıya alınamaz.');
    await db.prepare('INSERT INTO account_moderation(user_id,suspended,reason) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET suspended=excluded.suspended,reason=excluded.reason,updated_at=now()').run(v.id,v.disabled,v.reason);
    if(v.disabled)await db.prepare('DELETE FROM sessions WHERE user_id=?').run(v.id);
   } else {
    if(!await db.prepare('SELECT id FROM products WHERE id=? FOR UPDATE').get(v.id))throw fail(404,'Ürün bulunamadı.');
    await db.prepare('INSERT INTO product_moderation(product_id,hidden,reason) VALUES (?,?,?) ON CONFLICT(product_id) DO UPDATE SET hidden=excluded.hidden,reason=excluded.reason,updated_at=now()').run(v.id,v.disabled,v.reason);
   }
   await db.prepare('INSERT INTO admin_audit(id,admin_id,action,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,`${v.kind}:${v.disabled?'disable':'restore'}`,v.id,v.reason);
  });res.json({ok:true});
 });
}

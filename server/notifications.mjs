import { z } from 'zod';
export async function notify(db,{userId,eventKey,kind,title,route}) {
  await db.prepare('INSERT INTO notifications(user_id,event_key,kind,title,route) VALUES (?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING').run(userId,eventKey,kind,title,route);
}
export async function notifyFollowers(db,product) {
  await db.query(`INSERT INTO notifications(user_id,event_key,kind,title,route)
    SELECT DISTINCT a.user_id,$1,'product',$2,$3 FROM shop_follows f JOIN feed_actors a ON a.id=f.actor_id
    WHERE f.seller_id=$4 AND a.user_id IS NOT NULL AND a.user_id<>$4 AND a.merged_into IS NULL
    ON CONFLICT(user_id,event_key) DO NOTHING`,[`product:${product.id}`,`${product.shop} yeni bir ürün paylaştı.`,`/product/${encodeURIComponent(product.id)}`,product.sellerId]);
}
export function installNotifications({app,db,auth,input}) {
  app.get('/api/notifications',auth,async(req,res)=>{
    const {before}=input(z.object({before:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional()}),req.query);
    const rows=(await db.query('SELECT id,kind,title,route,read_at AS "readAt",created_at AS "createdAt" FROM notifications WHERE user_id=$1 AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT 31',[req.user.id,before||null])).rows;
    const unread=(await db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id=? AND read_at IS NULL').get(req.user.id)).n;
    res.set('Cache-Control','no-store').json({items:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null,unread});
  });
  app.post('/api/notifications/read',auth,async(req,res)=>{
    const {ids}=input(z.object({ids:z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(100)}).strict(),req.body);
    await db.query('UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND id=ANY($2::bigint[])',[req.user.id,ids]);
    res.json({ok:true});
  });
}

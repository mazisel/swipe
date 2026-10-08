import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { notify } from './notifications.mjs';
import { shippingLabels } from '../shared/shipping.ts';

export const shippingSql = `jsonb_build_object('status',COALESCE(s.status,'preparing'),'carrier',COALESCE(s.carrier,''),'trackingNumber',COALESCE(s.tracking_number,''),'updatedAt',s.updated_at,'version',COALESCE(s.version,0))`;
export const shipmentListSql = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'sellerId',t.seller_id,'shop',t.shop,'items',t.items,'status',t.status,'carrier',t.carrier,'trackingNumber',t.tracking_number,'version',t.version,'updatedAt',t.updated_at) ORDER BY t.shop,t.id),'[]'::jsonb) FROM order_shipments t WHERE t.order_id=o.id)`;
export async function createShipments(db,order) {
  const groups=new Map();
  for(const item of order.items) {const seller=item.sellerId;if(!groups.has(seller))groups.set(seller,[]);groups.get(seller).push(item);}
  for(const [seller,items] of groups)await db.prepare('INSERT INTO order_shipments(id,order_id,seller_id,shop,items) VALUES (?,?,?,?,?::jsonb) ON CONFLICT DO NOTHING').run(randomUUID(),order.id,seller,items[0].shop,JSON.stringify(items));
}
export function installShipping({app,db,fail,input}) {
  // Registered after /api/admin authentication and role middleware.
  const update=async(req,res)=>{
    const id=input(z.string().min(1).max(100),req.params.id);
    const data=input(z.object({status:z.enum(Object.keys(shippingLabels)),carrier:z.string().trim().max(80),trackingNumber:z.string().trim().max(100),version:z.number().int().min(0).max(2147483646)}).strict(),req.body);
    if(data.status!=='preparing' && (!data.carrier || !data.trackingNumber))throw fail(400,'Kargo firması ve takip numarasını gir.');
    const shipping=await db.transaction(async()=>{
      const order=await db.prepare('SELECT * FROM orders WHERE id=? FOR UPDATE').get(id);
      if(!order)throw fail(404,'Sipariş bulunamadı.');
      const parts=await db.prepare('SELECT * FROM order_shipments WHERE order_id=? ORDER BY id').all(id);
      if(!req.params.shipmentId && parts.length>1)throw fail(409,'Bu sipariş için mağazaya ait kargoyu seç.');
      const previous=req.params.shipmentId?parts.find(p=>p.id===req.params.shipmentId):parts[0];
      if(!previous)throw fail(404,'Kargo kaydı bulunamadı.');
      if((previous?.version||0)!==data.version)throw fail(409,'Kargo bilgisi başka bir işlemde güncellendi. Listeyi yenileyip tekrar aç.');
      await db.prepare('UPDATE order_shipments SET status=?,carrier=?,tracking_number=?,version=version+1,updated_at=now() WHERE id=?').run(data.status,data.carrier,data.trackingNumber,previous.id);
      if(parts.length===1)await db.prepare(`INSERT INTO order_shipping(order_id,status,carrier,tracking_number) VALUES (?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET status=excluded.status,carrier=excluded.carrier,tracking_number=excluded.tracking_number,version=order_shipping.version+1,updated_at=now()`).run(id,data.status,data.carrier,data.trackingNumber);
      await db.prepare('INSERT INTO admin_audit(id,admin_id,action,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,'order:shipping',previous.id,JSON.stringify({before:previous?{status:previous.status,carrier:previous.carrier,trackingNumber:previous.tracking_number}:null,after:{status:data.status,carrier:data.carrier,trackingNumber:data.trackingNumber}}));
      await notify(db,{userId:order.user_id,eventKey:`shipping:${previous.id}:${data.version+1}`,kind:'shipping',title:`${previous.shop}: ${shippingLabels[data.status]}`,route:'/profile'});
      return {id:previous.id,status:data.status,carrier:data.carrier,trackingNumber:data.trackingNumber,version:data.version+1};
    });
    res.json({shipping});
  };
  app.post('/api/admin/orders/:id/shipping',update);
  app.post('/api/admin/orders/:id/shipments/:shipmentId',update);
}

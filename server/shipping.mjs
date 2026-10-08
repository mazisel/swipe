import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { shippingLabels } from '../shared/shipping.ts';

export const shippingSql = `jsonb_build_object('status',COALESCE(s.status,'preparing'),'carrier',COALESCE(s.carrier,''),'trackingNumber',COALESCE(s.tracking_number,''),'updatedAt',s.updated_at,'version',COALESCE(s.version,0))`;
export function installShipping({app,db,fail,input}) {
  // Registered after /api/admin authentication and role middleware.
  app.post('/api/admin/orders/:id/shipping',async(req,res)=>{
    const id=input(z.string().min(1).max(100),req.params.id);
    const data=input(z.object({status:z.enum(Object.keys(shippingLabels)),carrier:z.string().trim().max(80),trackingNumber:z.string().trim().max(100),version:z.number().int().min(0).max(2147483646)}).strict(),req.body);
    if(data.status!=='preparing' && (!data.carrier || !data.trackingNumber))throw fail(400,'Kargo firması ve takip numarasını gir.');
    const shipping=await db.transaction(async()=>{
      if(!await db.prepare('SELECT id FROM orders WHERE id=? FOR UPDATE').get(id))throw fail(404,'Sipariş bulunamadı.');
      const previous=await db.prepare('SELECT * FROM order_shipping WHERE order_id=?').get(id);
      if((previous?.version||0)!==data.version)throw fail(409,'Kargo bilgisi başka bir işlemde güncellendi. Listeyi yenileyip tekrar aç.');
      await db.prepare(`INSERT INTO order_shipping(order_id,status,carrier,tracking_number) VALUES (?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET status=excluded.status,carrier=excluded.carrier,tracking_number=excluded.tracking_number,version=order_shipping.version+1,updated_at=now()`).run(id,data.status,data.carrier,data.trackingNumber);
      await db.prepare('INSERT INTO admin_audit(id,admin_id,action,target_id,reason) VALUES (?,?,?,?,?)').run(randomUUID(),req.user.id,'order:shipping',id,JSON.stringify({before:previous?{status:previous.status,carrier:previous.carrier,trackingNumber:previous.tracking_number}:null,after:{status:data.status,carrier:data.carrier,trackingNumber:data.trackingNumber}}));
      return (await db.query(`SELECT ${shippingSql} AS shipping FROM order_shipping s WHERE s.order_id=$1`,[id])).rows[0].shipping;
    });
    res.json({shipping});
  });
}

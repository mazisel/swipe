import { useEffect, useRef, useState } from 'react';
import { emptyShipping, Shipping, ShippingStatus, shippingLabels } from '../../shared/shipping';
import { api } from '../lib/api';

export function ShippingEditor({id,shipmentId,shop,shipping,onClose,onSaved}:{id:string;shipmentId?:string;shop?:string;shipping?:Shipping;onClose:()=>void;onSaved:()=>void}) {
  const original=shipping||emptyShipping;
  const [status,setStatus]=useState(original.status),[carrier,setCarrier]=useState(original.carrier),[trackingNumber,setTrackingNumber]=useState(original.trackingNumber);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  async function save(e:React.FormEvent) {
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try {await api(`/admin/orders/${encodeURIComponent(id)}/${shipmentId?`shipments/${encodeURIComponent(shipmentId)}`:'shipping'}`,{status,carrier,trackingNumber,version:original.version});onSaved();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="dialog shipping-dialog" aria-labelledby="shipping-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <h2 id="shipping-title">Kargo bilgisi</h2><p>{id} · {shop}</p><p>Bu bilgi seçilen mağazanın ürünleri için alıcıya gösterilir. Demo siparişi güncellemek gerçek kargo oluşturmaz.</p>
    <form onSubmit={save}><label>Durum<select autoFocus value={status} onChange={e=>setStatus(e.target.value as ShippingStatus)} disabled={busy}>{Object.entries(shippingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Kargo firması<input value={carrier} onChange={e=>setCarrier(e.target.value)} maxLength={80} required={status!=='preparing'} disabled={busy} placeholder="Örn. Yurtiçi Kargo"/></label>
      <label>Takip numarası<input value={trackingNumber} onChange={e=>setTrackingNumber(e.target.value)} maxLength={100} required={status!=='preparing'} disabled={busy} autoComplete="off"/></label>
      {error&&<p role="alert" className="error">{error}</p>}
      <div className="dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Vazgeç</button><button className="primary" disabled={busy}>{busy?'Kaydediliyor…':'Kargo bilgisini kaydet'}</button></div>
    </form>
  </dialog>;
}

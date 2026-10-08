import {useEffect,useRef,useState} from 'react';
import {api,mediaUrl} from '../lib/api';
type Shop={id:string;name:string};
type Asset={url:string;type:'image'|'video'};
export function AdminCatalogEditor({shop,onClose,onSaved}:{shop:Shop|null;onClose:()=>void;onSaved:(shop?:Shop)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[price,setPrice]=useState(''),[stock,setStock]=useState('1'),[color,setColor]=useState(''),[sizes,setSizes]=useState('Standart'),[category,setCategory]=useState('Giyim');
 const [media,setMedia]=useState<Asset[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
 async function upload(files:File[]){
  if(!shop||busy)return;setError('');
  if(media.length+files.length>6){setError('En fazla 6 fotoğraf veya video seç.');return;}
  if(files.some(f=>f.size>50*1024*1024)){setError('Her dosya en fazla 50 MB olabilir.');return;}
  setBusy(true);
  try{for(const file of files){const form=new FormData();form.append('file',file);const asset=await api<Asset>(`/admin/shops/${shop.id}/uploads`,undefined,form);setMedia(items=>[...items,asset]);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  try{if(!shop){const result=await api<{shop:Shop}>('/admin/shops',{name,bio:description});onSaved(result.shop);}else{await api(`/admin/shops/${shop.id}/products`,{title:name,description,price:Math.round(Number(price.replace(',','.'))*100),stock:Number(stock),color,category,sizes:sizes.split(',').map(s=>s.trim()).filter(Boolean),gallery:media.map(m=>m.url)});onSaved();}}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <dialog ref={dialog} className="dialog shipping-dialog" aria-labelledby="catalog-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <h2 id="catalog-title">{shop?'Ürün ekle':'Mağaza oluştur'}</h2><p>{shop?`${shop.name} adına yayımlanacak.`:'Bu mağazayı yönetim panelinden yöneteceksin. Satıcı hesabı veya şifre gerekmez.'}</p>
 <form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,display:'grid',gap:16}}>
 <label>{shop?'Ürün adı':'Mağaza adı'}<input autoFocus required minLength={shop?3:2} maxLength={shop?100:60} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>{shop?'Ürün açıklaması':'Mağaza açıklaması'}<textarea required={!!shop} minLength={shop?10:0} maxLength={shop?2000:500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {shop&&<><label>Fotoğraf / video · {media.length}/6<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple disabled={media.length>=6||busy} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';void upload(files);}}/></label>
 <p className="note">İlk medya kapaktır. JPG, PNG, WebP, MP4 veya MOV; dosya başına en fazla 50 MB.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>{media.map((m,i)=><div key={m.url}>{m.type==='image'?<img alt={`${i+1}. ürün görseli`} src={mediaUrl(m.url)} style={{width:'100%',height:130,objectFit:'cover'}}/>:<video controls src={mediaUrl(m.url)} style={{width:'100%',height:130}}/>}<small>{i===0?'Kapak':`${i+1}. medya`}</small><div style={{display:'flex',flexWrap:'wrap',gap:4}}><button type="button" disabled={i===0} onClick={()=>setMedia(items=>[m,...items.filter(a=>a.url!==m.url)])}>Kapak yap</button><button type="button" onClick={()=>setMedia(items=>items.filter(a=>a.url!==m.url))}>Kaldır</button></div></div>)}</div>
 <label>Fiyat (TL)<input required inputMode="decimal" placeholder="1299,90" value={price} onChange={e=>setPrice(e.target.value)} pattern="[0-9]+([.,][0-9]{1,2})?"/></label>
 <label>Stok<input required type="number" min="1" max="10000" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></label>
 <label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}>{['Giyim','Çanta','Ayakkabı','Aksesuar','Yaşam'].map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Renk<input required maxLength={40} value={color} onChange={e=>setColor(e.target.value)}/></label>
 <label>Beden / seçenekler<input required value={sizes} onChange={e=>setSizes(e.target.value)} placeholder="S, M, L veya Standart"/></label><p className="note">Seçenekleri virgülle ayır. Stok tüm seçenekler için ortaktır.</p></>}
 </fieldset>{error&&<p role="alert" className="error">{error}</p>}<div className="dialog-actions"><button type="button" disabled={busy} onClick={onClose}>Vazgeç</button><button className="primary" disabled={busy||!!shop&&!media.length}>{busy?'İşleniyor…':shop?'Ürünü yayımla':'Mağazayı oluştur'}</button></div></form></dialog>;
}

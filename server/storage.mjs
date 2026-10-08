import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
export const mimeFor = filename => ({ '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime' })[path.extname(filename).toLowerCase()];
export function createMediaStorage({ uploadDir='server/data/uploads', url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY, bucket=process.env.SUPABASE_STORAGE_BUCKET || 'product-media' }={}) {
  if (!!url !== !!key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together.');
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('SUPABASE_URL must be an HTTPS Supabase project URL.');
  if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error('Invalid storage bucket.');
  const headers = { apikey:key, Authorization:`Bearer ${key}` };
  let ready;
  async function ensureBucket() {
    const response = await fetch(`${url}/storage/v1/bucket/${bucket}`,{headers,signal:AbortSignal.timeout(15000)});
    if (response.ok) { const b=await response.json(); if (!b.public) throw new Error('Product media bucket must be public.'); return; }
    if (response.status !== 404 && response.status !== 400) throw new Error('Storage bucket could not be checked.');
    const created = await fetch(`${url}/storage/v1/bucket`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({ id:bucket,name:bucket,public:true,file_size_limit:52428800,allowed_mime_types:['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'] }),signal:AbortSignal.timeout(15000)});
    if (!created.ok) throw new Error('Storage bucket could not be created.');
  }
  return {
    async put(filename,buffer) {
      if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4|mov)$/.test(filename)) throw new Error('Invalid media filename.');
      const mime = mimeFor(filename);
      if (!url) { await mkdir(uploadDir,{recursive:true}); await writeFile(path.join(uploadDir,filename),buffer); return {url:`/uploads/${filename}`,mime}; }
      await (ready ||= ensureBucket().catch(e=>{ready=null;throw e;}));
      const response = await fetch(`${url}/storage/v1/object/${bucket}/${filename}`, {method:'POST',headers:{...headers,'Content-Type':mime,'x-upsert':'true'},body:buffer,signal:AbortSignal.timeout(120000)});
      if (!response.ok) throw new Error('Storage upload failed.');
      return {url:`${url}/storage/v1/object/public/${bucket}/${filename}`,mime};
    },
    async read(media) {
      if (/^\/uploads\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4|mov)$/.test(media)) {
        const file=path.join(uploadDir,path.basename(media)); if ((await stat(file)).size>52428800) throw new Error('Media exceeds 50 MB.');
        return {buffer:await readFile(file),mime:mimeFor(file)};
      }
      const prefix = `${url}/storage/v1/object/public/${bucket}/`;
      if (!url || !media.startsWith(prefix) || !/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|mp4|mov)$/.test(media.slice(prefix.length))) throw new Error('AI only reads owned product uploads.');
      const response=await fetch(media,{signal:AbortSignal.timeout(120000),redirect:'error'});
      if (!response.ok || Number(response.headers.get('content-length'))>52428800) throw new Error('Media unavailable.');
      const chunks=[];let size=0;
      for await (const chunk of response.body) { size+=chunk.length;if(size>52428800) throw new Error('Media exceeds 50 MB.');chunks.push(chunk); }
      return {buffer:Buffer.concat(chunks),mime:mimeFor(media)};
    },
  };
}

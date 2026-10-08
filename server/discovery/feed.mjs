import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ALGORITHM, WEIGHTS, buildProfile, rankProducts, selectPage, explainCandidate } from './ranking.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const cursor = (id, page) => Buffer.from(JSON.stringify({ id, page })).toString('base64url');
const eventSchema = z.object({ id: z.uuid(), productId: z.string().min(1).max(100), kind: z.enum(['view','progress','finish','detail','save','cart','search_select']), sessionId: z.uuid().optional(), impressionId: z.uuid().optional(), endReason: z.enum(['swipe','pause']).optional(), durationMs: z.number().int().min(0).max(120000).default(0), completion: z.number().min(0).max(1).default(0), loops: z.number().int().min(0).max(2).default(0) }).strict();

export function installFeed({ app, db, productRows, fail, input, resolveUser, personalized = process.env.FEED_PERSONALIZED !== 'false' }) {
  async function account(userId) {
    await db.prepare('INSERT INTO feed_actors(id,user_id) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING').run(randomUUID(), userId);
    return db.prepare('SELECT * FROM feed_actors WHERE user_id=?').get(userId);
  }
  async function actor(req) {
    const user = await resolveUser(req);
    if (user) return account(user.id);
    const token = req.headers['x-feed-token'];
    const row = typeof token === 'string' && token.length <= 128 && await db.prepare('SELECT * FROM feed_actors WHERE token_hash=? AND merged_into IS NULL').get(hash(token));
    if (!row) throw fail(401, 'Keşfet kimliği yenilenmeli.');
    return row;
  }
  async function record(a, productId, kind, meta = {}) {
    const p = await db.prepare('SELECT seller_id FROM products WHERE id=?').get(productId);
    if (!p || p.seller_id === a.user_id) return;
    await db.prepare(`INSERT INTO feed_events(id,actor_id,generation,product_id,kind,weight,session_id,algorithm,impression_id,duration_ms,completion,day)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(actor_id,product_id,kind,day) DO UPDATE SET duration_ms=GREATEST(feed_events.duration_ms,excluded.duration_ms),completion=GREATEST(feed_events.completion,excluded.completion)`).run(randomUUID(), a.id, a.generation, productId, kind, WEIGHTS[kind] || 0, meta.sessionId || null, meta.algorithm || ALGORITHM, meta.impressionId || null, meta.durationMs || 0, meta.completion || 0, new Date().toISOString().slice(0,10));
    await db.prepare('DELETE FROM feed_profiles WHERE actor_id=?').run(a.id);
  }
  async function weakSignal(userId, productId, kind) {
    const a = await account(userId);
    await db.transaction(async () => { const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id); await record(locked, productId, kind); });
  }
  app.post('/api/feed/identity', async (req, res) => {
    const user = await resolveUser(req);
    if (!user) {
      const existing = req.headers['x-feed-token'];
      const found = typeof existing === 'string' && existing.length <= 128 && await db.prepare('SELECT * FROM feed_actors WHERE token_hash=? AND merged_into IS NULL').get(hash(existing));
      if (found) return res.json({ actorId: found.id, generation: found.generation });
      const token = randomBytes(32).toString('hex'), id = randomUUID();
      await db.prepare('INSERT INTO feed_actors(id,token_hash) VALUES (?,?)').run(id, hash(token));
      return res.status(201).json({ token, actorId: id, generation: 1 });
    }
    const current = await account(user.id), token = req.headers['x-feed-token'];
    await db.transaction(async () => {
      const guest = typeof token === 'string' && token.length <= 128 && await db.prepare('SELECT * FROM feed_actors WHERE token_hash=? AND user_id IS NULL FOR UPDATE').get(hash(token));
      const target = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(current.id);
      if (guest && !guest.merged_into) {
        await db.prepare(`INSERT INTO feed_events(id,actor_id,generation,product_id,kind,weight,algorithm,day,created_at,duration_ms,completion)
          SELECT id || '-merged', ?, ?, product_id,kind,weight,algorithm,day,created_at,duration_ms,completion FROM feed_events WHERE actor_id=? ON CONFLICT DO NOTHING`).run(target.id, target.generation, guest.id);
        await db.prepare('INSERT INTO feed_preferences SELECT ?,kind,target_id FROM feed_preferences WHERE actor_id=? ON CONFLICT DO NOTHING').run(target.id,guest.id);
        await db.prepare('INSERT INTO shop_follows(actor_id,seller_id,created_at) SELECT ?,seller_id,created_at FROM shop_follows WHERE actor_id=? AND seller_id<>? ON CONFLICT DO NOTHING').run(target.id,guest.id,user.id);
        await db.prepare('DELETE FROM shop_follows WHERE actor_id=?').run(guest.id);
        await db.prepare('INSERT INTO product_likes(actor_id,product_id,created_at) SELECT ?,product_id,created_at FROM product_likes WHERE actor_id=? ON CONFLICT DO NOTHING').run(target.id,guest.id);
        await db.prepare('DELETE FROM product_likes WHERE actor_id=?').run(guest.id);
        await db.prepare('DELETE FROM feed_events WHERE actor_id=?').run(guest.id);
        await db.prepare('DELETE FROM feed_preferences WHERE actor_id=?').run(guest.id);
        await db.prepare('DELETE FROM feed_profiles WHERE actor_id IN (?,?)').run(guest.id,target.id);
        await db.prepare('UPDATE feed_actors SET merged_into=?,token_hash=NULL,generation=generation+1 WHERE id=?').run(target.id,guest.id);
      }
    });
    const updated = await account(user.id);
    res.json({ actorId: updated.id, generation: updated.generation });
  });
  async function likeSnapshot(a) {
    const ids = (await db.prepare('SELECT product_id FROM product_likes WHERE actor_id=? ORDER BY created_at DESC,product_id').all(a.id)).map(r=>r.product_id);
    const counts = Object.fromEntries((await db.prepare('SELECT p.id,COUNT(l.actor_id) AS n FROM products p LEFT JOIN product_likes l ON l.product_id=p.id GROUP BY p.id').all()).map(r=>[r.id,Number(r.n)]));
    return { ids, counts };
  }
  app.get('/api/likes', async (req,res) => {
    const a = await actor(req);
    res.json(await likeSnapshot(a));
  });
  app.post('/api/likes', async (req,res) => {
    const a = await actor(req), data = input(z.object({ productId:z.string().min(1).max(100), liked:z.boolean() }).strict(),req.body);
    const result = await db.transaction(async () => {
      const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      if (locked.merged_into) throw fail(409,'Keşfet kimliği yenilendi.');
      if (!await db.prepare('SELECT id FROM products WHERE id=? FOR UPDATE').get(data.productId)) throw fail(404,'Ürün bulunamadı.');
      if (data.liked) {
        const inserted = await db.prepare('INSERT INTO product_likes(actor_id,product_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(a.id,data.productId);
        if (inserted.changes) await record(locked,data.productId,'save');
      } else {
        await db.prepare('DELETE FROM product_likes WHERE actor_id=? AND product_id=?').run(a.id,data.productId);
        await db.prepare("DELETE FROM feed_events WHERE actor_id=? AND product_id=? AND kind='save'").run(a.id,data.productId);
        await db.prepare('DELETE FROM feed_profiles WHERE actor_id=?').run(a.id);
      }
      const count = await db.prepare('SELECT COUNT(*) AS n FROM product_likes WHERE product_id=?').get(data.productId);
      return { productId:data.productId, liked:data.liked, likeCount:Number(count.n) };
    });
    res.json(result);
  });
  app.post('/api/likes/import', async (req,res) => {
    const a = await actor(req), data = input(z.object({ importId:z.uuid(), ids:z.array(z.string().min(1).max(100)).max(1000) }).strict(),req.body);
    await db.transaction(async () => {
      const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      if (locked.merged_into) throw fail(409,'Keşfet kimliği yenilendi.');
      // A device migration token is consumed globally: a retry after logout
      // cannot copy the previous account's old local favorites to a new guest.
      const receipt = await db.prepare('INSERT INTO like_imports(id,actor_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(data.importId,a.id);
      if (!receipt.changes) return;
      for (const id of [...new Set(data.ids)].sort()) {
        if (!await db.prepare('SELECT id FROM products WHERE id=? FOR UPDATE').get(id)) continue;
        const inserted = await db.prepare('INSERT INTO product_likes(actor_id,product_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(a.id,id);
        if (inserted.changes) await record(locked,id,'save');
      }
    });
    res.json(await likeSnapshot(a));
  });
  app.get('/api/following', async (req,res) => {
    const a = await actor(req);
    const shops = await db.prepare(`SELECT u.id,u.shop AS name,COALESCE(p.bio,'') AS bio FROM shop_follows f JOIN users u ON u.id=f.seller_id LEFT JOIN shop_profiles p ON p.user_id=u.id WHERE f.actor_id=? AND u.shop IS NOT NULL ORDER BY f.created_at DESC,u.id`).all(a.id);
    res.json({ shops });
  });
  app.post('/api/following', async (req,res) => {
    const a = await actor(req), data = input(z.object({ sellerId:z.string().min(1).max(100), following:z.boolean() }).strict(),req.body);
    await db.transaction(async () => {
      const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      if (locked.merged_into) throw fail(409,'Keşfet kimliği yenilendi.');
      const shop = await db.prepare('SELECT id FROM users WHERE id=? AND shop IS NOT NULL').get(data.sellerId);
      if (!shop) throw fail(404,'Mağaza bulunamadı.');
      if (a.user_id === data.sellerId) throw fail(400,'Kendi mağazanı takip edemezsin.');
      if (data.following) await db.prepare('INSERT INTO shop_follows(actor_id,seller_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(a.id,data.sellerId);
      else await db.prepare('DELETE FROM shop_follows WHERE actor_id=? AND seller_id=?').run(a.id,data.sellerId);
    });
    res.json({ following:data.following });
  });
  app.get('/api/feed', async (req, res) => {
    const requestedSize = input(z.coerce.number().refine(n => [6,20].includes(n), 'Geçersiz sayfa boyutu.'), req.query.pageSize ?? 20);
    const started = performance.now(), a = await actor(req);
    const result = await db.transaction(async () => {
      const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      const products = await productRows(), byId = new Map(products.map(p => [p.id,p]));
      const preferences = await db.prepare('SELECT * FROM feed_preferences WHERE actor_id=?').all(a.id);
      const eligible = p => p && p.stock > 0 && !preferences.some(x => (x.kind === 'product' ? p.id : p.sellerId) === x.target_id);
      let session, page = 0;
      if (req.query.cursor) {
        let decoded; try { decoded = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString()); } catch { throw fail(400,'Akış sayfası geçersiz.'); }
        if (!Number.isInteger(decoded.page) || decoded.page < 1 || decoded.page > 10000 || typeof decoded.id !== 'string') throw fail(400,'Akış sayfası geçersiz.');
        session = await db.prepare("SELECT * FROM feed_sessions WHERE id=? AND actor_id=? AND generation=? AND created_at>now()-interval '24 hours'").get(decoded.id,a.id,locked.generation);
        if (!session || session.algorithm !== (personalized ? ALGORITHM : 'swipe-balanced-v1')) throw fail(409,'Keşfet yenilendi. Akışı tekrar aç.');
        page = decoded.page;
        const previous = await db.prepare('SELECT next_cursor FROM feed_pages WHERE session_id=? AND page=?').get(session.id,page-1);
        if (previous?.next_cursor !== req.query.cursor) throw fail(400,'Akış sayfası geçersiz.');
      } else {
        session = { id: randomUUID(), page_size: requestedSize, algorithm: personalized ? ALGORITHM : 'swipe-balanced-v1' };
        await db.prepare('INSERT INTO feed_sessions(id,actor_id,generation,algorithm,page_size) VALUES (?,?,?,?,?)').run(session.id,a.id,locked.generation,session.algorithm,session.page_size);
      }
      const existing = await db.prepare('SELECT * FROM feed_pages WHERE session_id=? AND page=?').get(session.id,page);
      const response = (ids, nextCursor, reasons = {}) => ({ pageSize: session.page_size, reasons: Object.fromEntries(ids.filter(id => eligible(byId.get(id))).map(id => [id, reasons[id] || { code: "discovery", text: "Farklı parçalar keşfetmen için bu seçkiye eklendi." }])), items: ids.map(id => byId.get(id)).filter(eligible), nextCursor, sessionId: session.id, algorithmVersion: session.algorithm, generation: locked.generation });
      if (existing) return response(existing.product_ids, existing.next_cursor, existing.reasons);
      const history = (await db.prepare('SELECT product_ids FROM feed_pages WHERE session_id=? ORDER BY page').all(session.id)).flatMap(r=>r.product_ids);
      const seen = new Set(history);
      const candidates = products.filter(p => eligible(p) && !seen.has(p.id));
      const features = new Map((await db.prepare("SELECT * FROM product_features WHERE status='ready'").all()).map(f=>[f.product_id,f]));
      const events = await db.prepare("SELECT * FROM feed_events WHERE actor_id=? AND generation=? AND created_at>now()-interval '90 days'").all(a.id,locked.generation);
      const now = Date.now();
      const profile = buildProfile(events,products,features,now);
      const recentProfile = buildProfile(events.filter(e => now-new Date(e.created_at).getTime() <= 30*60*1000),products,features,now);
      const exposures = new Map((await db.prepare(`SELECT product_id,count(*) AS count,max(created_at) AS "lastSeen" FROM feed_impressions WHERE actor_id=? AND generation=? AND duration_ms>=1000 AND created_at>now()-interval '7 days' GROUP BY product_id`).all(a.id,locked.generation)).map(r => [r.product_id,r]));
      await db.prepare(`INSERT INTO feed_profiles(actor_id,generation,affinities,embedding) VALUES (?,?,?::jsonb,?::vector) ON CONFLICT(actor_id) DO UPDATE SET generation=excluded.generation,affinities=excluded.affinities,embedding=excluded.embedding,updated_at=now()`).run(a.id,locked.generation,JSON.stringify(profile.affinities),profile.embedding ? JSON.stringify(profile.embedding) : null);
      const stats = new Map((await db.prepare(`SELECT product_id, COUNT(DISTINCT actor_id) FILTER(WHERE kind='impression') AS impressions,
        COUNT(DISTINCT actor_id) FILTER(WHERE kind IN ('save','cart')) AS intent,
        COUNT(DISTINCT actor_id) FILTER(WHERE kind IN ('save','cart') AND created_at>now()-interval '1 day') AS recent
        FROM feed_events WHERE created_at>now()-interval '30 days' GROUP BY product_id`).all()).map(r=>[r.product_id,r]));
      const followed = new Set((await db.prepare('SELECT seller_id FROM shop_follows WHERE actor_id=?').all(a.id)).map(r=>r.seller_id));
      const reasons = {};
      const selected = selectPage(rankProducts({ products:candidates,features,stats,profile,recentProfile,exposures,seed:session.id,personalized,followed,now }),history.map(id=>byId.get(id)).filter(Boolean),session.page_size,(candidate,mode) => { reasons[candidate.product.id] = explainCandidate(candidate,mode); });
      const next = candidates.length > selected.length ? cursor(session.id,page+1) : null;
      await db.prepare('INSERT INTO feed_pages(session_id,page,product_ids,next_cursor,reasons) VALUES (?,?,?::jsonb,?,?::jsonb)').run(session.id,page,JSON.stringify(selected.map(p=>p.id)),next,JSON.stringify(reasons));
      return response(selected.map(p=>p.id),next,reasons);
    });
    const ms = performance.now()-started;
    await db.prepare(`INSERT INTO feed_metrics(day,algorithm,requests,total_ms,max_ms) VALUES (?,?,1,?,?) ON CONFLICT(day,algorithm) DO UPDATE SET requests=feed_metrics.requests+1,total_ms=feed_metrics.total_ms+excluded.total_ms,max_ms=GREATEST(feed_metrics.max_ms,excluded.max_ms)`).run(new Date().toISOString().slice(0,10),result.algorithmVersion,ms,ms);
    res.set('Cache-Control','no-store').json(result);
  });
  app.post('/api/feed/events', async (req, res) => {
    const a = await actor(req), data = input(z.object({ generation:z.number().int().positive(), events:z.array(eventSchema).max(40) }).strict(),req.body);
    const accepted = await db.transaction(async () => {
      const locked = await db.prepare('SELECT * FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      if (data.generation !== locked.generation || locked.merged_into) throw fail(409,'Keşfet tercihleri yenilendi.');
      let accepted = 0;
      for (const e of data.events) {
        const product = await db.prepare('SELECT * FROM products WHERE id=?').get(e.productId); if (!product) continue;
        const receipt = await db.prepare('INSERT INTO feed_receipts(id,actor_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(e.id,a.id); if (!receipt.changes) continue;
        let session;
        if (e.sessionId) session = await db.prepare("SELECT * FROM feed_sessions WHERE id=? AND actor_id=? AND generation=? AND created_at>now()-interval '24 hours'").get(e.sessionId,a.id,a.generation);
        if (e.sessionId && !session) continue;
        const meta = { ...e, algorithm:session?.algorithm || ALGORITHM };
        if (['view','progress','finish'].includes(e.kind)) {
          if (!session || !e.impressionId) continue;
          const pages = await db.prepare('SELECT product_ids FROM feed_pages WHERE session_id=?').all(session.id);
          if (!pages.some(p=>p.product_ids.includes(e.productId))) continue;
          if (e.kind === 'view') {
            await db.prepare('INSERT INTO feed_impressions(id,actor_id,session_id,product_id,generation) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').run(e.impressionId,a.id,session.id,e.productId,a.generation);
          } else {
            const impression = await db.prepare('SELECT * FROM feed_impressions WHERE id=? AND actor_id=? AND session_id=? AND product_id=? FOR UPDATE').get(e.impressionId,a.id,session.id,e.productId);
            if (!impression || impression.closed) continue;
            const elapsed = Math.max(0,Date.now()-new Date(impression.created_at).getTime())+1500;
            const duration = Math.max(impression.duration_ms,Math.min(e.durationMs,elapsed,120000));
            const video = JSON.parse(product.data).mediaType === 'video';
            const qualified = duration>=3000 || (video && duration>=1000 && e.completion>=.95);
            if (duration>=1000) await record(locked,e.productId,'impression',{...meta,durationMs:duration});
            if (qualified) await record(locked,e.productId,'qualified',{...meta,durationMs:duration});
            if (e.kind==='finish' && e.endReason==='swipe' && duration>0 && duration<2000) await record(locked,e.productId,'skip',meta);
            await db.prepare('UPDATE feed_impressions SET duration_ms=?,completion=GREATEST(completion,?),loops=GREATEST(loops,?),qualified=?,closed=? WHERE id=?').run(duration,e.completion,e.loops,qualified,e.kind==='finish',e.impressionId);
          }
        } else await record(locked,e.productId,e.kind,meta);
        accepted++;
      }
      return accepted;
    });
    res.json({ accepted });
  });
  app.post('/api/feed/preferences', async (req,res) => {
    const a = await actor(req), data = input(z.object({ kind:z.enum(['product','seller']), targetId:z.string().min(1).max(100) }).strict(),req.body);
    await db.transaction(async () => {
      await db.prepare('SELECT id FROM feed_actors WHERE id=? FOR UPDATE').get(a.id);
      const exists = data.kind==='product' ? await db.prepare('SELECT id FROM products WHERE id=?').get(data.targetId) : await db.prepare('SELECT id FROM users WHERE id=? AND shop IS NOT NULL').get(data.targetId);
      if (!exists) throw fail(404,'İçerik bulunamadı.');
      await db.prepare('INSERT INTO feed_preferences VALUES (?,?,?) ON CONFLICT DO NOTHING').run(a.id,data.kind,data.targetId);
    });
    res.json({ok:true});
  });
  app.post('/api/feed/reset', async (req,res) => {
    const a = await actor(req);
    const generation = await db.transaction(async () => {
      const row = await db.prepare('UPDATE feed_actors SET generation=generation+1 WHERE id=? RETURNING generation').get(a.id);
      for (const table of ['feed_events','feed_impressions','feed_preferences','feed_profiles','feed_receipts','feed_sessions']) await db.prepare(`DELETE FROM ${table} WHERE actor_id=?`).run(a.id);
      return row.generation;
    });
    res.json({ actorId:a.id, generation });
  });
  return { weakSignal };
}

export async function pruneDiscovery(db) {
  await db.transaction(async () => {
    await db.exec("DELETE FROM feed_events WHERE created_at<now()-interval '90 days'; DELETE FROM feed_receipts WHERE created_at<now()-interval '90 days'; DELETE FROM feed_sessions WHERE created_at<now()-interval '2 days'; DELETE FROM feed_profiles WHERE updated_at<now()-interval '90 days';");
  });
}

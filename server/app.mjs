import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { openDatabase } from './db.mjs';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { seedProducts } from './seed.mjs';
import { installSafety } from './safety.mjs';
import { installNotifications, notifyFollowers } from './notifications.mjs';
import { shippingSql, shipmentListSql, createShipments } from './shipping.mjs';
import { installAdmin } from './admin.mjs';
import { installAccountSecurity } from './account-security.mjs';
import { installSocial } from './social.mjs';
import { installFeed } from './discovery/feed.mjs';
import { createMediaStorage } from './storage.mjs';
import { enqueueAnalysis } from './discovery/ai.mjs';

const derive = promisify(scrypt);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const input = (schema, value) => { const result = schema.safeParse(value); if (!result.success) throw fail(400, result.error.issues[0].message); return result.data; };
const text = (min, max) => z.string().trim().min(min, `En az ${min} karakter girin.`).max(max, `En fazla ${max} karakter girin.`);
const credentials = z.object({ email: z.email('Geçerli bir e-posta girin.').max(254).transform(v => v.toLowerCase()), password: z.string().min(8, 'Şifre en az 8 karakter olmalı.').max(128) });

export async function createApp({ accountSecurity, dbPath, databaseUrl = process.env.DATABASE_URL, dataDir = 'server/data/postgres', uploadDir = 'server/data/uploads', seed = true, demo = false, origins = ['http://localhost:8081', 'http://127.0.0.1:8081'] } = {}) {
  mkdirSync(uploadDir, { recursive: true });
  const db = await openDatabase({ databaseUrl, dataDir: dbPath === ':memory:' ? ':memory:' : dataDir });
  if (seed) for (const product of seedProducts) {
    (await db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING').run(product.sellerId, `${product.sellerId}@example.invalid`, product.shop, 'disabled', product.shop));
    (await db.prepare('INSERT INTO products VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').run(product.id, product.sellerId, JSON.stringify({ ...product, createdAt: '2026-10-06T09:00:00.000Z' }), product.stock));
    // Upgrade only fixture media; preserve IDs, inventory and social relations.
    const row = await db.prepare('SELECT data FROM products WHERE id=? AND seller_id=?').get(product.id, product.sellerId);
    const existing = row && JSON.parse(row.data);
    if (existing && existing.demoMediaVersion !== 3) await db.prepare('UPDATE products SET data=? WHERE id=?').run(JSON.stringify({ ...existing, media: product.media, mediaType: product.mediaType, poster: product.poster, gallery: product.gallery, demoMediaVersion: 3 }), product.id);
  }
  const app = express();
  app.disable('x-powered-by');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 3) throw new Error('Invalid TRUST_PROXY_HOPS');
  if (proxyHops) app.set('trust proxy', proxyHops);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin(origin, cb) { cb(null, !origin || origins.includes(origin)); } }));
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/ready', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await db.query('SELECT 1'); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false }); }
  });
  app.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Biraz fazla istek geldi. Lütfen bir dakika bekleyin.' } }));
  app.use('/uploads', express.static(path.resolve(uploadDir), { maxAge: '1d', dotfiles: 'deny' }));
  if (seed) app.use('/demo-media', express.static(path.resolve('server/demo-media'), { maxAge: '1d', dotfiles: 'deny' }));
  const safeUser = async row => ({ id: row.id, name: row.name, email: row.email, shop: row.shop, shopBio: (await db.prepare('SELECT bio FROM shop_profiles WHERE user_id=?').get(row.id))?.bio || '' });
  const resolveUser = async (req) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    const row = token && (await db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.hash=? AND sessions.expires>?').get(digest(token), Date.now()));
    if (token && !row) throw fail(401, 'Devam etmek için hesabına giriş yap.');
    if (row && (await db.prepare('SELECT 1 FROM account_moderation WHERE user_id=? AND suspended').get(row.id))) throw fail(403, 'Hesabın askıya alınmış.');
    return row || null;
  };
  const auth = async (req, res, next) => {
    req.user = await resolveUser(req);
    if (!req.user) throw fail(401, 'Devam etmek için hesabına giriş yap.');
    next();
  };
  const seller = (req, res, next) => req.user.shop ? next() : next(fail(403, 'Önce mağazanı oluştur.'));

  const session = async (user) => {
    const token = randomBytes(32).toString('hex');
    (await db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()));
    (await db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), user.id, Date.now() + 7 * 86400000));
    return { user: (await safeUser(user)), token };
  };
  installSafety({app,db,auth,fail,input});
  installNotifications({app,db,auth,input});
  installAdmin({ app, db, auth, fail, input });
  installAccountSecurity({ app, db, auth, fail, input, ...accountSecurity });
  const productRows = async () => (await db.prepare(`SELECT products.*, users.shop AS shop_name,
    (SELECT COUNT(*) FROM product_likes WHERE product_id=products.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE product_id=products.id) AS comment_count,
    (SELECT COUNT(*) FROM reviews WHERE product_id=products.id) AS review_count,
    (SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS rating_average
    FROM products JOIN users ON users.id=products.seller_id WHERE NOT EXISTS (SELECT 1 FROM product_moderation m WHERE m.product_id=products.id AND m.hidden) AND NOT EXISTS (SELECT 1 FROM account_moderation a WHERE a.user_id=users.id AND a.suspended) ORDER BY (products.data::jsonb->>'createdAt') DESC NULLS LAST, products.id`).all()).map(row => ({ ...JSON.parse(row.data), stock: row.stock, shop: row.shop_name, likeCount: Number(row.like_count), commentCount: Number(row.comment_count), reviewCount: Number(row.review_count), ratingAverage: Number(row.rating_average) || 0 }));
  const feed = installFeed({ app, db, productRows, fail, input, resolveUser });
  installSocial({ app, db, auth, fail, input, text, weakSignal: feed.weakSignal });
  const storage = createMediaStorage({ uploadDir });
  app.get('/api/health', (req, res) => res.json({ ok: true, database: db.mode, ai: process.env.GEMINI_API_KEY ? 'configured' : 'unconfigured', checkout: demo ? 'demo' : 'unavailable' }));
  app.get('/api/products', async (req, res) => {
    const products = (await productRows());
    // Seed catalogue has a deliberate editorial order; new seller listings appear first.
    products.sort((a, b) => Number(seedProducts.some(p => p.id === a.id)) - Number(seedProducts.some(p => p.id === b.id)) || (seedProducts.findIndex(p => p.id === a.id) - seedProducts.findIndex(p => p.id === b.id)));
    res.json({ products, checkout: demo ? 'demo' : 'unavailable' });
  });
  app.get('/api/shops/:id', async (req, res) => {
    const row = (await db.prepare('SELECT id, shop FROM users WHERE id=? AND shop IS NOT NULL').get(req.params.id));
    if (!row) throw fail(404, 'Mağaza bulunamadı.');
    res.json({ shop: { id: row.id, name: row.shop, bio: (await db.prepare('SELECT bio FROM shop_profiles WHERE user_id=?').get(row.id))?.bio || '' }, products: (await productRows()).filter(p => p.sellerId === row.id) });
  });
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar dene.' } });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const data = input(credentials.extend({ name: text(2, 80) }), req.body);
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(data.password, salt, 64)).toString('hex');
    const user = { id: randomUUID(), name: data.name, email: data.email, shop: null };
    try { (await db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, NULL)').run(user.id, user.email, user.name, `${salt}:${hash}`)); }
    catch (error) { if (error.code === '23505') throw fail(409, 'Bu e-posta ile kayıtlı bir hesap var.'); throw error; }
    res.status(201).json((await session(user)));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const data = input(credentials, req.body);
    const result = await db.transaction(async () => {
    const user = (await db.prepare('SELECT * FROM users WHERE email=? FOR UPDATE').get(data.email));
    if (user && await db.prepare('SELECT 1 FROM account_moderation WHERE user_id=? AND suspended').get(user.id)) throw fail(403, 'Hesabın askıya alınmış.');
    const [salt, hash] = (user?.password || 'invalid:').split(':');
    const candidate = await derive(data.password, salt, 64);
    if (!hash || !timingSafeEqual(candidate, Buffer.from(hash, 'hex'))) throw fail(401, 'E-posta veya şifre doğru değil.');
    return session(user);
    });
    res.json(result);
  });
  app.get('/api/me', auth, async (req, res) => res.json({ user: (await safeUser(req.user)) }));
  app.post('/api/auth/logout', auth, async (req, res) => { (await db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(req.headers.authorization.slice(7)))); res.json({ ok: true }); });
  app.post('/api/shop', auth, async (req, res) => {
    const { name } = input(z.object({ name: text(2, 60) }), req.body);
    if (req.user.shop) throw fail(409, 'Zaten bir mağazan var.');
    (await db.prepare('UPDATE users SET shop=? WHERE id=?').run(name, req.user.id));
    res.status(201).json({ user: { ...(await safeUser(req.user)), shop: name } });
  });
  app.post('/api/shop/profile', auth, seller, async (req, res) => {
    const data = input(z.object({ name: text(2, 60), bio: z.string().trim().max(500) }), req.body);
    await db.transaction(async () => {
      (await db.prepare('UPDATE users SET shop=? WHERE id=?').run(data.name, req.user.id));
      (await db.prepare('INSERT INTO shop_profiles VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio').run(req.user.id, data.bio));
    });
    res.json({ user: { ...(await safeUser(req.user)), shop: data.name, shopBio: data.bio } });
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } });
  app.post('/api/uploads', auth, seller, upload.single('file'), async (req, res) => {
    const data = req.file?.buffer;
    if (!data) throw fail(400, 'Bir fotoğraf veya video seç.');
    let ext, type;
    if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) { ext = 'jpg'; type = 'image'; }
    else if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { ext = 'png'; type = 'image'; }
    else if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') { ext = 'webp'; type = 'image'; }
    else if (data.toString('ascii', 4, 8) === 'ftyp' && ['isom', 'mp42', 'mp41', 'avc1', 'M4V ', 'qt  '].includes(data.toString('ascii', 8, 12))) { ext = data.toString('ascii', 8, 12) === 'qt  ' ? 'mov' : 'mp4'; type = 'video'; }
    else throw fail(400, 'JPG, PNG, WebP, MP4 veya MOV yükleyebilirsin.');
    const filename = `${randomUUID()}.${ext}`;
    const asset = await storage.put(filename, data);
    const url = asset.url;
    (await db.prepare('INSERT INTO uploads VALUES (?, ?, ?)').run(url, req.user.id, type));
    await db.prepare('INSERT INTO media_assets(url,content_hash,mime,size_bytes) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').run(url, digest(data), asset.mime, data.length);
    res.status(201).json({ url, type });
  });
  app.post('/api/products', auth, seller, async (req, res) => {
    const data = input(z.object({ title: text(3, 100), description: text(10, 2000), price: z.number().int().min(100).max(100000000), category: z.enum(['Giyim', 'Çanta', 'Ayakkabı', 'Aksesuar', 'Yaşam']), media: text(1, 1000).optional(), gallery: z.array(text(1, 1000)).min(1).max(6).optional(), sizes: z.array(text(1, 20)).min(1).max(15), stock: z.number().int().min(1).max(10000), color: text(1, 40) }), req.body);
    const urls = data.gallery || (data.media ? [data.media] : []);
    if (!urls.length || new Set(urls).size !== urls.length) throw fail(400, '1–6 farklı fotoğraf veya video seç.');
    const gallery = [];
    for (const url of urls) {
      const asset = await db.prepare('SELECT * FROM uploads WHERE url=? AND user_id=?').get(url, req.user.id);
      if (!asset) throw fail(400, 'Kendi yüklediğin bir fotoğraf veya video seç.');
      gallery.push({ url: asset.url, type: asset.type, poster: '' });
    }
    const product = { ...data, gallery, media: gallery[0].url, id: randomUUID(), sellerId: req.user.id, shop: req.user.shop, mediaType: gallery[0].type, poster: '', sizes: [...new Set(data.sizes)], createdAt: new Date().toISOString() };
    await db.transaction(async () => {
      await db.prepare('INSERT INTO products VALUES (?, ?, ?, ?)').run(product.id, req.user.id, JSON.stringify(product), data.stock);
      await enqueueAnalysis(db, product);
      await notifyFollowers(db,product);
    });
    res.status(201).json({ product });
  });
  app.get('/api/orders', auth, async (req, res) => res.json({ orders: (await db.prepare(`SELECT o.data,${shippingSql} AS shipping,${shipmentListSql} AS shipments FROM orders o LEFT JOIN order_shipping s ON s.order_id=o.id WHERE o.user_id=? ORDER BY (o.data::jsonb->>'createdAt') DESC`).all(req.user.id)).map(row => ({...JSON.parse(row.data),shipping:row.shipping,shipments:row.shipments})) }));
  app.post('/api/checkout', auth, async (req, res) => {
    if (!demo) throw fail(503, 'Gerçek ödeme henüz etkin değil. Ödeme sağlayıcısı bağlantısı gerekiyor.');
    const data = input(z.object({ requestKey: z.uuid(), demoAcknowledged: z.literal(true, { error: 'Demo sipariş bilgisini onayla.' }), address: text(15, 500), name: text(2, 80), items: z.array(z.object({ productId: text(1, 100), size: text(1, 20), quantity: z.number().int().min(1).max(20) })).min(1).max(50) }), req.body);
    const order = await db.transaction(async () => {
      await db.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').get(req.user.id);
      const previous = await db.prepare('SELECT data FROM orders WHERE user_id=? AND request_key=?').get(req.user.id, data.requestKey);
      if (previous) return JSON.parse(previous.data);
      const items = [], reserved = new Map();
      for (const item of data.items) {
        const row = (await db.prepare('SELECT * FROM products WHERE id=? AND NOT EXISTS (SELECT 1 FROM product_moderation m WHERE m.product_id=products.id AND m.hidden) AND NOT EXISTS (SELECT 1 FROM account_moderation a WHERE a.user_id=products.seller_id AND a.suspended)').get(item.productId));
        if (!row) throw fail(400, 'Sepetindeki bir ürün artık mevcut değil.');
        const product = JSON.parse(row.data);
        if (!product.sizes.includes(item.size)) throw fail(400, `${product.title} için geçerli bir seçenek seç.`);
        const quantity = (reserved.get(product.id) || 0) + item.quantity;
        if (quantity > row.stock) throw fail(409, `${product.title} için yeterli stok yok.`);
        reserved.set(product.id, quantity);
        items.push({ ...item, title: product.title, shop: product.shop, sellerId: product.sellerId, price: product.price });
      }
      // Demo orders never reserve inventory or trigger fulfillment.
      const order = { id: `SW-${randomBytes(4).toString('hex').toUpperCase()}`, status: 'demo', total: items.reduce((sum, item) => sum + item.price * item.quantity, 0), items, createdAt: new Date().toISOString() };
      (await db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?)').run(order.id, req.user.id, data.requestKey, JSON.stringify(order)));
      await createShipments(db,order);
      return order;
    });
    res.status(201).json({ order });
  });
  app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Dosya yüklenemedi. En fazla 50 MB yükleyebilirsin.' });
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'İşlem tamamlanamadı. Lütfen tekrar dene.' : error.message });
  });
  return { app, db };
}

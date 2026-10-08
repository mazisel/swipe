import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.mjs';

const dir = mkdtempSync(join(tmpdir(), 'swipe-test-'));
const { app, db } = await createApp({ dbPath: ':memory:', uploadDir: dir, demo: true });
let server, base, seller, buyer, product, uploaded;
async function call(route, body, token, form) {
  const response = await fetch(`${base}/api${route}`, { method: body || form ? 'POST' : 'GET', headers: { ...(!form && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) }, body: form || (body && JSON.stringify(body)) });
  return { status: response.status, ...(await response.json()) };
}
before(async () => { server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); rmSync(dir, { recursive: true }); });

test('discovery is public, mixed-media and contains integer money', async () => { const result = await call('/products'); assert.equal(result.status, 200); assert.equal(result.products.length, 20); assert.ok(result.products.some(p => p.mediaType === 'video')); assert.ok(result.products.every(p => Number.isInteger(p.price))); });
test('anonymous users cannot create shops or orders', async () => { assert.equal((await call('/shop', { name: 'Denied' })).status, 401); assert.equal((await call('/checkout', {})).status, 401); });
test('accounts normalize emails and store hashed passwords only', async () => {
  seller = await call('/auth/register', { email: 'Seller@example.com', name: 'Deniz Yılmaz', password: 'test-password-123' });
  buyer = await call('/auth/register', { email: 'buyer@example.com', name: 'Ece Kaya', password: 'test-password-456' });
  assert.equal(seller.status, 201); assert.equal(seller.user.email, 'seller@example.com'); assert.equal(seller.user.password, undefined);
  const row = (await db.prepare('SELECT password FROM users WHERE id=?').get(seller.user.id)); assert.notEqual(row.password, 'test-password-123'); assert.match(row.password, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal((await call('/auth/register', { email: 'seller@example.com', name: 'Same', password: 'test-password-123' })).status, 409);
  assert.equal((await call('/auth/login', { email: 'seller@example.com', password: 'wrong-password' })).status, 401);
});
test('seller must open a shop and can upload only supported file content', async () => {
  assert.equal((await call('/products', {}, buyer.token)).status, 403);
  const shop = await call('/shop', { name: 'Deniz Atelier' }, seller.token); assert.equal(shop.user.shop, 'Deniz Atelier');
  const bad = new FormData(); bad.append('file', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'fake.png');
  assert.equal((await call('/uploads', undefined, seller.token, bad)).status, 400);
  const form = new FormData(); form.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'product.png');
  uploaded = await call('/uploads', undefined, seller.token, form); assert.equal(uploaded.status, 201); assert.match(uploaded.url, /^\/uploads\/.+\.png$/);
});
test('product publishing enforces seller ownership and validation', async () => {
  const data = { title: 'Keten gömlek', description: 'Yumuşak ve rahat bir keten gömlek.', price: 129900, category: 'Giyim', media: uploaded.url, sizes: ['S', 'M'], stock: 2, color: 'Ekru' };
  await call('/shop', { name: 'Ece Studio' }, buyer.token);
  assert.equal((await call('/products', data, buyer.token)).status, 400);
  assert.equal((await call('/products', { ...data, price: -100 }, seller.token)).status, 400);
  const result = await call('/products', data, seller.token); assert.equal(result.status, 201); product = result.product; assert.equal(product.shop, 'Deniz Atelier'); assert.equal(product.sellerId, seller.user.id);
  assert.equal((await call('/products')).products[0].id, product.id);
});
const checkout = (items) => ({ name: 'Ece Kaya', address: 'Örnek Mahallesi 15 Kadıköy İstanbul', demoAcknowledged: true, requestKey: randomUUID(), items });
test('checkout verifies aggregate stock and variants before creating an order', async () => {
  const invalid = await call('/checkout', checkout([{ productId: product.id, size: 'XL', quantity: 1 }]), buyer.token); assert.equal(invalid.status, 400);
  const tooMany = await call('/checkout', checkout([{ productId: product.id, size: 'S', quantity: 2 }, { productId: product.id, size: 'M', quantity: 1 }]), buyer.token); assert.equal(tooMany.status, 409);
  assert.equal((await call('/orders', undefined, buyer.token)).orders.length, 0);
});
test('server prices override forged client prices; retry creates one demo order', async () => {
  const payload = checkout([{ productId: product.id, size: 'S', quantity: 2, price: 1 }]);
  const first = await call('/checkout', payload, buyer.token); assert.equal(first.status, 201); assert.equal(first.order.total, 259800); assert.equal(first.order.status, 'demo');
  const retry = await call('/checkout', payload, buyer.token); assert.equal(retry.order.id, first.order.id);
  assert.equal((await call('/orders', undefined, buyer.token)).orders.length, 1); assert.equal((await call('/orders', undefined, seller.token)).orders.length, 0);
  assert.equal((await db.prepare('SELECT stock FROM products WHERE id=?').get(product.id)).stock, 2);
});
test('demo acknowledgement is required and logout revokes access', async () => {
  assert.equal((await call('/checkout', { ...checkout([{ productId: product.id, size: 'S', quantity: 1 }]), demoAcknowledged: false }, buyer.token)).status, 400);
  assert.equal((await call('/auth/logout', {}, buyer.token)).status, 200); assert.equal((await call('/me', undefined, buyer.token)).status, 401);
});
test('a single order preserves products from different sellers', async () => {
  const result = await call('/checkout', checkout([{ productId: 'soft-knit', size: 'M', quantity: 1 }, { productId: 'everyday-bag', size: 'Standart', quantity: 1 }]), seller.token);
  assert.equal(result.status, 201);
  assert.equal(result.order.total, 318900);
  assert.equal(new Set(result.order.items.map(item => item.sellerId)).size, 2);
});
test('shop profile edits belong to the authenticated seller and public profiles omit account data', async () => {
  assert.equal((await call('/shop/profile', { name: 'Denied', bio: '' })).status, 401);
  const result = await call('/shop/profile', { name: 'Deniz Studio', bio: 'Küçük seriler, doğal dokular.', userId: buyer.user.id }, seller.token);
  assert.equal(result.status, 200); assert.equal(result.user.shop, 'Deniz Studio');
  assert.equal((await db.prepare('SELECT shop FROM users WHERE id=?').get(buyer.user.id)).shop, 'Ece Studio');
  const publicProfile = await call(`/shops/${seller.user.id}`);
  assert.equal(publicProfile.shop.bio, 'Küçük seriler, doğal dokular.');
  assert.equal(publicProfile.shop.email, undefined); assert.equal(publicProfile.products[0].shop, 'Deniz Studio');
  assert.equal((await call('/shops/missing-id')).status, 404);
});
test('payment remains disabled unless demo is explicitly enabled', async () => {
  const other = await createApp({ dbPath: ':memory:', uploadDir: dir, demo: false });
  const local = await new Promise(resolve => { const s = other.app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const url = `http://127.0.0.1:${local.address().port}/api`;
    const register = await fetch(`${url}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test User', email: 'disabled@example.com', password: 'password123' }) });
    const { token } = await register.json();
    const result = await fetch(`${url}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' }); assert.equal(result.status, 503);
  } finally { await new Promise(resolve => local.close(resolve)); await other.db.close(); }
});


test('gallery validates every asset owner, limit, uniqueness and ordered cover', async () => {
  const form = new FormData(); form.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'second.png');
  const second = await call('/uploads', undefined, seller.token, form);
  const data = { title: 'Çoklu görsel ürünü', description: 'Birden fazla medya ile örnek ürün.', price: 9900, category: 'Giyim', sizes: ['M'], stock: 3, color: 'Beyaz' };
  assert.equal((await call('/products', { ...data, gallery: [] }, seller.token)).status, 400);
  assert.equal((await call('/products', { ...data, gallery: Array(7).fill(uploaded.url) }, seller.token)).status, 400);
  assert.equal((await call('/products', { ...data, gallery: [uploaded.url, uploaded.url] }, seller.token)).status, 400);
  assert.equal((await call('/products', { ...data, gallery: [uploaded.url, '/uploads/not-owned.mp4'] }, seller.token)).status, 400);
  const result = await call('/products', { ...data, gallery: [second.url, uploaded.url] }, seller.token);
  assert.equal(result.status, 201);
  assert.equal(result.product.media, second.url);
  assert.deepEqual(result.product.gallery.map(item => item.url), [second.url, uploaded.url]);
  assert.ok(result.product.gallery.every(item => item.type === 'image'));
  assert.deepEqual(JSON.parse((await db.prepare('SELECT data FROM products WHERE id=?').get(result.product.id)).data).gallery, result.product.gallery);
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.mjs';
import { seedProducts } from '../server/seed.mjs';
const dir = mkdtempSync(join(tmpdir(), 'swipe-social-'));
const { app, db } = await createApp({ dbPath: ':memory:', uploadDir: dir, demo: true });
let server, base, buyer, seller, stranger, conversationId, messageId;
const productId = 'social-test-product';
async function call(route, body, token) {
  const r = await fetch(`${base}/api${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, ...(await r.json()) };
}
before(async () => {
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`;
  [buyer, seller, stranger] = await Promise.all(['buyer', 'seller', 'stranger'].map(role => call('/auth/register', { name: `${role} Test`, email: `${role}@social.example.invalid`, password: 'local-test-only-123' })));
  await call('/shop', { name: 'Social Studio' }, seller.token);
  const p = { ...seedProducts[0], id: productId, sellerId: seller.user.id, shop: 'Social Studio' };
  (await db.prepare('INSERT INTO products VALUES (?,?,?,?)').run(p.id, p.sellerId, JSON.stringify(p), p.stock));
});
after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); rmSync(dir, { recursive: true }); });

test('comments require auth, validate text and use server-owned identity', async () => {
  assert.equal((await call(`/products/${productId}/comments`, { body: 'Hello' })).status, 401);
  assert.equal((await call(`/products/${productId}/comments`, { body: '  ' }, buyer.token)).status, 400);
  assert.equal((await call(`/products/${productId}/comments`, { body: 'x'.repeat(1001) }, buyer.token)).status, 400);
  const result = await call(`/products/${productId}/comments`, { body: '  Dokusu nasıl?  ', userId: seller.user.id, name: 'Fake Seller' }, buyer.token);
  assert.equal(result.status, 201); assert.equal(result.comment.userId, buyer.user.id); assert.equal(result.comment.body, 'Dokusu nasıl?');
  const list = await call(`/products/${productId}/comments`);
  assert.equal(list.comments[0].name, 'buyer T.'); assert.equal(list.comments[0].email, undefined);
  assert.equal((await call('/products')).products.find(p => p.id === productId).commentCount, 1);
  assert.equal((await call(`/comments/${result.comment.id}/remove`, {}, stranger.token)).status, 404);
  assert.equal((await call(`/comments/${result.comment.id}/remove`, {}, buyer.token)).status, 200);
  assert.equal((await call(`/products/${productId}/comments`)).comments.length, 0);
  assert.equal((await call('/products/unknown/comments')).status, 404);
});
test('ratings require an order and reject seller self-rating or invalid scores', async () => {
  assert.equal((await call(`/products/${productId}/reviews`, { rating: 5, body: 'Great' })).status, 401);
  assert.equal((await call(`/products/${productId}/reviews`, { rating: 5, body: 'Great' }, buyer.token)).status, 403);
  assert.equal((await call(`/products/${productId}/reviews`, { rating: 5, body: 'Great' }, seller.token)).status, 403);
  assert.equal((await call(`/products/${productId}/review-eligibility`, undefined, buyer.token)).eligible, false);
  const order = await call('/checkout', { name: 'Buyer Test', address: 'Demo adresi Kadıköy İstanbul', demoAcknowledged: true, requestKey: randomUUID(), items: [{ productId, size: 'M', quantity: 1 }] }, buyer.token);
  assert.equal(order.status, 201);
  assert.equal((await call(`/products/${productId}/review-eligibility`, undefined, buyer.token)).purchaseType, 'demo');
  for (const rating of [0, 6, 3.5]) assert.equal((await call(`/products/${productId}/reviews`, { rating, body: 'Nice piece' }, buyer.token)).status, 400);
});
test('one review per buyer updates aggregates without inventing verified purchases', async () => {
  assert.equal((await call(`/products/${productId}/reviews`, { rating: 4, body: 'Demo değerlendirmem.', purchaseType: 'verified' }, buyer.token)).status, 200);
  await call(`/products/${productId}/reviews`, { rating: 5, body: 'Güncellenen demo değerlendirmem.' }, buyer.token);
  const list = await call(`/products/${productId}/reviews`);
  assert.deepEqual(list.summary, { count: 1, average: 5 }); assert.equal(list.reviews.length, 1); assert.equal(list.reviews[0].purchaseType, 'demo');
  const p = (await call('/products')).products.find(p => p.id === productId); assert.equal(p.reviewCount, 1); assert.equal(p.ratingAverage, 5);
});
test('conversations are product-bound, unique and hide empty threads from inbox', async () => {
  assert.equal((await call('/conversations/start', { productId })).status, 401);
  assert.equal((await call('/conversations/start', { productId }, seller.token)).status, 400);
  assert.equal((await call('/conversations/start', { productId: 'missing' }, buyer.token)).status, 404);
  const first = await call('/conversations/start', { productId, sellerId: stranger.user.id }, buyer.token);
  conversationId = first.conversation.id;
  assert.equal(first.conversation.peerName, 'Social Studio'); assert.equal((await call('/conversations/start', { productId }, buyer.token)).conversation.id, conversationId);
  assert.equal((await call('/conversations', undefined, buyer.token)).conversations.length, 0);
});
test('DM membership protects reads, writes and read receipts from third parties', async () => {
  for (const token of [stranger.token]) {
    assert.equal((await call(`/conversations/${conversationId}`, undefined, token)).status, 404);
    assert.equal((await call(`/conversations/${conversationId}/messages`, { body: 'Unauthorized', requestKey: randomUUID() }, token)).status, 404);
    assert.equal((await call(`/conversations/${conversationId}/read`, { messageId: 1 }, token)).status, 404);
  }
  assert.equal((await call(`/conversations/${conversationId}`)).status, 401);
  assert.equal((await call('/conversations?role=seller', undefined, buyer.token)).status, 403);
  assert.equal((await call('/conversations', undefined, stranger.token)).conversations.length, 0);
});
test('DM retries are idempotent, validate text and cannot spoof sender', async () => {
  assert.equal((await call(`/conversations/${conversationId}/messages`, { body: '  ', requestKey: randomUUID() }, buyer.token)).status, 400);
  assert.equal((await call(`/conversations/${conversationId}/messages`, { body: 'x'.repeat(2001), requestKey: randomUUID() }, buyer.token)).status, 400);
  const payload = { body: 'M bedenin ölçüsü nedir?', requestKey: randomUUID(), senderId: seller.user.id };
  const first = await call(`/conversations/${conversationId}/messages`, payload, buyer.token); messageId = first.message.id;
  const retry = await call(`/conversations/${conversationId}/messages`, payload, buyer.token);
  assert.equal(first.message.senderId, buyer.user.id); assert.equal(retry.message.id, messageId);
  assert.equal((await call(`/conversations/${conversationId}`, undefined, seller.token)).messages.length, 1);
});
test('seller replies and read receipts update only the correct participant inbox', async () => {
  const inbox = await call('/conversations?role=seller', undefined, seller.token);
  assert.equal(inbox.conversations[0].unread, 1); assert.equal(inbox.conversations[0].peerName, 'buyer T.');
  assert.equal((await call('/conversations', undefined, seller.token)).conversations.length, 0);
  assert.equal((await call(`/conversations/${conversationId}/read`, { messageId: 999999 }, seller.token)).status, 400);
  await call(`/conversations/${conversationId}/read`, { messageId }, seller.token);
  assert.equal((await call('/conversations?role=seller', undefined, seller.token)).conversations[0].unread, 0);
  assert.equal((await call(`/conversations/${conversationId}`, undefined, buyer.token)).conversation.peerRead, messageId);
  const reply = await call(`/conversations/${conversationId}/messages`, { body: 'Tabii, ölçü bilgisini paylaşalım.', requestKey: randomUUID() }, seller.token);
  assert.equal((await call('/conversations', undefined, buyer.token)).conversations[0].unread, 1);
  await call(`/conversations/${conversationId}/read`, { messageId: reply.message.id }, buyer.token);
  assert.equal((await call('/conversations', undefined, buyer.token)).conversations[0].unread, 0);
});

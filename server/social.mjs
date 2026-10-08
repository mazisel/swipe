import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { blocked, lockPeers } from './safety.mjs';
import { notify } from './notifications.mjs';

export function installSocial({ app, db, auth, fail, input, text, weakSignal }) {
  const product = async id => {
    const row = (await db.prepare('SELECT * FROM products WHERE id=?').get(id));
    if (!row) throw fail(404, 'Ürün bulunamadı.');
    return row;
  };
  const authorName = name => { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0]}.` : parts[0]; };
  const publicEntry = row => ({ id: row.id, userId: row.user_id, name: authorName(row.name), body: row.body, createdAt: row.created_at, ...(row.rating && { rating: row.rating, purchaseType: row.purchase_type }) });
  const summary = async id => {
    const result = (await db.prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews WHERE product_id=?').get(id));
    return { count: result.count, average: Number(result.average) || 0 };
  };
  const purchaseType = async (userId, productId) => {
    const orders = (await db.prepare('SELECT data FROM orders WHERE user_id=?').all(userId)).map(r => JSON.parse(r.data));
    // A demo order is not a verified physical purchase.
    return orders.some(o => o.status === 'demo' && o.items.some(i => i.productId === productId)) ? 'demo' : null;
  };
  app.get('/api/products/:id/comments', async (req, res) => {
    (await product(req.params.id));
    const comments = (await db.prepare('SELECT comments.*, users.name FROM comments JOIN users ON users.id=comments.user_id WHERE product_id=? ORDER BY comments.created_at DESC, comments.id').all(req.params.id)).map(publicEntry);
    res.json({ comments });
  });
  app.post('/api/products/:id/comments', auth, async (req, res) => {
    (await product(req.params.id)); const { body } = input(z.object({ body: text(1, 1000) }), req.body);
    const id = randomUUID(), createdAt = new Date().toISOString();
    (await db.prepare('INSERT INTO comments VALUES (?,?,?,?,?)').run(id, req.params.id, req.user.id, body, createdAt));
    await weakSignal?.(req.user.id, req.params.id, 'comment');
    res.status(201).json({ comment: { id, userId: req.user.id, name: authorName(req.user.name), body, createdAt } });
  });
  app.post('/api/comments/:id/remove', auth, async (req, res) => {
    const result = (await db.prepare('DELETE FROM comments WHERE id=? AND user_id=?').run(req.params.id, req.user.id));
    if (!result.changes) throw fail(404, 'Yorum bulunamadı veya sana ait değil.');
    res.json({ ok: true });
  });
  app.get('/api/products/:id/reviews', async (req, res) => {
    (await product(req.params.id));
    res.json({ reviews: (await db.prepare('SELECT reviews.*, users.name FROM reviews JOIN users ON users.id=reviews.user_id WHERE product_id=? ORDER BY reviews.created_at DESC, reviews.id').all(req.params.id)).map(publicEntry), summary: (await summary(req.params.id)) });
  });
  app.get('/api/products/:id/review-eligibility', auth, async (req, res) => {
    const row = (await product(req.params.id));
    const type = row.seller_id !== req.user.id ? (await purchaseType(req.user.id, row.id)) : null;
    res.json({ eligible: !!type, purchaseType: type, reason: row.seller_id === req.user.id ? 'Kendi ürününü değerlendiremezsin.' : type ? '' : 'Bu parçayı sipariş ettikten sonra değerlendirebilirsin.' });
  });
  app.post('/api/products/:id/reviews', auth, async (req, res) => {
    const row = (await product(req.params.id));
    if (row.seller_id === req.user.id) throw fail(403, 'Kendi ürününü değerlendiremezsin.');
    const type = (await purchaseType(req.user.id, row.id));
    if (!type) throw fail(403, 'Yalnızca sipariş ettiğin parçaları değerlendirebilirsin.');
    const data = input(z.object({ rating: z.number().int().min(1).max(5), body: text(3, 2000) }), req.body);
    (await db.prepare(`INSERT INTO reviews VALUES (?,?,?,?,?,?,?) ON CONFLICT(product_id,user_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,created_at=excluded.created_at`).run(randomUUID(), row.id, req.user.id, data.rating, data.body, type, new Date().toISOString()));
    res.json({ ok: true, summary: (await summary(row.id)) });
  });
  const member = async (id, userId) => {
    const row = (await db.prepare('SELECT * FROM conversations WHERE id=? AND (buyer_id=? OR seller_id=?)').get(id, userId, userId));
    if (!row) throw fail(404, 'Sohbet bulunamadı.');
    return row;
  };
  const message = row => ({ id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at });
  const conversation = async (row, userId) => {
    const isBuyer = row.buyer_id === userId;
    const peer = (await db.prepare('SELECT name, shop FROM users WHERE id=?').get(isBuyer ? row.seller_id : row.buyer_id));
    const p = JSON.parse((await product(row.product_id)).data);
    const last = (await db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 1').get(row.id));
    const peerId=isBuyer?row.seller_id:row.buyer_id;
    return { peerId,blocked:await blocked(db,userId,peerId),blockedByMe:!!await db.prepare('SELECT 1 FROM dm_blocks WHERE blocker_id=? AND blocked_id=?').get(userId,peerId), id: row.id, productId: p.id, productTitle: p.title, peerName: isBuyer ? peer.shop : authorName(peer.name), peerRead: isBuyer ? row.seller_read : row.buyer_read, unread: (await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=? AND sender_id!=? AND id>?').get(row.id, userId, isBuyer ? row.buyer_read : row.seller_read)).n, lastMessage: last ? message(last) : null };
  };
  app.post('/api/conversations/start', auth, async (req, res) => {
    const { productId } = input(z.object({ productId: text(1, 100) }), req.body); const p = (await product(productId));
    if (p.seller_id === req.user.id) throw fail(400, 'Kendi mağazana mesaj gönderemezsin.');
    if(await blocked(db,req.user.id,p.seller_id))throw fail(403,'Bu hesapla mesajlaşma kapalı.');
    (await db.prepare('INSERT INTO conversations (id,product_id,buyer_id,seller_id) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').run(randomUUID(), productId, req.user.id, p.seller_id));
    const row = (await db.prepare('SELECT * FROM conversations WHERE product_id=? AND buyer_id=?').get(productId, req.user.id));
    res.json({ conversation: (await conversation(row, req.user.id)) });
  });
  app.get('/api/conversations', auth, async (req, res) => {
    const sellerView = req.query.role === 'seller';
    if (sellerView && !req.user.shop) throw fail(403, 'Mağaza hesabı gerekiyor.');
    const rows = (await db.prepare(`SELECT * FROM conversations WHERE ${sellerView ? 'seller_id' : 'buyer_id'}=? AND EXISTS(SELECT 1 FROM messages WHERE conversation_id=conversations.id)`).all(req.user.id));
    res.json({ conversations: (await Promise.all(rows.map(async row => (await conversation(row, req.user.id))))).sort((a, b) => b.lastMessage.id - a.lastMessage.id) });
  });
  app.get('/api/conversations/:id', auth, async (req, res) => {
    const row = (await member(req.params.id, req.user.id));
    res.json({ conversation: (await conversation(row, req.user.id)), messages: (await db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY id').all(row.id)).map(message) });
  });
  app.post('/api/conversations/:id/messages', auth, async (req, res) => {
    const row = (await member(req.params.id, req.user.id));
    const data = input(z.object({ body: text(1, 2000), requestKey: z.uuid() }), req.body);
    const result=await db.transaction(async()=>{
    const peerId=row.buyer_id===req.user.id?row.seller_id:row.buyer_id;
    await lockPeers(db,req.user.id,peerId);
    if(await blocked(db,req.user.id,peerId))throw fail(403,'Bu hesapla mesajlaşma kapalı.');
    (await db.prepare('INSERT INTO messages (conversation_id,sender_id,body,request_key,created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').run(row.id, req.user.id, data.body, data.requestKey, new Date().toISOString()));
    const result = (await db.prepare('SELECT * FROM messages WHERE conversation_id=? AND sender_id=? AND request_key=?').get(row.id, req.user.id, data.requestKey));
    await notify(db,{userId:peerId,eventKey:`message:${result.id}`,kind:'message',title:'Yeni bir mesajın var.',route:peerId===row.seller_id?`/studio?section=messages&conversationId=${row.id}`:`/messages?conversationId=${row.id}`});
    return result;
    });
    await weakSignal?.(req.user.id, row.product_id, 'dm');
    res.json({ message: message(result) });
  });
  app.post('/api/conversations/:id/read', auth, async (req, res) => {
    const row = (await member(req.params.id, req.user.id)); const { messageId } = input(z.object({ messageId: z.number().int().positive() }), req.body);
    if (!(await db.prepare('SELECT id FROM messages WHERE id=? AND conversation_id=?').get(messageId, row.id))) throw fail(400, 'Mesaj bulunamadı.');
    const column = row.buyer_id === req.user.id ? 'buyer_read' : 'seller_read';
    (await db.prepare(`UPDATE conversations SET ${column}=GREATEST(${column},?) WHERE id=?`).run(messageId, row.id));
    res.json({ ok: true });
  });
}

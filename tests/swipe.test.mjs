import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horizontalIntent, releasedSwipe, planSwipe, undoSwipeCart, SwipeLessonCounter } from '../shared/swipe.ts';
import { seedProducts } from '../server/seed.mjs';

test('swipe actions require deliberate horizontal distance; vertical, diagonal and multitouch stay neutral', () => {
  assert.equal(releasedSwipe(-130, 8, 390), 'save');
  assert.equal(releasedSwipe(130, 8, 390), 'cart');
  assert.equal(releasedSwipe(-40, 0, 390), null);
  assert.equal(releasedSwipe(130, 110, 390), null);
  assert.equal(releasedSwipe(15, 200, 390), null);
  assert.equal(horizontalIntent(130, 0, 2), false);
  assert.equal(releasedSwipe(80, 0, 280), 'cart');
});
test('repeated save is idempotent and never unsaves an existing favorite', () => {
  const product = seedProducts[0];
  const first = planSwipe([], [], product, 'save');
  assert.deepEqual(first.saved, [product.id]);
  assert.equal(planSwipe([], first.saved, product, 'save').saved, undefined);
});
test('swipe cart requires a valid size and stock, and never increments any existing variant', () => {
  const product = seedProducts.find(p => p.sizes.length > 1), size = product.sizes[0];
  assert.equal(planSwipe([], [], product, 'cart').cart, undefined);
  assert.equal(planSwipe([], [], product, 'cart', 'invalid').cart, undefined);
  assert.equal(planSwipe([], [], { ...product, stock: 0 }, 'cart', size).cart, undefined);
  const first = planSwipe([], [], product, 'cart', size);
  assert.equal(first.cart[0].quantity, 1);
  assert.equal(planSwipe(first.cart, [], product, 'cart', size).cart, undefined);
  assert.equal(planSwipe(first.cart, [], product, 'cart', product.sizes[1]).cart, undefined);
});
test('undo removes only its own unchanged cart line and preserves unrelated contents', () => {
  const product = seedProducts[0], previous = { productId: 'other', size: 'M', quantity: 2 };
  const change = planSwipe([previous], [], product, 'cart', product.sizes[0]);
  assert.deepEqual(undoSwipeCart(change.cart, change.line), [previous]);
  const edited = change.cart.map(line => line === change.line ? { ...line, quantity: 2 } : line);
  assert.equal(undoSwipeCart(edited, change.line), null);
  assert.equal(undoSwipeCart([previous], change.line), null);
});
test('lesson waits for three product transitions, excludes refreshes, hidden items and new sessions', () => {
  const lesson = new SwipeLessonCounter();
  assert.equal(lesson.observe('a', '1', true), false);
  assert.equal(lesson.observe('a', '1', true), false);
  assert.equal(lesson.observe('a', '2', true), false);
  assert.equal(lesson.observe('a', '2', false), false);
  lesson.rebase();
  assert.equal(lesson.observe('a', '3', true), false);
  assert.equal(lesson.observe('b', '1', true), false);
  assert.equal(lesson.observe('b', '2', true), false);
  assert.equal(lesson.observe('b', '3', true), true);
  assert.equal(lesson.transitions, 3);
});

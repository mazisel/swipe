import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productGallery, nextMedia } from '../shared/gallery.ts';
import { seedProducts } from '../server/seed.mjs';
test('legacy single-media products work and gallery navigation stays within the product', () => {
  const legacy = { ...seedProducts[0], gallery: undefined };
  assert.equal(productGallery(legacy)[0].url, legacy.media);
  assert.equal(nextMedia(0, -1, 3), 0);
  assert.equal(nextMedia(2, 1, 3), 2);
  assert.equal(nextMedia(1, 1, 3), 2);
});
test('expanded demo has 20 unique products and 3 video covers with matching gallery cover', () => {
  assert.equal(seedProducts.length, 20);
  assert.equal(new Set(seedProducts.map(p => p.id)).size, 20);
  assert.equal(seedProducts.filter(p => p.mediaType === 'video').length, 3);
  for (const p of seedProducts) {
    assert.ok(p.gallery.length >= 2 && p.gallery.length <= 6);
    assert.equal(p.gallery[0].url, p.media);
    assert.equal(p.gallery[0].type, p.mediaType);
  }
});

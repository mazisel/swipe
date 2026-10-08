import type { Product, ProductMedia } from './types';
export function productGallery(product: Product): ProductMedia[] {
  return product.gallery?.length ? product.gallery.slice(0, 6) : [{ url: product.media, type: product.mediaType, poster: product.poster }];
}
export function nextMedia(index: number, delta: number, count: number) {
  return Math.max(0, Math.min(count - 1, index + delta));
}

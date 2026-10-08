import type { CartItem, Product } from './types';

export type SwipeAction = 'save' | 'cart';
export const SWIPE_UNDO_MS = 8000;
export const swipeThreshold = (width: number) => Math.max(72, Math.min(112, width * .27));
export function horizontalIntent(dx: number, dy: number, touches = 1) {
  return touches === 1 && Math.abs(dx) >= 14 && Math.abs(dx) > Math.abs(dy) * 1.65;
}
export function releasedSwipe(dx: number, dy: number, width: number): SwipeAction | null {
  if (!horizontalIntent(dx, dy) || Math.abs(dx) < swipeThreshold(width)) return null;
  return dx < 0 ? 'save' : 'cart';
}

export function planSwipe(cart: CartItem[], saved: string[], product: Product, kind: SwipeAction, size?: string) {
  if (kind === 'save') return saved.includes(product.id)
    ? { message: 'Bu parçayı zaten beğendin.' }
    : { message: 'Beğendiklerine eklendi.', saved: [...saved, product.id] };
  if (cart.some(item => item.productId === product.id)) return { message: 'Bu parça zaten çantanda.' };
  if (product.stock <= 0) return { message: 'Bu parça şu an tükenmiş.' };
  if (!size || !product.sizes.includes(size)) return { message: 'Önce bir beden seç.' };
  const line: CartItem = { productId: product.id, size, quantity: 1 };
  return { message: 'Çantana eklendi.', cart: [...cart, line], line };
}

// An undo receipt may remove only the line it inserted, never a later edit.
export function undoSwipeCart(cart: CartItem[], line: CartItem) {
  return cart.includes(line) ? cart.filter(item => item !== line) : null;
}

export class SwipeLessonCounter {
  transitions = 0;
  session = '';
  product = '';
  observe(session: string, product: string, scrolled: boolean) {
    if (!product || !session) return false;
    if (this.session === session && this.product && this.product !== product && scrolled) this.transitions++;
    this.session = session;
    this.product = product;
    return this.transitions >= 3;
  }
  rebase() { this.product = ''; }
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, loadToken, saveToken } from './api';
import { initializeDiscovery, trackDiscovery, deferDiscovery, flushDiscovery, beginIdentityChange, finishIdentityChange, resetDiscovery, hideDiscovery } from './discovery';
import { AppState } from 'react-native';
import { CartItem, Product, User } from '../../shared/types';
import { planSwipe, undoSwipeCart, SWIPE_UNDO_MS, SwipeAction } from '../../shared/swipe';
import { useLikes } from './useLikes';
import { useFollowing } from './useFollowing';
import { useLiveState } from './useLiveState';

export type SwipeReceipt = { key: string; message: string; expiresAt: number; undo?: () => boolean | Promise<boolean> };

function useStoreState() {
  const [feedRevision, setFeedRevision] = useState(0);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart, cartNow] = useLiveState<CartItem[]>([]);
  const likes = useLikes();
  const { saved, savedNow, loadLikes, setLike, suspendLikes } = likes;
  const saveReceipts = useRef(new Map<string, symbol>());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const follows = useFollowing(hydrated, user?.id || 'guest', feedRevision);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState('unavailable');
  const [toast, setToast] = useState('');
  async function refresh() {
    try { const data = await api<{ products: Product[]; checkout: string }>('/products'); setProducts(data.products); setCheckout(data.checkout); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    // refresh only commits state after the asynchronous API request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem('swipe-bag');
        if (raw) { const data = JSON.parse(raw); if (Array.isArray(data.cart)) setCart(data.cart); }
        if (await loadToken()) { try { const data = await api<{ user: User }>('/me'); setUser(data.user); } catch { await saveToken(null); } }
      } catch { /* Invalid local cache must not prevent discovery. */ }
      finally {
        try { await initializeDiscovery(); setDiscoveryReady(true); await loadLikes(true); } catch { /* Feed offers retry when identity cannot be initialized. */ }
        setHydrated(true);
      }
    })();
  }, [setCart, loadLikes]);
  useEffect(() => {
    const timer = setInterval(() => { void flushDiscovery(); }, 5000);
    const listener = AppState.addEventListener('change', () => { void flushDiscovery(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);
  useEffect(() => {
    if (!hydrated || !likes.likesReady) return;
    const update = () => { if (AppState.currentState === 'active') void loadLikes(); };
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener('change', update);
    return () => { clearInterval(timer); subscription.remove(); };
  }, [hydrated, likes.likesReady, loadLikes]);
  useEffect(() => { if (hydrated) void AsyncStorage.mergeItem('swipe-bag', JSON.stringify({ cart })).catch(() => setToast('Bu cihazda sepet kaydedilemedi.')); }, [cart, hydrated]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); } }, [toast]);
  function add(product: Product, size: string) {
    const count = cartNow.current.filter(i => i.productId === product.id).reduce((n, i) => n + i.quantity, 0);
    if (count >= product.stock || (cartNow.current.find(i => i.productId === product.id && i.size === size)?.quantity || 0) >= 20) { setToast('Bu ürün için stok sınırına ulaştın.'); return false; }
    setCart(current => { const existing = current.find(i => i.productId === product.id && i.size === size); return existing ? current.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i) : [...current, { productId: product.id, size, quantity: 1 }]; });
    trackDiscovery({ productId: product.id, kind: 'cart' });
    setToast('Çantana eklendi.');
    return true;
  }
  function quantity(productId: string, size: string, value: number) {
    const product = products.find(p => p.id === productId);
    const other = cartNow.current.filter(i => i.productId === productId && i.size !== size).reduce((sum, i) => sum + i.quantity, 0);
    if (value > Math.min(20, (product?.stock || 0) - other)) { setToast('Bu ürün için stok sınırına ulaştın.'); return; }
    setCart(current => value <= 0 ? current.filter(i => !(i.productId === productId && i.size === size)) : current.map(i => i.productId === productId && i.size === size ? { ...i, quantity: value } : i));
  }
  async function toggleSaved(id: string) {
    saveReceipts.current.delete(id);
    try { await setLike(id, !savedNow.current.includes(id)); return true; }
    catch (e) { setToast((e as Error).message); await loadLikes(); return false; }
  }
  async function swipeProduct(product: Product, kind: SwipeAction, size?: string): Promise<SwipeReceipt> {
    const latest = products.find(p => p.id === product.id) || product;
    const change = planSwipe(cartNow.current, savedNow.current, latest, kind, size);
    const key = `${kind}:${product.id}`;
    if (!change.cart && !change.saved) return { key, message: change.message, expiresAt: Date.now() + 3000 };
    const token = Symbol();
    if (change.saved) { try { await setLike(product.id, true); } catch (e) { await loadLikes(); throw e; } saveReceipts.current.set(product.id, token); }
    if (change.cart) setCart(change.cart);
    const cancelSignal = kind === 'cart' ? deferDiscovery({ productId: product.id, kind }, SWIPE_UNDO_MS) : () => {};
    const deadline = Date.now() + SWIPE_UNDO_MS;
    let consumed = false;
    return { key, message: change.message, expiresAt: deadline, async undo() {
      if (consumed || Date.now() >= deadline) return false;
      consumed = true;
      if (change.line) {
        const reverted = undoSwipeCart(cartNow.current, change.line);
        if (!reverted) return false;
        setCart(reverted);
      } else {
        if (saveReceipts.current.get(product.id) !== token) return false;
        try { await setLike(product.id, false); saveReceipts.current.delete(product.id); }
        catch (e) { consumed = false; setToast((e as Error).message); await loadLikes(); return false; }
      }
      cancelSignal(); return true;
    } };
  }
  async function authenticate(mode: 'register' | 'login', data: { email: string; password: string; name?: string }) {
    const result = await api<{ user: User; token: string }>(`/auth/${mode}`, data);
    await suspendLikes(); saveReceipts.current.clear();
    await beginIdentityChange();
    await saveToken(result.token); setUser(result.user);
    try { await finishIdentityChange(); await loadLikes(); } finally { setFeedRevision(v => v + 1); }
  }
  async function logout() {
    await suspendLikes(); saveReceipts.current.clear();
    await beginIdentityChange();
    try { await api('/auth/logout', {}); await saveToken(null); setUser(null); setCart([]); await finishIdentityChange(true); await loadLikes(); }
    catch(e) { await finishIdentityChange().catch(() => {}); await loadLikes(); throw e; }
    finally { setFeedRevision(v => v + 1); }
  }
  async function resetFeed() { await resetDiscovery(); setFeedRevision(v => v + 1); setToast('Keşfet tercihlerin sıfırlandı.'); }
  async function hideFeed(kind: 'product' | 'seller', id: string) { await hideDiscovery(kind, id); }
  async function readyDiscovery() { await initializeDiscovery(); setDiscoveryReady(true); }
  return { ...likes, ...follows, feedRevision, discoveryReady, readyDiscovery, resetFeed, hideFeed, products: products.map(p => ({ ...p, likeCount: likes.likeCounts[p.id] ?? p.likeCount ?? 0 })), cart, saved, user, setUser, loading, hydrated, error, checkout, toast, setToast, refresh, add, swipeProduct, quantity, toggleSaved, authenticate, logout, clearCart: () => setCart([]) };
}
type Store = ReturnType<typeof useStoreState>;
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) { const value = useStoreState(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useStore() { const value = useContext(Context); if (!value) throw new Error('StoreProvider is missing'); return value; }

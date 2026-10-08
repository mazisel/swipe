import { useCallback, useEffect, useRef, useState } from 'react';
import type { FollowedShop } from '../../shared/types';
import { api } from './api';
import { initializeDiscovery } from './discovery';

export function useFollowing(hydrated: boolean, owner: string, revision: number) {
  const [state, setState] = useState<{ owner: string; shops: FollowedShop[]; ready: boolean; error: string }>({ owner: '', shops: [], ready: false, error: '' });
  const epoch = useRef(0), pending = useRef(new Set<string>());
  const refreshFollowing = useCallback(async () => {
    const mine = ++epoch.current;
    try {
      await initializeDiscovery();
      const result = await api<{ shops: FollowedShop[] }>('/following');
      if (mine === epoch.current) setState({ owner, shops: result.shops, ready: true, error: '' });
    } catch (e) { if (mine === epoch.current) setState({ owner, shops: [], ready: false, error: (e as Error).message }); }
  }, [owner]);
  useEffect(() => {
    // State updates occur only after the identity and HTTP promises settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hydrated) void refreshFollowing();
    const requests = pending.current;
    // Epoch is a mutable request counter, not a DOM node captured by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { epoch.current++; requests.clear(); };
  }, [hydrated, revision, refreshFollowing]);
  async function setFollowing(shop: FollowedShop, following: boolean) {
    if (pending.current.has(shop.id) || state.owner !== owner || !state.ready) return;
    const mine = epoch.current; pending.current.add(shop.id);
    try {
      await api('/following', { sellerId: shop.id, following });
      if (mine === epoch.current) setState(current => ({ ...current, shops: following ? [shop, ...current.shops.filter(s => s.id !== shop.id)] : current.shops.filter(s => s.id !== shop.id) }));
    } finally { pending.current.delete(shop.id); }
  }
  return { following: state.owner === owner ? state.shops : [], followingReady: state.owner === owner && state.ready, followingError: state.owner === owner ? state.error : '', refreshFollowing, setFollowing };
}

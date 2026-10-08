import { useCallback, useEffect, useRef, useState } from 'react';
import { FeedPage, Product } from '../../shared/types';
import { api, ApiError } from './api';
import { initializeDiscovery } from './discovery';
export function useDiscoveryFeed(hydrated: boolean, revision: number) {
  const [page, setPage] = useState<FeedPage | null>(null);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const epoch = useRef(0), inflight = useRef(false), hidden = useRef(new Set<string>());
  useEffect(() => {
    if (!hydrated) return;
    const current = ++epoch.current; hidden.current.clear(); inflight.current = false;
    void (async () => {
      setLoading(true); setLoadingMore(false); setError('');
      try { await initializeDiscovery(); const result = await api<FeedPage>('/feed'); if (current === epoch.current) setPage(result); }
      catch (e) { if (current === epoch.current) setError((e as Error).message); }
      finally { if (current === epoch.current) setLoading(false); }
    })();
    return () => { epoch.current = current + 1; };
  }, [hydrated, revision, reload]);
  const nextCursor = page?.nextCursor;
  const loadMore = useCallback(async () => {
    if (!nextCursor || inflight.current) return;
    inflight.current = true; setLoadingMore(true); const current = epoch.current;
    try {
      const next = await api<FeedPage>(`/feed?cursor=${encodeURIComponent(nextCursor)}`);
      if (current !== epoch.current) return;
      setPage(previous => previous ? { ...next, reasons: { ...previous.reasons, ...next.reasons }, items: [...previous.items, ...next.items.filter(p => !hidden.current.has(p.id) && !hidden.current.has(p.sellerId) && !previous.items.some(x => x.id === p.id))] } : next); setError('');
    } catch (e) { if (current === epoch.current) { setError((e as Error).message); if (e instanceof ApiError && [401,409].includes(e.status)) setPage(p => p ? { ...p, nextCursor: null } : p); } }
    finally { if(current === epoch.current) { inflight.current = false; setLoadingMore(false); } }
  }, [nextCursor]);
  function remove(kind: 'product' | 'seller', targetId: string) { hidden.current.add(targetId); setPage(p => p ? { ...p, items:p.items.filter(item => (kind === 'product' ? item.id : item.sellerId) !== targetId) } : p); }
  const items: Product[] = page?.items || [];
  return { items, reasons: page?.reasons || {}, sessionId:page?.sessionId, nextCursor:page?.nextCursor, loading, loadingMore, error, loadMore, remove, restart:() => setReload(v=>v+1) };
}

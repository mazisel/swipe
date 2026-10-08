import { useEffect } from 'react';
import { Image } from 'react-native';
import { mediaUrl } from './api';
// Small rolling cache: no full-catalog downloads or unbounded bookkeeping.
const cached = new Set<string>();
const pending = new Map<string, Promise<void>>();
async function prefetch(url: string) {
  if (cached.has(url)) return;
  if (pending.has(url)) return pending.get(url);
  if (pending.size >= 4) { await Promise.race(pending.values()); return prefetch(url); }
  const request = Image.prefetch(url).then(ok => {
    if (ok) { cached.add(url); if (cached.size > 64) cached.delete(cached.values().next().value!); }
  }).catch(() => {}).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}
export function useMediaPrefetch(urls: string[], enabled: boolean) {
  const key = JSON.stringify([...new Set(urls.filter(Boolean).map(mediaUrl))].slice(0, 4));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => { for (const url of JSON.parse(key) as string[]) { if (cancelled) break; await prefetch(url); } })();
    return () => { cancelled = true; };
  }, [key, enabled]);
}

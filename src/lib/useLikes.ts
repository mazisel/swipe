import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { api } from './api';
import { useLiveState } from './useLiveState';
type Snapshot = { ids: string[]; counts: Record<string, number> };
type Result = { productId: string; liked: boolean; likeCount: number };
const migrationKey = 'swipe-legacy-likes-import';
const migrationDone = 'swipe-legacy-likes-done';
export function useLikes() {
  const [saved, setSaved, savedNow] = useLiveState<string[]>([]);
  const [likeCounts, setCounts] = useState<Record<string, number>>({});
  const [likesReady, setReady] = useState(false), [likesError, setError] = useState('');
  const [liking, setLiking] = useState<string[]>([]);
  const ready = useRef(false), epoch = useRef(0), revision = useRef(0);
  const pending = useRef(new Map<string, Promise<Result>>());
  const loadLikes = useCallback(async (migrate = false) => {
    if (pending.current.size) return;
    const mine = epoch.current, version = revision.current;
    try {
      if (migrate && !await AsyncStorage.getItem(migrationDone)) {
        let raw = await AsyncStorage.getItem(migrationKey);
        if (!raw) {
          const bag = await AsyncStorage.getItem('swipe-bag');
          let ids: string[] = [];
          try { const value = JSON.parse(bag || '{}'); if (Array.isArray(value.saved)) ids = [...new Set<string>(value.saved.filter((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 100))].slice(0, 1000); } catch { /* Invalid cache has no usable legacy favorites. */ }
          raw = JSON.stringify({ importId: Crypto.randomUUID(), ids });
          await AsyncStorage.setItem(migrationKey, raw);
        }
        await api('/likes/import', JSON.parse(raw));
        await AsyncStorage.setItem(migrationDone, 'true');
        await AsyncStorage.mergeItem('swipe-bag', JSON.stringify({ saved: [] }));
        await AsyncStorage.removeItem(migrationKey);
      }
      const result = await api<Snapshot>('/likes');
      if (mine !== epoch.current || version !== revision.current) return;
      setSaved(result.ids); setCounts(result.counts); ready.current = true; setReady(true); setError('');
    } catch (e) { if (mine === epoch.current) setError((e as Error).message); }
  }, [setSaved]);
  async function setLike(id: string, liked: boolean) {
    if (!ready.current) throw new Error('Beğeniler yüklenemedi. Beğendiklerin ekranından yeniden dene.');
    if (pending.current.has(id)) throw new Error('Beğenin güncelleniyor.');
    const mine = epoch.current; revision.current++;
    const request = api<Result>('/likes', { productId: id, liked });
    pending.current.set(id, request); setLiking([...pending.current.keys()]);
    try {
      const result = await request;
      if (mine !== epoch.current) throw new Error('Hesap değişti. Tekrar dene.');
      setSaved(current => result.liked ? [...new Set([...current, id])] : current.filter(value => value !== id));
      setCounts(current => ({ ...current, [id]: result.likeCount }));
      setError('');
      return result;
    } finally {
      pending.current.delete(id);
      if (mine === epoch.current) setLiking([...pending.current.keys()]);
    }
  }
  async function suspendLikes() {
    ready.current = false; setReady(false);
    await Promise.allSettled([...pending.current.values()]);
    epoch.current++; revision.current++; setSaved([]); setLiking([]); setError('');
  }
  useEffect(() => () => { epoch.current++; }, []);
  return { saved, savedNow, likeCounts, likesReady, likesError, liking, loadLikes, setLike, suspendLikes };
}

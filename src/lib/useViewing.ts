import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ViewingClock } from '../../shared/viewing';
import { trackDiscovery, flushDiscovery } from './discovery';
export function useForeground() {
  const [foreground, setForeground] = useState(AppState.currentState === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden));
  useEffect(() => {
    const update = () => setForeground(AppState.currentState === 'active' && (Platform.OS !== 'web' || !document.hidden));
    const sub = AppState.addEventListener('change', update);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', update);
    return () => { sub.remove(); if(Platform.OS === 'web') document.removeEventListener('visibilitychange', update); };
  }, []);
  return foreground;
}
type Options = { productId: string; sessionId?: string; enabled: boolean; visible: boolean; sample?: () => { position: number; duration: number; playing: boolean } };
export function useViewing(options: Options) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const { productId, sessionId, enabled } = options;
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const clock = new ViewingClock(), impressionId = Crypto.randomUUID();
    let samples = 0;
    const base = { productId, sessionId, impressionId };
    trackDiscovery({ ...base, kind: 'view' });
    function sample() {
      const current = latest.current, playback = current.sample?.();
      clock.sample(performance.now(), current.enabled && (playback?.playing ?? true), playback?.position, playback?.duration);
      if (++samples % 10 === 0) trackDiscovery({ ...base, kind: 'progress', ...clock.snapshot() });
    }
    sample(); const timer = setInterval(sample, 500);
    return () => {
      clearInterval(timer);
      // Include the final fraction of a second so sub-500ms swipes are measured.
      try { const playback = latest.current.sample?.(); clock.sample(performance.now(), true, playback?.position, playback?.duration); } catch { /* A native player may already be released on unmount. */ }
      trackDiscovery({ ...base, kind: 'finish', endReason: latest.current.visible ? 'pause' : 'swipe', ...clock.snapshot() });
      void flushDiscovery();
    };
  }, [enabled, productId, sessionId]);
}

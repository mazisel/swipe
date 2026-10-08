import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Only poll while this screen is focused and the app is in the foreground.
// The supplied callback receives a lifetime guard to discard stale responses.
export function useLiveRefresh(load: (alive: () => boolean) => Promise<void>) {
  useFocusEffect(useCallback(() => {
    let active = true, pending = false;
    const run = async () => {
      if (pending || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      pending = true;
      try { await load(() => active); } finally { pending = false; }
    };
    void run(); const timer = setInterval(() => { void run(); }, 7000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void run(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [load]));
}

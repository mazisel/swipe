import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';
const ReducedMotion = createContext(true);
export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    if (Platform.OS === 'web') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches);
      update(); query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; sub.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{children}</ReducedMotion.Provider>;
}
export const useReducedMotion = () => useContext(ReducedMotion);
export function useMotionValue(target: number, duration = 200, native = true) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(target));
  useEffect(() => {
    value.stopAnimation();
    if (reduced) { value.setValue(target); return; }
    const animation = Animated.timing(value, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [value, target, duration, native, reduced]);
  return value;
}
export function usePulse(trigger: string | number | boolean, enabled = true, enter = false) {
  const reduced = useReducedMotion(), previous = useRef<string | number | boolean | undefined>(enter ? undefined : trigger);
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const changed = previous.current !== trigger; previous.current = trigger;
    value.stopAnimation(); value.setValue(0);
    if (!changed || !enabled || reduced) return;
    const animation = Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 80, useNativeDriver: true, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration: 170, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start(); return () => animation.stop();
  }, [trigger, enabled, reduced, value]);
  return value;
}
export function usePressMotion() {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const progress = useMotionValue(!reduced && pressed ? 1 : 0, 100);
  return { progress, style: { transform: [{ scale: reduced ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, .96] }) }] }, onPressIn: () => setPressed(true), onPressOut: () => setPressed(false) };
}

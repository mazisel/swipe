import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { horizontalIntent, releasedSwipe, swipeThreshold, type SwipeAction } from '../../shared/swipe';
import { Icon } from './Icon';
import { GlassSurface } from './GlassSurface';
const webStyle: ViewStyle & { touchAction: string; userSelect: string } = { touchAction: 'pan-y', userSelect: 'none' };
export const SwipePressContext = createContext<() => boolean>(() => true);

export function SwipeSurface({ children, preview, width, active, enabled, onAction, onExit, onDragging }: {
  children: ReactNode; preview: ReactNode; width: number; active: boolean; enabled: boolean;
  onAction: (action: SwipeAction) => Promise<boolean>; onExit: () => void; onDragging: (dragging: boolean) => void;
}) {
  const [distance] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);
  const surface = useRef<View>(null), originX = useRef(0);
  const gesture = useRef({ rejected: false, vertical: false, claimDx: 0, claimDy: 0 });
  const latest = useRef({ onAction, onExit, enabled });
  const transaction = useRef(0), locked = useRef(false), blockedPressUntil = useRef(0);
  useLayoutEffect(() => { latest.current = { onAction, onExit, enabled }; });
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { alive = false; listener.remove(); };
  }, []);
  useEffect(() => {
    // Offscreen cards must be reusable when the buyer scrolls back.
    if (!active) { transaction.current++; locked.current = false; distance.stopAnimation(); distance.setValue(0); opacity.setValue(1); }
    // Invalidate whichever async transaction is current at cleanup, not the initial one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { transaction.current++; locked.current = false; };
  }, [active, distance, opacity]);
  const canPress = useCallback(() => !locked.current && Date.now() > blockedPressUntil.current, []);
  const threshold = swipeThreshold(width);
  const settle = useCallback(() => {
    blockedPressUntil.current = Date.now() + 400;
    Animated.spring(distance, { toValue: 0, stiffness: 230, damping: 25, mass: .8, useNativeDriver: true, ...(reduceMotion ? { overshootClamping: true } : {}) }).start();
    if (reduceMotion) { distance.stopAnimation(); distance.setValue(0); }
    locked.current = false; onDragging(false);
  }, [distance, onDragging, reduceMotion]);
  const perform = useCallback(async (action: SwipeAction) => {
    if (locked.current || !latest.current.enabled) { settle(); return; }
    locked.current = true; onDragging(true); blockedPressUntil.current = Infinity;
    const mine = ++transaction.current;
    // Keep the selected product centered while its size sheet is open.
    Animated.spring(distance, { toValue: 0, stiffness: 240, damping: 28, mass: .8, useNativeDriver: true }).start();
    let completed = false;
    try { completed = await latest.current.onAction(action); } catch { /* A cancelled/unavailable action leaves its card in place. */ }
    if (mine !== transaction.current) return;
    if (!completed) { settle(); return; }
    distance.stopAnimation();
    Animated.parallel([
      Animated.timing(distance, { toValue: (action === 'save' ? -1 : 1) * width * 1.45, duration: reduceMotion ? 0 : 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 240, delay: reduceMotion ? 0 : 70, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished || mine !== transaction.current) return;
      blockedPressUntil.current = Date.now() + 400;
      locked.current = false; onDragging(false);
      latest.current.onExit();
    });
  }, [distance, opacity, onDragging, reduceMotion, settle, width]);
  const responder = useMemo(() => {
    // PanResponder retains these event callbacks without calling them during render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: event => {
        // locationX belongs to the touched child (often an icon), not this surface.
        const x = event.nativeEvent.pageX - originX.current;
        if (!locked.current) blockedPressUntil.current = 0;
        gesture.current = { rejected: !latest.current.enabled || locked.current || x < 16 || x > width - 16, vertical: false, claimDx: 0, claimDy: 0 };
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, state) => {
        // Cancel child links as soon as this touch moves, even if the drag is
        // too short, diagonal or at an edge and never becomes our responder.
        // PanResponder invokes this handler on movement, never during render.
        // eslint-disable-next-line react-hooks/purity
        if (Math.hypot(state.dx, state.dy) > 10) blockedPressUntil.current = Date.now() + 400;
        if (Math.abs(state.dy) >= 12 && Math.abs(state.dy) >= Math.abs(state.dx)) gesture.current.vertical = true;
        if (state.numberActiveTouches !== 1) gesture.current.rejected = true;
        const claim = latest.current.enabled && !locked.current && !gesture.current.rejected && !gesture.current.vertical && horizontalIntent(state.dx, state.dy, state.numberActiveTouches);
        // RN resets travel when ownership changes; preserve the first movement.
        if (claim) { gesture.current.claimDx = state.dx; gesture.current.claimDy = state.dy; }
        return claim;
      },
      onPanResponderGrant: () => { blockedPressUntil.current = Infinity; distance.stopAnimation(); onDragging(true); distance.setValue(gesture.current.claimDx); },
      onPanResponderStart: (_, state) => { if (state.numberActiveTouches !== 1) gesture.current.rejected = true; },
      onPanResponderMove: (_, state) => {
        if (state.numberActiveTouches !== 1) gesture.current.rejected = true;
        distance.setValue(Math.max(-width, Math.min(width, gesture.current.claimDx + state.dx)));
      },
      onPanResponderRelease: (_, state) => {
        const action = latest.current.enabled && !gesture.current.rejected ? releasedSwipe(gesture.current.claimDx + state.dx, gesture.current.claimDy + state.dy, width) : null;
        if (action) void perform(action); else settle();
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => !locked.current,
    });
  }, [distance, onDragging, perform, settle, width]);
  const progress = distance.interpolate({ inputRange: [-width, 0, width], outputRange: [1, 0, 1], extrapolate: 'clamp' });
  return <View ref={surface} onLayout={() => surface.current?.measureInWindow(x => { originX.current = x; })} style={StyleSheet.absoluteFill}>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[styles.preview, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.985, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) }] }]}>{preview}</Animated.View>
    <Animated.View {...responder.panHandlers} style={[styles.card, Platform.OS === 'web' && webStyle, { opacity, transform: [{ translateX: distance }, { rotate: distance.interpolate({ inputRange: [-width, 0, width], outputRange: reduceMotion ? ['0deg', '0deg', '0deg'] : ['-7deg', '0deg', '7deg'], extrapolate: 'clamp' }) }] }]}>
      <SwipePressContext.Provider value={canPress}>{children}</SwipePressContext.Provider>
    </Animated.View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[StyleSheet.absoluteFill, styles.hintPosition]}>
        {(['save', 'cart'] as const).map(action => <Animated.View key={action} style={[styles.hint, {
          opacity: distance.interpolate({ inputRange: action === 'save' ? [-threshold, -12, 0] : [0, 12, threshold], outputRange: action === 'save' ? [1, 0, 0] : [0, 0, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, .27, 1], outputRange: [reduceMotion ? 0 : 8, 0, 0], extrapolate: 'clamp' }) }],
        }]}><GlassSurface style={styles.hintGlass} interactive={false}><View style={styles.hintIcon}><Icon name={action === 'save' ? 'heart' : 'bag'} size={19} color="#FFF" /></View><Text style={styles.hintText}>{action === 'save' ? 'Beğen' : 'Çantaya ekle'}</Text></GlassSurface></Animated.View>)}
      </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#191A1D' },
  preview: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#191A1D' },
  hintPosition: { alignItems: 'center' }, hint: { position: 'absolute', top: '23%' },
  hintGlass: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 18, paddingVertical: 8, borderRadius: 30, backgroundColor: 'rgba(24,26,29,.48)', borderColor: 'rgba(255,255,255,.24)', boxShadow: '0 4px 20px rgba(0,0,0,.12)' },
  hintIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.12)', justifyContent: 'center', alignItems: 'center' },
  hintText: { fontWeight: '500', fontSize: 15, letterSpacing: -.2, color: '#FFF' },
});

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
export function GlassSurface({ children, style, target, interactive = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; target?: React.RefObject<View | null>; interactive?: boolean }) {
  const [reduceTransparency, setReduceTransparency] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-transparency: reduce)').matches : false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const query = window.matchMedia('(prefers-reduced-transparency: reduce)');
      const update = (event: MediaQueryListEvent) => setReduceTransparency(event.matches);
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }
    if (Platform.OS !== 'ios') return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription.remove();
  }, []);
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const surface = [glass.surface, style];
  if (reduceTransparency) return <View style={[surface, { backgroundColor: '#282B30' }]}>{children}</View>;
  if (nativeGlass) return <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={surface}>{children}</GlassView>;
  return <View style={surface}><BlurView pointerEvents="none" intensity={45} tint="dark" blurTarget={target} blurMethod={Platform.OS === 'android' && target ? 'dimezisBlurViewSdk31Plus' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />{children}</View>;
}
const glass = StyleSheet.create({ surface: { overflow: 'hidden', borderRadius: 36, borderWidth: 1, borderColor: 'rgba(255,255,255,0.23)', backgroundColor: 'rgba(30,32,35,0.2)', boxShadow: '0 12px 35px rgba(0,0,0,0.24)' } });

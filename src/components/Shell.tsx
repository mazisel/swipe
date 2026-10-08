import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../lib/store';
import { Icon, IconName } from './Icon';
import { GlassSurface } from './GlassSurface';
import { NavigationTapContext, TapPressable } from './TapPressable';
import { useMotionValue, usePulse } from '../lib/motion';
import { Pulse } from './MicroMotion';
import { TapGesture } from '../../shared/tapGesture';
const nav: { path: '/' | '/search' | '/messages' | '/cart' | '/profile'; title: string; icon: IconName }[] = [
  { path: '/', title: 'Akış', icon: 'reels' }, { path: '/search', title: 'Ara', icon: 'search' }, { path: '/messages', title: 'DM', icon: 'send' }, { path: '/cart', title: 'Çanta', icon: 'bag' }, { path: '/profile', title: 'Sen', icon: 'user' },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const { cart, toast, hydrated } = useStore(); const insets = useSafeAreaInsets();
  const target = useRef<View>(null); const studio = (pathname.startsWith('/studio') || pathname.startsWith('/admin')); const product = pathname.startsWith('/product/') || pathname.startsWith('/social/'); const immersive = pathname === '/' || product;
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const [dockWidth, setDockWidth] = useState(0);
  const selectedIndex = pathname === '/following' ? 4 : nav.findIndex(item => item.path === pathname);
  const tabWidth = Math.max(0, (dockWidth - 12) / 5);
  const selectionX = useMotionValue(Math.max(0, selectedIndex) * (tabWidth + 3), 220);
  const [navigationTap] = useState(() => new TapGesture());
  return <NavigationTapContext.Provider value={navigationTap}><View style={shell.root}
    onStartShouldSetResponderCapture={event => { navigationTap.begin(event.nativeEvent, event.nativeEvent.touches?.length || 1); return false; }}
    onMoveShouldSetResponderCapture={event => { navigationTap.move(event.nativeEvent, event.nativeEvent.touches?.length || 1); return false; }}
    onTouchMove={event => navigationTap.move(event.nativeEvent, event.nativeEvent.touches?.length || 1)}
    onTouchCancel={() => navigationTap.cancel()}><StatusBar style="light" />
    <BlurTargetView ref={target} style={[shell.content, { paddingTop: immersive ? 0 : insets.top }]}>{children}</BlurTargetView>
    {!studio && !product && <View pointerEvents="box-none" style={[shell.dockPosition, { bottom: Math.max(insets.bottom, 14) }]}><GlassSurface target={target} style={shell.dock}><View onLayout={event => setDockWidth(event.nativeEvent.layout.width)} style={shell.dockTabs}>
      {dockWidth > 0 && selectedIndex >= 0 && <Animated.View pointerEvents="none" style={[shell.tabActive, { position: 'absolute', left: 0, top: 0, height: 46, width: tabWidth, borderRadius: 28, transform: [{ translateX: selectionX }] }]} />}
      {nav.map(item => { const active = pathname === item.path; return <TapPressable key={item.path} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected: active }} onPress={() => router.navigate(item.path)} style={shell.tab}>
        <NavGlyph icon={item.icon} active={active} count={count} hydrated={hydrated} /><Text style={[shell.tabLabel, active && { color: '#FFF', fontWeight: '600' }]}>{item.title}</Text>
      </TapPressable>; })}
    </View></GlassSurface></View>}
    {!!toast && <View pointerEvents="none" style={[shell.toastPosition, { bottom: product ? Math.max(insets.bottom, 20) + 130 : Math.max(insets.bottom, 14) + 90 }]}><View style={shell.toast}><Icon name="check" size={18} color="#17191B" /><Text accessibilityLiveRegion="polite" style={shell.toastText}>{toast}</Text></View></View>}
  </View></NavigationTapContext.Provider>;
}
function NavGlyph({ icon, active, count, hydrated }: { icon: IconName; active: boolean; count: number; hydrated: boolean }) {
  const selected = usePulse(active, active), bag = usePulse(count, icon === 'bag' && hydrated);
  return <Animated.View style={{ transform: [{ scale: Animated.add(1, Animated.add(Animated.multiply(selected, .09), Animated.multiply(bag, .12))) }, { rotate: selected.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-4deg'] }) }] }}>
    <Icon name={icon} size={23} color={active ? '#FFFFFF' : '#D3D5D8'} filled={active && icon === 'reels'} />
    {icon === 'bag' && count > 0 && <Pulse enter trigger={count} enabled={hydrated} style={shell.badge}><Text style={shell.badgeText}>{count > 99 ? '99+' : count}</Text></Pulse>}
  </Animated.View>;
}
const shell = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0B0D' }, content: { flex: 1, minWidth: 0, minHeight: 0 },
  dockPosition: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 18 }, dock: { width: '100%', maxWidth: 390, padding: 4 }, dockTabs: { flexDirection: 'row', gap: 3, width: '100%' },
  tab: { flex: 1, height: 46, justifyContent: 'center', alignItems: 'center', gap: 3, borderRadius: 28 }, tabActive: { backgroundColor: 'rgba(255,255,255,0.19)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.17)' }, tabLabel: { fontSize: 9, color: '#CED0D4', letterSpacing: .1 },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: '#FFF', minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#111', fontSize: 9, fontWeight: '700' },
  toastPosition: { position: 'absolute', left: 24, right: 24, alignItems: 'center' }, toast: { backgroundColor: '#F1F2EF', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 9 }, toastText: { color: '#17191B', fontSize: 13 },
});

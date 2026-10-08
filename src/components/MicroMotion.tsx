import { useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle, type PressableProps } from 'react-native';
import { TapPressable } from './TapPressable';
import { useMotionValue, usePressMotion, usePulse } from '../lib/motion';
export function MotionPressable({ style, children, ...props }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const motion = usePressMotion();
  return <Animated.View style={motion.style}><TapPressable {...props} style={style} onPressIn={event => { motion.onPressIn(); props.onPressIn?.(event); }} onPressOut={event => { motion.onPressOut(); props.onPressOut?.(event); }}>{children}</TapPressable></Animated.View>;
}
export function Pulse({ trigger, enabled = true, enter = false, strength = .08, children, style }: { trigger: string | number | boolean; enabled?: boolean; enter?: boolean; strength?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = usePulse(trigger, enabled, enter);
  return <Animated.View style={[style, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + strength] }) }] }]}>{children}</Animated.View>;
}
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const progress = useMotionValue(open ? 1 : 0, 210, false);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} aria-hidden={!open} style={{ height: Animated.multiply(progress, height), opacity: progress, overflow: 'hidden' }}>
    <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', left: 0, right: 0 }}>{children}</View>
  </Animated.View>;
}
export function SelectionChip({ selected, style, children, ...props }: Omit<PressableProps, 'style' | 'children'> & { selected: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const progress = useMotionValue(selected ? 1 : 0, 170);
  return <MotionPressable {...props} style={style}><Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: '#F0F1F2', opacity: progress }]} /><Pulse trigger={selected} enabled={selected}>{children}</Pulse></MotionPressable>;
}
export function GallerySegment({ active }: { active: boolean }) {
  const progress = useMotionValue(active ? 1 : 0, 180);
  return <View style={{ flex: 1, height: 2, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.28)' }}><Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: progress }]} /></View>;
}

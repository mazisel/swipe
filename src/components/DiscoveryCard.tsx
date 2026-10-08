import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../lib/store';
import { useMotionValue, usePressMotion, usePulse } from '../lib/motion';
import { confirmSwipe } from '../lib/swipeHaptics';
import { money, type Product } from '../../shared/types';
import type { SwipeAction } from '../../shared/swipe';
import { mediaUrl } from '../lib/api';
import { Icon, type IconName } from './Icon';
import { Media } from './Media';
import { SwipeSurface } from './SwipeSurface';
import { TapPressable as Pressable } from './TapPressable';

function ReelAction({ icon, label, caption, filled, disabled, onPress }: { icon: IconName; label: string; caption: string; filled?: boolean; disabled?: boolean; onPress: () => void }) {
  const pulse = usePulse(!!filled, !!filled);
  const fill = useMotionValue(filled ? 1 : 0, 160);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled, selected: filled }} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? .6 : 1 }]}><Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}><Icon name={icon} size={28} /><Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fill }]}><Icon name={icon} size={28} filled /></Animated.View></Animated.View><Text style={styles.actionText}>{caption}</Text></Pressable>;
}
export function DiscoveryCard({ product, next, height, width, bottom, active, preload, playing, enabled, sessionId, saved, onAction, onExit, onDragging, onSave, onOptions, onShare }: {
  product: Product; next?: Product; height: number; width: number; bottom: number;
  active: boolean; preload: boolean; playing: boolean; enabled: boolean; sessionId?: string; saved: boolean;
  onAction: (kind: SwipeAction) => Promise<boolean>; onExit: () => void; onDragging: (value: boolean) => void;
  onSave: () => Promise<boolean>; onOptions: () => void; onShare: () => void;
}) {
  const { likesReady, liking } = useStore();
  const count = product.likeCount || 0;
  const priceMotion = usePressMotion();
  return <View style={{ height, width: '100%', backgroundColor: '#191A1D' }}>
    <SwipeSurface width={width} active={active} enabled={enabled} onAction={onAction} onExit={onExit} onDragging={onDragging}
      preview={next && (next.mediaType === 'image' || next.poster) ? <Image source={{ uri: mediaUrl(next.poster || next.media) }} style={StyleSheet.absoluteFill} /> : <View style={StyleSheet.absoluteFill} />}>
      <Media preload={preload} product={product} visible={active} active={playing} sessionId={sessionId} onLongPress={onOptions} reel />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(8,9,11,.28)', 'rgba(8,9,11,.78)']} locations={[0, .45, 1]} style={styles.shade} />
      <View style={[styles.actions, { bottom: 157 + bottom }]}>
        <ReelAction icon="heart" label={`${saved ? 'Beğeniyi kaldır' : 'Ürünü beğen'}, ${count} beğeni`} caption={new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(count)} disabled={!likesReady || liking.includes(product.id)} filled={saved} onPress={async () => { if (await onSave() && !saved) confirmSwipe(); }} />
        <ReelAction icon="comment" label="Yorumları aç" caption={product.commentCount ? String(product.commentCount) : 'Yorum'} onPress={() => router.push(`/social/${product.id}`)} />
        <ReelAction icon="share" label="Ürünü paylaş" caption="Paylaş" onPress={onShare} />
        <Pressable accessibilityRole="button" accessibilityLabel="Keşfet seçenekleri" onPress={onOptions} style={styles.more}><Text style={styles.moreText}>···</Text></Pressable>
      </View>
      <View style={[styles.caption, { bottom: 98 + bottom }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${product.shop} mağazasını aç`} onPress={() => router.push(`/shop/${product.sellerId}`)} style={styles.seller}><Text numberOfLines={1} style={styles.shop}>{product.shop.toLocaleLowerCase('tr').replaceAll(' ', '.')}</Text></Pressable>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <Animated.View style={[{ alignSelf: 'flex-start' }, priceMotion.style]}><Pressable onPressIn={priceMotion.onPressIn} onPressOut={priceMotion.onPressOut} accessibilityRole="button" accessibilityLabel={`${product.title} ürününü gör, ${money(product.price)}`} onPress={() => router.push(`/product/${product.id}`)} style={styles.productLink}><Text style={styles.price}>{money(product.price)}</Text><Animated.View style={[styles.productArrow, { transform: [{ translateX: priceMotion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }, { translateY: priceMotion.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { rotate: '-45deg' }] }]}><Icon name="arrow" size={16} /></Animated.View></Pressable></Animated.View>
      </View>
    </SwipeSurface>
  </View>;
}
const styles = StyleSheet.create({
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' },
  actions: { position: 'absolute', right: 12, gap: 12 }, action: { alignItems: 'center', justifyContent: 'center', minWidth: 46, minHeight: 52, gap: 5 }, actionText: { color: '#FFF', fontSize: 10, fontWeight: '500', textShadowColor: 'rgba(0,0,0,.25)', textShadowRadius: 6 }, more: { alignItems: 'center', minHeight: 36, justifyContent: 'center' }, moreText: { color: '#FFF', fontSize: 23 },
  caption: { position: 'absolute', left: 20, right: 72 },
  seller: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, justifyContent: 'center' },
  shop: { color: 'rgba(255,255,255,.78)', fontSize: 12, fontWeight: '500' },
  title: { color: '#FFF', fontSize: 19, fontWeight: '500', letterSpacing: -.45, lineHeight: 25, maxWidth: 310 },
  productLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingRight: 12, marginTop: 2 },
  price: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  productArrow: { transform: [{ rotate: '-45deg' }], opacity: .8 },
});

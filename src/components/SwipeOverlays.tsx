import { MotionPressable } from './MicroMotion';
import { useEffect } from 'react';
import { AccessibilityInfo, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, type Product } from '../../shared/types';
import { mediaUrl } from '../lib/api';
import type { SwipeReceipt } from '../lib/store';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';
import { IconButton } from './ui';

export function SwipeLesson({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => { AccessibilityInfo.announceForAccessibility('Bir hareketle sende. Sola kaydır, beğen. Sağa kaydır, çantaya ekle. İşlem tamamlanınca sıradaki kart gelir. Yukarı kaydırarak da keşfetmeye devam edebilirsin.'); }, []);
  return <View pointerEvents="box-none" style={styles.lessonPosition}><GlassSurface style={styles.lesson}>
    <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Bir hareketle sende.</Text><IconButton name="close" label="Öğreticiyi kapat" onPress={onDismiss} /></View>
    <Text style={styles.subtitle}>Sevdiğin parçalar için iki küçük hareket.</Text>
    <View style={styles.directions}>
      <View style={styles.direction}><View style={styles.symbols}><Icon name="back" size={19} /><Icon name="heart" size={26} /></View><Text style={styles.directionTitle}>Sola kaydır</Text><Text style={styles.subtitle}>Beğendiklerine ekle</Text></View>
      <View style={styles.divider} />
      <View style={styles.direction}><View style={styles.symbols}><Icon name="bag" size={26} /><Icon name="arrow" size={19} /></View><Text style={styles.directionTitle}>Sağa kaydır</Text><Text style={styles.subtitle}>Çantana ekle</Text></View>
    </View>
    <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.understood}><Text style={styles.understoodText}>Anladım, keşfe devam</Text><Icon name="up" size={17} /></Pressable>
  </GlassSurface></View>;
}

export function SwipeFeedback({ receipt, onClose }: { receipt: SwipeReceipt; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => { const timer = setTimeout(onClose, Math.max(0, receipt.expiresAt - Date.now())); return () => clearTimeout(timer); }, [receipt, onClose]);
  useEffect(() => { AccessibilityInfo.announceForAccessibility(receipt.message); }, [receipt]);
  return <View pointerEvents="box-none" style={[styles.feedbackPosition, { bottom: Math.max(insets.bottom, 14) + 84 }]}><GlassSurface style={styles.feedback}>
    <Icon name="check" size={19} /><Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{receipt.message}</Text>
    {receipt.undo && <Pressable accessibilityRole="button" accessibilityLabel="Son kaydırmayı geri al" onPress={async () => { const undone = await receipt.undo?.(); AccessibilityInfo.announceForAccessibility(undone ? 'İşlem geri alındı.' : 'Bu parça daha sonra değiştirildi.'); onClose(); }} style={styles.undo}><Text style={styles.undoText}>Geri al</Text></Pressable>}
  </GlassSurface></View>;
}

export function SwipeSizePicker({ product, onSelect, onClose }: { product: Product | null; onSelect: (size: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return <Modal transparent animationType="fade" visible={!!product} onRequestClose={onClose}>
    <View style={styles.modal}><Pressable accessibilityRole="button" accessibilityLabel="Beden seçimini kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      {product && <View accessibilityViewIsModal style={[styles.pickerPosition, { paddingBottom: Math.max(insets.bottom, 20) }]}><GlassSurface style={styles.picker}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Sana uyanı seç.</Text><IconButton name="close" label="Beden seçimini kapat" onPress={onClose} /></View>
        <View style={styles.product}>
          <Image source={{ uri: mediaUrl(product.poster || product.media) }} style={styles.thumbnail} />
          <View style={{ flex: 1, gap: 5 }}><Text style={styles.productTitle}>{product.title}</Text><Text style={styles.subtitle}>{product.color} · {money(product.price)}</Text></View>
        </View>
        <Text style={styles.sizeLabel}>Bedenine dokun, çantana eklensin.</Text>
        <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={styles.sizes}>
          {product.sizes.map(size => <MotionPressable key={size} accessibilityRole="button" accessibilityLabel={`${size} bedenini çantaya ekle`} disabled={product.stock <= 0} onPress={() => onSelect(size)} style={styles.size}><Text style={styles.sizeText}>{size}</Text></MotionPressable>)}
        </ScrollView>
      </GlassSurface></View>}
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  lessonPosition: { position: 'absolute', top: '21%', left: 16, right: 16, alignItems: 'center' },
  lesson: { width: '100%', maxWidth: 380, padding: 19, borderRadius: 28, backgroundColor: 'rgba(22,26,29,.78)' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginRight: -10 },
  title: { color: '#FFF', fontSize: 21, fontWeight: '600', letterSpacing: -.6, flexShrink: 1 },
  subtitle: { color: '#D0D5D6', fontSize: 11, lineHeight: 17 },
  directions: { flexDirection: 'row', alignItems: 'center', marginVertical: 25, gap: 12 }, direction: { flex: 1, gap: 6 },
  symbols: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 7 },
  divider: { width: 1, height: 74, backgroundColor: 'rgba(255,255,255,.16)', marginRight: 5 },
  directionTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  understood: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,.16)', paddingTop: 17, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, understoodText: { color: '#FFF', fontSize: 12, fontWeight: '500' },
  feedbackPosition: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  feedback: { borderRadius: 24, paddingLeft: 17, paddingRight: 8, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(25,29,30,.9)', maxWidth: 400 },
  feedbackText: { color: '#FFF', fontSize: 12, flexShrink: 1 }, undo: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 13 }, undoText: { color: '#DDE9D0', fontSize: 12, fontWeight: '700' },
  modal: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.32)' },
  pickerPosition: { width: '100%', maxWidth: 500, paddingHorizontal: 14 }, picker: { padding: 22, borderRadius: 30, backgroundColor: 'rgba(26,30,32,.83)' },
  product: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 15 }, thumbnail: { width: 55, height: 68, borderRadius: 10, backgroundColor: '#303438' }, productTitle: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  sizeLabel: { color: '#D0D5D6', fontSize: 12, marginTop: 24, marginBottom: 13 }, sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, size: { minWidth: 57, minHeight: 53, paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,.3)', backgroundColor: 'rgba(255,255,255,.06)', alignItems: 'center', justifyContent: 'center' }, sizeText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});

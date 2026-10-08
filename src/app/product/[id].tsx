import { Pulse, SelectionChip } from '../../components/MicroMotion';
import { trackDiscovery } from '../../lib/discovery';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money } from '../../../shared/types';
import { useStore } from '../../lib/store';
import { Button, Empty, IconButton } from '../../components/ui';
import { Media } from '../../components/Media';
import { Thumbnail } from '../../components/Thumbnail';
export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { products, add, saved, toggleSaved, likesReady, liking, loading } = useStore();
  const product = products.find(p => p.id === id); const [size, setSize] = useState(''); const [added, setAdded] = useState(false); const [expanded, setExpanded] = useState(false); const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets();
  const productId = product?.id;
  useFocusEffect(useCallback(() => { if (productId) trackDiscovery({ productId, kind: 'detail' }); }, [productId]));
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  if (!product) return <View style={sheet.screen}><Empty title={loading ? 'Yükleniyor…' : 'Bu parça artık burada değil'} description="Akışta başka keşifler seni bekliyor." action={{ title: 'Akışa dön', onPress: close }} /></View>;
  const selected = size || (product.sizes.length === 1 ? product.sizes[0] : '');
  const reelWidth = width >= 760 ? Math.min(560, height * .65) : width;
  return <View accessibilityViewIsModal style={sheet.screen}><View style={{ width: reelWidth, flex: 1 }}><Media product={product} /><View style={sheet.dim} />
    <Pressable accessibilityRole="button" accessibilityLabel="Ürün panelini kapat" onPress={close} style={{ flex: 1, minHeight: 40 }} />
    <View style={[sheet.panel, { maxHeight: height * .78, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <View style={sheet.handle} /><View style={sheet.panelHeader}><Text style={sheet.eyebrow}>BİR YAKINDAN BAK.</Text><IconButton name="close" label="Akışa dön" onPress={close} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 23, paddingBottom: 22 }}>
        <View style={sheet.productRow}><Thumbnail product={product} style={{ width: 74, height: 90, borderRadius: 11 }} /><View style={{ flex: 1 }}><Text style={sheet.shop}>{product.shop}</Text><Text style={sheet.title}>{product.title}</Text><Text style={sheet.price}>{money(product.price)}</Text></View><View style={{ alignItems: 'center', gap: 2 }}><IconButton name="heart" disabled={!likesReady || liking.includes(product.id)} label={saved.includes(product.id) ? 'Beğeniyi kaldır' : 'Ürünü beğen'} onPress={() => toggleSaved(product.id)} filled={saved.includes(product.id)} /><Text style={{ color: '#CED0D2', fontSize: 11 }}>{product.likeCount || 0}</Text></View></View>
        <View><Text style={sheet.label}>{product.color} <Text style={sheet.muted}>/ {product.sizes.length > 1 ? 'Bedenini seç' : 'Tek seçenek'}</Text></Text><View style={sheet.sizes}>{product.sizes.map(value => <SelectionChip selected={selected === value} key={value} accessibilityRole="radio" accessibilityLabel={value} accessibilityState={{ checked: selected === value }} onPress={() => { setSize(value); setAdded(false); }} style={sheet.size}><Text style={{ color: selected === value ? '#141619' : '#E8E9EB', fontSize: 13, fontWeight: '500' }}>{value}</Text></SelectionChip>)}</View></View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}><Button title={product.reviewCount ? `★ ${product.ratingAverage?.toFixed(1)} · ${product.reviewCount} değerlendirme` : 'Değerlendirmeler'} outline onPress={() => router.push({ pathname: '/social/[id]', params: { id: product.id, tab: 'reviews' } })} /><Button title="Mağazaya sor" icon="send" outline onPress={() => router.push({ pathname: '/messages', params: { productId: product.id } })} /></View>
        <View><Pressable accessibilityRole="button" accessibilityLabel="Ürün hikâyesini aç veya kapat" onPress={() => setExpanded(!expanded)} style={sheet.details}><Text style={sheet.label}>Bu parçanın hikâyesi</Text><Text style={{ color: '#BBB', fontSize: 21 }}>{expanded ? '−' : '+'}</Text></Pressable>{expanded && <Text style={sheet.description}>{product.description}</Text>}</View>
      </ScrollView>
      <Pulse strength={.025} trigger={!!selected} enabled={!!selected}><Button title={product.stock === 0 ? 'Tükendi' : !selected ? 'Bir beden seç' : added ? 'Çantana eklendi' : 'Çantama ekle'} icon={added ? 'check' : 'bag'} disabled={!selected || product.stock === 0} onPress={() => { if (add(product, selected)) setAdded(true); }} /></Pulse>
      {added && <Pressable accessibilityRole="button" accessibilityLabel="Çantama git" onPress={() => router.replace('/cart')} style={sheet.bagLink}><Text style={{ color: '#E5E7EB', fontSize: 13 }}>Çantama git →</Text></Pressable>}
    </View>
  </View></View>;
}
const sheet = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0B0D', alignItems: 'center' }, dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.25)' },
  panel: { backgroundColor: '#181B1F', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 23, borderWidth: 1, borderBottomWidth: 0, borderColor: '#373B41' }, handle: { width: 34, height: 4, borderRadius: 4, backgroundColor: '#656A72', alignSelf: 'center', marginTop: 10 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 9 }, eyebrow: { color: '#9298A1', letterSpacing: 1.8, fontSize: 9 }, productRow: { flexDirection: 'row', gap: 15, alignItems: 'center' }, shop: { color: '#AEB4BE', fontSize: 11, marginBottom: 6 }, title: { color: '#F5F5F5', fontSize: 17, fontWeight: '500', lineHeight: 22, letterSpacing: -.35 }, price: { color: '#FFF', fontSize: 19, fontWeight: '600', marginTop: 10 }, label: { color: '#E5E7EB', fontSize: 13, fontWeight: '500' }, muted: { color: '#9298A1', fontWeight: '400' },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 13 }, size: { minWidth: 52, height: 46, paddingHorizontal: 15, borderRadius: 13, backgroundColor: '#292D32', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3A3F45' }, sizeActive: { backgroundColor: '#F0F1F2', borderColor: '#F0F1F2' }, details: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }, description: { fontSize: 13, color: '#ADB3BC', lineHeight: 21, paddingTop: 12 }, bagLink: { height: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

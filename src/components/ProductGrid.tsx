import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { money, Product } from '../../shared/types';
import { Thumbnail } from './Thumbnail';
import { colors } from './ui';
export function ProductGrid({ products, onSelect }: { products: Product[]; onSelect?: (product: Product) => void }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 28 }}>{products.map(product => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={product.title} onPress={() => { onSelect?.(product); router.push(`/product/${product.id}`); }} style={{ width: '46%', flexGrow: 1, maxWidth: 260, marginBottom: 15 }}>
    <Thumbnail product={product} style={{ width: '100%', aspectRatio: .8, backgroundColor: colors.pale, borderRadius: 9 }} /><Text style={{ fontSize: 10, color: colors.muted, marginTop: 12 }}>{product.shop} · {product.mediaType === 'video' ? 'Video' : product.category}</Text><Text style={{ fontSize: 15, fontWeight: '500', color: colors.ink, marginTop: 6 }}>{product.title}</Text><Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 8 }}>{money(product.price)}</Text>
  </Pressable>)}</View>;
}

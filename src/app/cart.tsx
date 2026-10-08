import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../lib/store';
import { Thumbnail } from '../components/Thumbnail';
import { money } from '../../shared/types';
import { Button, colors, Empty, IconButton, Page, styles } from '../components/ui';
export default function Cart() {
  const { cart, products, quantity, user } = useStore();
  const total = cart.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0);
  const missing = cart.some(item => !products.find(p => p.id === item.productId));
  return <Page title="Çantandakiler." subtitle={`Sepetinde ${cart.reduce((n, i) => n + i.quantity, 0)} parça var.`}>
    {!cart.length ? <Empty title="Sepetin yeni keşiflere açık" description="Sevdiğin parçayı bul, bedenini seç ve buraya ekle." action={{ title: 'Keşfete dön', onPress: () => router.navigate('/') }} /> : <>
      {cart.map(item => { const product = products.find(p => p.id === item.productId); return <View key={`${item.productId}-${item.size}`} style={[styles.section, { flexDirection: 'row', gap: 17 }]}>{product && <Pressable accessibilityRole="button" accessibilityLabel={product.title} onPress={() => router.push(`/product/${product.id}`)}><Thumbnail product={product} style={{ width: 82, height: 108, borderRadius: 7, backgroundColor: colors.pale }} /></Pressable>}<View style={{ flex: 1 }}><Text style={{ fontSize: 10, color: colors.muted, marginBottom: 6 }}>{product?.shop || 'Ürün artık mevcut değil'}</Text><Text style={{ fontSize: 15, fontWeight: '500', color: colors.ink }}>{product?.title || item.productId}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{item.size}{product && ` / ${product.color}`}</Text><View style={[styles.row, { justifyContent: 'space-between', marginTop: 10 }]}><View style={[styles.row, { gap: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 6 }]}><IconButton name="minus" label={`${product?.title || 'Ürün'} adedini azalt`} onPress={() => quantity(item.productId, item.size, item.quantity - 1)} /><Text style={{ fontSize: 13, color: colors.ink, minWidth: 18, textAlign: 'center' }}>{item.quantity}</Text><IconButton name="plus" label={`${product?.title || 'Ürün'} adedini artır`} onPress={() => quantity(item.productId, item.size, item.quantity + 1)} /></View><Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{money((product?.price || 0) * item.quantity)}</Text></View></View><IconButton name="close" label="Ürünü sepetten çıkar" onPress={() => quantity(item.productId, item.size, 0)} /></View>; })}
      <View style={{ gap: 20, marginTop: 28, maxWidth: 450, width: '100%', alignSelf: 'flex-end' }}><View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={{ fontSize: 16, color: colors.ink }}>Toplam</Text><Text style={{ fontSize: 24, fontWeight: '600', color: colors.ink }}>{money(total)}</Text></View><Text style={styles.subtitle}>Bu ön izlemede gerçek ödeme alınmaz ve gönderim yapılmaz.</Text><Button title={user ? 'Sipariş adımına geç' : 'Giriş yap ve devam et'} icon="arrow" disabled={missing} onPress={() => router.push(user ? '/checkout' : { pathname: '/profile', params: { next: 'checkout' } })} />{missing && <Text style={{ color: '#F59B91' }}>Devam etmek için mevcut olmayan ürünü çıkar.</Text>}</View>
    </>}
  </Page>;
}

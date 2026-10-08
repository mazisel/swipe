import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { money, Order } from '../../shared/types';
import { Button, colors, Empty, ErrorText, Field, Page, styles } from '../components/ui';
import { Icon } from '../components/Icon';
export default function Checkout() {
  const { cart, products, user, clearCart, checkout } = useStore(); const [name, setName] = useState(user?.name || ''); const [address, setAddress] = useState(''); const [ack, setAck] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [order, setOrder] = useState<Order | null>(null); const requestKey = useRef(Crypto.randomUUID());
  const total = cart.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.price || 0) * item.quantity, 0);
  async function submit() { setBusy(true); setError(''); try { const result = await api<{ order: Order }>('/checkout', { requestKey: requestKey.current, name, address, demoAcknowledged: ack, items: cart }); setOrder(result.order); clearCart(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  if (order) return <Page title="Sipariş akışı tamamlandı." subtitle="Bu bir demo sipariş. Ücret alınmadı ve gönderim yapılmayacak."><Empty icon="check" title={order.id} description={`${money(order.total)} tutarındaki demo siparişini profilinden inceleyebilirsin.`} action={{ title: 'Siparişlerimi gör', onPress: () => router.replace('/profile') }} /><Button title="Keşfetmeye devam et" outline onPress={() => router.replace('/')} /></Page>;
  if (!user) return <Page title="Bir adım kaldı." back><Empty icon="user" title="Hesabına giriş yap" description="Siparişlerini hesabında saklayalım." action={{ title: 'Giriş yap', onPress: () => router.replace({ pathname: '/profile', params: { next: 'checkout' } }) }} /></Page>;
  if (!cart.length) return <Page title="Sepetin boş." back><Empty title="Önce bir parça keşfet" description="Seçtiğin parçalar burada seni bekleyecek." action={{ title: 'Keşfete dön', onPress: () => router.replace('/') }} /></Page>;
  return <Page title="Son bir adım." subtitle="Siparişini gözden geçir." back><View style={{ maxWidth: 540, width: '100%', gap: 22, marginTop: 30 }}>
    <View style={{ backgroundColor: colors.pale, padding: 18, borderRadius: 8, gap: 7 }}><Text style={{ fontWeight: '600', color: colors.olive }}>Demo ödeme</Text><Text style={[styles.subtitle, { color: colors.olive }]}>Gerçek ödeme alınmaz. Kart bilgisi girmen gerekmez; ürünler kargoya verilmez.</Text></View>
    <Field label="Alıcı adı" value={name} onChangeText={setName} placeholder="Ad soyad" /><Field label="Teslimat adresi" placeholder="Mahalle, sokak, kapı no, ilçe ve şehir" multiline value={address} onChangeText={setAddress} /><Text style={{ color: colors.muted, fontSize: 12 }}>Denemek için örnek bir adres kullanabilirsin.</Text>
    <View style={[styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.line, paddingTop: 20 }]}><Text style={{ fontSize: 16, color: colors.ink }}>Ürün toplamı</Text><Text style={{ fontSize: 23, fontWeight: '600', color: colors.ink }}>{money(total)}</Text></View>
    <Pressable accessibilityRole="checkbox" accessibilityLabel="Bu işlemin demo sipariş olduğunu anladım" accessibilityState={{ checked: ack }} onPress={() => setAck(!ack)} style={[styles.row, { paddingVertical: 8 }]}><View style={{ width: 24, height: 24, borderRadius: 5, borderWidth: 1, borderColor: ack ? colors.ink : '#999', backgroundColor: ack ? colors.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{ack && <Icon name="check" size={17} color={colors.canvas} />}</View><Text style={{ flex: 1, fontSize: 13, color: colors.ink, lineHeight: 20 }}>Bu işlemin demo sipariş olduğunu anladım.</Text></Pressable>
    <ErrorText message={error} />{checkout !== 'demo' && <ErrorText message="Ödeme henüz etkinleştirilmedi. Ödeme sağlayıcısı bağlantısı bekleniyor." />}<Button title="Demo sipariş oluştur" icon="arrow" loading={busy} disabled={!ack || name.trim().length < 2 || address.trim().length < 15 || checkout !== 'demo'} onPress={submit} />
  </View></Page>;
}

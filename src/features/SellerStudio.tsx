import { useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { categories, Category, Product, ProductMedia, User } from '../../shared/types';
import { useStore } from '../lib/store';
import { api, mediaUrl } from '../lib/api';
import { Button, colors, Empty, ErrorText, Field, Page, styles } from '../components/ui';
import { Icon } from '../components/Icon';
import { ProductGrid } from '../components/ProductGrid';

export default function Sell() {
  const { user, setUser, products, refresh, setToast, hydrated } = useStore();
  const [shop, setShop] = useState(''); const [editingProfile, setEditingProfile] = useState(false); const [profileName, setProfileName] = useState(user?.shop || ''); const [bio, setBio] = useState(user?.shopBio || ''); const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState('');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState(''); const [stock, setStock] = useState('1'); const [color, setColor] = useState(''); const [sizes, setSizes] = useState('Standart'); const [category, setCategory] = useState<Category>('Giyim'); const [media, setMedia] = useState<ProductMedia[]>([]);
  const own = products.filter(p => p.sellerId === user?.id);
  async function createShop() { setBusy(true); setError(''); try { const result = await api<{ user: User }>('/shop', { name: shop }); setUser(result.user); setToast('Mağazan hazır. İlk ürününü ekleyebilirsin.'); setAdding(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function saveProfile() { setBusy(true); setError(''); try { const result = await api<{ user: User }>('/shop/profile', { name: profileName, bio }); setUser(result.user); await refresh(); setEditingProfile(false); setToast('Mağaza profilin güncellendi.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function pick() {
    setError('');
    try {
      if (media.length >= 6 || uploading) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: .85, allowsMultipleSelection: true, selectionLimit: 6 - media.length, orderedSelection: true, videoMaxDuration: 60 });
      if (result.canceled) return;
      if (result.assets.length + media.length > 6) throw new Error('Bir ürüne en fazla 6 medya ekleyebilirsin.');
      if (result.assets.some(asset => (asset.fileSize || 0) > 50 * 1024 * 1024)) throw new Error('Her dosya en fazla 50 MB olabilir.');
      setUploading(true);
      for (const asset of result.assets) {
        const form = new FormData();
        if (Platform.OS === 'web') form.append('file', asset.file || await (await fetch(asset.uri)).blob(), asset.fileName || 'product.jpg');
        else form.append('file', { uri: asset.uri, type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'), name: asset.fileName || (asset.type === 'video' ? 'product.mp4' : 'product.jpg') } as unknown as Blob);
        const uploaded = await api<ProductMedia>('/uploads', undefined, form);
        setMedia(current => [...current, uploaded]);
      }
    } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }
  async function publish() {
    setError(''); if (!media.length) { setError('Ürünün için bir fotoğraf veya video seç.'); return; }
    if (!/^\d+([.,]\d{1,2})?$/.test(price)) { setError('Fiyatı 1299 veya 1299,90 biçiminde gir.'); return; }
    if (!/^\d+$/.test(stock)) { setError('Stok için tam sayı gir.'); return; }
    setBusy(true);
    try {
      await api<{ product: Product }>('/products', { title, description, price: Math.round(Number(price.replace(',', '.')) * 100), category, gallery: media.map(item => item.url), stock: Number(stock), sizes: sizes.split(',').map(v => v.trim()).filter(Boolean), color });
      await refresh(); setAdding(false); setTitle(''); setDescription(''); setPrice(''); setStock('1'); setColor(''); setSizes('Standart'); setMedia([]); setToast('Ürünün keşfette yayımlandı.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!hydrated) return <Page title="Mağazan yükleniyor…"><View /></Page>;
  if (!user) return null;
  if (!user.shop) return <Page title="Küçük bir başlangıç." subtitle="Mağazana sana ait bir isim ver."><View style={{ marginTop: 32, maxWidth: 450, gap: 22 }}><Field label="Mağaza adı" placeholder="Örn. Mavi Atelier" value={shop} onChangeText={setShop} maxLength={60} /><Text style={styles.subtitle}>Bu isim ürünlerinde görünür. Fotoğraf ve videolarını bir sonraki adımda ekleyebilirsin.</Text><ErrorText message={error} /><Button title="Mağazamı oluştur" onPress={createShop} loading={busy} disabled={shop.trim().length < 2} /></View></Page>;
  if (editingProfile) return <Page title="Mağaza profilin" subtitle="Alıcılar mağazanı bu bilgilerle tanır."><View style={{ maxWidth: 500, gap: 22, marginTop: 30 }}><Field label="Mağaza adı" value={profileName} onChangeText={setProfileName} maxLength={60} /><Field label="Mağaza hakkında" value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="Neler üretiyorsun, neleri seviyorsun?" /><ErrorText message={error} /><Button title="Profili kaydet" loading={busy} onPress={saveProfile} /><Button title="Vazgeç" outline disabled={busy} onPress={() => setEditingProfile(false)} /></View></Page>;
  return <Page title={user.shop} subtitle={`${own.length} ürün · Senin küçük mağazan`}>
    <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }]}><Text style={{ color: colors.muted, fontSize: 13 }}>{adding ? 'Yeni bir keşif ekle' : 'Koleksiyonun'}</Text>{!adding && <Button title="Profilini düzenle" outline onPress={() => { setProfileName(user.shop || ''); setBio(user.shopBio || ''); setEditingProfile(true); }} />}<Button title={adding ? 'Vazgeç' : 'Ürün ekle'} icon={adding ? 'close' : 'plus'} outline={adding} disabled={busy || uploading} onPress={() => { setAdding(!adding); setError(''); }} /></View>
    {adding ? <View style={{ maxWidth: 600, width: '100%', gap: 22, marginTop: 28 }}>
      <View style={{ gap: 12 }}>
        <Text style={styles.label}>Fotoğraf ve videolar · {media.length}/6</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>İlk medya kapaktır. Oklarla sırala veya kapağa taşı.</Text>
        {media.map((item, index) => <View key={item.url} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }}>
          {item.type === 'image' ? <Image source={{ uri: mediaUrl(item.url) }} style={{ width: 60, height: 70, borderRadius: 6 }} /> : <View style={{ width: 60, height: 70, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" /></View>}
          <View style={{ flex: 1, gap: 8 }}><Text style={{ color: colors.ink }}>{index === 0 ? 'Kapak' : `${index + 1}. medya`} · {item.type === 'video' ? 'Video' : 'Fotoğraf'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[{ label: 'Öne al', to: index - 1 }, { label: 'Arkaya al', to: index + 1 }, { label: 'Kapak yap', to: 0 }].map(action => <Pressable key={action.label} accessibilityRole="button" disabled={uploading || busy || action.to < 0 || action.to >= media.length || action.to === index} onPress={() => setMedia(current => { const next = [...current]; next.splice(index, 1); next.splice(action.to, 0, item); return next; })}><Text style={{ color: action.to < 0 || action.to >= media.length || action.to === index ? '#62666C' : '#FFF', fontSize: 12 }}>{action.label}</Text></Pressable>)}
            <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}. medyayı kaldır`} disabled={busy || uploading} onPress={() => setMedia(current => current.filter(m => m.url !== item.url))}><Text style={{ color: '#FFB8B8', fontSize: 12 }}>Kaldır</Text></Pressable>
          </View></View>
        </View>)}
        <Button title={uploading ? 'Yükleniyor…' : 'Fotoğraf / video ekle'} icon="plus" outline disabled={uploading || busy || media.length >= 6} onPress={pick} />
        <Text style={{ color: colors.muted, fontSize: 11 }}>JPG, PNG, WebP, MP4, MOV · Dosya başına en fazla 50 MB</Text>
      </View>
      <Field label="Ürün adı" placeholder="Örn. Rahat kesim keten gömlek" value={title} onChangeText={setTitle} maxLength={100} /><Field label="Ürünün hikâyesi" placeholder="Malzeme, kesim, ölçü ve bakım bilgilerini paylaş." multiline value={description} onChangeText={setDescription} maxLength={2000} />
      <View style={{ flexDirection: 'row', gap: 16 }}><View style={{ flex: 1 }}><Field label="Fiyat (TL)" placeholder="1299" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View><View style={{ width: 110 }}><Field label="Toplam stok" keyboardType="number-pad" value={stock} onChangeText={setStock} /></View></View>
      <View><Text style={styles.label}>Kategori</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.filter(c => c !== 'Tümü').map(c => <Pressable key={c} accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ checked: c === category }} onPress={() => setCategory(c)} style={{ padding: 12, backgroundColor: category === c ? colors.ink : '#24282D', borderWidth: 1, borderColor: colors.line, borderRadius: 6 }}><Text style={{ fontSize: 12, color: c === category ? colors.canvas : colors.ink }}>{c}</Text></Pressable>)}</View></View>
      <Field label="Renk" placeholder="Örn. Ekru" value={color} onChangeText={setColor} maxLength={40} /><Field label="Beden / seçenekler" placeholder="S, M, L veya Standart" value={sizes} onChangeText={setSizes} /><Text style={{ fontSize: 12, color: colors.muted }}>Seçenekleri virgülle ayır. Toplam stok tüm bedenler için ortaktır.</Text><ErrorText message={error} /><Button title="Ürünü yayımla" icon="arrow" onPress={publish} loading={busy} disabled={uploading || !media.length} />
    </View> : <><ErrorText message={error} />{own.length ? <ProductGrid products={own} /> : <Empty icon="store" title="İlk parçanın yeri hazır" description="İyi bir fotoğraf veya kısa bir video ile koleksiyonuna başla." action={{ title: 'İlk ürünümü ekle', onPress: () => setAdding(true) }} />}</>}
  </Page>;
}

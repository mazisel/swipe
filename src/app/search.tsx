import { trackDiscovery } from '../lib/discovery';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categories, Category } from '../../shared/types';
import { useStore } from '../lib/store';
import { ProductGrid } from '../components/ProductGrid';
import { colors, Empty, ErrorText } from '../components/ui';
import { Icon } from '../components/Icon';
export default function Search() {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState<Category>('Tümü'); const { products, error } = useStore();
  const results = products.filter(p => (category === 'Tümü' || p.category === category) && `${p.title} ${p.shop} ${p.description}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={search.page}><View style={search.container}>
    <Text style={search.title}>Aklında ne var?</Text><View style={search.inputRow}><Icon name="search" color="#A8ADB5" size={21} /><TextInput accessibilityLabel="Ürün veya mağaza ara" placeholder="Bir parça, bir mağaza, bir his…" placeholderTextColor="#8C929B" value={query} onChangeText={setQuery} style={search.input} returnKeyType="search" />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQuery('')} hitSlop={10}><Icon name="close" size={19} /></Pressable>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={search.categories}>{categories.map(c => <Pressable key={c} accessibilityRole="tab" accessibilityState={{ selected: category === c }} onPress={() => setCategory(c)} style={[search.category, category === c && search.selected]}><Text style={{ fontSize: 12, color: category === c ? '#131518' : '#BDC1C8' }}>{c}</Text></Pressable>)}</ScrollView>
    <ErrorText message={error} /><Text style={search.count}>{query ? `${results.length} keşif bulundu` : 'Gözün bunlara da takılabilir'}</Text>{results.length ? <ProductGrid products={results} onSelect={p => trackDiscovery({ productId: p.id, kind: 'search_select' })} /> : <Empty icon="search" title="Henüz bir eşleşme yok" description="Başka bir kelimeyle veya kategoriyle yeniden deneyebilirsin." />}
  </View></ScrollView>;
}
const search = StyleSheet.create({ page: { flexGrow: 1, padding: 23, paddingTop: 38, paddingBottom: 130 }, container: { maxWidth: 780, width: '100%', alignSelf: 'center' }, title: { color: colors.ink, fontSize: 29, fontWeight: '600', letterSpacing: -1, marginBottom: 24 }, inputRow: { backgroundColor: '#22262A', borderRadius: 17, paddingHorizontal: 17, height: 54, flexDirection: 'row', alignItems: 'center', gap: 10 }, input: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, height: '100%' }, categories: { gap: 8, paddingTop: 21, paddingBottom: 27 }, category: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#22262A' }, selected: { backgroundColor: '#EEEFF0' }, count: { color: '#9BA0A8', fontSize: 12 } });

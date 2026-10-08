import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useStore } from '../lib/store';
import { Button, Empty, ErrorText, Page } from '../components/ui';
import { ProductGrid } from '../components/ProductGrid';
export default function Liked() {
  const { products, saved, likesReady, likesError, loadLikes, readyDiscovery, setToast } = useStore();
  const items = products.filter(p => saved.includes(p.id));
  return <Page title="Beğendiklerin" subtitle="Kalbine dokunan parçalar, yeniden keşfetmen için burada.">
    <ErrorText message={likesError} />
    {likesError ? <Button title="Yeniden dene" onPress={() => { void readyDiscovery().then(() => loadLikes(true)).catch(() => setToast('Bağlantı kurulamadı. Lütfen yeniden dene.')); }} /> : !likesReady ? <ActivityIndicator color="#FFF" /> : items.length ? <ProductGrid products={items} /> : <Empty icon="heart" title="İlk beğenini bulalım" description="Keşfette kalbe dokun veya sola kaydır. Beğendiğin ürünler burada birikir." action={{ title: 'Keşfetmeye başla', onPress: () => router.navigate('/') }} />}
  </Page>;
}

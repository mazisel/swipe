import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Share, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { money, type Product } from '../../shared/types';
import { useStore, type SwipeReceipt } from '../lib/store';
import { useDiscoveryFeed } from '../lib/useDiscoveryFeed';
import { useMediaPrefetch } from '../lib/useMediaPrefetch';
import { useSwipeLesson } from '../lib/useSwipeLesson';
import { useForeground } from '../lib/useViewing';
import { confirmSwipe } from '../lib/swipeHaptics';
import type { SwipeAction } from '../../shared/swipe';
import { Reveal } from '../components/MicroMotion';
import { FollowButton } from '../components/FollowButton';
import { Button, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { DiscoveryCard } from '../components/DiscoveryCard';
import { SwipeFeedback, SwipeLesson, SwipeSizePicker } from '../components/SwipeOverlays';
const viewabilityConfig = { itemVisiblePercentThreshold: 65 };

export default function Discover() {
  const { products: catalogue, cart, saved, swipeProduct, toggleSaved, hydrated, feedRevision, hideFeed, setToast } = useStore();
  const feed = useDiscoveryFeed(hydrated, feedRevision);
  const { loading, error, nextCursor, loadMore } = feed;
  const catalogueById = new Map(catalogue.map(p => [p.id, p]));
  const products = feed.items.map(p => catalogueById.get(p.id) || p);
  const [options, setOptions] = useState<Product | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [sizeProduct, setSizeProduct] = useState<Product | null>(null);
  const pendingSize = useRef<((completed: boolean) => void) | null>(null);
  const [feedback, setFeedback] = useState<SwipeReceipt | null>(null);
  const [dragging, setDragging] = useState(false), [hiding, setHiding] = useState(false);
  const [height, setHeight] = useState(0), [index, setIndex] = useState(0), [visibleIndex, setVisibleIndex] = useState(0);
  const { width, height: windowHeight } = useWindowDimensions();
  const list = useRef<FlatList<Product>>(null);
  const pathname = usePathname(), foreground = useForeground(), insets = useSafeAreaInsets();
  const reelWidth = width >= 760 ? Math.min(560, windowHeight * .65) : width;
  useMediaPrefetch(products.slice(index + 1, index + 3).map(p => p.mediaType === 'image' ? p.media : p.poster), pathname === '/' && foreground);
  const clearFeedback = useCallback(() => setFeedback(null), []);
  const lesson = useSwipeLesson(feed.sessionId || '', products[index]?.id || '', pathname === '/' && foreground && !loading && !options && !sizeProduct && !feedback && !dragging && !!products[index]);
  const closeSize = useCallback(() => { pendingSize.current?.(false); pendingSize.current = null; setSizeProduct(null); }, []);
  useEffect(() => () => { pendingSize.current?.(false); pendingSize.current = null; }, [pathname, feed.sessionId]);

  async function completeAction(product: Product, kind: SwipeAction, size?: string) {
    const receipt = await swipeProduct(product, kind, size);
    setToast('');
    setFeedback(current => !receipt.undo && current?.undo && current.key === receipt.key ? current : receipt);
    if (receipt.undo) confirmSwipe();
    return !!receipt.undo || (kind === 'save' ? saved.includes(product.id) : cart.some(item => item.productId === product.id));
  }
  async function swipe(product: Product, kind: SwipeAction) {
    lesson.acknowledge();
    if (kind === 'cart' && product.sizes.length > 1 && product.stock > 0 && !cart.some(item => item.productId === product.id)) {
      setFeedback(null); setSizeProduct(product);
      return new Promise<boolean>(resolve => { pendingSize.current = resolve; });
    }
    try { return await completeAction(product, kind, product.sizes[0]); } catch (e) { setToast((e as Error).message); return false; }
  }
  async function chooseSize(size: string) {
    if (!sizeProduct) return;
    const completed = await completeAction(sizeProduct, 'cart', size);
    const resolve = pendingSize.current; pendingSize.current = null;
    setSizeProduct(null); resolve?.(completed);
  }
  function advance(productId: string) {
    const current = products.findIndex(p => p.id === productId);
    if (current < 0) return;
    lesson.onScroll(); setIndex(current + 1);
    list.current?.scrollToOffset({ offset: height * (current + 1), animated: false });
  }
  function restart() { closeSize(); lesson.rebase(); setDragging(false); setIndex(0); feed.restart(); }
  async function hide(kind: 'product' | 'seller') {
    if (!options || hiding) return;
    setHiding(true);
    try {
      const id = kind === 'product' ? options.id : options.sellerId;
      await hideFeed(kind, id); lesson.rebase(); feed.remove(kind, id); setOptions(null); setIndex(0);
      list.current?.scrollToOffset({ offset: 0, animated: false });
      setToast(kind === 'product' ? 'Bu parça akışından kaldırıldı.' : 'Bu mağazanın parçaları gizlendi.');
    } catch (e) { setToast((e as Error).message); } finally { setHiding(false); }
  }
  // Keep the prepared media window anchored while neither card is 65% visible.
  // Playback/measurement still stop in that gap via visibleIndex.
  // FlatList retains this callback identity even through Expo Fast Refresh.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken<Product>[] }) => { const next = viewableItems[0]?.index ?? -1; setVisibleIndex(next); if (next >= 0) setIndex(next); });
  useEffect(() => { if (!loading && nextCursor && products.length - index <= 2 && !error) void loadMore(); }, [index, products.length, loading, error, nextCursor, loadMore]);
  async function share(product: Product) {
    try { await Share.share({ message: `${product.title} — ${money(product.price)} · ${product.shop}`, ...(Platform.OS === 'web' ? { url: `${window.location.origin}/product/${product.id}` } : {}) }); }
    catch { setToast('Paylaşım açılamadı.'); }
  }
  const move = (delta: number) => list.current?.scrollToOffset({ offset: height * Math.max(0, Math.min(products.length, index + delta)), animated: true });

  return <View accessibilityElementsHidden={pathname !== '/'} importantForAccessibility={pathname !== '/' ? 'no-hide-descendants' : 'auto'} aria-hidden={pathname !== '/'} style={styles.screen}>
    <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ width: reelWidth, flex: 1, overflow: 'hidden' }}>
      {loading ? <View style={styles.center}><ActivityIndicator color="#FFF" /></View>
        : error && !products.length ? <View style={styles.center}><Empty title="Akışa küçük bir ara" description={error} action={{ title: 'Yeniden dene', onPress: restart }} /></View>
        : !products.length ? <Empty icon="reels" title="İlk keşifler yolda" description="Yeni parçalar eklendiğinde burada görünecek." />
        : height > 0 && <FlatList
          key={feed.sessionId} ref={list} data={products} keyExtractor={p => p.id} pagingEnabled snapToInterval={height} snapToAlignment="start" decelerationRate="fast" showsVerticalScrollIndicator={false}
          initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} scrollEnabled={!dragging && !options && !sizeProduct}
          onScroll={lesson.onScroll} scrollEventThrottle={100}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })} onViewableItemsChanged={onViewable} viewabilityConfig={viewabilityConfig}
          extraData={{ index, visibleIndex, saved, cart, pathname, height, options, sizeProduct, dragging, lesson: lesson.visible, foreground }}
          onEndReached={() => { if (!error) void feed.loadMore(); }} onEndReachedThreshold={0.5}
          ListFooterComponent={<View style={[styles.center, { height, padding: 32, paddingBottom: 130 }]}>{feed.loadingMore ? <ActivityIndicator color="#FFF" /> : error ? <Empty title="Keşifler yüklenemedi" description={error} action={{ title: 'Yeniden dene', onPress: () => { if (feed.nextCursor) void feed.loadMore(); else restart(); } }} /> : <Empty icon="reels" title="Şimdilik hepsini gördün." description="Yeni bir sırayla yeniden keşfet. Beğendiklerin bize yol gösteriyor." action={{ title: 'Yeniden keşfet', onPress: restart }} />}</View>}
          renderItem={({ item, index: itemIndex }) => <DiscoveryCard
            product={item} next={products[itemIndex + 1]} height={height} width={reelWidth} bottom={Math.max(insets.bottom, 14)}
            active={itemIndex === visibleIndex} preload={Math.abs(itemIndex - index) <= 1 && pathname === '/' && foreground} playing={itemIndex === visibleIndex && pathname === '/' && !options && !sizeProduct && !dragging && !lesson.visible}
            enabled={itemIndex === visibleIndex && pathname === '/' && foreground && !options && !sizeProduct}
            saved={saved.includes(item.id)} sessionId={feed.sessionId}
            onAction={kind => swipe(item, kind)} onExit={() => advance(item.id)} onDragging={setDragging}
            onSave={() => !dragging ? toggleSaved(item.id) : Promise.resolve(false)} onOptions={() => { setShowReason(false); setOptions(item); }} onShare={() => { void share(item); }}
          />}
        />}
      {lesson.visible && <SwipeLesson onDismiss={lesson.dismiss} />}
      {feedback && pathname === '/' && <SwipeFeedback receipt={feedback} onClose={clearFeedback} />}
    </View>
    <SwipeSizePicker product={sizeProduct ? catalogueById.get(sizeProduct.id) || sizeProduct : null} onClose={closeSize} onSelect={chooseSize} />
    <Modal transparent animationType="fade" visible={!!options} onRequestClose={() => setOptions(null)}><View style={styles.modal}>
      <Pressable accessibilityRole="button" accessibilityLabel="Seçenekleri kapat" style={StyleSheet.absoluteFill} onPress={() => setOptions(null)} />
      <View accessibilityViewIsModal style={[styles.options, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Text style={styles.optionsTitle}>Keşfini şekillendir.</Text>
        <Button title="Neden bunu görüyorum?" outline onPress={() => setShowReason(value => !value)} />
        <Reveal open={showReason}><View style={{ gap: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: '#F4F5F6', fontSize: 15, lineHeight: 23 }}>{options && feed.reasons[options.id]?.text || 'Farklı parçalar keşfetmen için bu seçkiye eklendi.'}</Text><Text style={{ color: '#969BA3', fontSize: 12, lineHeight: 18 }}>Açıklama bu seçkinin hazırlandığı ana aittir. Etkileşimlerin sonraki önerileri şekillendirir; özel mesajların okunmaz.</Text></View></Reveal>
        {options && <FollowButton shop={{ id: options.sellerId, name: options.shop, bio: '' }} />}
        <Button title="Ürünü bildir" outline onPress={()=>{const id=options?.id;setOptions(null);if(id)router.push({pathname:'/report',params:{kind:'product',targetId:id}});}}/><Button title="İlgilenmiyorum" outline loading={hiding} onPress={() => hide('product')} />
        <Button title="Bu mağazayı gösterme" outline disabled={hiding} onPress={() => hide('seller')} />
        <Button title="Vazgeç" onPress={() => setOptions(null)} />
      </View>
    </View></Modal>
    {width >= 760 && !!products.length && <View style={[styles.desktopControls, { left: width / 2 + reelWidth / 2 + 24 }]}>{([{ icon: 'up', label: 'Önceki keşif', delta: -1 }, { icon: 'down', label: 'Sonraki keşif', delta: 1 }] as const).map(button => <Pressable key={button.label} accessibilityRole="button" accessibilityLabel={button.label} disabled={dragging} onPress={() => move(button.delta)} style={styles.desktopArrow}><Icon name={button.icon} color="#BFC1C7" /></Pressable>)}</View>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0B0D', alignItems: 'center' }, center: { flex: 1, justifyContent: 'center' },
  modal: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.4)' },
  options: { width: '100%', maxWidth: 560, padding: 24, gap: 14, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#202329' }, optionsTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  desktopControls: { position: 'absolute', top: '44%', gap: 12 }, desktopArrow: { width: 46, height: 46, backgroundColor: '#202226', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});

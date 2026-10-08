import { useContext, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Product } from '../../shared/types';
import { mediaUrl } from '../lib/api';
import { useMediaPrefetch } from '../lib/useMediaPrefetch';
import { IconButton } from './ui';
import { Icon } from './Icon';
import { useForeground, useViewing } from '../lib/useViewing';
import { SwipePressContext } from './SwipeSurface';
import { TapPressable } from './TapPressable';
import { GallerySegment } from './MicroMotion';
import { productGallery, nextMedia } from '../../shared/gallery';
type MediaProps = { product: Product; active?: boolean; preload?: boolean; fallback?: string; reel?: boolean; visible?: boolean; sessionId?: string; onLongPress?: () => void };
function Video({ product, active, reel, visible = active, sessionId, onLongPress, fallback }: MediaProps) {
  const [firstFrame, setFirstFrame] = useState(false);
  const canPress = useContext(SwipePressContext);
  const [muted, setMuted] = useState(true); const [paused, setPaused] = useState(false); const foreground = useForeground(); const insets = useSafeAreaInsets();
  const source = mediaUrl(product.media);
  const [loadedSource, setLoadedSource] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  // Construct an empty player; load native asset metadata off the render path.
  const player = useVideoPlayer(null, p => { p.loop = true; p.muted = true; });
  useEffect(() => {
    let alive = true;
    void player.replaceAsync({ uri: source, useCaching: true }).then(() => {
      if (alive) setLoadedSource(source);
    }).catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
  }, [player, source]);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useViewing({ productId: product.id, sessionId, visible: !!visible, enabled: !!active && foreground && !paused && status === 'readyToPlay', sample: () => ({ position: player.currentTime, duration: player.duration, playing: player.playing }) });
  // Expo VideoPlayer is an imperative native handle with mutable properties.
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { if (active && foreground && !paused && loadedSource === source) player.play(); else player.pause(); }, [active, foreground, paused, player, loadedSource, source]);
  return <View style={StyleSheet.absoluteFill}><VideoView player={player} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" nativeControls={false} surfaceType="textureView" playsInline onFirstFrameRender={() => setFirstFrame(true)} />
    {!firstFrame && !!(product.poster || fallback) && <Image source={{ uri: mediaUrl(product.poster || fallback!) }} resizeMode="cover" style={StyleSheet.absoluteFill} />}
    {(loadFailed || status === 'error') && <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#25272B' }]}><Text style={{ color: '#FFF' }}>Video yüklenemedi.</Text><Text style={{ marginTop: 8, color: '#AAA' }}>Bağlantını kontrol et.</Text></View>}
    {reel && <><Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Videoyu oynat' : 'Videoyu duraklat'} onLongPress={() => { if (canPress()) onLongPress?.(); }} onPress={() => { if (canPress()) setPaused(!paused); }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{paused && <View style={{ padding: 23, borderRadius: 50, backgroundColor: 'rgba(0,0,0,.22)' }}><Icon name="play" size={36} color="#FFF" filled /></View>}</Pressable><View style={{ position: 'absolute', top: insets.top + 14, right: 14 }}><IconButton name={muted ? 'mute' : 'sound'} label={muted ? 'Sesi aç' : 'Sesi kapat'} onPress={() => setMuted(!muted)} color="#FFF" background="rgba(0,0,0,0.23)" /></View></>}
  </View>;
}
function SingleMedia({ product, active = false, reel = false, visible = active, sessionId, onLongPress, fallback }: MediaProps) {
  if (product.mediaType === 'video') return <Video key={product.media} product={product} active={active} reel={reel} visible={visible} sessionId={sessionId} onLongPress={onLongPress} fallback={fallback} />;
  return <Photo product={product} active={active} visible={visible} sessionId={sessionId} onLongPress={onLongPress} fallback={fallback} />;
}
function Photo({ product, active, visible, sessionId, onLongPress, fallback }: MediaProps) {
  const [failed, setFailed] = useState(false); const [ready, setReady] = useState(false); const foreground = useForeground();
  useViewing({ productId: product.id, sessionId, visible: !!visible, enabled: !!active && foreground && ready && !failed });
  return <Pressable accessibilityLabel={product.title} onLongPress={onLongPress} style={StyleSheet.absoluteFill}>{!ready && !!fallback && <Image source={{ uri: mediaUrl(fallback) }} resizeMode="cover" style={StyleSheet.absoluteFill} />}<Image source={{ uri: mediaUrl(product.media) }} accessibilityLabel={product.title} resizeMode="cover" style={StyleSheet.absoluteFill} onLoad={() => setReady(true)} onError={() => setFailed(true)} />{failed && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#24262B' }]}><Text style={{ color: '#FFF' }}>Görsel yüklenemedi.</Text></View>}</Pressable>;
}


export function Media(props: MediaProps) {
  return props.reel ? <Gallery key={props.product.id} {...props} /> : <SingleMedia {...props} />;
}
function Gallery(props: MediaProps) {
  const { product, active, visible = active, preload } = props;
  const foreground = useForeground();
  const items = productGallery(product), [index, setIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const selected = items[Math.min(index, items.length - 1)];
  const fallback = (items[index - 1]?.type === 'image' ? items[index - 1].url : items[index - 1]?.poster) || product.poster || items.find(item => item.type === 'image')?.url || '';
  const prepared = !!visible || (foreground && !!preload);
  useMediaPrefetch(items.slice(index, index + 3).map(item => item.type === 'image' ? item.url : item.poster || ''), prepared && foreground);
  // Keep the next gallery item mounted but paused; keyed layers reuse its player
  // on a tap. Preloaded layers never accrue impressions or viewing time.
  return <View style={StyleSheet.absoluteFill}>
    {!prepared ? <View style={StyleSheet.absoluteFill}>{!!(selected.type === 'image' ? selected.url : selected.poster || fallback) && <Image source={{ uri: mediaUrl(selected.type === 'image' ? selected.url : selected.poster || fallback) }} resizeMode="cover" style={StyleSheet.absoluteFill} />}</View> : items.map((item, i) => (i === index || (foreground && !!visible && i === index + 1)) && <View key={item.url} pointerEvents={i === index ? 'auto' : 'none'} accessibilityElementsHidden={i !== index} importantForAccessibility={i !== index ? 'no-hide-descendants' : 'auto'} aria-hidden={i !== index} style={[StyleSheet.absoluteFill, { opacity: i === index ? 1 : 0 }]}>
      <SingleMedia {...props} fallback={fallback} product={{ ...product, media: item.url, mediaType: item.type, poster: item.poster || '' }} active={i === index && active} visible={i === index && visible} reel={i === index && props.reel} />
    </View>)}
    {items.length > 1 && <>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        <TapPressable accessibilityRole="button" accessibilityLabel="Önceki görsel" disabled={index === 0} onLongPress={props.onLongPress} onPress={() => setIndex(i => nextMedia(i, -1, items.length))} style={{ width: '35%', marginTop: insets.top + 62, marginBottom: 100 }} />
        <View pointerEvents="none" style={{ flex: 1 }} />
        <TapPressable accessibilityRole="button" accessibilityLabel="Sonraki görsel" disabled={index === items.length - 1} onLongPress={props.onLongPress} onPress={() => setIndex(i => nextMedia(i, 1, items.length))} style={{ width: '35%', marginTop: insets.top + 62, marginBottom: 100 }} />
      </View>
      <View pointerEvents="none" accessibilityElementsHidden={!active} style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>{items.map((item, i) => <GallerySegment key={item.url} active={i === index} />)}</View>
        <Text accessibilityLiveRegion="polite" style={{ color: '#FFF', fontSize: 10, marginTop: 9, textShadowColor: '#0008', textShadowRadius: 4 }}>{index + 1} / {items.length}{selected.type === 'video' ? ' · Video' : ''}</Text>
      </View>
    </>}
  </View>;
}

import { Pulse } from './MicroMotion';
import { useState } from 'react';
import { useMotionValue } from '../lib/motion';
import { Animated, View } from 'react-native';
import type { FollowedShop } from '../../shared/types';
import { useStore } from '../lib/store';
import { Button, ErrorText } from './ui';
export function FollowButton({ shop }: { shop: FollowedShop }) {
  const { user, following, followingReady, followingError, refreshFollowing, setFollowing, setToast } = useStore();
  const [busy, setBusy] = useState(false);
  const opacity = useMotionValue(busy ? .65 : 1, 180);
  if (user?.id === shop.id) return null;
  const followed = following.some(item => item.id === shop.id);
  return <View style={{ gap: 8 }}><Pulse strength={.025} trigger={followed}><Animated.View style={{ opacity }}><Button title={followed ? 'Takiptesin ✓' : 'Mağazayı takip et'} outline={followed} disabled={!followingReady} loading={busy} onPress={async () => {
    setBusy(true);
    try { await setFollowing(shop, !followed); setToast(followed ? 'Mağaza takibinden çıktın.' : `${shop.name} takipte. Sonraki keşiflerinde öncelik alacak.`); }
    catch (e) { setToast((e as Error).message); }
    finally { setBusy(false); }
  }} /></Animated.View></Pulse>{!!followingError && <><ErrorText message={followingError} /><Button title="Takipleri yeniden yükle" outline onPress={() => { void refreshFollowing(); }} /></>}</View>;
}

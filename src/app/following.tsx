import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../lib/store';
import { Button, colors, Empty, ErrorText, Page } from '../components/ui';
import { FollowButton } from '../components/FollowButton';
import { TapPressable } from '../components/TapPressable';
export default function Following() {
  const { following, followingReady, followingError, refreshFollowing, user } = useStore();
  return <Page title="Takip ettiğin mağazalar" subtitle={user ? 'Sevdiğin dünyalar, keşiflerinde bir adım önde.' : 'Takiplerin bu cihazda hatırlanır. Giriş yaptığında hesabına taşınır.'} back>
    <ErrorText message={followingError} />
    {followingError ? <Button title="Yeniden dene" onPress={() => { void refreshFollowing(); }} /> : !followingReady ? <ActivityIndicator color={colors.ink} /> : !following.length ? <Empty icon="user" title="İlk mağazanı keşfet" description="Mağaza profilinden veya akıştaki üç nokta menüsünden takip edebilirsin." action={{ title: 'Keşfet', onPress: () => router.navigate('/') }} /> : following.map(shop => <View key={shop.id} style={{ paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 16 }}><TapPressable accessibilityRole="button" accessibilityLabel={`${shop.name} mağazasını aç`} onPress={() => router.push(`/shop/${shop.id}`)}><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '600' }}>{shop.name}</Text>{!!shop.bio && <Text style={{ color: colors.muted, marginTop: 6 }}>{shop.bio}</Text>}</TapPressable><View style={{ alignItems: 'flex-start' }}><FollowButton shop={shop} /></View></View>)}
  </Page>;
}

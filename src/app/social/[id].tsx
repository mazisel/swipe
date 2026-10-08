import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Comment, Review } from '../../../shared/types';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Media } from '../../components/Media';
import { Icon } from '../../components/Icon';
import { Button, colors, ErrorText, IconButton } from '../../components/ui';

type ReviewData = { reviews: Review[]; summary: { count: number; average: number } };
type Eligibility = { eligible: boolean; purchaseType: 'demo' | null; reason: string };
export default function SocialPanel() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useStore();
  return <SocialContent key={`${id}-${user?.id || 'guest'}`} id={id} initialTab={tab === 'reviews' ? 'reviews' : 'comments'} />;
}
function SocialContent({ id, initialTab }: { id: string; initialTab: 'comments' | 'reviews' }) {
  const { products, user, refresh } = useStore(); const product = products.find(p => p.id === id);
  const [mode, setMode] = useState(initialTab); const [comments, setComments] = useState<Comment[]>([]); const [reviews, setReviews] = useState<ReviewData>({ reviews: [], summary: { count: 0, average: 0 } }); const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [draft, setDraft] = useState(''); const [reviewDraft, setReviewDraft] = useState(''); const [rating, setRating] = useState(0); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets(); const userId = user?.id;
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([api<{ comments: Comment[] }>(`/products/${id}/comments`), api<ReviewData>(`/products/${id}/reviews`), userId ? api<Eligibility>(`/products/${id}/review-eligibility`) : Promise.resolve(null)]).then(([c, r, e]) => {
      if (!active) return; setComments(c.comments); setReviews(r); setEligibility(e); setError('');
      const own = r.reviews.find(entry => entry.userId === userId); if (own) { setRating(own.rating); setReviewDraft(own.body); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, userId]));
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  async function submit() {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'comments') { const result = await api<{ comment: Comment }>(`/products/${id}/comments`, { body: draft }); setComments(current => [result.comment, ...current]); setDraft(''); }
      else { await api(`/products/${id}/reviews`, { body: reviewDraft, rating }); const result = await api<ReviewData>(`/products/${id}/reviews`); setReviews(result); setNotice('Değerlendirmen kaydedildi.'); }
      void refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(commentId: string) { if (busy) return; setBusy(true); try { await api(`/comments/${commentId}/remove`, {}); setComments(current => current.filter(c => c.id !== commentId)); void refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const entries = mode === 'comments' ? comments : reviews.reviews;
  return <KeyboardAvoidingView accessibilityViewIsModal behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.screen}>
    <View style={{ flex: 1, width: width >= 760 ? Math.min(560, height * .65) : width }}>
      {product && <Media product={product} />}<View style={s.dim} />
      <Pressable accessibilityRole="button" accessibilityLabel="Sohbet panelini kapat" onPress={close} style={{ flex: 1, minHeight: 30 }} />
      <View style={[s.panel, { height: height * .77, maxHeight: '94%', paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={s.handle} /><View style={s.heading}><Text style={s.title}>Bu parçanın etrafında.</Text><IconButton name="close" label="Akışa dön" onPress={close} /></View>
        <View style={s.tabs}>{(['comments', 'reviews'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value === 'comments' ? 'Yorumlar' : 'Değerlendirmeler'} accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setError(''); setNotice(''); }} style={[s.tab, mode === value && s.selectedTab]}><Text style={{ color: mode === value ? '#FFF' : colors.muted, fontWeight: '600', fontSize: 13 }}>{value === 'comments' ? `Yorumlar · ${comments.length}` : `Değerlendirmeler · ${reviews.summary.count}`}</Text></Pressable>)}</View>
        {loading ? <View style={s.empty}><ActivityIndicator color="#FFF" /></View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 22, gap: 24, flexGrow: 1 }}>
          {mode === 'reviews' && reviews.summary.count > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="star" filled color="#D8E2C9" /><Text style={{ color: '#FFF', fontSize: 26, fontWeight: '600' }}>{reviews.summary.average.toFixed(1).replace('.', ',')}</Text><Text style={s.muted}>{reviews.summary.count} demo değerlendirmesi</Text></View>}
          {!entries.length && <View style={s.empty}><Icon name={mode === 'comments' ? 'comment' : 'star'} size={32} color="#A9B19E" /><Text style={s.emptyTitle}>{mode === 'comments' ? 'Sohbeti sen başlat.' : 'İlk deneyimi sen paylaş.'}</Text><Text style={[s.muted, { textAlign: 'center', maxWidth: 270 }]}>{mode === 'comments' ? 'Aklına takılanı sor, bu parça hakkında konuş.' : 'Sipariş verenlerin puanları ve deneyimleri burada buluşacak.'}</Text></View>}
          {entries.map(entry => <View key={entry.id} style={s.entry}><View style={s.avatar}><Text style={{ color: '#D6D9DE', fontWeight: '600' }}>{entry.name[0]}</Text></View><View style={{ flex: 1, gap: 7 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: '#F1F2F4', fontSize: 13, fontWeight: '600' }}>{entry.name}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(entry.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</Text></View>{'rating' in entry && <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>{[1, 2, 3, 4, 5].map(n => <Icon key={n} name="star" size={12} filled={n <= Number(entry.rating)} color="#D8E2C9" />)}<Text style={{ color: colors.muted, fontSize: 9, marginLeft: 5 }}>Demo sipariş</Text></View>}<Text style={s.body}>{entry.body}</Text>{mode === 'comments' && entry.userId === userId && <Pressable accessibilityRole="button" accessibilityLabel="Yorumumu sil" disabled={busy} onPress={() => remove(entry.id)} style={{ alignSelf: 'flex-start', paddingVertical: 7 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Sil</Text></Pressable>}</View></View>)}
        </ScrollView>}
        <View style={s.composer}><ErrorText message={error} />{!!notice && <Text accessibilityLiveRegion="polite" style={s.muted}>{notice}</Text>}
          {!user ? <Button title={mode === 'comments' ? 'Yorum yapmak için giriş yap' : 'Değerlendirmek için giriş yap'} outline onPress={() => router.replace({ pathname: '/profile', params: { next: `/social/${id}?tab=${mode}` } })} /> : loading ? null : mode === 'reviews' && !eligibility?.eligible ? <Text style={s.muted}>{eligibility?.reason || 'Değerlendirme bilgisi yüklenemedi.'}</Text> : <>
            {mode === 'reviews' && <><View accessibilityRole="radiogroup" accessibilityLabel="Ürün puanı" style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} yıldız`} accessibilityState={{ checked: rating === n }} onPress={() => setRating(n)} style={{ padding: 8 }}><Icon name="star" size={25} filled={n <= rating} color={n <= rating ? '#D8E2C9' : '#707783'} /></Pressable>)}</View><Text style={{ color: colors.muted, fontSize: 11 }}>Demo sipariş deneyimi · Gerçek satın alma değildir.</Text></>}
            <View style={s.inputRow}><TextInput accessibilityLabel={mode === 'comments' ? 'Yorumun' : 'Değerlendirmen'} placeholder={mode === 'comments' ? 'Sohbete katıl…' : 'Bu parçayla ilgili düşüncelerin…'} value={mode === 'comments' ? draft : reviewDraft} onChangeText={mode === 'comments' ? setDraft : setReviewDraft} multiline maxLength={mode === 'comments' ? 1000 : 2000} placeholderTextColor="#90969F" style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel={mode === 'comments' ? 'Yorumu gönder' : 'Değerlendirmeyi kaydet'} disabled={busy || !(mode === 'comments' ? draft.trim() : rating && reviewDraft.trim().length >= 3)} onPress={submit} style={[s.send, { opacity: busy || !(mode === 'comments' ? draft.trim() : rating && reviewDraft.trim().length >= 3) ? .35 : 1 }]}>{busy ? <ActivityIndicator color="#141619" /> : <Icon name="send" size={19} color="#141619" />}</Pressable></View>
          </>}
        </View>
      </View>
    </View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0B0D', alignItems: 'center' }, dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.4)' }, panel: { backgroundColor: '#181B1F', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: '#373B41' }, handle: { width: 34, height: 4, borderRadius: 4, backgroundColor: '#656A72', alignSelf: 'center', marginTop: 10 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, title: { color: '#FFF', fontSize: 17, fontWeight: '600', letterSpacing: -.5 }, tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line }, tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, selectedTab: { borderBottomColor: '#FFF' }, empty: { flex: 1, minHeight: 150, justifyContent: 'center', alignItems: 'center', gap: 13 }, emptyTitle: { color: '#FFF', fontSize: 19, fontWeight: '500' }, muted: { fontSize: 12, lineHeight: 19, color: colors.muted }, entry: { flexDirection: 'row', gap: 12 }, avatar: { width: 34, height: 34, borderRadius: 18, backgroundColor: '#30353B', alignItems: 'center', justifyContent: 'center' }, body: { color: '#DFE2E7', fontSize: 13, lineHeight: 20 }, composer: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 16, gap: 10 }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, input: { flex: 1, minHeight: 46, maxHeight: 110, color: '#FFF', fontSize: 14, borderRadius: 23, borderWidth: 1, borderColor: '#3D434B', paddingHorizontal: 16, paddingVertical: 12 }, send: { height: 46, width: 46, backgroundColor: '#E3E8DE', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { Conversation, Message } from '../../shared/types';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { Button, colors, Empty, ErrorText, IconButton } from '../components/ui';
import { Icon } from '../components/Icon';
import { Thumbnail } from '../components/Thumbnail';

type Thread = { conversation: Conversation; messages: Message[] };
export function MessageCenter({ seller = false, productId, conversationId }: { seller?: boolean; productId?: string; conversationId?:string }) {
  const { user, hydrated } = useStore();
  if (!hydrated) return <View style={s.loading}><ActivityIndicator color="#FFF" /></View>;
  if (!user) return <Empty icon="send" title="Sohbet burada başlar." description="Bir parçayı merak ettiğinde mağazaya doğrudan sor. Yanıtların burada seni beklesin." action={{ title: 'Mesajlaşmak için giriş yap', onPress: () => router.replace({ pathname: '/profile', params: { next: productId ? `/messages?productId=${encodeURIComponent(productId)}` : '/messages' } }) }} />;
  return <Inbox key={`${user.id}-${seller}-${productId || ''}-${conversationId||''}`} seller={seller} productId={productId} conversationId={conversationId} userId={user.id} />;
}
function Inbox({ seller, productId, conversationId, userId }: { seller: boolean; productId?: string; conversationId?:string; userId: string }) {
  const [selected, setSelected] = useState<string | null>(conversationId||null); const [starting, setStarting] = useState(!!productId); const [startError, setStartError] = useState('');
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (productId && !seller) void api<{ conversation: Conversation }>('/conversations/start', { productId }).then(data => { if (alive) { setSelected(data.conversation.id); setStartError(''); } }).catch(e => { if (alive) setStartError(e.message); }).finally(() => { if (alive) setStarting(false); });
    return () => { alive = false; };
  }, [productId, seller]));
  if (starting) return <View style={s.loading}><ActivityIndicator color="#FFF" /></View>;
  if (selected) return <Chat key={selected} id={selected} userId={userId} seller={seller} onBack={() => setSelected(null)} />;
  return <View style={{ flex: 1 }}><ErrorText message={startError} /><ConversationList seller={seller} onSelect={setSelected} /></View>;
}
function ConversationList({ seller, onSelect }: { seller: boolean; onSelect: (id: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async (alive: () => boolean) => { try { const data = await api<{ conversations: Conversation[] }>(`/conversations?role=${seller ? 'seller' : 'buyer'}`); if (alive()) { setConversations(data.conversations); setError(''); } } catch (e) { if (alive()) setError((e as Error).message); } finally { if (alive()) setLoading(false); } }, [seller]);
  useLiveRefresh(load);
  return <View style={{ flex: 1 }}><View style={s.header}><View><Text style={s.title}>{seller ? 'Mağaza mesajları' : 'Mesajların.'}</Text><Text style={s.subtitle}>{seller ? 'Bir soru, yeni bir bağ.' : 'Merak ettiğin parçalar, gerçek sohbetler.'}</Text></View><Icon name="send" color="#C8D4BB" size={25} /></View><ErrorText message={error} />
    {loading ? <View style={s.loading}><ActivityIndicator color="#FFF" /></View> : <ScrollView contentContainerStyle={{ paddingBottom: seller ? 24 : 118 }}>
      {!conversations.length ? <Empty icon="comment" title="Henüz bir sohbet yok." description={seller ? 'Alıcılardan gelen mesajları burada yanıtlayabilirsin.' : 'Akıştaki DM simgesine dokun, mağazaya ilk mesajını gönder.'} /> : conversations.map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.peerName} ile sohbet${c.unread ? `, ${c.unread} okunmamış mesaj` : ''}`} onPress={() => onSelect(c.id)} style={s.conversation}><View style={s.avatar}><Text style={{ color: '#DFE5D8', fontWeight: '600', fontSize: 17 }}>{c.peerName[0]}</Text></View><View style={{ flex: 1, gap: 6 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}><Text numberOfLines={1} style={[s.name, { flex: 1 }]}>{c.peerName}</Text><Text style={s.date}>{new Date(c.lastMessage!.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</Text></View><Text numberOfLines={1} style={{ color: c.unread ? '#F0F2F4' : colors.muted, fontSize: 13 }}>{c.lastMessage!.body}</Text><Text numberOfLines={1} style={s.date}>{c.productTitle}</Text></View>{c.unread > 0 && <View style={s.unread}><Text style={{ color: '#171A15', fontSize: 10, fontWeight: '700' }}>{c.unread}</Text></View>}</Pressable>)}
    </ScrollView>}
  </View>;
}
function Chat({ id, userId, seller, onBack }: { id: string; userId: string; seller: boolean; onBack: () => void }) {
  const { products } = useStore(); const [thread, setThread] = useState<Thread | null>(null); const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [sendError, setSendError] = useState('');
  const scroll = useRef<ScrollView>(null); const atBottom = useRef(true); const attempt = useRef<{ body: string; key: string } | null>(null); const sending = useRef(false);
  const load = useCallback(async (alive: () => boolean) => {
    try {
      const data = await api<Thread>(`/conversations/${id}`);
      if (!alive()) return;
      setThread(current => ({ ...data, messages: [...new Map([...(current?.messages || []), ...data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id) })); setError('');
      const last = data.messages.at(-1);
      if (last && data.conversation.unread > 0) await api(`/conversations/${id}/read`, { messageId: last.id });
    } catch (e) { if (alive()) setError((e as Error).message); }
  }, [id]);
  useLiveRefresh(load);
  async function send() {
    const body = draft.trim(); if (thread?.conversation.blocked || !body || sending.current) return;
    sending.current = true; setBusy(true); setSendError('');
    if (!attempt.current || attempt.current.body !== body) attempt.current = { body, key: Crypto.randomUUID() };
    try {
      const data = await api<{ message: Message }>(`/conversations/${id}/messages`, { body, requestKey: attempt.current.key });
      atBottom.current = true;
      setThread(current => current ? { ...current, messages: [...current.messages.filter(m => m.id !== data.message.id), data.message].sort((a, b) => a.id - b.id) } : current);
      setDraft(''); attempt.current = null;
    } catch (e) { setSendError((e as Error).message); } finally { sending.current = false; setBusy(false); }
  }
  const product = products.find(p => p.id === thread?.conversation.productId);
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingBottom: seller ? 16 : 105 }}>
    <View style={[s.header, { justifyContent: 'flex-start', paddingVertical: 12 }]}><IconButton name="back" label="Mesaj listesine dön" onPress={onBack} /><View style={{ flex: 1 }}><Text style={s.name}>{thread?.conversation.peerName || 'Sohbet'}</Text><Text style={s.subtitle}>{seller ? 'Alıcı' : 'Mağazayla sohbet'}</Text></View></View>
    {product && <Pressable accessibilityRole="button" accessibilityLabel="Sohbetteki ürünü aç" onPress={() => router.push(`/product/${product.id}`)} style={s.product}><Thumbnail product={product} style={{ width: 36, height: 44, borderRadius: 7 }} /><Text numberOfLines={2} style={{ flex: 1, color: '#D2D6DC', fontSize: 12 }}>{product.title}</Text><Icon name="arrow" size={17} color={colors.muted} /></Pressable>}
    <ErrorText message={error} />
    {!thread && !error ? <View style={s.loading}><ActivityIndicator color="#FFF" /></View> : <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (atBottom.current) scroll.current?.scrollToEnd({ animated: true }); }} onScroll={e => { const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent; atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100} contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 13 }}>
      {thread && !thread.messages.length && <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 13 }}><Icon name="send" size={32} color="#C8D4BB" /><Text style={s.name}>İlk mesaj senden.</Text><Text style={[s.subtitle, { textAlign: 'center', maxWidth: 240 }]}>Beden, doku ya da aklına takılan küçük bir detay. Mağazaya sor.</Text></View>}
      {thread?.messages.map((m, index) => { const own = m.senderId === userId; return <View key={m.id} style={{ alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 5 }}><View style={[s.bubble, own && s.ownBubble]}><Text selectable style={{ color: own ? '#192019' : '#E9ECF0', fontSize: 14, lineHeight: 21 }}>{m.body}</Text></View><Text style={[s.date, { alignSelf: own ? 'flex-end' : 'flex-start', paddingHorizontal: 4 }]}>{new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{own && index === thread.messages.length - 1 ? (m.id <= thread.conversation.peerRead ? ' · Görüldü' : ' · Gönderildi') : ''}</Text>{!own&&<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/report',params:{kind:'message',targetId:String(m.id)}})}><Text style={s.date}>Mesajı bildir</Text></Pressable>}</View>; })}
    </ScrollView>}
    {thread?.conversation.peerId&&<View style={{paddingHorizontal:18,gap:8}}><Button title={thread.conversation.blockedByMe?'Engeli kaldır':'Mesajlarda engelle'} outline onPress={async()=>{try{await api('/blocks',{userId:thread.conversation.peerId,block:!thread.conversation.blockedByMe});await load(()=>true);}catch(e){setSendError((e as Error).message);}}}/>{thread.conversation.blocked&&<Text style={s.subtitle}>Bu hesapla yeni mesaj gönderimi kapalı.</Text>}</View>}<View style={s.composer}><ErrorText message={sendError} /><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}><TextInput accessibilityLabel="Mesajın" value={draft} onChangeText={setDraft} editable={!busy&&!thread?.conversation.blocked} placeholder="Bir mesaj yaz…" placeholderTextColor="#9298A0" multiline maxLength={2000} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel="Mesajı gönder" accessibilityState={{ disabled: busy || !!thread?.conversation.blocked || !draft.trim() || !thread }} disabled={busy || !!thread?.conversation.blocked || !draft.trim() || !thread} onPress={send} style={[s.send, { opacity: busy || !!thread?.conversation.blocked || !draft.trim() || !thread ? .4 : 1 }]}>{busy ? <ActivityIndicator color="#192019" /> : <Icon name="send" size={21} color="#192019" />}</Pressable></View>{!!sendError && <Button title="Tekrar gönder" outline onPress={send} loading={busy} />}</View>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 100 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 22, gap: 12 }, title: { color: '#FFF', fontSize: 30, letterSpacing: -1, fontWeight: '600' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 19 }, conversation: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: '#24282D' }, avatar: { width: 49, height: 49, backgroundColor: '#2A302B', borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, name: { color: '#F0F2F4', fontSize: 15, fontWeight: '600' }, date: { color: '#8B929C', fontSize: 10 }, unread: { minWidth: 20, height: 20, borderRadius: 12, paddingHorizontal: 5, backgroundColor: '#D5E0C9', alignItems: 'center', justifyContent: 'center' }, product: { flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 22, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2B3036' }, bubble: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 21, borderBottomLeftRadius: 5, backgroundColor: '#292E35' }, ownBubble: { backgroundColor: '#D7E1CD', borderBottomLeftRadius: 21, borderBottomRightRadius: 5 }, composer: { paddingTop: 12, paddingHorizontal: 18, gap: 10, borderTopWidth: 1, borderColor: '#272D34' }, input: { flex: 1, color: '#FFF', fontSize: 14, minHeight: 48, maxHeight: 110, borderWidth: 1, borderColor: '#3A414A', borderRadius: 24, paddingVertical: 13, paddingHorizontal: 18 }, send: { width: 48, height: 48, borderRadius: 25, backgroundColor: '#D7E1CD', alignItems: 'center', justifyContent: 'center' },
});

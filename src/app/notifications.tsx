import {useCallback,useState} from 'react';
import {Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {api} from '../lib/api';
import {useStore} from '../lib/store';
import {Button,ErrorText,Page,styles} from '../components/ui';
type Notice={id:number;title:string;route:string;readAt:string|null;createdAt:string};
type Result={items:Notice[];nextCursor:number|null;unread:number};
export default function Notifications(){
 const {user}=useStore();
 return user?<NotificationsInbox key={user.id}/>:<Page title="Bildirimlerin" back><Button title="Giriş yap" onPress={()=>router.push('/profile')}/></Page>;
}
function NotificationsInbox(){
 const {user}=useStore();const [items,setItems]=useState<Notice[]>([]),[cursor,setCursor]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{setBusy(true);try{const r=await api<Result>('/notifications');setItems(r.items);setCursor(r.nextCursor);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}},[]);
 useFocusEffect(useCallback(()=>{if(user)void load();},[user,load]));
 async function open(n:Notice){try{await api('/notifications/read',{ids:[n.id]});setItems(v=>v.map(i=>i.id===n.id?{...i,readAt:new Date().toISOString()}:i));router.push(n.route as '/profile');}catch(e){setError((e as Error).message);}}
 return <Page title="Bildirimlerin" back subtitle="Mesajlar, kargo güncellemeleri ve takip ettiğin mağazalardan yeni parçalar."><ErrorText message={error}/>{!user?<Button title="Giriş yap" onPress={()=>router.push('/profile')}/>:<><View style={{marginTop:20,gap:12}}><Button title="Yenile" outline loading={busy} onPress={()=>void load()}/>{!items.length&&!busy&&<Text style={styles.subtitle}>Henüz bildirim yok.</Text>}{items.map(n=><View key={n.id} style={styles.section}><Text style={styles.subtitle}>{n.readAt?'':'● '}{n.title}</Text><Text style={styles.subtitle}>{new Date(n.createdAt).toLocaleString('tr-TR')}</Text><Button title="Görüntüle" outline onPress={()=>void open(n)}/></View>)}{cursor&&<Button title="Daha eski bildirimler" loading={busy} onPress={async()=>{if(busy)return;setBusy(true);try{const r=await api<Result>(`/notifications?before=${cursor}`);setItems(v=>[...v,...r.items.filter(n=>!v.some(i=>i.id===n.id))]);setCursor(r.nextCursor);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/>}</View></>}</Page>;
}

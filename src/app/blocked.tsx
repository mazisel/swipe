import {useCallback,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect,router} from 'expo-router';
import {api} from '../lib/api';
import {useStore} from '../lib/store';
import {Button,ErrorText,Page,styles} from '../components/ui';
export default function Blocked(){
 const {user}=useStore();
 return user?<BlockedAccounts key={user.id}/>:<Page title="Mesajlarda engellediklerin" back><Button title="Giriş yap" onPress={()=>router.push('/profile')}/></Page>;
}
function BlockedAccounts(){
 const {user}=useStore();const [items,setItems]=useState<{id:string;name:string}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 useFocusEffect(useCallback(()=>{let active=true;if(user)void api<{items:typeof items}>('/blocks').then(r=>{if(active)setItems(r.items);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[user]));
 return <Page title="Mesajlarda engellediklerin" back subtitle="Engel, iki yönde yeni mesaj gönderilmesini durdurur. Eski mesajlar korunur."><ErrorText message={error}/>{!user?<Button title="Giriş yap" onPress={()=>router.push('/profile')}/>:<>{!items.length&&<Text style={styles.subtitle}>Engellediğin hesap yok.</Text>}{items.map(item=><View key={item.id} style={styles.section}><Text style={styles.subtitle}>{item.name}</Text><Button title="Engeli kaldır" outline loading={busy===item.id} onPress={async()=>{if(busy)return;setBusy(item.id);try{await api('/blocks',{userId:item.id,block:false});setItems(x=>x.filter(i=>i.id!==item.id));}catch(e){setError((e as Error).message);}finally{setBusy('');}}}/></View>)}</>}</Page>;
}

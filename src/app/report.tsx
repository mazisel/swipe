import {useState} from 'react';
import {Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {api} from '../lib/api';
import {useStore} from '../lib/store';
import {Button,ErrorText,Field,Page,styles} from '../components/ui';
export default function Report() {
 const {kind,targetId}=useLocalSearchParams<{kind:string;targetId:string}>();const {user}=useStore();
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function submit(){setBusy(true);setError('');try{await api('/reports',{kind,targetId,reason});setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Page title="İçeriği bildir" back subtitle={kind==='message'?'Yalnızca seçtiğin mesaj ve açıklaman inceleme ekibine iletilir.':'Bildirimin yönetim ekibimiz tarafından incelenecek.'}><View style={{gap:18,marginTop:24,maxWidth:480}}>{!user?<Button title="Bildirmek için giriş yap" onPress={()=>router.push('/profile')}/>:done?<Text accessibilityRole="alert" style={styles.subtitle}>Bildirimin alındı. Aynı içerik için açık bildirimin varsa inceleme devam eder.</Text>:<><Field label="Bildirim nedeni" multiline value={reason} onChangeText={setReason} maxLength={1000} placeholder="Sorunu kısaca açıkla (en az 5 karakter)"/><Button title="Bildirimi gönder" loading={busy} onPress={()=>void submit()}/></>}<ErrorText message={error}/></View></Page>;
}

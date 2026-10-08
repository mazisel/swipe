import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { Button, ErrorText, styles } from './ui';

export function EmailVerification() {
  const [status,setStatus]=useState<{verified:boolean;mailAvailable:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useFocusEffect(useCallback(()=>{
    let active=true;
    void api<{verified:boolean;mailAvailable:boolean}>('/auth/email-status').then(result=>{if(active)setStatus(result);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[]));
  async function send() {
    setBusy(true);setError('');setMessage('');
    try { const result=await api<{message:string}>('/auth/verify-email/request',{});setMessage(result.message); }
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <View style={{gap:12,marginTop:24,maxWidth:480}}>
    <Text style={styles.subtitle}>{status?.verified?'E-posta adresin doğrulandı.':'E-posta adresini doğrulayarak hesabını tamamla.'}</Text>
    {status&&!status.verified&&(status.mailAvailable?<Button outline title="Doğrulama e-postası gönder" loading={busy} onPress={()=>void send()}/>:<Text style={styles.subtitle}>E-posta doğrulama yakında kullanılabilir olacak.</Text>)}
    {!!message&&<Text accessibilityRole="alert" style={styles.subtitle}>{message}</Text>}<ErrorText message={error}/>
  </View>;
}

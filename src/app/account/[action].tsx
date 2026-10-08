import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { useStore } from '../../lib/store';
import { api } from '../../lib/api';
import { Button, ErrorText, Field, Page, styles } from '../../components/ui';

export default function AccountAction() {
  const {action}=useLocalSearchParams<{action:string}>();
  return <AccountForm key={action}/>;
}
function AccountForm() {
  const {user,logout}=useStore();
  const navigation=useRootNavigationState();
  const { action, '#': fragment } = useLocalSearchParams<{action:string;'#'?:string}>();
  const [token,setToken]=useState('');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
  useEffect(()=>{
    if(!navigation?.key)return;
    const value=Platform.OS==='web'?window.location.hash.slice(1):fragment||'';
    const candidate=new URLSearchParams(value).get('token')||'';
    // Link fragments are kept in memory only; never persist or send as GET params.
    if(candidate) {
      // Capture the external URL value before removing the credential from history.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(candidate);
      // Expo's root navigation ref becomes ready after child mount effects.
      const timer=setTimeout(()=>router.setParams({ '#': '' }),0);
      return ()=>clearTimeout(timer);
    }
  },[fragment,navigation?.key]);
  const forgot=action==='forgot-password', reset=action==='reset-password', verify=action==='verify-email';
  async function submit() {
    if(busy)return;
    if(reset && password!==confirmation){setError('Şifreler aynı olmalı.');return;}
    setBusy(true);setError('');setMessage('');
    try {
      const result=await api<{message:string}>(forgot?'/auth/forgot-password':reset?'/auth/reset-password':'/auth/verify-email',forgot?{email:email.trim()}:reset?{token,password}:{token});
      setMessage(result.message);setDone(true);setPassword('');setConfirmation('');setToken('');
      if(reset&&user)await logout().catch(()=>{});
    } catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(!forgot&&!reset&&!verify)return <Page title="Bağlantı bulunamadı"><Button title="Hesabına dön" onPress={()=>router.replace('/profile')}/></Page>;
  return <Page title={forgot?'Şifreni unuttun mu?':reset?'Yeni bir şifre belirle.':'E-posta adresini doğrula.'} subtitle={forgot?'Hesabının e-posta adresini yaz; sana yenileme bağlantısı gönderelim.':reset?'En az 8 karakter kullan. Yeni şifreni kaydettiğinde tüm oturumlar kapanır.':'Adresinin sana ait olduğunu onaylamak için aşağıdaki düğmeye dokun.'}>
    <View style={{maxWidth:420,width:'100%',gap:20,marginTop:30}}>
      {!done && <>
        {forgot?<Field label="E-posta" autoComplete="email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail}/>:reset?<><Field label="Yeni şifre" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword}/><Field label="Yeni şifre tekrar" secureTextEntry autoComplete="new-password" value={confirmation} onChangeText={setConfirmation}/></>:null}
        {!forgot&&!token?<Text style={styles.subtitle}>E-postandaki bağlantıyı aç. Bağlantı eksik veya sayfa yenilenmişse e-postadan tekrar açabilirsin.</Text>:<Button title={forgot?'Yenileme bağlantısı gönder':reset?'Yeni şifremi kaydet':'E-posta adresimi doğrula'} loading={busy} onPress={()=>void submit()}/>}
      </>}
      <ErrorText message={error}/>
      {!!message&&<Text accessibilityRole="alert" style={styles.subtitle}>{message}</Text>}
      {(done||!!error)&&!forgot&&<Button outline title={reset?'Yeni bağlantı iste':'Hesabına dön'} onPress={()=>router.replace(reset?'/account/forgot-password':'/profile')}/>}
      <Button title="Giriş ekranına dön" outline onPress={()=>router.replace('/profile')}/>
    </View>
  </Page>;
}

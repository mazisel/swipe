import {useCallback,useState} from 'react';
import {router} from 'expo-router';
import {api} from '../lib/api';
import {useLiveRefresh} from '../lib/useLiveRefresh';
import {Button} from './ui';
export function NotificationLink(){const [unread,setUnread]=useState(0);useLiveRefresh(useCallback(async(alive:()=>boolean)=>{try{const r=await api<{unread:number}>('/notifications');if(alive())setUnread(r.unread);}catch{/* Keep navigation available while offline. */}},[]));return <Button title={`Bildirimlerin${unread?` (${unread})`:''}`} outline onPress={()=>router.push('/notifications')}/>;}

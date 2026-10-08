import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { api, ApiError, setFeedToken } from './api';
import { FeedEvent, FeedIdentity } from '../../shared/types';
const key = 'swipe-discovery-identity';
let identity: FeedIdentity | null = null;
let initialization: Promise<FeedIdentity> | null = null;
let queue: { generation: number; actorId: string; event: FeedEvent }[] = [];
let sending: Promise<void> | null = null;
let epoch = 0;
let suspended = false;
async function read() { return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key); }
async function write() {
  const value = JSON.stringify(identity);
  if (Platform.OS === 'web') await AsyncStorage.setItem(key,value); else await SecureStore.setItemAsync(key,value);
}
export async function initializeDiscovery(force = false): Promise<FeedIdentity> {
  if (initialization) return initialization;
  initialization = (async () => {
    if (!identity && !force) { try { const raw = await read(); if(raw) identity=JSON.parse(raw); } catch { identity=null; } }
    setFeedToken(identity?.token);
    const result = await api<FeedIdentity>('/feed/identity',{});
    identity = { ...result, token:result.token || identity?.token };
    setFeedToken(identity.token);
    await write(); return identity;
  })();
  try { return await initialization; } finally { initialization=null; }
}
export function trackDiscovery(event: Omit<FeedEvent,'id'>) {
  if (!identity || suspended) return;
  queue.push({ actorId:identity.actorId, generation:identity.generation, event:{...event,id:Crypto.randomUUID()} });
  if(queue.length>200) queue=queue.slice(-200);
  if(queue.length>=20) void flushDiscovery();
}
export function deferDiscovery(event: Omit<FeedEvent, 'id'>, delay: number) {
  const owner = identity;
  const revision = epoch;
  const timer = setTimeout(() => {
    // Undoable actions must not recreate preferences after reset/login/logout.
    if (owner && revision === epoch && owner.actorId === identity?.actorId && owner.generation === identity?.generation) trackDiscovery(event);
  }, delay);
  return () => clearTimeout(timer);
}
export async function flushDiscovery(): Promise<void> {
  if (sending) return sending;
  const mine=epoch;
  sending=(async () => {
    if (!identity || !queue.length) return;
    const current=identity;
    queue=queue.filter(q=>q.actorId===current.actorId && q.generation===current.generation);
    const batch=queue.slice(0,40); if(!batch.length) return;
    try {
      await api('/feed/events',{generation:current.generation,events:batch.map(q=>q.event)});
      if(mine===epoch) {const ids=new Set(batch.map(q=>q.event.id));queue=queue.filter(q=>!ids.has(q.event.id));}
    } catch(error) {
      if(error instanceof ApiError && [400,401,409].includes(error.status) && mine===epoch) queue=[];
      // Offline events stay bounded in memory; identifiers make network retries safe.
    }
  })();
  try {await sending;} finally {sending=null;}
}
export async function beginIdentityChange() { if(initialization) await initialization.catch(() => {}); suspended=true; await flushDiscovery(); epoch++;queue=[]; }
export async function finishIdentityChange(logout = false) {
  try {
    if(logout) {identity=null;await write();}
    return await initializeDiscovery(true);
  } finally { suspended=false; }
}
export async function resetDiscovery() {
  if(initialization) await initialization.catch(() => {});
  suspended=true;epoch++;queue=[];
  try {
    if(sending) await sending;
    const result=await api<FeedIdentity>('/feed/reset',{});
    identity={...result,token:identity?.token};await write();return result;
  } finally {suspended=false;}
}
export async function hideDiscovery(kind:'product'|'seller', targetId:string) { await api('/feed/preferences',{kind,targetId}); }

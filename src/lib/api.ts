import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
let feedToken: string | undefined;
export function setFeedToken(value?: string) { feedToken = value; }
function guestHeaders(): Record<string, string> { return feedToken ? { 'X-Feed-Token': feedToken } : {}; }
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
export const API = Platform.OS === 'web' && process.env.EXPO_PUBLIC_API_SAME_ORIGIN === 'true' ? '' : process.env.EXPO_PUBLIC_API_URL || `http://${Platform.OS === 'web' ? 'localhost' : host}:3001`;
let token: string | null = null;
export const mediaUrl = (url: string) => url.startsWith('/') ? `${API}${url}` : url;
export async function loadToken() {
  token = Platform.OS === 'web' ? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('swipe-session') : null) : await SecureStore.getItemAsync('swipe-session');
  return token;
}
export async function saveToken(value: string | null) {
  token = value;
  if (Platform.OS === 'web') { if (value) sessionStorage.setItem('swipe-session', value); else sessionStorage.removeItem('swipe-session'); }
  else if (value) await SecureStore.setItemAsync('swipe-session', value);
  else await SecureStore.deleteItemAsync('swipe-session');
}
export async function api<T>(route: string, body?: unknown, form?: FormData): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), form ? 120000 : 15000);
  try {
    const response = await fetch(`${API}/api${route}`, {
      method: body !== undefined || form ? 'POST' : 'GET', signal: controller.signal,
      headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...guestHeaders() },
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(data.error || 'İşlem tamamlanamadı.', response.status);
    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Bağlantı kurulamadı. İnternetini ve sunucu bağlantısını kontrol edip tekrar dene.');
    throw error;
  } finally { clearTimeout(timer); }
}

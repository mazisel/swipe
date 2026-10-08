import { MotionProvider } from '../lib/motion';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../lib/store';
import { Shell } from '../components/Shell';
import { colors } from '../components/ui';
export default function Layout() {
  return <SafeAreaProvider><MotionProvider><StoreProvider><Shell><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}><Stack.Screen name="product/[id]" options={{ presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_bottom' }} /><Stack.Screen name="social/[id]" options={{ presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_bottom' }} /></Stack></Shell></StoreProvider></MotionProvider></SafeAreaProvider>;
}

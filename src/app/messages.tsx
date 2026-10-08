import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MessageCenter } from '../features/Messages';
export default function Messages() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  return <View style={{ flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' }}><MessageCenter productId={productId} /></View>;
}

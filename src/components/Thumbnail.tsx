import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { Product } from '../../shared/types';
import { mediaUrl } from '../lib/api';
import { Icon } from './Icon';
import { colors } from './ui';
export function Thumbnail({ product, style }: { product: Product; style?: StyleProp<ViewStyle> }) {
  const uri = product.poster || (product.mediaType === 'image' ? product.media : '');
  return <View style={[{ backgroundColor: colors.pale, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>{uri ? <Image source={{ uri: mediaUrl(uri) }} accessibilityLabel={product.title} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="play" size={26} color={colors.olive} />}</View>;
}

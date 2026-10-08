import { createContext, useContext, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { TapGesture, tapActivation } from '../../shared/tapGesture';
import { SwipePressContext } from './SwipeSurface';

export const NavigationTapContext = createContext<TapGesture | null>(null);

// Pressable deliberately retains a press outside its bounds. Navigation needs
// stricter tap intent so short, cancelled and out-and-back drags cannot open a page.
export function TapPressable({ onPress, ...props }: PressableProps) {
  const [tap] = useState(() => new TapGesture());
  const navigationTap = useContext(NavigationTapContext);
  const canPress = useContext(SwipePressContext);
  return <Pressable {...props}
    onStartShouldSetResponderCapture={event => { tap.begin(event.nativeEvent, event.nativeEvent.touches?.length || 1); return false; }}
    onTouchMove={event => tap.move(event.nativeEvent, event.nativeEvent.touches?.length || 1)}
    onPressMove={event => tap.move(event.nativeEvent, event.nativeEvent.touches?.length || 1)}
    onTouchCancel={() => tap.cancel()}
    onPress={event => {
      const { point, keyboard } = tapActivation(event);
      if (canPress() && (keyboard || (tap.allows(point) && (!navigationTap || navigationTap.allows(point))))) onPress?.(event);
    }} />;
}

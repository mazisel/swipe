import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function confirmSwipe() {
  const feedback = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  void feedback.catch(() => { /* Optional hardware feedback must never block an action. */ });
}

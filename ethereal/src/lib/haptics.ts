import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/** Quiet haptic cues. Silently does nothing where haptics aren't available (e.g. the web). */
const safe = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return
  fn().catch(() => undefined)
}

export const haptic = {
  tap: () => safe(() => Haptics.selectionAsync()),
  soft: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  press: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
}

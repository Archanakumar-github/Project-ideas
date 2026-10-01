import { useEffect } from 'react'
import { Keyboard, Platform } from 'react-native'
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'

/** The on-screen keyboard's height as a shared value, animated in step with the keyboard. */
export function useKeyboardInset(): SharedValue<number> {
  const height = useSharedValue(0)
  useEffect(() => {
    if (Platform.OS === 'web') return
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const ease = { easing: Easing.bezier(0.17, 0.59, 0.4, 0.77) }
    const show = Keyboard.addListener(showEvt, (e) => {
      height.value = withTiming(e.endCoordinates.height, { duration: e.duration || 250, ...ease })
    })
    const hide = Keyboard.addListener(hideEvt, (e) => {
      height.value = withTiming(0, { duration: e.duration || 250, ...ease })
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [height])
  return height
}

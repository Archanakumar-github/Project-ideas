/** A Pressable that sinks softly under the finger, springs back, and can tap a haptic. */
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { haptic } from '../lib/haptics'
import { springs } from '../theme'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  scaleTo?: number
  hapticOnPress?: boolean
}

export function PressableScale({ style, scaleTo = 0.96, hapticOnPress = false, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, springs.snappy)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.gentle)
        onPressOut?.(e)
      }}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap()
        onPress?.(e)
      }}
      style={[style, animated]}
    />
  )
}

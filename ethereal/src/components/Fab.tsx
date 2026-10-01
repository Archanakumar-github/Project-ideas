/** The quick-add portal: a softly breathing golden orb. */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus } from './icons'
import { PressableScale } from './PressableScale'
import { haptic } from '../lib/haptics'
import { colors, gradients } from '../theme'

export function Fab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets()
  const breath = useSharedValue(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!reduced) breath.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true)
  }, [breath, reduced])
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.3,
    transform: [{ scale: 1 + breath.value * 0.12 }],
  }))

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 14 }]}>
      <Animated.View pointerEvents="none" style={[styles.halo, halo]} />
      <PressableScale
        onPress={() => {
          haptic.press()
          onPress()
        }}
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel="Add a desire"
        style={styles.btn}
      >
        <LinearGradient colors={gradients.goldButton} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.fill}>
          <Plus size={26} color={colors.night} strokeWidth={2} />
        </LinearGradient>
      </PressableScale>
    </View>
  )
}

const SIZE = 60

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: SIZE + 26,
    height: SIZE + 26,
    borderRadius: (SIZE + 26) / 2,
    backgroundColor: colors.goldGlow,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    shadowColor: colors.gold,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  fill: { flex: 1, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
})

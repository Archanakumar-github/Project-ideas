/**
 * The night sky behind everything: an indigo gradient, a scatter of faint stars and three
 * soft glows (gold, lavender, mist) drifting very slowly.
 */
import { memo, useEffect, useMemo } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { colors, gradients } from '../theme'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function Orb({ color, size, x, y, drift, duration }: {
  color: string
  size: number
  x: number
  y: number
  drift: number
  duration: number
}) {
  const t = useSharedValue(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
  }, [duration, reduced, t])
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * drift }, { translateY: (0.5 - t.value) * drift * 0.6 }],
    opacity: 0.75 + t.value * 0.25,
  }))
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2 }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.18} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
      </Svg>
    </Animated.View>
  )
}

export const Backdrop = memo(function Backdrop() {
  const { width, height } = useWindowDimensions()
  const stars = useMemo(() => {
    const rand = seeded(7)
    return Array.from({ length: 70 }, () => ({
      x: rand() * width,
      y: rand() * height * 0.9,
      r: rand() * 0.9 + 0.3,
      o: rand() * 0.5 + 0.15,
    }))
  }, [width, height])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={gradients.sky} locations={[0, 0.35, 0.75, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.parchment} opacity={s.o} />
        ))}
      </Svg>
      <Orb color={colors.gold} size={width * 1.1} x={width * 0.85} y={height * 0.05} drift={40} duration={14000} />
      <Orb color={colors.lavender} size={width * 1.3} x={width * 0.05} y={height * 0.5} drift={60} duration={19000} />
      <Orb color="#8D86B8" size={width * 1.2} x={width * 0.9} y={height * 0.95} drift={50} duration={23000} />
    </View>
  )
})

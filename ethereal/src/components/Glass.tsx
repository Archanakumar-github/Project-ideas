/** Muted glassmorphism surface: a blur of what's behind, a whisper of indigo and a hairline edge. */
import type { ReactNode } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, radius } from '../theme'

interface Props {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
  strong?: boolean
  rounded?: number
}

export function Glass({ children, style, intensity = 28, strong = false, rounded = radius.lg }: Props) {
  return (
    <View
      style={[
        styles.wrap,
        { borderRadius: rounded, borderColor: strong ? colors.glassBorderStrong : colors.glassBorder },
        style,
      ]}
    >
      {Platform.OS === 'android' ? null : (
        <BlurView tint="dark" intensity={intensity} style={[StyleSheet.absoluteFill, styles.under, { borderRadius: rounded }]} />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.under,
          { backgroundColor: strong ? colors.glassStrong : colors.glass, borderRadius: rounded },
          Platform.OS === 'android' && { backgroundColor: 'rgba(30, 31, 72, 0.92)' },
        ]}
      />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    // Its own stacking context, so the layers below can sit at z -1 without escaping it.
    zIndex: 0,
  },
  under: { zIndex: -1 },
})

import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PressableScale } from './PressableScale'
import { Sans } from './Type'
import { colors, gradients, radius } from '../theme'

export function GoldButton({ label, onPress, disabled, icon }: {
  label: string
  onPress: () => void
  disabled?: boolean
  icon?: ReactNode
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hapticOnPress
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.gold, disabled && { opacity: 0.4 }]}
    >
      <LinearGradient colors={gradients.goldButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goldFill}>
        {icon}
        <Sans size={15} weight="semi" style={{ color: colors.night }}>
          {label}
        </Sans>
      </LinearGradient>
    </PressableScale>
  )
}

export function GhostButton({ label, onPress, icon, tone = 'default', busy, disabled }: {
  label: string
  onPress: () => void
  icon?: ReactNode
  tone?: 'default' | 'danger' | 'gold'
  busy?: boolean
  disabled?: boolean
}) {
  const color = tone === 'danger' ? colors.rose : tone === 'gold' ? colors.goldSoft : colors.parchmentDim
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      hapticOnPress
      accessibilityRole="button"
      style={[styles.ghost, disabled && { opacity: 0.4 }]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <View>{icon}</View> : null}
      <Sans size={14} weight="medium" style={{ color }}>
        {label}
      </Sans>
    </PressableScale>
  )
}

/** A circular glass icon button (close, more…). */
export function IconButton({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <PressableScale onPress={onPress} hapticOnPress accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={styles.icon}>
      {children}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  gold: {
    borderRadius: radius.pill,
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  goldFill: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(239,230,210,0.04)',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,15,38,0.55)',
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
})

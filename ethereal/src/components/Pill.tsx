import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { PressableScale } from './PressableScale'
import { Sans } from './Type'
import { colors, radius } from '../theme'

interface Props {
  label: string
  active?: boolean
  onPress?: () => void
  onLongPress?: () => void
  icon?: ReactNode
  trailing?: ReactNode
  dashed?: boolean
  small?: boolean
  accessibilityHint?: string
}

/** Rounded selection chip: quiet when idle, warm gold when chosen. */
export function Pill({ label, active, onPress, onLongPress, icon, trailing, dashed, small, accessibilityHint }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      hapticOnPress
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label || accessibilityHint}
      accessibilityHint={accessibilityHint}
      style={[
        styles.pill,
        small && styles.small,
        active && styles.active,
        dashed && styles.dashed,
      ]}
    >
      {icon ? <View style={label ? styles.icon : null}>{icon}</View> : null}
      {label ? (
      <Sans
        size={small ? 12.5 : 13.5}
        weight={active ? 'semi' : 'medium'}
        numberOfLines={1}
        style={{ color: active ? colors.night : dashed ? colors.goldSoft : colors.parchmentDim }}
      >
        {label}
      </Sans>
      ) : null}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 15,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(239, 230, 210, 0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  small: { height: 32, paddingHorizontal: 12 },
  active: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  dashed: { borderStyle: 'dashed', borderColor: 'rgba(232, 204, 151, 0.45)', backgroundColor: 'transparent' },
  icon: { marginRight: 6 },
  trailing: { marginLeft: 6 },
})

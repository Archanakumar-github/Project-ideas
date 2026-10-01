import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { PressableScale } from './PressableScale'
import { Sans } from './Type'
import { colors, radius } from '../theme'

export interface Action {
  key: string
  label: string
  icon: ReactNode
  onPress: () => void
  tone?: 'default' | 'danger'
  hint?: string
}

/** A grouped list of quiet, full-width actions for quick-action sheets. */
export function ActionList({ actions }: { actions: Action[] }) {
  return (
    <View style={styles.group}>
      {actions.map((a, i) => (
        <PressableScale
          key={a.key}
          onPress={a.onPress}
          hapticOnPress
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityHint={a.hint}
          style={[styles.row, i > 0 && styles.divider]}
        >
          <View style={styles.icon}>{a.icon}</View>
          <Sans size={15.5} weight="medium" style={{ color: a.tone === 'danger' ? colors.rose : colors.parchment, flex: 1 }}>
            {a.label}
          </Sans>
          {a.hint ? (
            <Sans size={12} style={{ color: colors.mistDim }} numberOfLines={1}>
              {a.hint}
            </Sans>
          ) : null}
        </PressableScale>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,15,38,0.35)',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassBorderStrong },
  icon: { width: 22, alignItems: 'center' },
})

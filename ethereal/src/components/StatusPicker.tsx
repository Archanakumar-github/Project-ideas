import { StyleSheet, View } from 'react-native'
import { Moon, Sparkles, Feather } from './icons'
import { PressableScale } from './PressableScale'
import { Sans } from './Type'
import { ITEM_STATUSES, type ItemStatus } from '../db/types'
import { haptic } from '../lib/haptics'
import { colors, radius, statusMeta } from '../theme'

const ICONS = { dreaming: Moon, refining: Feather, manifested: Sparkles } as const

/** Dreaming → Refining → Manifested, as three soft segments. */
export function StatusPicker({ value, onChange }: { value: ItemStatus; onChange: (s: ItemStatus) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {ITEM_STATUSES.map((s) => {
        const active = s === value
        const meta = statusMeta[s]
        const Icon = ICONS[s]
        return (
          <PressableScale
            key={s}
            onPress={() => {
              if (s === 'manifested' && value !== s) haptic.success()
              else haptic.tap()
              onChange(s)
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityHint={meta.hint}
            style={[styles.seg, active && { borderColor: meta.color, backgroundColor: 'rgba(239,230,210,0.07)' }]}
          >
            <Icon size={15} color={active ? meta.color : colors.mistDim} strokeWidth={1.7} />
            <Sans size={13} weight={active ? 'semi' : 'regular'} style={{ color: active ? meta.color : colors.mistDim }}>
              {meta.label}
            </Sans>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
})

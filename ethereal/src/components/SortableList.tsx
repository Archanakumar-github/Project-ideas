/**
 * A short list reordered by dragging each row's handle. Rows glide out of the way with
 * springs while you drag; the new order is reported once, when you let go.
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { GripVertical } from './icons'
import { haptic } from '../lib/haptics'
import { colors, springs } from '../theme'

type Positions = Record<string, number>

interface Props<T extends { id: string }> {
  data: T[]
  rowHeight: number
  renderRow: (item: T) => ReactNode
  onReorder: (ids: string[]) => void
  rowStyle?: StyleProp<ViewStyle>
}

function Row({
  id,
  count,
  rowHeight,
  positions,
  activeId,
  onDrop,
  rowStyle,
  children,
}: {
  id: string
  count: number
  rowHeight: number
  positions: SharedValue<Positions>
  activeId: SharedValue<string | null>
  onDrop: () => void
  rowStyle?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const top = useSharedValue((positions.value[id] ?? 0) * rowHeight)
  const startTop = useSharedValue(0)

  useAnimatedReaction(
    () => positions.value[id],
    (pos, prev) => {
      if (pos !== prev && activeId.value !== id && pos !== undefined) top.value = withSpring(pos * rowHeight, springs.snappy)
    },
  )

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      activeId.value = id
      startTop.value = top.value
      scheduleOnRN(haptic.press)
    })
    .onUpdate((e) => {
      top.value = Math.max(-8, Math.min((count - 1) * rowHeight + 8, startTop.value + e.translationY))
      const to = Math.max(0, Math.min(count - 1, Math.round(top.value / rowHeight)))
      const from = positions.value[id]
      if (to !== from) {
        const next: Positions = { ...positions.value }
        for (const key of Object.keys(next)) {
          if (key === id) continue
          const p = next[key]
          if (from < to && p > from && p <= to) next[key] = p - 1
          if (from > to && p >= to && p < from) next[key] = p + 1
        }
        next[id] = to
        positions.value = next
        scheduleOnRN(haptic.tap)
      }
    })
    .onFinalize(() => {
      top.value = withSpring((positions.value[id] ?? 0) * rowHeight, springs.gentle)
      if (activeId.value === id) {
        activeId.value = null
        scheduleOnRN(onDrop)
      }
    })

  const style = useAnimatedStyle(() => {
    const active = activeId.value === id
    return {
      top: top.value,
      zIndex: active ? 10 : 1,
      transform: [{ scale: withSpring(active ? 1.03 : 1, springs.snappy) }],
      shadowOpacity: withSpring(active ? 0.5 : 0),
    }
  })

  return (
    <Animated.View style={[styles.row, { height: rowHeight }, rowStyle, style]}>
      <View style={styles.content}>{children}</View>
      <GestureDetector gesture={pan}>
        <View style={styles.handle} accessibilityLabel="Drag to reorder" accessibilityRole="adjustable">
          <GripVertical size={18} color={colors.mistDim} />
        </View>
      </GestureDetector>
    </Animated.View>
  )
}

export function SortableList<T extends { id: string }>({ data, rowHeight, renderRow, onReorder, rowStyle }: Props<T>) {
  const initial = useMemo(() => Object.fromEntries(data.map((d, i) => [d.id, i])), [data])
  const positions = useSharedValue<Positions>(initial)
  const activeId = useSharedValue<string | null>(null)

  useEffect(() => {
    positions.value = initial
  }, [initial, positions])

  const drop = () => {
    const ids = Object.entries(positions.value)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id)
    if (ids.join() !== data.map((d) => d.id).join()) onReorder(ids)
  }

  return (
    <View style={{ height: data.length * rowHeight }}>
      {data.map((d) => (
        <Row
          key={d.id}
          id={d.id}
          count={data.length}
          rowHeight={rowHeight}
          positions={positions}
          activeId={activeId}
          onDrop={drop}
          rowStyle={rowStyle}
        >
          {renderRow(d)}
        </Row>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  content: { flex: 1 },
  handle: { width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' },
})

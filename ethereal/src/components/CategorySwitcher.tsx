/**
 * Horizontal category switcher: "All" plus every top-level category. Swiping the grid left and
 * right moves through the same list. Long-press a category for its quick actions.
 */
import { useEffect, useRef } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated'
import { Plus } from './icons'
import { PressableScale } from './PressableScale'
import { Serif } from './Type'
import type { Category } from '../db/types'
import { haptic } from '../lib/haptics'
import { openSheet } from '../state/ui'
import { colors, springs } from '../theme'

interface Props {
  roots: Category[]
  activeId: string | null
  onSelect: (id: string | null) => void
}

function Tab({ label, active, onPress, onLongPress, onLayout }: {
  label: string
  active: boolean
  onPress: () => void
  onLongPress?: () => void
  onLayout: (x: number, w: number) => void
}) {
  const glow = useAnimatedStyle(() => ({
    opacity: withTiming(active ? 1 : 0, { duration: 260 }),
    transform: [{ scaleX: withSpring(active ? 1 : 0.2, springs.gentle) }],
  }))
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      hapticOnPress
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tab}
      onLayout={(e) => onLayout(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
    >
      <Serif size={21} style={{ color: active ? colors.goldSoft : colors.mist, opacity: active ? 1 : 0.8 }}>
        {label}
      </Serif>
      <Animated.View style={[styles.underline, glow]} />
    </PressableScale>
  )
}

export function CategorySwitcher({ roots, activeId, onSelect }: Props) {
  const scroll = useRef<ScrollView>(null)
  const layouts = useRef(new Map<string, { x: number; w: number }>())
  const viewport = useRef(0)

  useEffect(() => {
    const l = layouts.current.get(activeId ?? 'all')
    if (l) scroll.current?.scrollTo({ x: Math.max(0, l.x - (viewport.current - l.w) / 2), animated: true })
  }, [activeId])

  return (
    <View onLayout={(e) => (viewport.current = e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        <Tab
          label="All"
          active={activeId === null}
          onPress={() => onSelect(null)}
          onLayout={(x, w) => layouts.current.set('all', { x, w })}
        />
        {roots.map((c) => (
          <Tab
            key={c.id}
            label={c.name}
            active={activeId === c.id}
            onPress={() => onSelect(c.id)}
            onLongPress={() => {
              haptic.press()
              openSheet({ type: 'categoryActions', categoryId: c.id })
            }}
            onLayout={(x, w) => layouts.current.set(c.id, { x, w })}
          />
        ))}
        <PressableScale
          onPress={() => openSheet({ type: 'categories', parentId: null })}
          hapticOnPress
          accessibilityRole="button"
          accessibilityLabel="Curate categories"
          style={styles.add}
        >
          <Plus size={16} color={colors.goldSoft} strokeWidth={1.8} />
        </PressableScale>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, alignItems: 'center', height: 50 },
  tab: { paddingHorizontal: 9, paddingVertical: 6, alignItems: 'center' },
  underline: {
    marginTop: 4,
    height: 2,
    width: '70%',
    borderRadius: 1,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  add: {
    marginLeft: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(232, 204, 151, 0.45)',
  },
})

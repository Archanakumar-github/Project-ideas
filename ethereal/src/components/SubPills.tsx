/**
 * Drill-down row of sub-category pills inside one top-level category. Sub-categories that hold
 * their own sub-categories open into them; "‹" climbs back up. A dashed pill adds a new
 * sub-category right here, under whatever level is showing.
 */
import { ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { ChevronLeft, ChevronRight } from './icons'
import { InlineAdd } from './InlineAdd'
import { Pill } from './Pill'
import type { Category } from '../db/types'
import { useScrollToActive } from '../hooks/useScrollToActive'
import { haptic } from '../lib/haptics'
import { childrenOf } from '../lib/tree'
import { createCategory } from '../state/library'
import { openSheet } from '../state/ui'
import { colors } from '../theme'

interface Props {
  categories: Category[]
  rootId: string
  /** The chosen sub-category, or null for the whole top-level category. */
  selectedId: string | null
  onSelect: (id: string | null) => void
  allLabel?: string
  /** Long-press a pill for its quick actions. */
  manageable?: boolean
}

export function SubPills({ categories, rootId, selectedId, onSelect, allLabel = 'All', manageable = true }: Props) {
  const selected = selectedId ? categories.find((c) => c.id === selectedId) : undefined
  const selectedHasKids = !!selected && categories.some((c) => c.parentId === selected.id)
  const levelParent = selected ? (selectedHasKids ? selected : categories.find((c) => c.id === selected.parentId)) : undefined
  const levelId = levelParent?.id ?? rootId
  const kids = childrenOf(categories, levelId)
  const atRoot = levelId === rootId
  const strip = useScrollToActive(selectedId)

  const up = () => {
    if (!levelParent) return onSelect(null)
    onSelect(levelParent.parentId && levelParent.parentId !== rootId ? levelParent.parentId : null)
  }
  const actions = (id: string) =>
    manageable
      ? () => {
          haptic.press()
          openSheet({ type: 'categoryActions', categoryId: id })
        }
      : undefined

  return (
    <ScrollView
      ref={strip.ref}
      onLayout={strip.onViewportLayout}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
    >
      {atRoot ? (
        <Pill small label={allLabel} active={!selectedId} onPress={() => onSelect(null)} />
      ) : (
        <>
          <Pill
            small
            label=""
            accessibilityHint="Go up a level"
            icon={<ChevronLeft size={15} color={colors.parchmentDim} />}
            onPress={up}
          />
          <Pill small label={levelParent!.name} active={selectedId === levelId} onPress={() => onSelect(levelId)} onLongPress={actions(levelId)} />
        </>
      )}
      {kids.map((c) => {
        const hasKids = categories.some((k) => k.parentId === c.id)
        return (
          <Animated.View
            key={c.id}
            onLayout={strip.register(c.id)}
            entering={FadeIn.duration(220)}
            layout={LinearTransition.springify().damping(20)}
          >
            <Pill
              small
              label={c.name}
              active={selectedId === c.id}
              onPress={() => onSelect(c.id)}
              onLongPress={actions(c.id)}
              trailing={hasKids ? <ChevronRight size={13} color={selectedId === c.id ? colors.night : colors.mistDim} /> : undefined}
            />
          </Animated.View>
        )
      })}
      <InlineAdd
        label="Sub-category"
        placeholder="Name it softly…"
        onCreate={async (name) => {
          const cat = await createCategory(name, levelId)
          if (cat) onSelect(cat.id)
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8, alignItems: 'center', minHeight: 44 },
})

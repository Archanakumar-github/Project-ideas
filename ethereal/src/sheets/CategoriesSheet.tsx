/**
 * "Curate your horizon": the category manager. Browse any level, drag to reorder, tap a row to
 * open its sub-categories, tap ⋯ for rename / add / delete, add new ones inline.
 */
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { ArrowLeft, ChevronRight, MoreHorizontal, X } from '../components/icons'
import { IconButton } from '../components/Buttons'
import { InlineAdd } from '../components/InlineAdd'
import { PressableScale } from '../components/PressableScale'
import { SheetScrollView, useSheet } from '../components/Sheet'
import { SortableList } from '../components/SortableList'
import { Eyebrow, Sans, Serif } from '../components/Type'
import { childrenOf, pathOf, subtreeIds } from '../lib/tree'
import { createCategory, library, reorderCategories } from '../state/library'
import { openSheet } from '../state/ui'
import { colors } from '../theme'

const ROW = 58

export function CategoriesSheet({ parentId: initialParent = null }: { parentId?: string | null }) {
  const { close } = useSheet()
  const categories = library.use((s) => s.categories)
  const items = library.use((s) => s.items)
  const [parentId, setParentId] = useState<string | null>(initialParent)
  const parent = parentId ? categories.find((c) => c.id === parentId) : undefined
  const level = parentId && !parent ? null : parentId
  const list = childrenOf(categories, level)
  const path = pathOf(categories, level)

  const countIn = (id: string) => {
    const ids = subtreeIds(categories, id)
    return items.filter((i) => i.categoryId && ids.has(i.categoryId)).length
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {level ? (
          <IconButton label="Up a level" onPress={() => setParentId(parent?.parentId ?? null)}>
            <ArrowLeft size={18} color={colors.parchmentDim} />
          </IconButton>
        ) : (
          <View style={{ width: 38 }} />
        )}
        <Eyebrow numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 8 }}>
          {path.length ? path.map((c) => c.name).join(' › ') : 'All categories'}
        </Eyebrow>
        <IconButton label="Close" onPress={close}>
          <X size={18} color={colors.parchmentDim} />
        </IconButton>
      </View>
      <SheetScrollView contentContainerStyle={styles.body}>
        <Animated.View key={level ?? 'root'} entering={FadeIn.duration(220)}>
          <Serif size={30}>{parent ? parent.name : 'Curate your horizon'}</Serif>
          <Sans size={13} style={styles.sub}>
            {parent
              ? 'Its sub-categories. Drag a handle to reorder; tap one to go deeper.'
              : 'Drag a handle to reorder. Tap a category to tend its sub-categories.'}
          </Sans>
          <View style={styles.list}>
            {list.length ? (
              <SortableList
                data={list}
                rowHeight={ROW}
                rowStyle={styles.rowBg}
                onReorder={reorderCategories}
                renderRow={(c) => {
                  const kids = categories.filter((k) => k.parentId === c.id).length
                  return (
                    <View style={styles.row}>
                      <PressableScale onPress={() => setParentId(c.id)} scaleTo={0.98} hapticOnPress style={styles.rowMain} accessibilityRole="button">
                        <View style={{ flex: 1 }}>
                          <Serif size={20} numberOfLines={1}>
                            {c.name}
                          </Serif>
                          <Sans size={11.5} style={{ color: colors.mistDim }}>
                            {[kids ? `${kids} sub-categor${kids === 1 ? 'y' : 'ies'}` : null, `${countIn(c.id)} desire${countIn(c.id) === 1 ? '' : 's'}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </Sans>
                        </View>
                        <ChevronRight size={16} color={colors.mistFaint} />
                      </PressableScale>
                      <PressableScale
                        onPress={() => openSheet({ type: 'categoryActions', categoryId: c.id })}
                        hapticOnPress
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Actions for ${c.name}`}
                        style={styles.more}
                      >
                        <MoreHorizontal size={18} color={colors.parchmentDim} />
                      </PressableScale>
                    </View>
                  )
                }}
              />
            ) : (
              <Sans style={styles.empty}>Nothing here yet.</Sans>
            )}
          </View>
          <View style={styles.add}>
            <InlineAdd
              label={level ? 'Sub-category' : 'Category'}
              placeholder={level ? 'Name it softly…' : 'A new horizon…'}
              onCreate={async (name) => void (await createCategory(name, level))}
            />
          </View>
        </Animated.View>
      </SheetScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexShrink: 1, minHeight: 420 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  sub: { marginTop: 4, color: colors.mistDim },
  list: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,15,38,0.35)',
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW,
  },
  rowBg: {
    backgroundColor: '#1A1B42',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, height: '100%' },
  more: { width: 40, height: '100%', alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 18, color: colors.mistDim },
  add: { marginTop: 14, flexDirection: 'row' },
})

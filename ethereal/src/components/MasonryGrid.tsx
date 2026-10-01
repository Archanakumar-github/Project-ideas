import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { ItemCard } from './ItemCard'
import type { Category, Item } from '../db/types'
import { columnsFor, estimateHeight, GRID_GAP, GRID_PADDING, layoutMasonry } from '../lib/masonry'

interface Props {
  items: Item[]
  width: number
  categories: Category[]
}

/** Dynamic masonry: cards keep their own heights and flow into the shortest column. */
export function MasonryGrid({ items, width, categories }: Props) {
  const columns = columnsFor(width)
  const inner = Math.min(width, 1200) - GRID_PADDING * 2
  const colWidth = (inner - GRID_GAP * (columns - 1)) / columns
  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const cols = useMemo(
    () => layoutMasonry(items, columns, (i) => estimateHeight(i, colWidth)),
    [items, columns, colWidth],
  )
  const order = useMemo(() => new Map(items.map((i, n) => [i.id, n])), [items])

  return (
    <View style={[styles.grid, { width: inner + GRID_PADDING * 2 }]}>
      {cols.map((col, c) => (
        <View key={c} style={[styles.col, { width: colWidth }]}>
          {col.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              width={colWidth}
              index={order.get(item.id) ?? 0}
              subtitle={item.categoryId ? names.get(item.categoryId) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: GRID_PADDING, alignSelf: 'center' },
  col: { gap: GRID_GAP },
})

import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { GoldButton } from '../components/Buttons'
import { CategoryPicker } from '../components/CategoryPicker'
import { useSheet } from '../components/Sheet'
import { Sans, Serif } from '../components/Type'
import { haptic } from '../lib/haptics'
import { pathLabel } from '../lib/tree'
import { library, updateItem } from '../state/library'
import { showToast } from '../state/ui'
import { colors } from '../theme'

/** Move a desire to another category or sub-category (or make a new one inline). */
export function RecategorizeSheet({ itemId }: { itemId: string }) {
  const { close } = useSheet()
  const item = library.use((s) => s.items.find((i) => i.id === itemId))
  const categories = library.use((s) => s.categories)
  const [value, setValue] = useState<string | null>(item?.categoryId ?? null)

  useEffect(() => {
    if (!item) close()
  }, [item, close])
  if (!item) return null

  const apply = () => {
    if (value !== item.categoryId) {
      void updateItem(itemId, { categoryId: value })
      haptic.success()
      showToast(value ? `Moved to ${pathLabel(categories, value)}` : 'Moved to Unsorted')
    }
    close()
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Serif size={26}>Re-categorize</Serif>
        <Sans size={13} numberOfLines={1} style={{ color: colors.mistDim }}>
          {item.title}
        </Sans>
      </View>
      <CategoryPicker value={value} onChange={setValue} />
      <View style={styles.footer}>
        <Sans size={12} style={{ color: colors.mistDim, marginBottom: 12, textAlign: 'center' }}>
          {value ? pathLabel(categories, value) : 'Unsorted — it will rest in All'}
        </Sans>
        <GoldButton label="Move here" onPress={apply} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 6, paddingBottom: 8 },
  head: { paddingHorizontal: 20, marginBottom: 16, gap: 2 },
  footer: { paddingHorizontal: 20, marginTop: 22 },
})

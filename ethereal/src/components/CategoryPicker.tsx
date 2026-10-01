/**
 * Choose where a desire lives: a row of top-level pills, then drill-down sub-category pills
 * (with "+ Sub-category" inline). Used by Quick Add and Re-categorize.
 */
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { InlineAdd } from './InlineAdd'
import { Pill } from './Pill'
import { SubPills } from './SubPills'
import { Eyebrow } from './Type'
import { useScrollToActive } from '../hooks/useScrollToActive'
import { rootOf } from '../lib/tree'
import { createCategory, library, topCategories } from '../state/library'

interface Props {
  value: string | null
  onChange: (categoryId: string | null) => void
}

export function CategoryPicker({ value, onChange }: Props) {
  const categories = library.use((s) => s.categories)
  const roots = topCategories(categories)
  const root = rootOf(categories, value)
  const strip = useScrollToActive(root?.id ?? 'unsorted')

  return (
    <View style={styles.wrap}>
      <Eyebrow style={styles.label}>Category</Eyebrow>
      <ScrollView
        ref={strip.ref}
        onLayout={strip.onViewportLayout}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {roots.map((c) => (
          <View key={c.id} onLayout={strip.register(c.id)}>
            <Pill label={c.name} active={root?.id === c.id} onPress={() => root?.id !== c.id && onChange(c.id)} />
          </View>
        ))}
        <View onLayout={strip.register('unsorted')}>
          <Pill label="Unsorted" active={!value} onPress={() => onChange(null)} />
        </View>
        <InlineAdd
          label="Category"
          placeholder="A new horizon…"
          onCreate={async (name) => {
            const cat = await createCategory(name, null)
            if (cat) onChange(cat.id)
          }}
        />
      </ScrollView>
      {root ? (
        <Animated.View key={root.id} entering={FadeIn.duration(220)}>
          <Eyebrow style={[styles.label, { marginTop: 14 }]}>Sub-category</Eyebrow>
          <SubPills
            categories={categories}
            rootId={root.id}
            selectedId={value === root.id ? null : value}
            onSelect={(id) => onChange(id ?? root.id)}
            allLabel={`Just ${root.name}`}
            manageable={false}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {},
  label: { paddingHorizontal: 20, marginBottom: 8 },
  row: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
})

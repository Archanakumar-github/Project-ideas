/** Quick actions for one category: rename, add a sub-category, move up/down, delete. */
import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { ArrowDown, ArrowUp, FolderPlus, FolderTree, PenLine, Trash2 } from '../components/icons'
import { ActionList, type Action } from '../components/ActionList'
import { GhostButton, GoldButton } from '../components/Buttons'
import { useSheet } from '../components/Sheet'
import { Sans, Serif } from '../components/Type'
import { haptic } from '../lib/haptics'
import { childrenOf, countDescendants, pathLabel, reorder, subtreeIds } from '../lib/tree'
import { createCategory, deleteCategory, library, renameCategory, reorderCategories } from '../state/library'
import { replaceSheet, setBrowse, showToast, ui } from '../state/ui'
import { colors, fonts, radius } from '../theme'

type Mode = 'menu' | 'rename' | 'add' | 'confirm'

export function CategoryActionsSheet({ categoryId }: { categoryId: string }) {
  const { close } = useSheet()
  const categories = library.use((s) => s.categories)
  const items = library.use((s) => s.items)
  const cat = categories.find((c) => c.id === categoryId)
  const [mode, setMode] = useState<Mode>('menu')
  const [text, setText] = useState(cat?.name ?? '')

  useEffect(() => {
    if (!cat) close()
  }, [cat, close])
  if (!cat) return null

  const siblings = childrenOf(categories, cat.parentId)
  const index = siblings.findIndex((s) => s.id === cat.id)
  const subs = countDescendants(categories, cat.id)
  const ids = subtreeIds(categories, cat.id)
  const held = items.filter((i) => i.categoryId && ids.has(i.categoryId)).length
  const parentName = cat.parentId ? categories.find((c) => c.id === cat.parentId)?.name : null

  const move = (dir: -1 | 1) => {
    haptic.tap()
    reorderCategories(reorder(siblings, index, index + dir).map((s) => s.id))
  }

  const confirmDelete = async () => {
    haptic.warning()
    const res = await deleteCategory(cat.id)
    const { activeRootId, focusId } = ui.get()
    if (activeRootId && res.removedIds.includes(activeRootId)) setBrowse(null)
    else if (focusId && res.removedIds.includes(focusId)) setBrowse(activeRootId)
    showToast(
      res.movedItems
        ? `${cat.name} removed · ${res.movedItems} desire${res.movedItems === 1 ? '' : 's'} moved to ${parentName ?? 'Unsorted'}`
        : `${cat.name} removed`,
    )
    close()
  }

  const actions: Action[] = [
    { key: 'rename', label: 'Rename', icon: <PenLine size={18} color={colors.parchmentDim} />, onPress: () => setMode('rename') },
    {
      key: 'add',
      label: 'Add sub-category',
      icon: <FolderPlus size={18} color={colors.parchmentDim} />,
      onPress: () => {
        setText('')
        setMode('add')
      },
    },
    ...(index > 0 ? [{ key: 'up', label: 'Move up', icon: <ArrowUp size={18} color={colors.parchmentDim} />, onPress: () => move(-1) }] : []),
    ...(index < siblings.length - 1
      ? [{ key: 'down', label: 'Move down', icon: <ArrowDown size={18} color={colors.parchmentDim} />, onPress: () => move(1) }]
      : []),
    {
      key: 'manage',
      label: 'Curate sub-categories',
      icon: <FolderTree size={18} color={colors.parchmentDim} />,
      onPress: () => replaceSheet({ type: 'categories', parentId: cat.id }),
    },
    { key: 'delete', label: 'Delete', tone: 'danger', icon: <Trash2 size={18} color={colors.rose} />, onPress: () => setMode('confirm') },
  ]

  return (
    <View style={styles.wrap}>
      <Serif size={26} numberOfLines={1}>
        {cat.name}
      </Serif>
      <Sans size={12} style={styles.meta}>
        {[cat.parentId ? pathLabel(categories, cat.parentId) : 'Top-level category', `${held} desire${held === 1 ? '' : 's'}`].join(' · ')}
      </Sans>

      {mode === 'menu' ? (
        <ActionList actions={actions} />
      ) : mode === 'confirm' ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.box}>
          <Serif size={20}>Delete “{cat.name}”?</Serif>
          <Sans size={13.5} style={{ marginTop: 6 }}>
            {subs ? `Its ${subs} sub-categor${subs === 1 ? 'y goes' : 'ies go'} too. ` : ''}
            {held
              ? `The ${held} desire${held === 1 ? '' : 's'} inside ${held === 1 ? 'is' : 'are'} kept and moved to ${parentName ?? 'Unsorted'}.`
              : 'Nothing you saved is inside.'}
          </Sans>
          <View style={styles.buttons}>
            <GhostButton label="Keep it" onPress={() => setMode('menu')} />
            <GhostButton label="Delete" tone="danger" icon={<Trash2 size={15} color={colors.rose} />} onPress={confirmDelete} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={styles.box}>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={mode === 'rename' ? 'Category name' : `A sub-category of ${cat.name}`}
            placeholderTextColor={colors.mistFaint}
            style={styles.input}
            maxLength={48}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          <View style={styles.buttons}>
            <GhostButton label="Cancel" onPress={() => setMode('menu')} />
            <View style={{ flex: 1 }}>
              <GoldButton label={mode === 'rename' ? 'Rename' : 'Add'} onPress={() => void submit()} disabled={!text.trim()} />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  )

  async function submit() {
    if (!text.trim() || !cat) return
    if (mode === 'rename') {
      renameCategory(cat.id, text)
      haptic.success()
      close()
    } else {
      const created = await createCategory(text, cat.id)
      if (created) {
        haptic.success()
        showToast(`${created.name} added to ${cat.name}`)
        close()
      }
    }
  }
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8 },
  meta: { color: colors.mistDim, marginTop: 2, marginBottom: 16 },
  box: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(14,15,38,0.35)',
  },
  input: {
    outlineWidth: 0,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    color: colors.parchment,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
})

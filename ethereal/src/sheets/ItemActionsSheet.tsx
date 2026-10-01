/** Long-press quick actions for a card: open, edit, re-categorize, change status, delete. */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Eye, ExternalLink, FolderTree, PenLine, Trash2 } from '../components/icons'
import { ActionList } from '../components/ActionList'
import { useSheet } from '../components/Sheet'
import { StatusPicker } from '../components/StatusPicker'
import { Sans, Serif } from '../components/Type'
import { useImageUri } from '../images/useImageUri'
import { pathLabel } from '../lib/tree'
import { deleteItem, library, updateItem } from '../state/library'
import { closeSheet, replaceSheet, ui } from '../state/ui'
import { colors, radius } from '../theme'
import { openLink } from './ItemSheet'

export function ItemActionsSheet({ itemId }: { itemId: string }) {
  const { close } = useSheet()
  const item = library.use((s) => s.items.find((i) => i.id === itemId))
  const categories = library.use((s) => s.categories)
  const uri = useImageUri(item?.imageUri)
  const fromItemView = ui.use((s) => s.sheets.some((x) => x.type === 'item' && x.itemId === itemId))

  useEffect(() => {
    if (!item) close()
  }, [item, close])
  if (!item) return null

  const actions = [
    ...(fromItemView
      ? []
      : [
          { key: 'open', label: 'Open', icon: <Eye size={18} color={colors.parchmentDim} />, onPress: () => replaceSheet({ type: 'item', itemId }) },
          {
            key: 'edit',
            label: 'Edit',
            icon: <PenLine size={18} color={colors.parchmentDim} />,
            onPress: () => replaceSheet({ type: 'item', itemId, focus: 'title' as const }),
          },
        ]),
    {
      key: 'move',
      label: 'Re-categorize',
      hint: item.categoryId ? pathLabel(categories, item.categoryId, ' › ') : 'Unsorted',
      icon: <FolderTree size={18} color={colors.parchmentDim} />,
      onPress: () => replaceSheet({ type: 'recategorize', itemId }),
    },
    ...(item.url
      ? [{ key: 'link', label: 'Open link', icon: <ExternalLink size={18} color={colors.parchmentDim} />, onPress: () => void openLink(item.url!) }]
      : []),
    {
      key: 'delete',
      label: 'Delete',
      tone: 'danger' as const,
      icon: <Trash2 size={18} color={colors.rose} />,
      onPress: () => {
        close()
        // Leaving the item view too: the item is gone (with Undo on the board).
        const viewer = ui.get().sheets.find((x) => x.type === 'item' && x.itemId === itemId)
        if (viewer) closeSheet(viewer.key)
        setTimeout(() => deleteItem(itemId), 200)
      },
    },
  ]

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {uri ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" /> : null}
        <View style={{ flex: 1 }}>
          <Serif size={22} numberOfLines={2}>
            {item.title}
          </Serif>
          <Sans size={12} style={{ color: colors.mistDim }} numberOfLines={1}>
            {item.categoryId ? pathLabel(categories, item.categoryId) : 'Unsorted'}
          </Sans>
        </View>
      </View>
      <View style={styles.status}>
        <StatusPicker value={item.status} onChange={(s) => void updateItem(itemId, { status: s })} />
      </View>
      <ActionList actions={actions} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, marginBottom: 14 },
  thumb: { width: 52, height: 52, borderRadius: radius.sm },
  status: { marginBottom: 14 },
})

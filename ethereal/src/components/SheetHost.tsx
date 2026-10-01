import { StyleSheet, View } from 'react-native'
import { Sheet } from './Sheet'
import { CategoriesSheet } from '../sheets/CategoriesSheet'
import { CategoryActionsSheet } from '../sheets/CategoryActionsSheet'
import { ItemActionsSheet } from '../sheets/ItemActionsSheet'
import { ItemSheet } from '../sheets/ItemSheet'
import { QuickAddSheet } from '../sheets/QuickAddSheet'
import { RecategorizeSheet } from '../sheets/RecategorizeSheet'
import { SettingsSheet } from '../sheets/SettingsSheet'
import { ui, type Sheet as SheetSpec } from '../state/ui'

function content(sheet: SheetSpec) {
  switch (sheet.type) {
    case 'add':
      return <QuickAddSheet />
    case 'item':
      return <ItemSheet itemId={sheet.itemId} focus={sheet.focus} />
    case 'actions':
      return <ItemActionsSheet itemId={sheet.itemId} />
    case 'recategorize':
      return <RecategorizeSheet itemId={sheet.itemId} />
    case 'categories':
      return <CategoriesSheet parentId={sheet.parentId ?? null} />
    case 'categoryActions':
      return <CategoryActionsSheet categoryId={sheet.categoryId} />
    case 'settings':
      return <SettingsSheet />
  }
}

/** Renders the stack of open sheets, newest on top. */
export function SheetHost() {
  const sheets = ui.use((s) => s.sheets)
  if (!sheets.length) return null
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {sheets.map((sheet, i) => (
        <Sheet key={sheet.key} sheetKey={sheet.key} variant={sheet.type === 'item' ? 'full' : 'bottom'} covered={i < sheets.length - 1}>
          {content(sheet)}
        </Sheet>
      ))}
    </View>
  )
}

import { lazy, Suspense } from 'react'
import { useUI, type Sheet } from '../../store/ui'
import { AddSheet } from '../add/AddSheet'
import { BookActionsSheet } from '../books/BookActionsSheet'
import { BookDetailSheet } from '../books/BookDetailSheet'
import { BookFormSheet } from '../books/BookFormSheet'
import { SeriesDetailSheet } from '../series/SeriesDetailSheet'
import { SeriesFormSheet } from '../series/SeriesFormSheet'
import { BatchCategorySheet, BatchShelvesSheet, BatchStatusSheet } from '../batch/BatchSheets'
import { FiltersSheet } from './FiltersSheet'
import { RestoreSnapshotSheet } from '../settings/RestoreSnapshotSheet'

const CategoriesSheet = lazy(() => import('../categories/CategoriesSheet').then((m) => ({ default: m.CategoriesSheet })))

function renderSheet(sheet: Sheet, depth: number, isTop: boolean) {
  const p = { depth, isTop }
  switch (sheet.kind) {
    case 'add':
      return <AddSheet sheet={sheet} {...p} />
    case 'book':
      return <BookDetailSheet sheet={sheet} {...p} />
    case 'book-form':
      return <BookFormSheet sheet={sheet} {...p} />
    case 'book-actions':
      return <BookActionsSheet sheet={sheet} {...p} />
    case 'series':
      return <SeriesDetailSheet sheet={sheet} {...p} />
    case 'series-form':
      return <SeriesFormSheet sheet={sheet} {...p} />
    case 'categories':
      return <CategoriesSheet sheet={sheet} {...p} />
    case 'filters':
      return <FiltersSheet sheet={sheet} {...p} />
    case 'batch-status':
      return <BatchStatusSheet sheet={sheet} {...p} />
    case 'batch-category':
      return <BatchCategorySheet sheet={sheet} {...p} />
    case 'batch-shelves':
      return <BatchShelvesSheet sheet={sheet} {...p} />
    case 'restore-snapshot':
      return <RestoreSnapshotSheet sheet={sheet} {...p} />
  }
}

/** Renders the sheet stack; each sheet can open another on top without losing context. */
export function SheetHost() {
  const sheets = useUI((s) => s.sheets)
  const openKeys = sheets.filter((s) => !s.closing)
  const topKey = openKeys.at(-1)?.key
  return (
    <>
      {sheets.map((sheet, i) => (
        <Suspense key={sheet.key} fallback={null}>
          {renderSheet(sheet, i, sheet.key === topKey)}
        </Suspense>
      ))}
    </>
  )
}

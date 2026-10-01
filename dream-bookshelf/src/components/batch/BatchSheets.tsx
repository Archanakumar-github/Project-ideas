import { useState } from 'react'
import { Bookmark, Check, Minus } from 'lucide-react'
import { BOOK_STATUSES } from '../../db/types'
import { addBooksToShelf, moveBooksToCategory, removeBooksFromShelf, setBooksStatus } from '../../db/repo'
import { categoryLabel, useLibrary } from '../../hooks/useLibrary'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, pluralize } from '../../lib/utils'
import { ui, useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { StatusIcon } from '../books/StatusBadge'
import { CategoryPicker, type CategoryValue } from '../categories/CategoryPicker'
import { InlineCreate } from '../categories/InlineCreate'
import { addShelf } from '../../db/repo'

type SheetProps<K extends Sheet['kind']> = { sheet: Extract<Sheet, { kind: K }>; depth: number; isTop: boolean }

function useBatch() {
  const selected = useUI((s) => s.selected)
  const stopSelecting = useUI((s) => s.stopSelecting)
  const closeSheet = useUI((s) => s.closeSheet)
  return { selected, stopSelecting, closeSheet }
}

export function BatchStatusSheet({ sheet, depth, isTop }: SheetProps<'batch-status'>) {
  const { selected, stopSelecting, closeSheet } = useBatch()
  return (
    <Drawer open={!sheet.closing} onClose={() => closeSheet(sheet.key)} depth={depth} isTop={isTop} title="Set status" subtitle={pluralize(selected.length, 'book')}>
      <div className="grid gap-2 pt-1">
        {BOOK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={async () => {
              await setBooksStatus(selected, s)
              ui.toast({ message: `Moved ${pluralize(selected.length, 'book')} to ${BOOK_STATUS_META[s].label}`, tone: 'success' })
              closeSheet(sheet.key)
              stopSelecting()
            }}
            className={cx('press flex min-h-14 items-center gap-3 rounded-card px-4 text-left text-[16px] font-medium', BOOK_STATUS_META[s].pill)}
          >
            <StatusIcon status={s} size={20} />
            {BOOK_STATUS_META[s].label}
          </button>
        ))}
      </div>
    </Drawer>
  )
}

export function BatchCategorySheet({ sheet, depth, isTop }: SheetProps<'batch-category'>) {
  const lib = useLibrary()
  const { selected, stopSelecting, closeSheet } = useBatch()
  const [value, setValue] = useState<CategoryValue>({})
  return (
    <Drawer
      open={!sheet.closing}
      onClose={() => closeSheet(sheet.key)}
      depth={depth}
      isTop={isTop}
      title="Move to category"
      subtitle={pluralize(selected.length, 'book')}
      footer={
        <Button
          variant="primary"
          block
          onClick={async () => {
            await moveBooksToCategory(selected, value.categoryId, value.subCategoryId)
            ui.toast({
              message: `Moved ${pluralize(selected.length, 'book')} to ${categoryLabel(lib, value.categoryId, value.subCategoryId) ?? 'Uncategorized'}`,
              tone: 'success',
            })
            closeSheet(sheet.key)
            stopSelecting()
          }}
        >
          Move {pluralize(selected.length, 'book')}
        </Button>
      }
    >
      <CategoryPicker value={value} onChange={setValue} />
    </Drawer>
  )
}

/** Tri-state shelf toggles: tap to add to all selected books, tap again to remove from all. */
export function BatchShelvesSheet({ sheet, depth, isTop }: SheetProps<'batch-shelves'>) {
  const lib = useLibrary()
  const { selected, closeSheet } = useBatch()
  const books = selected.map((id) => lib.booksById.get(id)).filter((b) => !!b)
  return (
    <Drawer open={!sheet.closing} onClose={() => closeSheet(sheet.key)} depth={depth} isTop={isTop} title="Shelves" subtitle={pluralize(selected.length, 'book')}>
      <ul className="space-y-2 pt-1">
        {lib.orderedShelves.map((shelf) => {
          const on = books.filter((b) => b.shelfIds.includes(shelf.id)).length
          const state = on === 0 ? 'none' : on === books.length ? 'all' : 'some'
          return (
            <li key={shelf.id}>
              <button
                type="button"
                aria-pressed={state === 'all' ? true : state === 'some' ? 'mixed' : false}
                onClick={() => void (state === 'all' ? removeBooksFromShelf(selected, shelf.id) : addBooksToShelf(selected, shelf.id))}
                className={cx(
                  'press flex min-h-13 w-full items-center gap-3 rounded-card border px-4 py-3 text-left text-[15px]',
                  state === 'none' ? 'border-line bg-card text-ink' : 'border-amber/40 bg-amber/10 text-amber',
                )}
              >
                <Bookmark size={17} />
                <span className="flex-1">{shelf.name}</span>
                <span className="text-xs text-ink-faint">{state === 'some' ? `${on} of ${books.length}` : ''}</span>
                <span className={cx('grid size-6 place-items-center rounded-full ring-2', state === 'none' ? 'ring-line' : 'bg-amber text-ink-inverse ring-amber')}>
                  {state === 'all' ? <Check size={14} strokeWidth={3} /> : state === 'some' ? <Minus size={14} strokeWidth={3} /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <InlineCreate
        className="mt-3"
        label="New shelf"
        onCreate={async (name) => {
          const shelf = await addShelf(name)
          await addBooksToShelf(selected, shelf.id)
        }}
      />
    </Drawer>
  )
}

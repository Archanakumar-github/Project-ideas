import { useState } from 'react'
import { BookOpenText, ChevronRight, FolderTree, ListChecks, Pencil, Trash } from 'lucide-react'
import { BOOK_STATUSES } from '../../db/types'
import { moveBooksToCategory, updateBook } from '../../db/repo'
import { categoryLabel, useLibrary } from '../../hooks/useLibrary'
import { deleteBooksWithUndo } from '../../lib/actions'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, formatAuthors } from '../../lib/utils'
import { useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Segmented } from '../ui/Segmented'
import { CategoryPicker } from '../categories/CategoryPicker'
import { ShelfPicker } from '../categories/ShelfPicker'
import { BookCover } from './BookCover'
import { StatusIcon } from './StatusBadge'

function ActionRow({ icon, label, onClick, danger, trailing }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; trailing?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'press flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] hover:bg-card',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className={danger ? 'text-danger' : 'text-ink-muted'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </button>
  )
}

/** Long-press / "…" quick actions: status, category, shelves, edit, select, delete. */
export function BookActionsSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'book-actions' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const book = lib.booksById.get(sheet.id)
  const closeSheet = useUI((s) => s.closeSheet)
  const replaceSheet = useUI((s) => s.replaceSheet)
  const startSelecting = useUI((s) => s.startSelecting)
  const [showCategory, setShowCategory] = useState(false)
  const close = () => closeSheet(sheet.key)

  if (!book) return null
  return (
    <Drawer open={!sheet.closing} onClose={close} depth={depth} isTop={isTop} bare>
      <div className="flex items-center gap-3 pt-3 pb-4">
        <BookCover title={book.title} authors={book.authors} coverId={book.coverId} coverUrl={book.coverUrl} size="xs" className="w-12 shrink-0" rounded="rounded-md" />
        <div className="min-w-0">
          <h2 className="line-clamp-2 font-serif text-lg leading-snug text-ink">{book.title}</h2>
          <p className="truncate text-[13px] text-ink-muted">{formatAuthors(book.authors)}</p>
        </div>
      </div>

      <Segmented
        label="Status"
        value={book.status}
        onChange={(status) => void updateBook(book.id, { status })}
        options={BOOK_STATUSES.map((s) => ({
          value: s,
          label: BOOK_STATUS_META[s].short,
          tone: BOOK_STATUS_META[s].color,
          icon: <StatusIcon status={s} size={14} />,
        }))}
      />

      <div className="mt-4 space-y-1">
        <ActionRow
          icon={<FolderTree size={18} />}
          label="Category"
          onClick={() => setShowCategory((v) => !v)}
          trailing={
            <span className="flex items-center gap-1 text-[13px] text-ink-faint">
              <span className="max-w-40 truncate">{categoryLabel(lib, book.categoryId, book.subCategoryId) ?? 'None'}</span>
              <ChevronRight size={16} className={cx('transition-transform duration-200', showCategory && 'rotate-90')} />
            </span>
          }
        />
        {showCategory && (
          <div className="animate-fade-in px-3 pt-1 pb-3">
            <CategoryPicker
              value={{ categoryId: book.categoryId, subCategoryId: book.subCategoryId }}
              onChange={(v) => void moveBooksToCategory([book.id], v.categoryId, v.subCategoryId)}
            />
          </div>
        )}
        <div className="px-3 pt-2 pb-3">
          <p className="mb-2 text-[13px] font-medium tracking-wide text-ink-muted uppercase">Shelves</p>
          <ShelfPicker value={book.shelfIds} onChange={(shelfIds) => void updateBook(book.id, { shelfIds })} />
        </div>
        <div className="my-1 h-px bg-line-soft" />
        <ActionRow icon={<BookOpenText size={18} />} label="Open details" onClick={() => replaceSheet(sheet.key, { kind: 'book', id: book.id })} />
        <ActionRow icon={<Pencil size={18} />} label="Edit" onClick={() => replaceSheet(sheet.key, { kind: 'book-form', id: book.id })} />
        <ActionRow
          icon={<ListChecks size={18} />}
          label="Select multiple"
          onClick={() => {
            const { tab, setTab } = useUI.getState()
            if (tab !== 'shelves' && tab !== 'search') setTab('shelves')
            startSelecting(book.id)
            close()
          }}
        />
        <ActionRow
          icon={<Trash size={18} />}
          label="Delete"
          danger
          onClick={() => {
            close()
            void deleteBooksWithUndo([book.id])
          }}
        />
      </div>
    </Drawer>
  )
}

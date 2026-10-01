import { useEffect, useRef, useState } from 'react'
import { Camera, CloudOff, ExternalLink, Layers, Pencil, RefreshCw, Trash, TriangleAlert } from 'lucide-react'
import { BOOK_STATUSES } from '../../db/types'
import { moveBooksToCategory, removeLocalCover, setLocalCover, updateBook } from '../../db/repo'
import { categoryLabel, useLibrary } from '../../hooks/useLibrary'
import { useOnline } from '../../hooks/useOnline'
import { deleteBooksWithUndo, refreshBook } from '../../lib/actions'
import { formatIsbn } from '../../lib/isbn'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, formatAuthors, formatPrice } from '../../lib/utils'
import { useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button, IconButton } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { Section } from '../ui/Field'
import { Spinner } from '../ui/Spinner'
import { CategoryPicker } from '../categories/CategoryPicker'
import { ShelfPicker } from '../categories/ShelfPicker'
import { BookCover } from './BookCover'
import { CoverInput } from './CoverInput'
import { StatusIcon } from './StatusBadge'

function hostname(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : ''
  } catch {
    return url ?? ''
  }
}

/** Full book view with instant inline edits (status, category, shelves, notes). */
export function BookDetailSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'book' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const online = useOnline()
  const book = lib.booksById.get(sheet.id)
  const closeSheet = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const [notes, setNotes] = useState(book?.notes ?? '')
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [editingCategory, setEditingCategory] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const close = () => closeSheet(sheet.key)

  // Keep the notes field in sync if the book changes elsewhere (and we're not mid-edit).
  const notesFocused = useRef(false)
  useEffect(() => {
    if (!notesFocused.current) setNotes(book?.notes ?? '')
  }, [book?.notes])

  // Debounced autosave while typing.
  useEffect(() => {
    if (!book || notes === (book.notes ?? '')) return
    const t = setTimeout(() => void updateBook(book.id, { notes }), 600)
    return () => clearTimeout(t)
  }, [notes, book])

  if (!book) return null
  const series = book.seriesId ? lib.seriesById.get(book.seriesId) : undefined
  const category = categoryLabel(lib, book.categoryId, book.subCategoryId)
  const facts = [
    book.publishYear && String(book.publishYear),
    book.pageCount && `${book.pageCount} pages`,
    book.isbn && `ISBN ${formatIsbn(book.isbn)}`,
  ].filter(Boolean)

  return (
    <Drawer
      open={!sheet.closing}
      onClose={close}
      depth={depth}
      isTop={isTop}
      size="tall"
      bare
      footer={
        <div className="flex items-center gap-2">
          <Button variant="primary" className="flex-1" icon={<Pencil size={16} />} onClick={() => openSheet({ kind: 'book-form', id: book.id })}>
            Edit details
          </Button>
          <IconButton label="Change cover" onClick={() => coverInput.current?.click()}>
            <Camera size={19} />
          </IconButton>
          <IconButton
            label="Refresh details online"
            disabled={!online || refreshing}
            onClick={async () => {
              setRefreshing(true)
              await refreshBook(book).finally(() => setRefreshing(false))
            }}
          >
            {refreshing ? <Spinner size={19} /> : <RefreshCw size={19} />}
          </IconButton>
          <IconButton
            label="Delete book"
            tone="danger"
            onClick={() => {
              close()
              void deleteBooksWithUndo([book.id])
            }}
          >
            <Trash size={19} />
          </IconButton>
        </div>
      }
    >
      <CoverInput ref={coverInput} onPicked={(blob) => void setLocalCover({ kind: 'book', id: book.id }, blob)} />

      <div className="flex gap-4 pt-3">
        <div className="relative w-28 shrink-0">
          <span aria-hidden className="absolute -inset-3 rounded-3xl bg-amber-glow/20 blur-2xl" />
          <BookCover
            title={book.title}
            authors={book.authors}
            coverId={book.coverId}
            coverUrl={book.coverUrl}
            className="relative shadow-glow"
          />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="font-serif text-[24px] leading-tight text-ink">{book.title}</h2>
          {book.subtitle && <p className="mt-1 font-serif text-[15px] leading-snug text-ink-muted italic">{book.subtitle}</p>}
          <p className="mt-2 text-[15px] text-ink-muted">{formatAuthors(book.authors, 3)}</p>
          {series && (
            <button
              type="button"
              onClick={() => openSheet({ kind: 'series', id: series.id })}
              className="press mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber/10 px-3 text-[13px] text-amber ring-1 ring-amber/25"
            >
              <Layers size={13} />
              {series.title}
              {book.seriesIndex !== undefined && <span className="opacity-75">· Book {book.seriesIndex}</span>}
            </button>
          )}
          {facts.length > 0 && <p className="mt-2 text-xs leading-relaxed text-ink-faint">{facts.join(' · ')}</p>}
        </div>
      </div>

      {book.metadataState !== 'complete' && (
        <div
          className={cx(
            'mt-4 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px] ring-1',
            book.metadataState === 'pending' ? 'bg-amber/8 text-amber ring-amber/20' : 'bg-terracotta/8 text-terracotta ring-terracotta/20',
          )}
        >
          {book.metadataState === 'pending' ? <CloudOff size={16} className="mt-0.5 shrink-0" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0" />}
          <span>
            {book.metadataState === 'pending'
              ? 'Cover and details will be fetched automatically when you’re online.'
              : 'Couldn’t find a confident match online. Add an ISBN or tweak the title, then refresh.'}
          </span>
        </div>
      )}

      <div className="mt-5">
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
      </div>

      {(book.price !== undefined || book.link) && (
        <div className="mt-4 flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            {book.price !== undefined ? (
              <>
                <p className="text-xs text-ink-faint">Price</p>
                <p className="font-serif text-xl text-terracotta">{formatPrice(book.price, book.currency)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-faint">Link</p>
                <p className="truncate text-[15px] text-ink-muted">{hostname(book.link)}</p>
              </>
            )}
          </div>
          {book.link && (
            <a
              href={book.link}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber/12 px-4 text-[15px] font-medium text-amber ring-1 ring-amber/25"
            >
              <ExternalLink size={16} />
              {book.status === 'want-to-buy' ? 'Buy' : 'Open link'}
            </a>
          )}
        </div>
      )}

      <Section
        title="Category"
        className="mt-6"
        action={
          <Button size="sm" variant="ghost" onClick={() => setEditingCategory((v) => !v)}>
            {editingCategory ? 'Done' : 'Change'}
          </Button>
        }
      >
        {editingCategory ? (
          <CategoryPicker
            value={{ categoryId: book.categoryId, subCategoryId: book.subCategoryId }}
            onChange={(v) => void moveBooksToCategory([book.id], v.categoryId, v.subCategoryId)}
          />
        ) : (
          <p className="text-[15px] text-ink-muted">{category ?? 'Uncategorized'}</p>
        )}
      </Section>

      <Section title="Shelves">
        <ShelfPicker value={book.shelfIds} onChange={(shelfIds) => void updateBook(book.id, { shelfIds })} />
      </Section>

      <Section title="Private notes">
        <textarea
          aria-label="Private notes"
          value={notes}
          rows={3}
          placeholder="Why you want it, who recommended it, edition to look for…"
          onFocus={() => (notesFocused.current = true)}
          onBlur={() => {
            notesFocused.current = false
            if (notes !== (book.notes ?? '')) void updateBook(book.id, { notes })
          }}
          onChange={(e) => setNotes(e.target.value)}
          className="field resize-none leading-relaxed"
        />
      </Section>

      {book.description && (
        <Section title="About this book">
          <p className={cx('text-[15px] leading-relaxed whitespace-pre-line text-ink-muted', !showFullDescription && 'line-clamp-6')}>
            {book.description}
          </p>
          {book.description.length > 320 && (
            <button type="button" className="mt-1 min-h-10 text-sm font-medium text-amber" onClick={() => setShowFullDescription((v) => !v)}>
              {showFullDescription ? 'Show less' : 'Read more'}
            </button>
          )}
        </Section>
      )}

      {(book.coverId || book.coverUrl) && (
        <button
          type="button"
          className="mt-6 min-h-10 text-xs text-ink-faint underline-offset-2 hover:underline"
          onClick={() => void removeLocalCover({ kind: 'book', id: book.id })}
        >
          Remove cover image
        </button>
      )}
    </Drawer>
  )
}

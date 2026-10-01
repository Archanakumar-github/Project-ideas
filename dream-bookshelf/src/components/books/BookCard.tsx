import { memo } from 'react'
import { Check, CloudOff, Ellipsis } from 'lucide-react'
import type { Book } from '../../db/types'
import { useLongPress } from '../../hooks/useLongPress'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, formatAuthors, formatPrice } from '../../lib/utils'
import { BookCover } from './BookCover'
import { StatusIcon, StatusPill } from './StatusBadge'

interface BookCardProps {
  book: Book
  layout: 'grid' | 'list'
  selecting: boolean
  selected: boolean
  seriesTitle?: string
  categoryText?: string
  onOpen: (book: Book) => void
  onActions: (book: Book) => void
  onToggleSelect: (book: Book) => void
}

/** Shelf card. Tap = open (or toggle in multi-select), long-press / "…" = quick actions. */
export const BookCard = memo(function BookCard({
  book,
  layout,
  selecting,
  selected,
  seriesTitle,
  categoryText,
  onOpen,
  onActions,
  onToggleSelect,
}: BookCardProps) {
  const press = useLongPress<HTMLDivElement>(() => onActions(book), {
    onClick: () => (selecting ? onToggleSelect(book) : onOpen(book)),
  })
  const meta = BOOK_STATUS_META[book.status]
  const price = book.status === 'want-to-buy' && book.price !== undefined ? formatPrice(book.price, book.currency) : ''

  const moreButton = !selecting && (
    <button
      type="button"
      aria-label={`Actions for ${book.title}`}
      onClick={(e) => {
        e.stopPropagation()
        onActions(book)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={cx(
        'grid size-11 shrink-0 place-items-center rounded-full',
        layout === 'grid' ? 'absolute top-0 right-0' : 'text-ink-faint hover:text-ink',
      )}
    >
      <span className={cx(layout === 'grid' && 'grid size-7 place-items-center rounded-full bg-canvas/70 text-ink backdrop-blur-md ring-1 ring-white/10')}>
        <Ellipsis size={16} />
      </span>
    </button>
  )

  const check = selecting && (
    <span
      aria-hidden
      className={cx(
        'grid size-6 place-items-center rounded-full ring-2 transition-colors duration-150',
        selected ? 'bg-amber text-ink-inverse ring-amber' : 'bg-canvas/60 ring-ink/50 backdrop-blur',
      )}
    >
      {selected && <Check size={14} strokeWidth={3} />}
    </span>
  )

  const a11y = {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `${book.title}${book.authors[0] ? ` by ${book.authors[0]}` : ''}, ${meta.label}`,
    'aria-pressed': selecting ? selected : undefined,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (selecting) onToggleSelect(book)
        else onOpen(book)
      }
    },
  }

  if (layout === 'list') {
    return (
      <div
        {...press}
        {...a11y}
        data-selected={selected || undefined}
        className={cx(
          'press touch-none-callout flex items-center gap-3 rounded-card border bg-card p-2.5 pr-1 transition-shadow duration-200',
          selected ? 'border-amber/50 shadow-glow' : 'border-line shadow-card active:shadow-glow-sm',
        )}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 104px' }}
      >
        {check}
        <BookCover title={book.title} authors={book.authors} coverId={book.coverId} coverUrl={book.coverUrl} size="sm" className="w-14 shrink-0" rounded="rounded-md" />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="line-clamp-2 font-serif text-[16px] leading-snug text-ink">{book.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted">{formatAuthors(book.authors)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            <StatusPill status={book.status} short />
            {seriesTitle && (
              <span className="truncate">
                {seriesTitle}
                {book.seriesIndex !== undefined && ` #${book.seriesIndex}`}
              </span>
            )}
            {categoryText && !seriesTitle && <span className="truncate">{categoryText}</span>}
            {price && <span className="font-medium text-terracotta">{price}</span>}
            {book.metadataState === 'pending' && <CloudOff size={12} aria-label="Details pending" />}
          </div>
        </div>
        {moreButton}
      </div>
    )
  }

  return (
    <div
      {...press}
      {...a11y}
      data-selected={selected || undefined}
      className="press touch-none-callout group relative flex flex-col"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 290px' }}
    >
      <div
        className={cx(
          'relative rounded-[10px] transition-shadow duration-200',
          selected ? 'shadow-glow ring-2 ring-amber/70' : 'shadow-card group-active:shadow-glow',
        )}
      >
        <BookCover title={book.title} authors={book.authors} coverId={book.coverId} coverUrl={book.coverUrl} />
        <span
          aria-hidden
          className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-canvas/75 backdrop-blur-md ring-1 ring-white/10"
          style={{ color: meta.color }}
        >
          <StatusIcon status={book.status} size={13} />
        </span>
        {book.seriesIndex !== undefined && (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-canvas/75 px-1.5 py-0.5 text-[10px] font-semibold text-amber backdrop-blur-md ring-1 ring-white/10">
            #{book.seriesIndex}
          </span>
        )}
        {price && (
          <span className="absolute right-1.5 bottom-1.5 rounded-full bg-canvas/80 px-2 py-0.5 text-[11px] font-semibold text-terracotta backdrop-blur-md ring-1 ring-white/10">
            {price}
          </span>
        )}
        {book.metadataState === 'pending' && (
          <span className="absolute top-9 right-2 text-ink/70" aria-label="Details pending">
            <CloudOff size={13} />
          </span>
        )}
        {selecting && <span className="absolute top-2 right-2">{check}</span>}
        {moreButton}
      </div>
      <h3 className="mt-2 line-clamp-2 font-serif text-[15px] leading-snug text-ink">{book.title}</h3>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{formatAuthors(book.authors, 1)}</p>
    </div>
  )
})

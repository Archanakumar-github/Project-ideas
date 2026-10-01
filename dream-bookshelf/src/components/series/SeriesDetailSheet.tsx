import { useEffect, useRef, useState } from 'react'
import { Camera, Pencil, Plus, Search, Trash } from 'lucide-react'
import { BOOK_STATUSES, SERIES_STATUSES, type Book, type BookStatus } from '../../db/types'
import { setLocalCover, setSeriesVolumesStatus, updateBook, updateSeries } from '../../db/repo'
import { categoryLabel, useLibrary } from '../../hooks/useLibrary'
import { deleteSeriesWithUndo } from '../../lib/actions'
import { seriesStats } from '../../lib/library'
import { BOOK_STATUS_META, SERIES_STATUS_META } from '../../lib/status'
import { cx, formatAuthors, pluralize } from '../../lib/utils'
import { ui, useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button, IconButton } from '../ui/Button'
import { Section } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { BookCover } from '../books/BookCover'
import { CoverInput } from '../books/CoverInput'
import { StatusIcon } from '../books/StatusBadge'
import { CoverStack } from './SeriesCard'
import { SeriesProgress } from './SeriesProgress'

const NEXT_STATUS: Record<BookStatus, BookStatus> = { 'want-to-read': 'want-to-buy', 'want-to-buy': 'owned', owned: 'want-to-read' }

function VolumeRow({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const meta = BOOK_STATUS_META[book.status]
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line-soft bg-card p-2 pr-1">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-8 shrink-0 text-center font-serif text-lg text-amber tabular-nums">{book.seriesIndex ?? '–'}</span>
        <BookCover title={book.title} authors={book.authors} coverId={book.coverId} coverUrl={book.coverUrl} size="xs" className="w-10 shrink-0" rounded="rounded" />
        <span className="line-clamp-2 min-w-0 flex-1 font-serif text-[15px] leading-snug text-ink">{book.title}</span>
      </button>
      <button
        type="button"
        onClick={() => void updateBook(book.id, { status: NEXT_STATUS[book.status] })}
        aria-label={`${meta.label} — tap to change`}
        className={cx('press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium', meta.pill)}
      >
        <StatusIcon status={book.status} size={13} />
        {meta.short}
      </button>
    </li>
  )
}

/** Series overview: progress, ordered volumes with gaps, quick status cycling, bulk actions. */
export function SeriesDetailSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'series' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const series = lib.seriesById.get(sheet.id)
  const volumes = lib.volumesBySeries.get(sheet.id) ?? []
  const closeSheet = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const coverInput = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState(series?.notes ?? '')
  useEffect(() => setNotes(series?.notes ?? ''), [series?.notes])
  const close = () => closeSheet(sheet.key)

  if (!series) return null
  const stats = seriesStats(series, volumes)
  const nextIndex = Math.floor(volumes.reduce((m, v) => Math.max(m, v.seriesIndex ?? 0), 0)) + 1
  const searchQuery = [series.title, series.authors[0]].filter(Boolean).join(' ')

  const addVolume = (index?: number) =>
    openSheet({
      kind: 'add',
      query: index ? `${searchQuery} ${index}` : searchQuery,
      target: { seriesId: series.id, seriesIndex: index },
    })

  const remove = async () => {
    const ok =
      volumes.length === 0 ||
      (await ui.confirm({
        title: `Delete “${series.title}”?`,
        message: `Its ${pluralize(volumes.length, 'book')} stay on your shelves as standalone books.`,
        confirmLabel: 'Delete series',
        tone: 'danger',
      }))
    if (!ok) return
    close()
    await deleteSeriesWithUndo(series.id, false)
  }

  // Interleave known gaps ("Book #4 — not added yet") into the ordered list.
  const rows: Array<{ type: 'book'; book: Book } | { type: 'gap'; index: number }> = []
  const gaps = new Set(stats.missing)
  let gapCursor = 1
  for (const v of volumes) {
    while (v.seriesIndex !== undefined && gapCursor < v.seriesIndex) {
      if (gaps.has(gapCursor)) rows.push({ type: 'gap', index: gapCursor })
      gapCursor++
    }
    rows.push({ type: 'book', book: v })
    if (v.seriesIndex !== undefined) gapCursor = Math.max(gapCursor, Math.floor(v.seriesIndex) + 1)
  }
  for (; series.totalVolumes && gapCursor <= series.totalVolumes; gapCursor++) if (gaps.has(gapCursor)) rows.push({ type: 'gap', index: gapCursor })

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
          <Button variant="primary" className="flex-1" icon={<Search size={16} />} onClick={() => addVolume(stats.missing[0] ?? nextIndex)}>
            Add volume #{stats.missing[0] ?? nextIndex}
          </Button>
          <IconButton label="Edit series" onClick={() => openSheet({ kind: 'series-form', id: series.id })}>
            <Pencil size={19} />
          </IconButton>
          <IconButton label="Series cover" onClick={() => coverInput.current?.click()}>
            <Camera size={19} />
          </IconButton>
          <IconButton label="Delete series" tone="danger" onClick={() => void remove()}>
            <Trash size={19} />
          </IconButton>
        </div>
      }
    >
      <CoverInput ref={coverInput} onPicked={(blob) => void setLocalCover({ kind: 'series', id: series.id }, blob)} />
      <div className="flex items-center gap-4 pt-3">
        <CoverStack series={series} volumes={volumes} className="w-20 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[24px] leading-tight text-ink">{series.title}</h2>
          <p className="mt-1 text-[14px] text-ink-muted">{formatAuthors(series.authors, 3)}</p>
          {categoryLabel(lib, series.categoryId, series.subCategoryId) && (
            <p className="mt-1 text-xs text-ink-faint">{categoryLabel(lib, series.categoryId, series.subCategoryId)}</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <SeriesProgress stats={stats} />
      </div>

      <div className="mt-5">
        <Segmented
          label="Series status"
          size="sm"
          value={series.status}
          onChange={(status) => void updateSeries(series.id, { status })}
          options={SERIES_STATUSES.map((s) => ({ value: s, label: SERIES_STATUS_META[s].short, tone: SERIES_STATUS_META[s].color }))}
        />
      </div>

      <Section
        title="Volumes"
        className="mt-6"
        action={
          volumes.length > 0 && (
            <div data-no-swipe className="flex items-center gap-0.5">
              <span className="mr-1 text-xs text-ink-faint">Mark all</span>
              {BOOK_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Mark all volumes ${BOOK_STATUS_META[s].label}`}
                  title={`Mark all: ${BOOK_STATUS_META[s].label}`}
                  onClick={() => void setSeriesVolumesStatus(series.id, s)}
                  className={cx('press grid size-9 place-items-center rounded-full', BOOK_STATUS_META[s].text, 'hover:bg-card')}
                >
                  <StatusIcon status={s} size={16} />
                </button>
              ))}
            </div>
          )
        }
      >
        {rows.length === 0 ? (
          <div className="rounded-card border border-dashed border-line p-5 text-center text-[14px] text-ink-muted">
            No volumes yet. Search for the first book, or add it by hand.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) =>
              row.type === 'book' ? (
                <VolumeRow key={row.book.id} book={row.book} onOpen={() => openSheet({ kind: 'book', id: row.book.id })} />
              ) : (
                <li key={`gap-${row.index}`}>
                  <button
                    type="button"
                    onClick={() => addVolume(row.index)}
                    className="press flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-line px-2 text-left text-[14px] text-ink-faint hover:border-amber/40 hover:text-amber"
                  >
                    <span className="w-8 text-center font-serif text-lg tabular-nums">{row.index}</span>
                    <span className="flex-1">Not added yet</span>
                    <Plus size={16} className="mr-2" />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          icon={<Plus size={14} />}
          onClick={() => openSheet({ kind: 'book-form', target: { seriesId: series.id, seriesIndex: stats.missing[0] ?? nextIndex } })}
        >
          Add a volume by hand
        </Button>
      </Section>

      <Section title="Notes">
        <textarea
          aria-label="Series notes"
          value={notes}
          rows={2}
          placeholder="Reading order, editions to collect…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (series.notes ?? '') && void updateSeries(series.id, { notes })}
          className="field resize-none leading-relaxed"
        />
      </Section>

      {series.description && (
        <Section title="About">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-muted">{series.description}</p>
        </Section>
      )}
    </Drawer>
  )
}

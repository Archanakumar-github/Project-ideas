import { useEffect, useMemo, useState } from 'react'
import { Check, Layers, LibraryBig } from 'lucide-react'
import type { BookCandidate } from '../../api/types'
import { enrichCandidate } from '../../api/metadata'
import { BOOK_STATUSES, type Book, type BookStatus } from '../../db/types'
import { useLibrary } from '../../hooks/useLibrary'
import { saveCandidate } from '../../lib/actions'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, formatAuthors, formatPrice } from '../../lib/utils'
import { useSettings } from '../../store/settings'
import { useUI, type SeriesTarget } from '../../store/ui'
import { BookCover } from '../books/BookCover'
import { StatusIcon, StatusPill } from '../books/StatusBadge'
import { CategoryPicker, type CategoryValue } from '../categories/CategoryPicker'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { suggestCategory } from './suggestCategory'

interface CandidateCardProps {
  candidate: BookCandidate
  expanded: boolean
  onExpand: () => void
  duplicate?: Book
  target?: SeriesTarget
  onSaved?: (book: Book) => void
}

/**
 * Search result. Tap to preview (enriches description/series in the background), choose
 * status + category, save. Defaults are pre-filled so the common case is: tap, tap Save.
 */
export function CandidateCard({ candidate, expanded, onExpand, duplicate, target, onSaved }: CandidateCardProps) {
  const lib = useLibrary()
  const lastStatus = useSettings((s) => s.lastStatus)
  const openSheet = useUI((s) => s.openSheet)
  const [c, setC] = useState(candidate)
  const [enriching, setEnriching] = useState(false)
  const [status, setStatus] = useState<BookStatus>(lastStatus)
  const [category, setCategory] = useState<CategoryValue>({})
  const [touchedCategory, setTouchedCategory] = useState(false)
  const [attachSeries, setAttachSeries] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => setC(candidate), [candidate])

  // Enrich once when first expanded.
  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    setEnriching(true)
    enrichCandidate(candidate, controller.signal)
      .then((full) => !controller.signal.aborted && setC(full))
      .finally(() => !controller.signal.aborted && setEnriching(false))
    return () => controller.abort()
  }, [expanded, candidate])

  const suggested = useMemo(() => suggestCategory(c.subjects, lib), [c.subjects, lib])
  const effectiveCategory = touchedCategory ? category : suggested
  const targetSeries = target ? lib.seriesById.get(target.seriesId) : undefined

  const save = async () => {
    setSaving(true)
    try {
      const book = await saveCandidate(c, {
        status,
        ...effectiveCategory,
        attachSeries: attachSeries && !target,
        target,
      })
      setSaved(true)
      onSaved?.(book)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className={cx(
        'rounded-card border bg-card transition-[box-shadow,border-color] duration-200',
        expanded ? 'border-amber/40 shadow-glow' : 'border-line shadow-card',
      )}
    >
      <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex w-full items-start gap-3 p-2.5 text-left">
        <BookCover
          title={c.title}
          authors={c.authors}
          coverUrl={c.thumbUrl ?? c.coverUrl}
          size="sm"
          className={cx('shrink-0 transition-[width] duration-200', expanded ? 'w-20' : 'w-12')}
          rounded="rounded-md"
        />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="line-clamp-2 font-serif text-[16px] leading-snug text-ink">{c.title}</h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted">{formatAuthors(c.authors)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            {c.publishYear && <span>{c.publishYear}</span>}
            {c.pageCount && <span>{c.pageCount} pages</span>}
            {c.seriesName && (
              <span className="inline-flex items-center gap-1 text-amber">
                <Layers size={11} />
                {c.seriesName}
                {c.seriesIndex !== undefined && ` #${c.seriesIndex}`}
              </span>
            )}
            {c.price !== undefined && <span className="text-terracotta">{formatPrice(c.price, c.currency)}</span>}
            {duplicate && (
              <span className="inline-flex items-center gap-1 text-sage">
                <LibraryBig size={11} /> On your shelf
              </span>
            )}
            {saved && (
              <span className="inline-flex items-center gap-1 text-sage">
                <Check size={11} /> Added
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="animate-fade-in space-y-4 px-3 pb-3">
          {(c.description || enriching) && (
            <p className={cx('line-clamp-4 text-[14px] leading-relaxed text-ink-muted', enriching && !c.description && 'skeleton h-14 rounded-lg')}>
              {c.description}
            </p>
          )}

          {duplicate && (
            <div className="flex items-center gap-3 rounded-xl bg-sage/10 px-3 py-2 text-[13px] text-sage ring-1 ring-sage/25">
              <span className="flex-1">
                Already on your shelf as <StatusPill status={duplicate.status} short className="ml-0.5" />
              </span>
              <Button size="sm" variant="ghost" onClick={() => openSheet({ kind: 'book', id: duplicate.id })}>
                Open
              </Button>
            </div>
          )}

          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={BOOK_STATUSES.map((s) => ({
              value: s,
              label: BOOK_STATUS_META[s].short,
              tone: BOOK_STATUS_META[s].color,
              icon: <StatusIcon status={s} size={14} />,
            }))}
          />

          <div>
            <p className="mb-2 text-[13px] font-medium tracking-wide text-ink-muted uppercase">
              Category {!touchedCategory && suggested.categoryId && <span className="ml-1 normal-case text-ink-faint">· suggested</span>}
            </p>
            <CategoryPicker
              value={effectiveCategory}
              showManage={false}
              onChange={(v) => {
                setTouchedCategory(true)
                setCategory(v)
              }}
            />
          </div>

          {targetSeries ? (
            <p className="flex items-center gap-2 text-[13px] text-amber">
              <Layers size={14} /> Will be added to {targetSeries.title}
              {target?.seriesIndex !== undefined && ` as #${target.seriesIndex}`}
            </p>
          ) : (
            c.seriesName && (
              <Switch
                checked={attachSeries}
                onChange={setAttachSeries}
                label={
                  <>
                    Add to series <span className="text-amber">{c.seriesName}</span>
                  </>
                }
                description={c.seriesIndex !== undefined ? `As book #${c.seriesIndex}` : 'Track the whole saga volume by volume'}
              />
            )
          )}

          <Button variant="primary" size="lg" block disabled={saving} onClick={() => void save()} icon={<StatusIcon status={status} size={18} />}>
            {saving ? 'Saving…' : `Save to ${BOOK_STATUS_META[status].label}`}
          </Button>
        </div>
      )}
    </article>
  )
}

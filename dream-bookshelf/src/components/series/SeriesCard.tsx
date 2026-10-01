import { memo } from 'react'
import type { Book, Series } from '../../db/types'
import { useLongPress } from '../../hooks/useLongPress'
import { seriesStats } from '../../lib/library'
import { SERIES_STATUS_META } from '../../lib/status'
import { cx, formatAuthors } from '../../lib/utils'
import { BookCover } from '../books/BookCover'
import { SeriesProgress } from './SeriesProgress'

/** Fanned stack of the first volumes' covers. */
export function CoverStack({ series, volumes, className }: { series: Series; volumes: Book[]; className?: string }) {
  const covers = volumes.slice(0, 3)
  if (covers.length === 0 || series.coverId) {
    return (
      <div className={cx('relative w-16', className)}>
        <BookCover title={series.title} authors={series.authors} coverId={series.coverId} size="xs" rounded="rounded-md" className="shadow-card" />
      </div>
    )
  }
  return (
    <div className={cx('relative w-16', className)}>
      {covers
        .map((b, i) => (
          <div
            key={b.id}
            className="absolute inset-x-0 top-0 transition-transform duration-200"
            style={{ transform: `translateX(${i * 7}px) rotate(${i * 4}deg) scale(${1 - i * 0.06})`, zIndex: 3 - i, transformOrigin: 'bottom left' }}
          >
            <BookCover title={b.title} authors={b.authors} coverId={b.coverId} coverUrl={b.coverUrl} size="xs" rounded="rounded-md" className="shadow-card" />
          </div>
        ))
        .reverse()}
      <div className="invisible aspect-[2/3]" />
    </div>
  )
}

export const SeriesCard = memo(function SeriesCard({
  series,
  volumes,
  onOpen,
  onLongPress,
}: {
  series: Series
  volumes: Book[]
  onOpen: (s: Series) => void
  onLongPress: (s: Series) => void
}) {
  const stats = seriesStats(series, volumes)
  const meta = SERIES_STATUS_META[series.status]
  const press = useLongPress<HTMLDivElement>(() => onLongPress(series), { onClick: () => onOpen(series) })
  return (
    <div
      {...press}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(series)}
      className="press touch-none-callout flex items-center gap-4 rounded-card border border-line bg-card p-3 pr-4 shadow-card active:shadow-glow"
    >
      <CoverStack series={series} volumes={volumes} className="ml-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-serif text-[17px] leading-snug text-ink">{series.title}</h3>
          <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.pill)}>{meta.short}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-muted">{formatAuthors(series.authors)}</p>
        <div className="mt-2.5">
          <SeriesProgress stats={stats} />
        </div>
      </div>
    </div>
  )
})

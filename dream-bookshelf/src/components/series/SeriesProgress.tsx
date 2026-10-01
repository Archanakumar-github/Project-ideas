import type { SeriesStats } from '../../lib/library'
import { pluralize } from '../../lib/utils'

/** Segmented bar: owned (amber) · want to buy (terracotta) · want to read (sage) · missing. */
export function SeriesProgress({ stats, showLabel = true }: { stats: SeriesStats; showLabel?: boolean }) {
  const total = Math.max(stats.total, 1)
  const seg = (n: number) => `${(n / total) * 100}%`
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${stats.owned} of ${stats.total} owned`}>
        <span className="h-full bg-amber transition-[width] duration-300" style={{ width: seg(stats.owned) }} />
        <span className="h-full bg-terracotta transition-[width] duration-300" style={{ width: seg(stats.wantToBuy) }} />
        <span className="h-full bg-sage transition-[width] duration-300" style={{ width: seg(stats.wantToRead) }} />
      </div>
      {showLabel && (
        <p className="mt-1.5 text-xs text-ink-muted">
          <span className="text-amber">{stats.owned}</span> of {pluralize(stats.total, 'book')} owned
          {stats.wantToBuy > 0 && (
            <>
              {' · '}
              <span className="text-terracotta">{stats.wantToBuy}</span> to buy
            </>
          )}
          {stats.wantToRead > 0 && (
            <>
              {' · '}
              <span className="text-sage">{stats.wantToRead}</span> to read
            </>
          )}
        </p>
      )}
    </div>
  )
}

import { useCallback, useMemo, useRef } from 'react'
import { Layers, Plus } from 'lucide-react'
import { SERIES_STATUSES, type Series } from '../db/types'
import { useLibrary } from '../hooks/useLibrary'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { SERIES_STATUS_META } from '../lib/status'
import { pluralize, titleKey } from '../lib/utils'
import { useUI, type SeriesFilter } from '../store/ui'
import { ViewHeader } from '../components/layout/ViewHeader'
import { SeriesCard } from '../components/series/SeriesCard'
import { Chip } from '../components/ui/Chip'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useSlideDirection } from './useDirectionalKey'

const TABS: SeriesFilter[] = ['all', ...SERIES_STATUSES]

export function SeriesView({ active }: { active: boolean }) {
  const lib = useLibrary()
  const filter = useUI((s) => s.seriesFilter)
  const setFilter = useUI((s) => s.setSeriesFilter)
  const openSheet = useUI((s) => s.openSheet)
  const swipeRef = useRef<HTMLDivElement>(null)

  const index = TABS.indexOf(filter)
  const slide = useSlideDirection(index)
  const onNext = useCallback(() => setFilter(TABS[Math.min(index + 1, TABS.length - 1)]), [index, setFilter])
  const onPrev = useCallback(() => setFilter(TABS[Math.max(index - 1, 0)]), [index, setFilter])
  useSwipeTabs(swipeRef, { onNext, onPrev, enabled: active })

  const list = useMemo(
    () =>
      lib.series
        .filter((s) => filter === 'all' || s.status === filter)
        .sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title))),
    [lib.series, filter],
  )
  const ownedVolumes = lib.books.filter((b) => b.seriesId && b.status === 'owned').length
  const counts = useMemo(() => {
    const c: Record<SeriesFilter, number> = { all: lib.series.length, 'want-to-read': 0, 'want-to-buy': 0, collecting: 0, complete: 0 }
    lib.series.forEach((s) => c[s.status]++)
    return c
  }, [lib.series])

  const onOpen = useCallback((s: Series) => openSheet({ kind: 'series', id: s.id }), [openSheet])
  const onLongPress = useCallback((s: Series) => openSheet({ kind: 'series-form', id: s.id }), [openSheet])

  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-y-contain">
      <ViewHeader title="Series" subtitle={`${pluralize(lib.series.length, 'series', 'series')} · ${ownedVolumes} volumes owned`}>
        <div data-no-swipe role="tablist" aria-label="Series status" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => (
            <Chip
              key={t}
              role="tab"
              aria-selected={filter === t}
              active={filter === t}
              tone={t === 'all' ? undefined : SERIES_STATUS_META[t].color}
              count={counts[t]}
              onClick={() => setFilter(t)}
            >
              {t === 'all' ? 'All' : SERIES_STATUS_META[t].label}
            </Chip>
          ))}
        </div>
      </ViewHeader>
      <div ref={swipeRef} className="min-h-[60vh] px-4" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 96px)' }}>
        <div key={filter} className={slide}>
          {lib.series.length === 0 ? (
            <EmptyState
              icon={<Layers size={30} />}
              title="No series yet"
              actions={
                <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => openSheet({ kind: 'series-form' })}>
                  Start a series
                </Button>
              }
            >
              Track a saga volume by volume — what you own, what to buy next, and the gaps in between. Books you add from search
              join their series automatically.
            </EmptyState>
          ) : list.length === 0 ? (
            <EmptyState icon={<Layers size={28} />} title="Nothing here">
              No series are marked “{filter === 'all' ? '' : SERIES_STATUS_META[filter].label}” yet.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((s) => (
                <li key={s.id}>
                  <SeriesCard series={s} volumes={lib.volumesBySeries.get(s.id) ?? []} onOpen={onOpen} onLongPress={onLongPress} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

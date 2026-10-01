import { useCallback, useMemo, useRef } from 'react'
import { Bookmark, BookPlus, CheckCheck, ListChecks, PenLine, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { BOOK_STATUSES } from '../db/types'
import { useLibrary } from '../hooks/useLibrary'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { refreshLibrary } from '../lib/actions'
import { primeKeyboard } from '../lib/keyboard'
import { filterBooks, sortBooks, wishlistTotals } from '../lib/library'
import { BOOK_STATUS_META } from '../lib/status'
import { formatPrice, isStandalone, pluralize } from '../lib/utils'
import { useSettings } from '../store/settings'
import { useUI, type StatusFilter } from '../store/ui'
import { ViewHeader } from '../components/layout/ViewHeader'
import { PullIndicator } from '../components/layout/PullIndicator'
import { BookCollection } from '../components/books/BookCollection'
import { StatusIcon } from '../components/books/StatusBadge'
import { Segmented } from '../components/ui/Segmented'
import { Chip } from '../components/ui/Chip'
import { Button, IconButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useSlideDirection } from './useDirectionalKey'

const STATUS_TABS: StatusFilter[] = ['all', ...BOOK_STATUSES]

export function ShelvesView({ active }: { active: boolean }) {
  const lib = useLibrary()
  const filters = useUI((s) => s.filters)
  const setFilters = useUI((s) => s.setFilters)
  const resetFilters = useUI((s) => s.resetFilters)
  const selecting = useUI((s) => s.selecting)
  const selected = useUI((s) => s.selected)
  const setSelected = useUI((s) => s.setSelected)
  const startSelecting = useUI((s) => s.startSelecting)
  const stopSelecting = useUI((s) => s.stopSelecting)
  const openSheet = useUI((s) => s.openSheet)
  const setTab = useUI((s) => s.setTab)
  const { sort, view, showSeriesVolumes } = useSettings()

  const scrollRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<HTMLDivElement>(null)
  const ptrRef = useRef<HTMLDivElement>(null)

  const books = useMemo(
    () => sortBooks(filterBooks(lib.books, filters, { showSeriesVolumes }), sort, lib.seriesById),
    [lib.books, lib.seriesById, filters, showSeriesVolumes, sort],
  )
  const wishlist = useMemo(() => wishlistTotals(lib.books)[0], [lib.books])

  const index = STATUS_TABS.indexOf(filters.status)
  const slide = useSlideDirection(index)
  const onNext = useCallback(() => setFilters({ status: STATUS_TABS[Math.min(index + 1, STATUS_TABS.length - 1)] }), [index, setFilters])
  const onPrev = useCallback(() => setFilters({ status: STATUS_TABS[Math.max(index - 1, 0)] }), [index, setFilters])
  useSwipeTabs(swipeRef, { onNext, onPrev, enabled: active })
  const { refreshing } = usePullToRefresh(scrollRef, ptrRef, refreshLibrary, { enabled: active && !selecting })

  const subs = filters.categoryId ? (lib.subCategories.get(filters.categoryId) ?? []) : []
  const usedCategories = lib.topCategories.filter((c) => (lib.categoryCounts.get(c.id) ?? 0) > 0 || filters.categoryId === c.id)
  const usedShelves = lib.orderedShelves.filter((s) => (lib.shelfCounts.get(s.id) ?? 0) > 0 || filters.shelfId === s.id)
  const hasFilters = !!(filters.categoryId || filters.shelfId)
  const allSelected = books.length > 0 && books.every((b) => selected.includes(b.id))

  const subtitle = [
    pluralize(lib.books.length, 'book'),
    wishlist && `${formatPrice(wishlist.amount, wishlist.currency)} wishlist`,
  ]
    .filter(Boolean)
    .join(' · ')

  const quickAdd = () => {
    primeKeyboard()
    openSheet({ kind: 'add' })
  }

  return (
    <div ref={scrollRef} data-scroller className="h-full overflow-y-auto overscroll-y-contain">
      {selecting ? (
        <ViewHeader
          title={selected.length ? `${selected.length} selected` : 'Select books'}
          subtitle="Tap covers to select"
          actions={
            <>
              <Button size="sm" variant="ghost" icon={<CheckCheck size={16} />} onClick={() => setSelected(allSelected ? [] : books.map((b) => b.id))}>
                {allSelected ? 'None' : 'All'}
              </Button>
              <IconButton label="Done selecting" onClick={stopSelecting}>
                <X size={20} />
              </IconButton>
            </>
          }
        />
      ) : (
        <ViewHeader
          title="Bibliotheca"
          subtitle={lib.ready ? subtitle : ' '}
          actions={
            <>
              <IconButton label="Select multiple" onClick={() => startSelecting()} disabled={lib.books.length === 0}>
                <ListChecks size={20} />
              </IconButton>
              <IconButton label="View & filters" onClick={() => openSheet({ kind: 'filters' })}>
                <SlidersHorizontal size={20} />
              </IconButton>
            </>
          }
        >
          <Segmented
            label="Shelf"
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={STATUS_TABS.map((s) =>
              s === 'all'
                ? { value: s, label: 'All', count: lib.statusCounts.all }
                : {
                    value: s,
                    label: BOOK_STATUS_META[s].short,
                    tone: BOOK_STATUS_META[s].color,
                    count: lib.statusCounts[s],
                    icon: <StatusIcon status={s} size={13} className="max-[430px]:hidden" />,
                  },
            )}
          />
        </ViewHeader>
      )}

      <PullIndicator ref={ptrRef} refreshing={refreshing} />

      <div ref={swipeRef} className="min-h-[60vh] px-4" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 96px)' }}>
        {lib.books.length > 0 && (usedCategories.length > 0 || usedShelves.length > 0) && (
          <div className="space-y-2 pb-4">
            {usedCategories.length > 0 && (
              <div data-no-swipe className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                <Chip active={!filters.categoryId} onClick={() => setFilters({ categoryId: undefined, subCategoryId: undefined })}>
                  All genres
                </Chip>
                {usedCategories.map((c) => (
                  <Chip
                    key={c.id}
                    active={filters.categoryId === c.id}
                    count={lib.categoryCounts.get(c.id) ?? 0}
                    onClick={() => setFilters({ categoryId: filters.categoryId === c.id ? undefined : c.id, subCategoryId: undefined })}
                  >
                    {c.name}
                  </Chip>
                ))}
                <IconButton label="Manage categories" size="sm" onClick={() => openSheet({ kind: 'categories' })}>
                  <Settings2 size={16} />
                </IconButton>
              </div>
            )}
            {subs.length > 0 && (
              <div data-no-swipe className="animate-fade-in no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {subs.map((c) => (
                  <Chip
                    key={c.id}
                    tone="var(--color-amber-glow)"
                    active={filters.subCategoryId === c.id}
                    count={lib.categoryCounts.get(c.id) ?? 0}
                    onClick={() => setFilters({ subCategoryId: filters.subCategoryId === c.id ? undefined : c.id })}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>
            )}
            {usedShelves.length > 0 && (
              <div data-no-swipe className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {usedShelves.map((s) => (
                  <Chip
                    key={s.id}
                    tone="var(--color-amber-glow)"
                    icon={<Bookmark size={13} />}
                    active={filters.shelfId === s.id}
                    count={lib.shelfCounts.get(s.id) ?? 0}
                    onClick={() => setFilters({ shelfId: filters.shelfId === s.id ? undefined : s.id })}
                  >
                    {s.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        <div key={filters.status} className={slide}>
          {!lib.ready ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 min-[420px]:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}>
                  <div className="skeleton aspect-[2/3] rounded-[10px]" />
                  <div className="skeleton mt-2 h-4 w-3/4 rounded" />
                </div>
              ))}
            </div>
          ) : lib.books.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={30} />}
              title="Your sanctuary awaits"
              actions={
                <>
                  <Button variant="primary" size="lg" icon={<BookPlus size={18} />} onClick={quickAdd}>
                    Find a book
                  </Button>
                  <Button icon={<PenLine size={16} />} onClick={() => openSheet({ kind: 'book-form' })}>
                    Add one by hand
                  </Button>
                  <Button variant="ghost" onClick={() => setTab('settings')}>
                    Restore a backup
                  </Button>
                </>
              }
            >
              <p>Gather the books you long to read and the ones you hope to own. Everything stays private, on this device.</p>
              {!isStandalone() && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                <p className="mt-3 text-[13px] text-ink-faint">Tip: tap Share → “Add to Home Screen” to install it like an app.</p>
              )}
            </EmptyState>
          ) : books.length === 0 ? (
            <EmptyState icon={<Bookmark size={28} />} title="Nothing on this shelf yet" actions={hasFilters ? <Button onClick={resetFilters}>Clear filters</Button> : undefined}>
              {hasFilters ? 'No books match these filters.' : 'Books you add with this status will appear here.'}
            </EmptyState>
          ) : (
            <BookCollection books={books} layout={view} />
          )}
        </div>
      </div>
    </div>
  )
}

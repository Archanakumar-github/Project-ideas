import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Globe, LibraryBig, Search, X } from 'lucide-react'
import type { SearchScope } from '../api/types'
import { useLibrary } from '../hooks/useLibrary'
import { searchLocal, searchSeriesLocal } from '../lib/library'
import { useUI } from '../store/ui'
import { ViewHeader } from '../components/layout/ViewHeader'
import { BookCollection } from '../components/books/BookCollection'
import { SeriesCard } from '../components/series/SeriesCard'
import { OnlineResults } from '../components/add/OnlineResults'
import { SCOPES } from '../components/add/AddSheet'
import { Chip } from '../components/ui/Chip'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Field'

const RECENT_KEY = 'dream-bookshelf:recent-searches'

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

/** One box for both: instant local results first, then online discovery with quick add. */
export function SearchView({ active }: { active: boolean }) {
  const lib = useLibrary()
  const openSheet = useUI((s) => s.openSheet)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [recent, setRecent] = useState<string[]>(loadRecent)
  // Privacy: this tab searches your shelves. Online lookups start only when you ask
  // (Enter or the button) and then follow your typing until the box is cleared.
  const [online, setOnline] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => {
    if (!query.trim()) setOnline(false)
  }, [query])

  useEffect(() => {
    if (active && !query) inputRef.current?.focus({ preventScroll: true })
    // Focus only when the tab is opened.
  }, [active])

  const remember = (q: string) => {
    const v = q.trim()
    if (v.length < 2) return
    const next = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, 8)
    setRecent(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const ctx = useMemo(
    () => ({ categoriesById: lib.categoriesById, shelvesById: lib.shelvesById, seriesById: lib.seriesById }),
    [lib.categoriesById, lib.shelvesById, lib.seriesById],
  )
  const localBooks = useMemo(() => searchLocal(lib.books, debounced, ctx), [lib.books, debounced, ctx])
  const localSeries = useMemo(() => searchSeriesLocal(lib.series, debounced), [lib.series, debounced])
  const hasQuery = debounced.trim().length >= 2

  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-y-contain">
      <ViewHeader title="Search" subtitle="Your shelves and the wider library">
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            remember(query)
            if (query.trim().length >= 2) setOnline(true)
            inputRef.current?.blur()
          }}
        >
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search"
            placeholder="Title, author, ISBN, notes, shelf…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => remember(query)}
            className="field h-12 rounded-2xl pr-11 pl-10"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-faint"
            >
              <X size={16} />
            </button>
          )}
        </form>
        <div data-no-swipe className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
          {SCOPES.map((s) => (
            <Chip key={s.value} active={scope === s.value} onClick={() => setScope(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </ViewHeader>

      <div className="px-4" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 32px)' }}>
        {!hasQuery ? (
          <div className="animate-fade-in">
            {recent.length > 0 && (
              <Section
                title="Recent"
                action={
                  <button
                    type="button"
                    className="min-h-9 text-sm text-ink-faint hover:text-ink"
                    onClick={() => {
                      setRecent([])
                      localStorage.removeItem(RECENT_KEY)
                    }}
                  >
                    Clear
                  </button>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <Chip key={r} icon={<Clock size={13} />} onClick={() => setQuery(r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </Section>
            )}
            <p className="mx-auto mt-10 max-w-xs text-center text-[14px] leading-relaxed text-ink-muted">
              Search your own shelves instantly — even offline — and discover new books from Open Library and Google Books.
            </p>
          </div>
        ) : (
          <>
            {(localBooks.length > 0 || localSeries.length > 0) && (
              <Section
                title={
                  <span className="inline-flex items-center gap-2">
                    <LibraryBig size={17} className="text-amber" /> On your shelves
                  </span>
                }
              >
                <div className="space-y-2.5">
                  {localSeries.slice(0, 3).map((s) => (
                    <SeriesCard
                      key={s.id}
                      series={s}
                      volumes={lib.volumesBySeries.get(s.id) ?? []}
                      onOpen={() => openSheet({ kind: 'series', id: s.id })}
                      onLongPress={() => openSheet({ kind: 'series-form', id: s.id })}
                    />
                  ))}
                  <BookCollection books={localBooks.slice(0, 30)} layout="list" />
                </div>
              </Section>
            )}
            <Section
              className="mt-8"
              title={
                <span className="inline-flex items-center gap-2">
                  <Globe size={17} className="text-amber" /> Discover
                </span>
              }
            >
              {online ? (
                <OnlineResults query={debounced} scope={scope} onSaved={() => remember(debounced)} />
              ) : (
                <div className="rounded-card border border-dashed border-line p-4 text-center">
                  {localBooks.length === 0 && localSeries.length === 0 && (
                    <p className="mb-3 text-[14px] text-ink-muted">Nothing on your shelves matches “{debounced.trim()}”.</p>
                  )}
                  <Button variant="soft" icon={<Globe size={16} />} onClick={() => setOnline(true)}>
                    Search Open Library for “{debounced.trim()}”
                  </Button>
                  <p className="mt-2 text-xs text-ink-faint">Only the search text is sent.</p>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CloudOff, Globe, PenLine, SearchX, WifiOff } from 'lucide-react'
import type { SearchScope } from '../../api/types'
import type { Book } from '../../db/types'
import { useLibrary } from '../../hooks/useLibrary'
import { savePlaceholder } from '../../lib/actions'
import { findDuplicate } from '../../lib/library'
import { useSettings } from '../../store/settings'
import { useUI, type SeriesTarget } from '../../store/ui'
import { Button } from '../ui/Button'
import { CandidateCard } from './CandidateCard'
import { useOnlineSearch } from './useOnlineSearch'

interface OnlineResultsProps {
  query: string
  scope: SearchScope
  target?: SeriesTarget
  onSaved?: (book: Book) => void
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 rounded-card border border-line bg-card p-2.5">
      <div className="skeleton aspect-[2/3] w-12 rounded-md" />
      <div className="flex-1 space-y-2 py-1">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
    </div>
  )
}

/** Online results + every degraded state (offline, disabled, errors, no results). */
export function OnlineResults({ query, scope, target, onSaved }: OnlineResultsProps) {
  const lib = useLibrary()
  const state = useOnlineSearch(query, scope)
  const [expanded, setExpanded] = useState<string | null>(null)
  const openSheet = useUI((s) => s.openSheet)
  const lastStatus = useSettings((s) => s.lastStatus)

  useEffect(() => setExpanded(null), [query, scope])

  const manual = () => openSheet({ kind: 'book-form', prefill: { title: query.trim() }, target })
  const placeholder = async () => {
    const book = await savePlaceholder(query, { status: lastStatus, target })
    onSaved?.(book)
  }

  if (state.status === 'idle') return null

  if (state.status === 'offline' || state.status === 'disabled') {
    const offline = state.status === 'offline'
    return (
      <div className="animate-fade-in rounded-card border border-line bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-terracotta">{offline ? <WifiOff size={20} /> : <CloudOff size={20} />}</span>
          <div className="text-[14px] leading-relaxed text-ink-muted">
            <p className="font-medium text-ink">{offline ? "You're offline" : 'Online lookups are off'}</p>
            {offline
              ? `Save “${query.trim()}” now — the cover and details will be fetched automatically when you're back online.`
              : 'Turn them on in Settings to search Open Library and Google Books, or add the book by hand.'}
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {offline && (
            <Button variant="primary" block onClick={() => void placeholder()}>
              Save “{query.trim()}” for later
            </Button>
          )}
          <Button block icon={<PenLine size={16} />} onClick={manual}>
            Add with details by hand
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="animate-fade-in rounded-card border border-line bg-card p-4 text-[14px] text-ink-muted">
        <p className="font-medium text-ink">{state.message}</p>
        <p className="mt-1">You can still save it now; Bibliotheca will retry the lookup in the background.</p>
        <div className="mt-4 grid gap-2">
          <Button variant="primary" block onClick={() => void placeholder()}>
            Save “{query.trim()}” and look it up later
          </Button>
          <Button block icon={<PenLine size={16} />} onClick={manual}>
            Add by hand
          </Button>
        </div>
      </div>
    )
  }

  const results = state.results
  return (
    <div className="space-y-2.5">
      {state.status === 'loading' && results.length === 0 && (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}
      {results.map((c) => (
        <CandidateCard
          key={c.key}
          candidate={c}
          expanded={expanded === c.key}
          onExpand={() => setExpanded(expanded === c.key ? null : c.key)}
          duplicate={findDuplicate(lib.books, c)}
          target={target}
          onSaved={onSaved}
        />
      ))}
      {state.status === 'done' && results.length === 0 && (
        <div className="animate-fade-in flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-muted">
          <SearchX size={22} className="text-ink-faint" />
          <p>No matches for “{query.trim()}”. Try the author's name or an ISBN.</p>
          <Button size="sm" icon={<PenLine size={14} />} onClick={manual}>
            Add it by hand
          </Button>
        </div>
      )}
      {state.status === 'done' && state.warnings.length > 0 && (
        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-ink-faint">
          <Globe size={13} className="mt-0.5 shrink-0" />
          {state.warnings.join(' ')}
        </p>
      )}
    </div>
  )
}

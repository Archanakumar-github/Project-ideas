import { useEffect, useRef, useState } from 'react'
import { Layers, PenLine, ScanBarcode, Search, X } from 'lucide-react'
import type { SearchScope } from '../../api/types'
import { useLibrary } from '../../hooks/useLibrary'
import { focusInput } from '../../lib/keyboard'
import { useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { OnlineResults } from './OnlineResults'

export const SCOPES: Array<{ value: SearchScope; label: string }> = [
  { value: 'all', label: 'Anything' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'isbn', label: 'ISBN' },
]

/**
 * Quick Search Add: type -> preview -> choose status/category -> save.
 * The input is focused immediately (keyboard primed by the FAB tap, see lib/keyboard.ts).
 */
export function AddSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'add' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const closeSheet = useUI((s) => s.closeSheet)
  const openSheet = useUI((s) => s.openSheet)
  const [query, setQuery] = useState(sheet.query ?? '')
  const [scope, setScope] = useState<SearchScope>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const target = sheet.target
  const series = target ? lib.seriesById.get(target.seriesId) : undefined
  const close = () => closeSheet(sheet.key)

  useEffect(() => {
    focusInput(inputRef.current)
  }, [])

  return (
    <Drawer
      open={!sheet.closing}
      onClose={close}
      depth={depth}
      isTop={isTop}
      size="full"
      title={series ? `Add to ${series.title}` : 'Add a book'}
      subtitle={series ? (target?.seriesIndex ? `Volume #${target.seriesIndex}` : 'Next volume') : 'Search by title, author or ISBN'}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            icon={<PenLine size={16} />}
            onClick={() => openSheet({ kind: 'book-form', prefill: query.trim() ? { title: query.trim() } : undefined, target })}
          >
            Add manually
          </Button>
          {series ? (
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
          ) : (
            <Button icon={<Layers size={16} />} onClick={() => openSheet({ kind: 'series-form' })}>
              New series
            </Button>
          )}
        </div>
      }
    >
      <div className="sticky top-0 z-10 -mx-5 bg-canvas-raised px-5 pt-1 pb-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            inputRef.current?.blur()
          }}
          className="relative"
        >
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="search"
            inputMode={scope === 'isbn' ? 'numeric' : 'search'}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search books"
            placeholder={scope === 'isbn' ? '978…' : 'Title, author or ISBN'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field h-12 rounded-2xl pr-11 pl-10 text-[16px]"
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
        <div data-no-swipe className="no-scrollbar -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5">
          {SCOPES.map((s) => (
            <Chip key={s.value} active={scope === s.value} onClick={() => setScope(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div className="animate-fade-in space-y-3 py-6 text-center text-[14px] leading-relaxed text-ink-muted">
          <ScanBarcode size={26} className="mx-auto text-ink-faint" />
          <p>
            Type a few words of a title or an author's name.
            <br />
            Have the book in hand? Enter the ISBN from the back cover.
          </p>
        </div>
      ) : (
        <OnlineResults query={query} scope={scope} target={target} onSaved={close} />
      )}
    </Drawer>
  )
}

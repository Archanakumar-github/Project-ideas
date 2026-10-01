import { FolderTree, Layers, Library, Search, Settings } from 'lucide-react'
import { useUI, type Tab } from '../../store/ui'
import { cx } from '../../lib/utils'

const ITEMS: Array<{ tab: Tab; label: string; Icon: typeof Library }> = [
  { tab: 'shelves', label: 'Shelves', Icon: Library },
  { tab: 'series', label: 'Series', Icon: Layers },
  { tab: 'search', label: 'Search', Icon: Search },
  { tab: 'categories', label: 'Categories', Icon: FolderTree },
  { tab: 'settings', label: 'Settings', Icon: Settings },
]

/** Bottom-anchored primary navigation (thumb zone), respecting the home indicator. */
export function BottomNav() {
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-canvas/85 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-xl grid-cols-5 px-1">
        {ITEMS.map(({ tab: t, label, Icon }) => {
          const active = tab === t
          return (
            <li key={t} className="flex">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (active) document.querySelector<HTMLElement>(`[data-view="${t}"] [data-scroller]`)?.scrollTo({ top: 0, behavior: 'smooth' })
                  else setTab(t)
                }}
                className={cx(
                  'relative flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium tracking-wide transition-colors duration-150',
                  active ? 'text-amber' : 'text-ink-faint hover:text-ink-muted',
                )}
              >
                <span
                  className={cx(
                    'grid h-8 w-14 place-items-center rounded-full transition-[background-color,box-shadow] duration-200',
                    active && 'bg-amber/12 shadow-[0_0_20px_-4px_rgb(226_149_120/0.5)]',
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

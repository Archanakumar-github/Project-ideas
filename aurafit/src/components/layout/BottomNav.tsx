import { BookHeart, Dumbbell, LineChart, Salad, Sun } from 'lucide-react'
import { useUI, type Tab } from '../../store/ui'
import { cx, haptic } from '../../lib/utils'

const ITEMS: Array<{ tab: Tab; label: string; Icon: typeof Sun }> = [
  { tab: 'today', label: 'Today', Icon: Sun },
  { tab: 'diet', label: 'Diet', Icon: Salad },
  { tab: 'train', label: 'Train', Icon: Dumbbell },
  { tab: 'progress', label: 'Progress', Icon: LineChart },
  { tab: 'journal', label: 'Journal', Icon: BookHeart },
]

/** Thumb-zone primary navigation, clear of the home indicator. */
export function BottomNav() {
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-xl grid-cols-5 px-1">
        {ITEMS.map(({ tab: t, label, Icon }) => {
          const active = tab === t
          return (
            <li key={t} className="flex">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  haptic()
                  if (active) document.querySelector<HTMLElement>(`[data-view="${t}"] [data-scroller]`)?.scrollTo({ top: 0, behavior: 'smooth' })
                  else setTab(t)
                }}
                className={cx('tap relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors', active ? 'text-accent-fg' : 'text-ink-3')}
              >
                <span className={cx('grid h-8 w-14 place-items-center rounded-full transition-colors', active && 'bg-accent-soft')}>
                  <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
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

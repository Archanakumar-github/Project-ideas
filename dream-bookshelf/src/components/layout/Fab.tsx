import { Plus } from 'lucide-react'
import { primeKeyboard } from '../../lib/keyboard'
import { useUI } from '../../store/ui'
import { cx } from '../../lib/utils'

/** Floating "+" — opens Quick Search Add (or New Series on the Series tab). */
export function Fab() {
  const tab = useUI((s) => s.tab)
  const selecting = useUI((s) => s.selecting)
  const openSheet = useUI((s) => s.openSheet)
  const visible = !selecting && (tab === 'shelves' || tab === 'series')
  const isSeries = tab === 'series'

  return (
    <button
      type="button"
      aria-label={isSeries ? 'New series' : 'Add a book'}
      tabIndex={visible ? 0 : -1}
      onClick={() => {
        if (isSeries) openSheet({ kind: 'series-form' })
        else {
          // Must run synchronously inside the tap so iOS will show the keyboard.
          primeKeyboard()
          openSheet({ kind: 'add' })
        }
      }}
      className={cx(
        'fixed right-4 z-30 grid size-14 place-items-center rounded-full bg-amber text-ink-inverse shadow-glow transition-[transform,opacity] duration-200 ease-cozy active:scale-95',
        visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
      )}
      style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)' }}
    >
      <span aria-hidden className="absolute inset-0 rounded-full bg-amber-glow/40 blur-md" />
      <Plus size={26} strokeWidth={2.4} className="relative" />
    </button>
  )
}

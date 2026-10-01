import { Sparkles } from 'lucide-react'
import { openSheet } from '../../store/ui'
import { haptic } from '../../lib/utils'

/** The coach is one tap away from every tab. */
export function CoachFab() {
  return (
    <button
      type="button"
      aria-label="Ask your coach"
      onClick={() => {
        haptic()
        openSheet({ kind: 'coach' })
      }}
      className="tap fixed z-40 grid h-14 w-14 place-items-center rounded-full bg-accent text-on-accent shadow-float transition-transform active:scale-95"
      style={{ right: 'max(16px, calc((100vw - 36rem) / 2 + 16px))', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 14px)' }}
    >
      <Sparkles size={24} />
    </button>
  )
}

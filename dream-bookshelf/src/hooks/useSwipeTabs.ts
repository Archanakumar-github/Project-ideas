import { useEffect, type RefObject } from 'react'

/**
 * Horizontal swipe to switch tabs. The content follows the finger (damped) for tactile
 * feedback. Touches that start inside `[data-no-swipe]` (e.g. scrollable chip rows) or
 * that are mostly vertical (scrolling) are ignored.
 */
export function useSwipeTabs(
  ref: RefObject<HTMLElement | null>,
  { onNext, onPrev, enabled = true }: { onNext: () => void; onPrev: () => void; enabled?: boolean },
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let startX = 0
    let startY = 0
    let startT = 0
    let axis: 'x' | 'y' | null = null
    let active = false
    let dx = 0

    const reset = (animate: boolean) => {
      el.style.transition = animate ? 'transform 180ms var(--ease-cozy), opacity 180ms var(--ease-cozy)' : ''
      el.style.transform = ''
      el.style.opacity = ''
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const target = e.target as HTMLElement
      if (target.closest('[data-no-swipe]')) return
      active = true
      axis = null
      dx = 0
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startT = performance.now()
      // Ignore swipes from the very screen edge (iOS back gesture in browser mode).
      if (startX < 16 || startX > window.innerWidth - 16) active = false
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      const x = e.touches[0].clientX - startX
      const y = e.touches[0].clientY - startY
      if (!axis) {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return
        axis = Math.abs(x) > Math.abs(y) * 1.3 ? 'x' : 'y'
      }
      if (axis !== 'x') return
      dx = x
      el.style.transition = ''
      el.style.transform = `translate3d(${dx * 0.25}px,0,0)`
      el.style.opacity = String(1 - Math.min(Math.abs(dx) / 900, 0.25))
    }
    const onEnd = () => {
      if (!active) return
      active = false
      if (axis !== 'x') return
      const velocity = Math.abs(dx) / Math.max(1, performance.now() - startT)
      const passed = Math.abs(dx) > 70 || (Math.abs(dx) > 30 && velocity > 0.45)
      reset(true)
      if (passed) (dx < 0 ? onNext : onPrev)()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      reset(false)
    }
  }, [ref, onNext, onPrev, enabled])
}

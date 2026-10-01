import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Pull-to-refresh for a scroll container (standalone iOS web apps have none built in).
 * Writes the pull distance straight to the indicator's style to avoid re-rendering the list
 * on every touchmove; React state only tracks the `refreshing` phase.
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown>,
  { threshold = 70, enabled = true }: { threshold?: number; enabled?: boolean } = {},
) {
  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !enabled) return
    let startY = 0
    let startX = 0
    let pulling = false
    let distance = 0
    let busy = false

    const paint = (d: number, animate = false) => {
      const ind = indicatorRef.current
      if (!ind) return
      ind.style.transition = animate ? 'transform 200ms var(--ease-cozy), opacity 200ms' : ''
      ind.style.transform = `translate3d(0, ${d - 48}px, 0)`
      ind.style.opacity = String(Math.min(1, d / threshold))
      ind.dataset.ready = d >= threshold ? 'true' : 'false'
      const icon = ind.querySelector<HTMLElement>('[data-ptr-icon]')
      if (icon) icon.style.transform = `rotate(${Math.min(d / threshold, 1) * 270}deg)`
    }

    const onStart = (e: TouchEvent) => {
      if (busy || el.scrollTop > 0 || e.touches.length !== 1) return
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      pulling = true
      distance = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX
      if (dy <= 0 || el.scrollTop > 0 || Math.abs(dx) > dy) {
        if (distance > 0) paint(0)
        distance = 0
        return
      }
      if (e.cancelable) e.preventDefault()
      distance = Math.min(130, dy * 0.45)
      paint(distance)
    }
    const onEnd = async () => {
      if (!pulling) return
      pulling = false
      if (distance >= threshold) {
        busy = true
        setRefreshing(true)
        paint(threshold, true)
        try {
          await refreshRef.current()
        } finally {
          busy = false
          setRefreshing(false)
          paint(0, true)
        }
      } else {
        paint(0, true)
      }
      distance = 0
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scrollRef, indicatorRef, threshold, enabled])

  return { refreshing }
}

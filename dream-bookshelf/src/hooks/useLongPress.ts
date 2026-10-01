import { useRef, type MouseEvent, type PointerEvent } from 'react'

/**
 * Long-press (touch) / right-click (mouse) handler that also swallows the click which
 * follows a long press. Movement > 10px (i.e. a scroll) cancels it.
 */
export function useLongPress<T extends HTMLElement = HTMLElement>(
  onLongPress: () => void,
  { onClick, delay = 450 }: { onClick?: (e: MouseEvent<T>) => void; delay?: number } = {},
) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    origin.current = null
  }

  return {
    onPointerDown(e: PointerEvent<T>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(() => {
        fired.current = true
        origin.current = null
        onLongPress()
      }, delay)
    },
    onPointerMove(e: PointerEvent<T>) {
      const o = origin.current
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick(e: MouseEvent<T>) {
      if (fired.current) {
        e.preventDefault()
        e.stopPropagation()
        fired.current = false
        return
      }
      onClick?.(e)
    },
    onContextMenu(e: MouseEvent<T>) {
      e.preventDefault()
      if (fired.current) return
      cancel()
      fired.current = true
      onLongPress()
    },
  }
}

import { useEffect, useState } from 'react'

/** Keeps an element mounted while it animates out; `visible` flips a frame after mount. */
export function useMountTransition(open: boolean, durationMs = 200) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (open) {
      setMounted(true)
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), durationMs)
    return () => clearTimeout(t)
  }, [open, durationMs])
  return { mounted, visible }
}

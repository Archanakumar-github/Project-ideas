import { useEffect } from 'react'

/** Keeps --vvh in sync with the visual viewport so sheets stay above the iOS keyboard. */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
}

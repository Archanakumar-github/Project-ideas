import { useEffect } from 'react'

/**
 * Publishes the visual viewport as CSS variables so bottom sheets can sit right above the
 * iOS software keyboard (iOS doesn't resize the layout viewport when the keyboard opens):
 *   --vvh       visible height
 *   --kb-inset  space taken by the keyboard at the bottom
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        root.style.setProperty('--vvh', `${vv.height}px`)
        root.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}

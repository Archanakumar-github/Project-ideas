import { useRef } from 'react'

/** Returns the slide animation class for a tab change, based on its direction. */
export function useSlideDirection(index: number): string {
  const prev = useRef(index)
  const dir = useRef<'left' | 'right' | null>(null)
  if (prev.current !== index) {
    dir.current = index > prev.current ? 'right' : 'left'
    prev.current = index
  }
  return dir.current === 'right' ? 'animate-slide-from-right' : dir.current === 'left' ? 'animate-slide-from-left' : 'animate-fade-in'
}

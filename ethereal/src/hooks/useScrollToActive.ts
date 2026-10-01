import { useEffect, useRef } from 'react'
import type { LayoutChangeEvent, ScrollView } from 'react-native'

/** Keeps the active pill of a horizontal row in view, centred when possible. */
export function useScrollToActive(activeKey: string | null | undefined) {
  const ref = useRef<ScrollView>(null)
  const layouts = useRef(new Map<string, { x: number; w: number }>())
  const viewport = useRef(0)
  // The key we've already brought into view; layout events can arrive in any order.
  const shown = useRef<string | null>(null)

  const scroll = (animated: boolean) => {
    const l = activeKey ? layouts.current.get(activeKey) : undefined
    if (!l || !viewport.current || !activeKey) return
    ref.current?.scrollTo({ x: Math.max(0, l.x - (viewport.current - l.w) / 2), animated })
    shown.current = activeKey
  }
  const settle = () => {
    if (shown.current !== activeKey) scroll(false)
  }

  // Only when the selection changes, so it never fights the user's own scrolling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => scroll(true), [activeKey])

  return {
    ref,
    onViewportLayout: (e: LayoutChangeEvent) => {
      viewport.current = e.nativeEvent.layout.width
      settle()
    },
    register: (key: string) => (e: LayoutChangeEvent) => {
      layouts.current.set(key, { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width })
      if (key === activeKey) settle()
    },
  }
}

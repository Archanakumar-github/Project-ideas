import { useEffect, useState } from 'react'
import { isLocal, resolveLocal, resolveLocalSync } from './store'

/** Turns an item's stored image reference into something <Image> can display. */
export function useImageUri(uri: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!uri) return null
    return isLocal(uri) ? resolveLocalSync(uri) : uri
  })

  useEffect(() => {
    if (!uri) {
      setResolved(null)
      return
    }
    if (!isLocal(uri)) {
      setResolved(uri)
      return
    }
    const sync = resolveLocalSync(uri)
    if (sync) {
      setResolved(sync)
      return
    }
    let alive = true
    void resolveLocal(uri).then((u) => alive && setResolved(u))
    return () => {
      alive = false
    }
  }, [uri])

  return resolved
}

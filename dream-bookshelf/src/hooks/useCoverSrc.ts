import { useEffect, useState } from 'react'
import { db } from '../db/db'

/**
 * Covers are immutable per id (a new image gets a new id), so object URLs can be cached for
 * the lifetime of the page and shared by every card that shows the same cover.
 */
const urlCache = new Map<string, string>()
const pending = new Map<string, Promise<string | undefined>>()

function loadCover(coverId: string): Promise<string | undefined> {
  const cached = urlCache.get(coverId)
  if (cached) return Promise.resolve(cached)
  let p = pending.get(coverId)
  if (!p) {
    p = db.covers.get(coverId).then((c) => {
      pending.delete(coverId)
      if (!c) return undefined
      const url = URL.createObjectURL(c.blob)
      urlCache.set(coverId, url)
      return url
    })
    pending.set(coverId, p)
  }
  return p
}

/** Resolves the best image source: local blob first, then the remote URL. */
export function useCoverSrc(coverId?: string, coverUrl?: string): string | undefined {
  const [local, setLocal] = useState<string | undefined>(() => (coverId ? urlCache.get(coverId) : undefined))

  useEffect(() => {
    if (!coverId) {
      setLocal(undefined)
      return
    }
    let alive = true
    const cached = urlCache.get(coverId)
    if (cached) setLocal(cached)
    else void loadCover(coverId).then((url) => alive && setLocal(url))
    return () => {
      alive = false
    }
  }, [coverId])

  return (coverId && local) || coverUrl
}

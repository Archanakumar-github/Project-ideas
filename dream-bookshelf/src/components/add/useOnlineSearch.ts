import { useEffect, useState } from 'react'
import { searchBooks, LookupsDisabledError } from '../../api/metadata'
import { OfflineError, isAbortError } from '../../api/http'
import type { BookCandidate, SearchScope } from '../../api/types'
import { useOnline } from '../../hooks/useOnline'
import { useSettings } from '../../store/settings'

export type OnlineSearchState =
  | { status: 'idle' }
  | { status: 'loading'; results: BookCandidate[] }
  | { status: 'done'; results: BookCandidate[]; warnings: string[] }
  | { status: 'offline' }
  | { status: 'disabled' }
  | { status: 'error'; message: string }

/** Debounced, abortable online search that re-runs automatically when the device reconnects. */
export function useOnlineSearch(query: string, scope: SearchScope, debounceMs = 350): OnlineSearchState {
  const online = useOnline()
  const enabled = useSettings((s) => s.onlineLookups)
  const [state, setState] = useState<OnlineSearchState>({ status: 'idle' })

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setState({ status: 'idle' })
      return
    }
    if (!enabled) {
      setState({ status: 'disabled' })
      return
    }
    if (!online) {
      setState({ status: 'offline' })
      return
    }
    const controller = new AbortController()
    setState((prev) => ({ status: 'loading', results: prev.status === 'done' ? prev.results : [] }))
    const timer = setTimeout(async () => {
      try {
        const out = await searchBooks(q, scope, { signal: controller.signal })
        if (!controller.signal.aborted) setState({ status: 'done', results: out.results, warnings: out.warnings })
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof OfflineError) setState({ status: 'offline' })
        else if (err instanceof LookupsDisabledError) setState({ status: 'disabled' })
        else
          setState({
            status: 'error',
            message: isAbortError(err)
              ? 'The book catalogues are taking too long to answer.'
              : 'Couldn’t reach the book catalogues right now.',
          })
      }
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, scope, online, enabled, debounceMs])

  return state
}

/** fetch() with a timeout, JSON parsing and a tiny in-memory cache (per session). */
export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 10 * 60 * 1000

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export async function getJSON<T>(url: string, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL) return hit.data as T
  if (!isOnline()) throw new HttpError('You are offline')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000)
  opts.signal?.addEventListener('abort', () => ctrl.abort())
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new HttpError(`Request failed (${res.status})`, res.status)
    const data = (await res.json()) as T
    cache.set(url, { at: Date.now(), data })
    if (cache.size > 200) cache.delete(cache.keys().next().value!)
    return data
  } catch (err) {
    if (err instanceof HttpError) throw err
    if ((err as Error).name === 'AbortError') throw new HttpError(opts.signal?.aborted ? 'Cancelled' : 'The request timed out')
    throw new HttpError('Network error')
  } finally {
    clearTimeout(timer)
  }
}

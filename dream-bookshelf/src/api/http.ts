export class OfflineError extends Error {
  constructor() {
    super("You're offline")
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
  get isRateLimit() {
    return this.status === 429 || this.status === 403
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

/** Combines an optional caller signal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms)
  const onAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function fetchJson<T>(
  url: string,
  { signal, timeoutMs = 8000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  if (!isOnline()) throw new OfflineError()
  const t = withTimeout(signal, timeoutMs)
  try {
    const res = await fetch(url, {
      signal: t.signal,
      headers: { Accept: 'application/json' },
      // No cookies, no referrer: the APIs learn nothing beyond the query itself.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!res.ok) throw new HttpError(res.status, `Request failed (${res.status})`)
    return (await res.json()) as T
  } finally {
    t.done()
  }
}

export async function fetchBlob(
  url: string,
  { signal, timeoutMs = 12000 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Blob> {
  if (!isOnline()) throw new OfflineError()
  const t = withTimeout(signal, timeoutMs)
  try {
    const res = await fetch(url, { signal: t.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!res.ok) throw new HttpError(res.status, `Image request failed (${res.status})`)
    return await res.blob()
  } finally {
    t.done()
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')
}

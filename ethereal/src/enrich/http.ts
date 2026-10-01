export class HttpError extends Error {
  constructor(
    public status: number,
    message = `Request failed (${status})`,
  ) {
    super(message)
  }
}

export interface FetchOptions {
  signal?: AbortSignal
  timeoutMs?: number
  accept?: string
}

/** fetch with a timeout that also honours the caller's abort signal. */
export async function fetchWithTimeout(url: string, { signal, timeoutMs = 8000, accept }: FetchOptions = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: accept ? { Accept: accept } : undefined,
      // No cookies, no referrer: a lookup tells the site nothing but the request itself.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    } as RequestInit)
    if (!res.ok) throw new HttpError(res.status)
    return res
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetchWithTimeout(url, { accept: 'application/json', ...opts })
  return (await res.json()) as T
}

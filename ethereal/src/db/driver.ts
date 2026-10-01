/**
 * The tiny slice of SQLite the app needs. Three implementations:
 *   - openDriver.ts      iOS / Android: expo-sqlite (a real SQLite file on the device)
 *   - openDriver.web.ts  browser build: sql.js (SQLite in WebAssembly), saved to IndexedDB
 *   - tests/nodeDriver   unit tests: node:sqlite
 * All SQL lives in repo.ts, so every platform runs exactly the same queries.
 */
export type SqlValue = string | number | null

export interface SqlDriver {
  exec(sql: string): Promise<void>
  run(sql: string, params?: SqlValue[]): Promise<void>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  /** Runs `fn` atomically. Calls never interleave: they queue behind each other. */
  transaction(fn: () => Promise<void>): Promise<void>
  /** Called when another browser tab changed the data (web only). */
  onExternalChange?(listener: () => void): () => void
}

/** Serialises async work, so two transactions never overlap on one connection. */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return function lock<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn)
    tail = result.catch(() => undefined)
    return result
  }
}

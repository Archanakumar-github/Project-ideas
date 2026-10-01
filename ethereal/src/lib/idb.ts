/**
 * Minimal IndexedDB key/value helper for the browser build. One database, `ethereal`, so the
 * app never touches the storage of the other apps published on the same origin.
 *   - `files`:  the SQLite database image (one key)
 *   - `images`: photos as Blobs, keyed by file name
 */
const DB_NAME = 'ethereal'
const VERSION = 1
export type IdbStore = 'files' | 'images'

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser has no IndexedDB, so nothing could be saved.'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'))
  }).catch((err) => {
    opening = null
    throw err
  })
  return opening
}

function request<T>(store: IdbStore, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(req.result as T)
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB request failed'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB request aborted'))
      }),
  )
}

export const idb = {
  get: <T>(store: IdbStore, key: string) => request<T | undefined>(store, 'readonly', (s) => s.get(key)),
  put: (store: IdbStore, key: string, value: unknown) => request<void>(store, 'readwrite', (s) => s.put(value, key)),
  delete: (store: IdbStore, key: string) => request<void>(store, 'readwrite', (s) => s.delete(key)),
  keys: (store: IdbStore) => request<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
}

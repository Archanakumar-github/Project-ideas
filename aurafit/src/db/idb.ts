/**
 * Minimal promise wrapper over IndexedDB: two object stores.
 *   docs: encrypted application documents { k, iv, ct, at }
 *   keys: key material { id, ... } (a non-extractable CryptoKey, or passcode salt/verifier)
 */
export const DB_NAME = 'aurafit'
const VERSION = 1

export function openDB(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(name, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'k' })
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'))
    req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'))
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export function get<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** Writes and deletes in one atomic transaction. */
export function writeBatch(db: IDBDatabase, store: string, puts: unknown[], deletes: IDBValidKey[] = []): Promise<void> {
  const tx = db.transaction(store, 'readwrite', { durability: 'strict' } as IDBTransactionOptions)
  const os = tx.objectStore(store)
  for (const k of deletes) os.delete(k)
  for (const v of puts) os.put(v)
  return done(tx)
}

export function clearStore(db: IDBDatabase, store: string): Promise<void> {
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).clear()
  return done(tx)
}

/** Replace a store's whole content atomically (used when re-keying). */
export function replaceAll(db: IDBDatabase, store: string, values: unknown[]): Promise<void> {
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  os.clear()
  for (const v of values) os.put(v)
  return done(tx)
}

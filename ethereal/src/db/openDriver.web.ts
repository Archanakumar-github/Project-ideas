/**
 * Browser driver: SQLite compiled to WebAssembly (sql.js), kept in memory and written to
 * IndexedDB shortly after every change and whenever the page is hidden.
 *
 * Why not expo-sqlite's own web build? It needs SharedArrayBuffer, which needs COOP/COEP
 * response headers, which GitHub Pages cannot send. sql.js has no such requirement.
 */
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js'
import type { Database, SqlJsStatic } from 'sql.js'
import { Asset } from 'expo-asset'
import { idb } from '../lib/idb'
import { createMutex, type SqlDriver, type SqlValue } from './driver'

const DB_KEY = 'ethereal.sqlite'
const SAVE_DELAY_MS = 250

let sqlJs: Promise<SqlJsStatic> | null = null

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    sqlJs = (async () => {
      const asset = Asset.fromModule(require('sql.js/dist/sql-wasm-browser.wasm'))
      return initSqlJs({ locateFile: () => asset.uri })
    })()
  }
  return sqlJs
}

export async function openDriver(): Promise<SqlDriver> {
  const SQL = await loadSqlJs()
  let db: Database = await load(SQL)
  const lock = createMutex()
  const tabId = Math.random().toString(36).slice(2)
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ethereal-db') : null
  const listeners = new Set<() => void>()

  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false

  // db.export() closes and reopens the database, so it must never run inside a transaction:
  // saves take the same lock as transactions.
  const saveLocked = () => lock(save)

  async function save() {
    if (timer) clearTimeout(timer)
    timer = null
    if (!dirty) return
    dirty = false
    await idb.put('files', DB_KEY, db.export())
    channel?.postMessage({ from: tabId })
  }

  function scheduleSave() {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void saveLocked(), SAVE_DELAY_MS)
  }

  // iOS can freeze a backgrounded page at any time: flush the moment it's hidden.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void saveLocked()
    })
    window.addEventListener('pagehide', () => void saveLocked())
  }

  // Another tab saved: reload its copy, then let the app re-read.
  channel?.addEventListener('message', (event: MessageEvent<{ from: string }>) => {
    if (event.data?.from === tabId) return
    void lock(async () => {
      db.close()
      db = await load(SQL)
      listeners.forEach((l) => l())
    })
  })

  function rows<T>(sql: string, params: SqlValue[]): T[] {
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params)
      const out: T[] = []
      while (stmt.step()) out.push(stmt.getAsObject() as T)
      return out
    } finally {
      stmt.free()
    }
  }

  return {
    exec: async (sql) => {
      db.exec(sql)
      scheduleSave()
    },
    run: async (sql, params = []) => {
      db.run(sql, params)
      scheduleSave()
    },
    all: async <T>(sql: string, params: SqlValue[] = []) => rows<T>(sql, params),
    first: async <T>(sql: string, params: SqlValue[] = []) => rows<T>(sql, params)[0] ?? null,
    transaction: (fn) =>
      lock(async () => {
        db.exec('BEGIN')
        try {
          await fn()
          db.exec('COMMIT')
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        }
        scheduleSave()
      }),
    onExternalChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

async function load(SQL: SqlJsStatic): Promise<Database> {
  const saved = await idb.get<Uint8Array>('files', DB_KEY)
  return saved ? new SQL.Database(saved) : new SQL.Database()
}

/** Test driver: the same SQL, run by Node's built-in SQLite. */
import { DatabaseSync } from 'node:sqlite'
import { createMutex, type SqlDriver, type SqlValue } from '../src/db/driver'

export function nodeDriver(): SqlDriver & { db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  const lock = createMutex()
  return {
    db,
    exec: async (sql) => {
      db.exec(sql)
    },
    run: async (sql, params: SqlValue[] = []) => {
      db.prepare(sql).run(...params)
    },
    all: async <T>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
    first: async <T>(sql: string, params: SqlValue[] = []) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
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
      }),
  }
}

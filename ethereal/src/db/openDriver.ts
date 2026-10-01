/**
 * iOS / Android driver: expo-sqlite, a SQLite file in the app's private documents directory.
 * Metro picks openDriver.web.ts for the browser build instead.
 */
import * as SQLite from 'expo-sqlite'
import { createMutex, type SqlDriver, type SqlValue } from './driver'

export async function openDriver(name = 'ethereal.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name)
  await db.execAsync('PRAGMA journal_mode = WAL;')
  const lock = createMutex()

  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlValue[] = []) => {
      await db.runAsync(sql, params)
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlValue[] = []) => db.getFirstAsync<T>(sql, params),
    transaction: (fn) => lock(() => db.withTransactionAsync(fn)),
  }
}

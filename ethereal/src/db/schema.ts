import type { SqlDriver } from './driver'

/**
 * Ordered migrations. Each runs once, inside a transaction, and bumps `PRAGMA user_version`.
 * Never edit a shipped migration: append a new one.
 *
 * Cascades are done in repo.ts rather than with foreign keys, because sql.js resets PRAGMAs
 * every time the browser build saves.
 */
export const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE categories (
    id          TEXT PRIMARY KEY NOT NULL,
    parent_id   TEXT,
    name        TEXT NOT NULL,
    kind        TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  CREATE INDEX categories_parent ON categories (parent_id, position);

  CREATE TABLE items (
    id            TEXT PRIMARY KEY NOT NULL,
    title         TEXT NOT NULL,
    notes         TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    url           TEXT,
    image_uri     TEXT,
    image_aspect  REAL,
    status        TEXT NOT NULL DEFAULT 'dreaming',
    category_id   TEXT,
    tags          TEXT NOT NULL DEFAULT '[]',
    meta          TEXT NOT NULL DEFAULT '{}',
    enrich_state  TEXT NOT NULL DEFAULT 'none',
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER
  );
  CREATE INDEX items_category ON items (category_id);
  CREATE INDEX items_created ON items (created_at);

  CREATE TABLE kv (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
]

export async function migrate(driver: SqlDriver): Promise<{ from: number; to: number }> {
  const row = await driver.first<{ user_version: number }>('PRAGMA user_version')
  const from = row?.user_version ?? 0
  for (let v = from; v < MIGRATIONS.length; v++) {
    await driver.transaction(async () => {
      await driver.exec(MIGRATIONS[v])
      await driver.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
  return { from, to: MIGRATIONS.length }
}

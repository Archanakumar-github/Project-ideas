/**
 * Every read and write the app makes. Platform-agnostic: it only talks to a SqlDriver.
 * Every write goes through `driver.transaction`, so writes are atomic and never interleave.
 */
import type { SqlDriver, SqlValue } from './driver'
import { migrate } from './schema'
import { DEFAULT_TAXONOMY } from './seed'
import type { Category, CategoryKind, EnrichState, Item, ItemDraft, ItemMeta, ItemPatch, ItemStatus } from './types'
import { ITEM_STATUSES } from './types'
import { uid } from '../lib/id'
import { subtreeIds } from '../lib/tree'

interface CategoryRow {
  id: string
  parent_id: string | null
  name: string
  kind: string | null
  position: number
  created_at: number
  updated_at: number
}

interface ItemRow {
  id: string
  title: string
  notes: string
  description: string
  url: string | null
  image_uri: string | null
  image_aspect: number | null
  status: string
  category_id: string | null
  tags: string
  meta: string
  enrich_state: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  parentId: r.parent_id ?? null,
  name: r.name,
  kind: (r.kind as CategoryKind | null) ?? null,
  position: Number(r.position),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
})

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  title: r.title,
  notes: r.notes ?? '',
  description: r.description ?? '',
  url: r.url ?? null,
  imageUri: r.image_uri ?? null,
  imageAspect: r.image_aspect == null ? null : Number(r.image_aspect),
  status: (ITEM_STATUSES as string[]).includes(r.status) ? (r.status as ItemStatus) : 'dreaming',
  categoryId: r.category_id ?? null,
  tags: parseJson<string[]>(r.tags, []),
  meta: parseJson<ItemMeta>(r.meta, {}),
  enrichState: r.enrich_state as EnrichState,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deletedAt: r.deleted_at == null ? null : Number(r.deleted_at),
})

export function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const t = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ')
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

function cleanTitle(title: string | undefined): string {
  return (title ?? '').replace(/\s+/g, ' ').trim()
}

/** Maps an item patch onto column/value pairs. */
function itemColumns(patch: ItemPatch): Array<[string, SqlValue]> {
  const cols: Array<[string, SqlValue]> = []
  if (patch.title !== undefined) cols.push(['title', cleanTitle(patch.title) || 'Untitled desire'])
  if (patch.notes !== undefined) cols.push(['notes', patch.notes])
  if (patch.description !== undefined) cols.push(['description', patch.description.trim()])
  if (patch.url !== undefined) cols.push(['url', patch.url?.trim() || null])
  if (patch.imageUri !== undefined) cols.push(['image_uri', patch.imageUri])
  if (patch.imageAspect !== undefined) cols.push(['image_aspect', patch.imageAspect])
  if (patch.status !== undefined) cols.push(['status', patch.status])
  if (patch.categoryId !== undefined) cols.push(['category_id', patch.categoryId])
  if (patch.tags !== undefined) cols.push(['tags', JSON.stringify(cleanTags(patch.tags))])
  if (patch.meta !== undefined) cols.push(['meta', JSON.stringify(patch.meta)])
  if (patch.enrichState !== undefined) cols.push(['enrich_state', patch.enrichState])
  if (patch.deletedAt !== undefined) cols.push(['deleted_at', patch.deletedAt])
  return cols
}

export interface Backup {
  format: 'ethereal-backup'
  version: 1
  exportedAt: string
  categories: Category[]
  items: Item[]
  settings: Record<string, string>
}

export class Repo {
  constructor(private readonly driver: SqlDriver) {}

  /** Creates or upgrades the schema and seeds the default categories on first launch. */
  async init(now = Date.now()): Promise<{ seeded: boolean }> {
    await migrate(this.driver)
    if ((await this.getSetting('seeded')) === '1') return { seeded: false }
    const count = await this.driver.first<{ n: number }>('SELECT COUNT(*) AS n FROM categories')
    await this.driver.transaction(async () => {
      if (!count || Number(count.n) === 0) {
        for (const [i, top] of DEFAULT_TAXONOMY.entries()) {
          const parentId = uid()
          await this.insertCategory({ id: parentId, parentId: null, name: top.name, kind: top.kind, position: i, now })
          for (const [j, name] of top.children.entries()) {
            await this.insertCategory({ id: uid(), parentId, name, kind: null, position: j, now })
          }
        }
      }
      await this.putSetting('seeded', '1')
    })
    return { seeded: true }
  }

  /* ---------------------------------------------------------------------------------------
   * Categories
   * ------------------------------------------------------------------------------------- */

  async listCategories(): Promise<Category[]> {
    const rows = await this.driver.all<CategoryRow>('SELECT * FROM categories ORDER BY position, created_at')
    return rows.map(toCategory)
  }

  private async insertCategory(c: {
    id: string
    parentId: string | null
    name: string
    kind: CategoryKind | null
    position: number
    now: number
  }) {
    await this.driver.run(
      'INSERT INTO categories (id, parent_id, name, kind, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [c.id, c.parentId, c.name, c.kind, c.position, c.now, c.now],
    )
  }

  async createCategory(name: string, parentId: string | null, now = Date.now()): Promise<Category> {
    const clean = cleanTitle(name)
    if (!clean) throw new Error('A category needs a name')
    const id = uid()
    await this.driver.transaction(async () => {
      if (parentId) {
        const parent = await this.driver.first<{ id: string }>('SELECT id FROM categories WHERE id = ?', [parentId])
        if (!parent) throw new Error('That category no longer exists')
      }
      const max = await this.driver.first<{ m: number | null }>(
        'SELECT MAX(position) AS m FROM categories WHERE parent_id IS ?',
        [parentId],
      )
      const position = max?.m == null ? 0 : Number(max.m) + 1
      await this.insertCategory({ id, parentId, name: clean, kind: null, position, now })
    })
    return (await this.getCategory(id))!
  }

  async getCategory(id: string): Promise<Category | null> {
    const row = await this.driver.first<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id])
    return row ? toCategory(row) : null
  }

  async renameCategory(id: string, name: string, now = Date.now()): Promise<void> {
    const clean = cleanTitle(name)
    if (!clean) throw new Error('A category needs a name')
    await this.driver.transaction(() =>
      this.driver.run('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?', [clean, now, id]),
    )
  }

  /** Persists a new sibling order. `orderedIds` must be the full list of siblings. */
  async reorderCategories(orderedIds: string[], now = Date.now()): Promise<void> {
    await this.driver.transaction(async () => {
      for (const [i, id] of orderedIds.entries()) {
        await this.driver.run('UPDATE categories SET position = ?, updated_at = ? WHERE id = ?', [i, now, id])
      }
    })
  }

  /** Re-parents a category (appending it to its new siblings). Refuses to create a cycle. */
  async moveCategory(id: string, newParentId: string | null, now = Date.now()): Promise<void> {
    await this.driver.transaction(async () => {
      const all = (await this.driver.all<CategoryRow>('SELECT * FROM categories')).map(toCategory)
      if (newParentId && subtreeIds(all, id).has(newParentId)) {
        throw new Error("A category can't live inside itself")
      }
      const max = await this.driver.first<{ m: number | null }>(
        'SELECT MAX(position) AS m FROM categories WHERE parent_id IS ? AND id != ?',
        [newParentId, id],
      )
      const position = max?.m == null ? 0 : Number(max.m) + 1
      await this.driver.run('UPDATE categories SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?', [
        newParentId,
        position,
        now,
        id,
      ])
    })
  }

  /**
   * Deletes a category and all of its sub-categories. Nothing the user saved is lost: items
   * filed anywhere in that branch move up to the deleted category's parent (or to "Unsorted"
   * for a top-level category).
   */
  async deleteCategory(id: string, now = Date.now()): Promise<{ removedIds: string[]; movedItems: number }> {
    let removedIds: string[] = []
    let movedItems = 0
    await this.driver.transaction(async () => {
      const all = (await this.driver.all<CategoryRow>('SELECT * FROM categories')).map(toCategory)
      const target = all.find((c) => c.id === id)
      if (!target) return
      removedIds = [...subtreeIds(all, id)]
      const marks = removedIds.map(() => '?').join(',')
      const moved = await this.driver.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM items WHERE category_id IN (${marks})`,
        removedIds,
      )
      movedItems = Number(moved?.n ?? 0)
      await this.driver.run(`UPDATE items SET category_id = ?, updated_at = ? WHERE category_id IN (${marks})`, [
        target.parentId,
        now,
        ...removedIds,
      ])
      await this.driver.run(`DELETE FROM categories WHERE id IN (${marks})`, removedIds)
      // Close the gap in the remaining siblings' order.
      const siblings = all
        .filter((c) => c.parentId === target.parentId && c.id !== id)
        .sort((a, b) => a.position - b.position)
      for (const [i, s] of siblings.entries()) {
        if (s.position !== i) await this.driver.run('UPDATE categories SET position = ? WHERE id = ?', [i, s.id])
      }
    })
    return { removedIds, movedItems }
  }

  /* ---------------------------------------------------------------------------------------
   * Items
   * ------------------------------------------------------------------------------------- */

  /** Live items, newest first. Items in the undo window are left out. */
  async listItems(): Promise<Item[]> {
    const rows = await this.driver.all<ItemRow>(
      'SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC',
    )
    return rows.map(toItem)
  }

  async getItem(id: string): Promise<Item | null> {
    const row = await this.driver.first<ItemRow>('SELECT * FROM items WHERE id = ?', [id])
    return row ? toItem(row) : null
  }

  /** Builds the full record without touching the database (lets the UI show it instantly). */
  buildItem(draft: ItemDraft, now = Date.now()): Item {
    return {
      id: draft.id ?? uid(),
      title: cleanTitle(draft.title) || 'Untitled desire',
      notes: draft.notes ?? '',
      description: draft.description?.trim() ?? '',
      url: draft.url?.trim() || null,
      imageUri: draft.imageUri ?? null,
      imageAspect: draft.imageAspect ?? null,
      status: draft.status ?? 'dreaming',
      categoryId: draft.categoryId ?? null,
      tags: cleanTags(draft.tags),
      meta: draft.meta ?? {},
      enrichState: draft.enrichState ?? 'none',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
  }

  async insertItem(item: Item): Promise<void> {
    await this.driver.transaction(() =>
      this.driver.run(
        `INSERT INTO items (id, title, notes, description, url, image_uri, image_aspect, status, category_id,
           tags, meta, enrich_state, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.title,
          item.notes,
          item.description,
          item.url,
          item.imageUri,
          item.imageAspect,
          item.status,
          item.categoryId,
          JSON.stringify(item.tags),
          JSON.stringify(item.meta),
          item.enrichState,
          item.createdAt,
          item.updatedAt,
          item.deletedAt,
        ],
      ),
    )
  }

  async createItem(draft: ItemDraft, now = Date.now()): Promise<Item> {
    const item = this.buildItem(draft, now)
    await this.insertItem(item)
    return item
  }

  async updateItem(id: string, patch: ItemPatch, now = Date.now()): Promise<void> {
    const cols = itemColumns(patch)
    if (!cols.length) return
    cols.push(['updated_at', patch.updatedAt ?? now])
    await this.driver.transaction(() =>
      this.driver.run(`UPDATE items SET ${cols.map(([c]) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...cols.map(([, v]) => v),
        id,
      ]),
    )
  }

  /** Step one of delete: hide the item, keeping it restorable for the undo window. */
  async softDeleteItem(id: string, now = Date.now()): Promise<void> {
    await this.driver.transaction(() =>
      this.driver.run('UPDATE items SET deleted_at = ? WHERE id = ?', [now, id]),
    )
  }

  async restoreItem(id: string): Promise<void> {
    await this.driver.transaction(() => this.driver.run('UPDATE items SET deleted_at = NULL WHERE id = ?', [id]))
  }

  /**
   * Step two: permanently remove items whose undo window has closed. Returns them so the
   * caller can delete their local image files too.
   */
  async purgeDeleted(olderThan: number): Promise<Item[]> {
    let purged: Item[] = []
    await this.driver.transaction(async () => {
      purged = (
        await this.driver.all<ItemRow>('SELECT * FROM items WHERE deleted_at IS NOT NULL AND deleted_at <= ?', [
          olderThan,
        ])
      ).map(toItem)
      if (purged.length) {
        await this.driver.run('DELETE FROM items WHERE deleted_at IS NOT NULL AND deleted_at <= ?', [olderThan])
      }
    })
    return purged
  }

  /** Every image a live or undo-able item still points at (for orphan clean-up). */
  async referencedImages(): Promise<Set<string>> {
    const rows = await this.driver.all<{ image_uri: string }>(
      'SELECT image_uri FROM items WHERE image_uri IS NOT NULL',
    )
    return new Set(rows.map((r) => r.image_uri))
  }

  /* ---------------------------------------------------------------------------------------
   * Settings (key/value)
   * ------------------------------------------------------------------------------------- */

  async getSetting(key: string): Promise<string | null> {
    const row = await this.driver.first<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])
    return row?.value ?? null
  }

  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.driver.all<{ key: string; value: string }>('SELECT key, value FROM kv')
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }

  private putSetting(key: string, value: string) {
    return this.driver.run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
      key,
      value,
    ])
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.driver.transaction(() => this.putSetting(key, value))
  }

  /* ---------------------------------------------------------------------------------------
   * Backup
   * ------------------------------------------------------------------------------------- */

  async exportAll(now = new Date()): Promise<Backup> {
    const settings = await this.getSettings()
    delete settings.seeded
    return {
      format: 'ethereal-backup',
      version: 1,
      exportedAt: now.toISOString(),
      categories: await this.listCategories(),
      items: await this.listItems(),
      settings,
    }
  }

  /** Replaces everything with the backup's contents. */
  async importAll(raw: unknown): Promise<{ categories: number; items: number }> {
    const backup = raw as Partial<Backup>
    if (!backup || backup.format !== 'ethereal-backup' || !Array.isArray(backup.categories) || !Array.isArray(backup.items)) {
      throw new Error("That file isn't an Ethereal backup")
    }
    const categories = backup.categories
    const items = backup.items
    await this.driver.transaction(async () => {
      await this.driver.run('DELETE FROM items')
      await this.driver.run('DELETE FROM categories')
      for (const c of categories) {
        await this.insertCategory({
          id: c.id,
          parentId: c.parentId ?? null,
          name: cleanTitle(c.name) || 'Untitled',
          kind: c.kind ?? null,
          position: Number(c.position) || 0,
          now: Number(c.createdAt) || Date.now(),
        })
      }
      for (const i of items) {
        const item = this.buildItem({ ...i, title: i.title }, Number(i.createdAt) || Date.now())
        await this.driver.run(
          `INSERT INTO items (id, title, notes, description, url, image_uri, image_aspect, status, category_id,
             tags, meta, enrich_state, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            item.id,
            item.title,
            item.notes,
            item.description,
            item.url,
            item.imageUri,
            item.imageAspect,
            item.status,
            item.categoryId,
            JSON.stringify(item.tags),
            JSON.stringify(item.meta),
            item.enrichState === 'pending' ? 'none' : item.enrichState,
            item.createdAt,
            Number(i.updatedAt) || item.createdAt,
          ],
        )
      }
      for (const [k, v] of Object.entries(backup.settings ?? {})) {
        if (typeof v === 'string' && k !== 'seeded') await this.putSetting(k, v)
      }
      await this.putSetting('seeded', '1')
    })
    return { categories: categories.length, items: items.length }
  }
}

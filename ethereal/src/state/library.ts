/**
 * The app's data in memory, plus every action that changes it.
 *
 * Writes are optimistic: memory updates first (so the UI answers in the same frame), then the
 * change is written to SQLite. If a write ever fails, memory is reloaded from the database and
 * the user sees a quiet toast.
 */
import { Platform } from 'react-native'
import { openDriver } from '../db/openDriver'
import { Repo, type Backup } from '../db/repo'
import type { Category, Item, ItemDraft, ItemPatch } from '../db/types'
import { lookup, mergeEnrichment, shouldAutoEnrich, type Enrichment } from '../enrich'
import { HttpError } from '../enrich/http'
import {
  cleanOrphans,
  deleteLocalImage,
  downloadImage,
  isLocal,
  readLocalBase64,
  saveLocalImage,
  writeLocalBase64,
} from '../images/store'
import { rootOf, sortByPosition } from '../lib/tree'
import { createStore } from './createStore'
import { showToast } from './ui'

export const UNDO_MS = 5000

export interface Settings {
  /** Look things up online when connected. */
  enrich: boolean
}

interface LibraryState {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  categories: Category[]
  items: Item[]
  settings: Settings
  online: boolean
  /** Items with a lookup running right now (drives the shimmer). */
  enriching: Record<string, true>
}

export const library = createStore<LibraryState>({
  status: 'loading',
  error: null,
  categories: [],
  items: [],
  settings: { enrich: true },
  online: true,
  enriching: {},
})

let repo: Repo | null = null
const r = () => {
  if (!repo) throw new Error('The library is still opening')
  return repo
}

/* -------------------------------------------------------------------------------------------
 * Boot
 * ----------------------------------------------------------------------------------------- */

async function reload() {
  const [categories, items, raw] = await Promise.all([r().listCategories(), r().listItems(), r().getSettings()])
  library.set({ categories, items, settings: { enrich: raw.enrich !== 'off' } })
}

export async function boot() {
  try {
    const driver = await openDriver()
    repo = new Repo(driver)
    await repo.init()
    // Anything left in the undo window by a previous session is gone for good now.
    const purged = await repo.purgeDeleted(Date.now())
    await Promise.all(purged.map((i) => deleteLocalImage(i.imageUri)))
    await reload()
    library.set({ status: 'ready' })
    driver.onExternalChange?.(() => void reload())
    if (Platform.OS === 'web') void navigator.storage?.persist?.().catch(() => undefined)
    // Housekeeping, off the critical path.
    setTimeout(() => {
      void repo
        ?.referencedImages()
        .then(cleanOrphans)
        .catch(() => undefined)
      void processPending()
    }, 1500)
  } catch (err) {
    library.set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

async function persist(label: string, write: () => Promise<unknown>) {
  try {
    await write()
  } catch (err) {
    console.warn(`[ethereal] ${label} failed`, err)
    showToast(err instanceof Error && err.message.length < 80 ? err.message : 'That change could not be saved')
    await reload().catch(() => undefined)
  }
}

/* -------------------------------------------------------------------------------------------
 * Items
 * ----------------------------------------------------------------------------------------- */

const patchInMemory = (id: string, patch: ItemPatch) =>
  library.set((s) => ({
    items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: patch.updatedAt ?? Date.now() } : i)),
  }))

export interface PickedImage {
  uri: string
  width: number
  height: number
}

export function addItem(draft: ItemDraft, image?: PickedImage | null, prefetched?: Enrichment | null): Item {
  let item = r().buildItem({
    ...draft,
    imageUri: image?.uri ?? draft.imageUri ?? null,
    imageAspect: image ? image.width / Math.max(1, image.height) : (draft.imageAspect ?? null),
  })
  const kind = rootOf(library.get().categories, item.categoryId)?.kind ?? null
  if (prefetched) {
    // The add sheet already previewed this link: use it, no second lookup.
    item = { ...item, ...mergeEnrichment(item, prefetched) } as Item
  } else if (library.get().settings.enrich && shouldAutoEnrich({ title: item.title, url: item.url, kind })) {
    // Lookups fill gaps only, so a photo of your own is never replaced, but a link still brings
    // its description and details.
    item.enrichState = 'pending'
  }

  library.set((s) => ({ items: [item, ...s.items] }))
  void persist('Saving', async () => {
    await r().insertItem(item)
    if (image) {
      // Copy the picked photo into the app's own storage; the picker's file is temporary.
      const stored = await saveLocalImage(image.uri, image.width, image.height)
      await updateItem(item.id, { imageUri: stored.uri, imageAspect: stored.aspect })
    }
  }).then(() => {
    if (item.enrichState === 'pending') void enrich(item.id)
    else if (item.imageUri && !image && !isLocal(item.imageUri)) void cacheImage(item.id, item.imageUri)
  })
  return item
}

export function updateItem(id: string, patch: ItemPatch): Promise<void> {
  patchInMemory(id, patch)
  return persist('Saving', () => r().updateItem(id, patch))
}

/** Swaps an item's image for a newly picked photo. */
export async function setItemPhoto(id: string, image: PickedImage | null) {
  const before = library.get().items.find((i) => i.id === id)
  const meta = { ...before?.meta }
  delete meta.remoteImageUrl
  if (!image) {
    await updateItem(id, { imageUri: null, imageAspect: null, meta })
  } else {
    patchInMemory(id, { imageUri: image.uri, imageAspect: image.width / Math.max(1, image.height) })
    await persist('Saving photo', async () => {
      const stored = await saveLocalImage(image.uri, image.width, image.height)
      await updateItem(id, { imageUri: stored.uri, imageAspect: stored.aspect, meta })
    })
  }
  if (isLocal(before?.imageUri)) void deleteLocalImage(before!.imageUri)
}

const purgeTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** One-tap delete: the item disappears at once and can be brought back for five seconds. */
export function deleteItem(id: string) {
  const item = library.get().items.find((i) => i.id === id)
  if (!item) return
  library.set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  const deletedAt = Date.now()
  void persist('Deleting', () => r().softDeleteItem(id, deletedAt))
  showToast('Released from your horizon', {
    actionLabel: 'Undo',
    duration: UNDO_MS,
    onAction: () => void undoDelete(item),
  })
  purgeTimers.set(
    id,
    setTimeout(() => {
      purgeTimers.delete(id)
      void persist('Deleting', async () => {
        const purged = await r().purgeDeleted(deletedAt)
        await Promise.all(purged.map((p) => deleteLocalImage(p.imageUri)))
      })
    }, UNDO_MS + 300),
  )
}

async function undoDelete(item: Item) {
  const t = purgeTimers.get(item.id)
  if (t) clearTimeout(t)
  purgeTimers.delete(item.id)
  library.set((s) => ({
    items: [item, ...s.items.filter((i) => i.id !== item.id)].sort((a, b) => b.createdAt - a.createdAt),
  }))
  await persist('Restoring', () => r().restoreItem(item.id))
}

/* -------------------------------------------------------------------------------------------
 * Enrichment
 * ----------------------------------------------------------------------------------------- */

const inFlight = new Set<string>()

/** Looks an item up online and fills in what's missing. Offline, it waits for the network. */
export async function enrich(id: string, { manual = false } = {}): Promise<'done' | 'none' | 'offline' | 'failed'> {
  const state = library.get()
  const item = state.items.find((i) => i.id === id)
  if (!item || inFlight.has(id)) return 'none'
  if (!state.online) return 'offline'
  if (!manual && !state.settings.enrich) return 'none'
  inFlight.add(id)
  library.set((st) => ({ enriching: { ...st.enriching, [id]: true } }))
  if (item.enrichState !== 'pending') patchInMemory(id, { enrichState: 'pending' })
  try {
    const kind = rootOf(state.categories, item.categoryId)?.kind ?? null
    const found = await lookup(
      { title: item.title, url: item.url, kind, manual },
      { viaProxy: Platform.OS === 'web' },
    )
    const current = library.get().items.find((i) => i.id === id)
    if (!current) return 'none'
    if (!found) {
      await updateItem(id, { enrichState: 'done' })
      return 'none'
    }
    const patch = mergeEnrichment(current, found, { replace: manual })
    await updateItem(id, patch)
    // Keep a copy of the image on the device, so it shows offline.
    if (patch.imageUri && !isLocal(patch.imageUri)) void cacheImage(id, patch.imageUri)
    return 'done'
  } catch (err) {
    // Network trouble or a busy API (429): try again on the next launch or reconnect.
    // Any other refusal (404, 403…) won't change by retrying.
    const transient = !(err instanceof HttpError) || err.status === 429 || err.status >= 500
    await updateItem(id, { enrichState: transient ? 'pending' : 'failed' })
    return !library.get().online ? 'offline' : 'failed'
  } finally {
    inFlight.delete(id)
    library.set((st) => {
      const { [id]: _, ...rest } = st.enriching
      return { enriching: rest }
    })
  }
}

async function cacheImage(id: string, url: string) {
  const stored = await downloadImage(url)
  if (!stored) return
  const item = library.get().items.find((i) => i.id === id)
  if (!item || item.imageUri !== url) {
    await deleteLocalImage(stored.uri)
    return
  }
  await updateItem(id, {
    imageUri: stored.uri,
    imageAspect: stored.aspect,
    meta: { ...item.meta, remoteImageUrl: url },
  })
}

/** Runs lookups that were queued while offline. */
export async function processPending() {
  const pending = library.get().items.filter((i) => i.enrichState === 'pending')
  for (const item of pending) {
    if (!library.get().online) return
    await enrich(item.id)
  }
}

export function setOnline(online: boolean) {
  const was = library.get().online
  library.set({ online })
  if (online && !was && library.get().status === 'ready') void processPending()
}

/* -------------------------------------------------------------------------------------------
 * Categories
 * ----------------------------------------------------------------------------------------- */

export async function createCategory(name: string, parentId: string | null): Promise<Category | null> {
  try {
    const cat = await r().createCategory(name, parentId)
    library.set((s) => ({ categories: [...s.categories, cat] }))
    return cat
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not add that category')
    return null
  }
}

export function renameCategory(id: string, name: string) {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) return
  library.set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, name: clean } : c)) }))
  void persist('Renaming', () => r().renameCategory(id, clean))
}

export function reorderCategories(orderedIds: string[]) {
  const pos = new Map(orderedIds.map((id, i) => [id, i]))
  library.set((s) => ({
    categories: s.categories.map((c) => (pos.has(c.id) ? { ...c, position: pos.get(c.id)! } : c)),
  }))
  void persist('Reordering', () => r().reorderCategories(orderedIds))
}

export async function moveCategory(id: string, newParentId: string | null) {
  await persist('Moving', async () => {
    await r().moveCategory(id, newParentId)
    await reload()
  })
}

export async function deleteCategory(id: string) {
  const res = await r().deleteCategory(id)
  await reload()
  return res
}

/* -------------------------------------------------------------------------------------------
 * Settings & backup
 * ----------------------------------------------------------------------------------------- */

export function setEnrich(enabled: boolean) {
  library.set((s) => ({ settings: { ...s.settings, enrich: enabled } }))
  void persist('Saving', () => r().setSetting('enrich', enabled ? 'on' : 'off'))
  if (enabled) void processPending()
}

/** Everything, photos included, as one JSON document. */
export async function exportBackup(): Promise<Backup & { images: Record<string, string> }> {
  const backup = await r().exportAll()
  const images: Record<string, string> = {}
  for (const item of backup.items) {
    if (isLocal(item.imageUri) && !images[item.imageUri]) {
      const data = await readLocalBase64(item.imageUri).catch(() => null)
      if (data) images[item.imageUri] = data
    }
  }
  return { ...backup, images }
}

export async function importBackup(data: unknown) {
  const res = await r().importAll(data)
  const images = (data as { images?: Record<string, unknown> }).images ?? {}
  for (const [uri, b64] of Object.entries(images)) {
    if (isLocal(uri) && typeof b64 === 'string' && /^[\w-]+\.jpg$/.test(uri.slice(6))) {
      await writeLocalBase64(uri, b64).catch(() => undefined)
    }
  }
  await reload()
  return res
}

/* -------------------------------------------------------------------------------------------
 * Selectors
 * ----------------------------------------------------------------------------------------- */

export const topCategories = (cats: Category[]) => sortByPosition(cats.filter((c) => c.parentId === null))

/** Live preview for a pasted link in the add sheet (null offline or with lookups off). */
export async function previewLink(url: string, signal?: AbortSignal): Promise<Enrichment | null> {
  const s = library.get()
  if (!s.online || !s.settings.enrich) return null
  return lookup({ title: '', url, kind: null }, { viaProxy: Platform.OS === 'web', signal })
}

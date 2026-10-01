import { create } from 'zustand'
import type { BookDraft, BookStatus, SeriesStatus } from '../db/types'
import { uid } from '../lib/utils'

export type Tab = 'shelves' | 'series' | 'search' | 'categories' | 'settings'
export const TABS: Tab[] = ['shelves', 'series', 'search', 'categories', 'settings']

export type StatusFilter = 'all' | BookStatus
export type SeriesFilter = 'all' | SeriesStatus

/** Context for adding books into a specific series ("Add volume"). */
export interface SeriesTarget {
  seriesId: string
  seriesIndex?: number
}

/**
 * Bottom sheets are a stack, so any sheet can open another on top (e.g. Book form ->
 * Category manager) without losing the current view — "inline" management.
 */
export type SheetSpec =
  | { kind: 'add'; query?: string; target?: SeriesTarget }
  | { kind: 'book'; id: string }
  | { kind: 'book-form'; id?: string; prefill?: Partial<BookDraft>; target?: SeriesTarget }
  | { kind: 'book-actions'; id: string }
  | { kind: 'series'; id: string }
  | { kind: 'series-form'; id?: string; prefill?: { title?: string; authors?: string[] } }
  | { kind: 'categories' }
  | { kind: 'filters' }
  | { kind: 'batch-status' }
  | { kind: 'batch-category' }
  | { kind: 'batch-shelves' }
  | { kind: 'restore-snapshot' }

export type Sheet = SheetSpec & { key: string; closing?: boolean }

/** Matches the sheet slide-out transition. */
export const SHEET_EXIT_MS = 200

export interface ToastSpec {
  id: string
  message: string
  tone?: 'default' | 'success' | 'warning' | 'error'
  action?: { label: string; run: () => void }
  duration?: number
}

export interface ConfirmSpec {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  resolve: (ok: boolean) => void
}

export interface ShelfFilters {
  status: StatusFilter
  categoryId?: string
  subCategoryId?: string
  shelfId?: string
}

interface UIState {
  tab: Tab
  setTab: (tab: Tab) => void

  sheets: Sheet[]
  openSheet: (spec: SheetSpec) => string
  closeSheet: (key?: string) => void
  replaceSheet: (key: string, spec: SheetSpec) => void
  closeAllSheets: () => void

  filters: ShelfFilters
  setFilters: (patch: Partial<ShelfFilters>) => void
  resetFilters: () => void
  seriesFilter: SeriesFilter
  setSeriesFilter: (f: SeriesFilter) => void

  selecting: boolean
  selected: string[]
  startSelecting: (initial?: string) => void
  toggleSelected: (id: string) => void
  setSelected: (ids: string[]) => void
  stopSelecting: () => void

  toasts: ToastSpec[]
  toast: (t: Omit<ToastSpec, 'id'>) => string
  dismissToast: (id: string) => void

  confirmSpec: ConfirmSpec | null
  confirm: (spec: Omit<ConfirmSpec, 'resolve'>) => Promise<boolean>
  settleConfirm: (ok: boolean) => void
}

function initialTab(): Tab {
  if (typeof location === 'undefined') return 'shelves'
  const fromUrl = new URLSearchParams(location.search).get('tab') as Tab | null
  if (fromUrl && TABS.includes(fromUrl)) return fromUrl
  try {
    const saved = sessionStorage.getItem('dream-bookshelf:tab') as Tab | null
    if (saved && TABS.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return 'shelves'
}

export const useUI = create<UIState>()((set, get) => ({
  tab: initialTab(),
  setTab: (tab) => {
    try {
      sessionStorage.setItem('dream-bookshelf:tab', tab)
    } catch {
      /* ignore */
    }
    set({ tab })
  },

  sheets: [],
  openSheet: (spec) => {
    const key = uid()
    set((s) => ({ sheets: [...s.sheets, { ...spec, key }] }))
    return key
  },
  closeSheet: (key) => {
    const target = key ?? get().sheets.filter((sh) => !sh.closing).at(-1)?.key
    if (!target) return
    // Mark as closing so the sheet can animate out, then drop it from the stack.
    set((s) => ({ sheets: s.sheets.map((sh) => (sh.key === target ? { ...sh, closing: true } : sh)) }))
    setTimeout(() => set((s) => ({ sheets: s.sheets.filter((sh) => sh.key !== target) })), SHEET_EXIT_MS)
  },
  replaceSheet: (key, spec) =>
    set((s) => ({ sheets: s.sheets.map((sh) => (sh.key === key ? { ...spec, key } : sh)) })),
  closeAllSheets: () => {
    set((s) => ({ sheets: s.sheets.map((sh) => ({ ...sh, closing: true })) }))
    setTimeout(() => set((s) => ({ sheets: s.sheets.filter((sh) => !sh.closing) })), SHEET_EXIT_MS)
  },

  filters: { status: 'all' },
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set((s) => ({ filters: { status: s.filters.status } })),
  seriesFilter: 'all',
  setSeriesFilter: (seriesFilter) => set({ seriesFilter }),

  selecting: false,
  selected: [],
  startSelecting: (initial) => set({ selecting: true, selected: initial ? [initial] : [] }),
  toggleSelected: (id) =>
    set((s) => ({
      selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id],
    })),
  setSelected: (selected) => set({ selected }),
  stopSelecting: () => set({ selecting: false, selected: [] }),

  toasts: [],
  toast: (t) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  confirmSpec: null,
  confirm: (spec) =>
    new Promise<boolean>((resolve) => {
      get().confirmSpec?.resolve(false)
      set({ confirmSpec: { ...spec, resolve } })
    }),
  settleConfirm: (ok) => {
    const spec = get().confirmSpec
    set({ confirmSpec: null })
    spec?.resolve(ok)
  },
}))

/** Imperative helpers usable outside React components. */
export const ui = {
  toast: (t: Omit<ToastSpec, 'id'>) => useUI.getState().toast(t),
  open: (spec: SheetSpec) => useUI.getState().openSheet(spec),
  confirm: (spec: Omit<ConfirmSpec, 'resolve'>) => useUI.getState().confirm(spec),
}

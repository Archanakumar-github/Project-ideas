/** Transient UI state: which sheet is open, toasts, the browsing position. Never persisted. */
import { createStore } from './createStore'

export type SheetSpec =
  | { type: 'add' }
  | { type: 'item'; itemId: string; focus?: 'title' | 'notes' }
  | { type: 'actions'; itemId: string }
  | { type: 'recategorize'; itemId: string }
  | { type: 'categories'; parentId?: string | null }
  | { type: 'categoryActions'; categoryId: string }
  | { type: 'settings' }

export type Sheet = SheetSpec & { key: number }

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  /** ms; undo toasts stay exactly 5 seconds. */
  duration: number
}

interface UiState {
  sheets: Sheet[]
  toast: Toast | null
  /** null = "All"; otherwise a top-level category. */
  activeRootId: string | null
  /** A sub-category (at any depth) inside the active root, or null for the whole root. */
  focusId: string | null
}

export const ui = createStore<UiState>({
  sheets: [],
  toast: null,
  activeRootId: null,
  focusId: null,
})

let sheetSeq = 0

export function openSheet(sheet: SheetSpec) {
  ui.set((s) => ({ sheets: [...s.sheets, { ...sheet, key: ++sheetSeq }] }))
}

/** Replaces the top sheet (e.g. quick actions → item view) in place. */
export function replaceSheet(sheet: SheetSpec) {
  ui.set((s) => ({ sheets: [...s.sheets.slice(0, -1), { ...sheet, key: ++sheetSeq }] }))
}

export function closeSheet(key?: number) {
  ui.set((s) => ({ sheets: key === undefined ? s.sheets.slice(0, -1) : s.sheets.filter((x) => x.key !== key) }))
}

let toastSeq = 0
let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, opts: { actionLabel?: string; onAction?: () => void; duration?: number } = {}) {
  const toast: Toast = { id: ++toastSeq, message, duration: opts.duration ?? 2600, ...opts }
  if (toastTimer) clearTimeout(toastTimer)
  ui.set({ toast })
  toastTimer = setTimeout(() => {
    if (ui.get().toast?.id === toast.id) ui.set({ toast: null })
  }, toast.duration)
  return toast.id
}

export function dismissToast(id?: number) {
  if (id === undefined || ui.get().toast?.id === id) ui.set({ toast: null })
}

export function setBrowse(activeRootId: string | null, focusId: string | null = null) {
  ui.set({ activeRootId, focusId })
}

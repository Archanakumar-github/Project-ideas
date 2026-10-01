import { create } from 'zustand'
import type { ISODate } from '../lib/dates'
import type { MealSection } from '../types'

export const TABS = ['today', 'diet', 'train', 'progress', 'journal'] as const
export type Tab = (typeof TABS)[number]

export type Sheet =
  | { kind: 'quickAdd'; date: ISODate; section: MealSection }
  | { kind: 'meal'; date: ISODate; plannedId: string }
  | { kind: 'weekPlan' }
  | { kind: 'grocery' }
  | { kind: 'program' }
  | { kind: 'swapExercise'; date: ISODate; sessionId: string; exerciseUid: string }
  | { kind: 'exerciseInfo'; exerciseId: string }
  | { kind: 'logWeight'; date: ISODate }
  | { kind: 'logMeasurements'; date: ISODate }
  | { kind: 'journalEntry'; id?: string; date?: ISODate }
  | { kind: 'settings'; section?: 'profile' | 'security' | 'data' | 'coach' }
  | { kind: 'coach'; prompt?: string }
  | { kind: 'profileSource' }

export interface Toast {
  id: number
  message: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'default' | 'error'
}

export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface UIState {
  tab: Tab
  sheets: Sheet[]
  toasts: Toast[]
  confirm?: ConfirmRequest
  dietDate?: ISODate
  setTab: (tab: Tab) => void
  openSheet: (sheet: Sheet) => void
  closeSheet: () => void
  closeAllSheets: () => void
  toast: (t: Omit<Toast, 'id'> | string) => void
  dismissToast: (id: number) => void
  setDietDate: (date: ISODate | undefined) => void
}

let toastId = 0

export const useUI = create<UIState>((set) => ({
  tab: 'today',
  sheets: [],
  toasts: [],
  setTab: (tab) => set({ tab }),
  openSheet: (sheet) => set((s) => ({ sheets: [...s.sheets, sheet] })),
  closeSheet: () => set((s) => ({ sheets: s.sheets.slice(0, -1) })),
  closeAllSheets: () => set({ sheets: [] }),
  toast: (t) => {
    const toast: Toast = typeof t === 'string' ? { id: ++toastId, message: t } : { ...t, id: ++toastId }
    set((s) => ({ toasts: [...s.toasts.slice(-1), toast] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== toast.id) })), toast.onAction ? 4000 : 2200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setDietDate: (dietDate) => set({ dietDate }),
}))

export function confirmDialog(req: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.setState({
      confirm: {
        ...req,
        resolve: (ok) => {
          useUI.setState({ confirm: undefined })
          resolve(ok)
        },
      },
    })
  })
}

export const toast = (t: Omit<Toast, 'id'> | string) => useUI.getState().toast(t)
export const openSheet = (s: Sheet) => useUI.getState().openSheet(s)
export const closeSheet = () => useUI.getState().closeSheet()

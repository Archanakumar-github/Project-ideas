import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BookStatus } from '../db/types'

export type SortKey = 'recent' | 'title' | 'author' | 'year' | 'price' | 'series'
export type ViewMode = 'grid' | 'list'

export interface Settings {
  /** Master switch for any network metadata lookups (privacy). */
  onlineLookups: boolean
  /** Query Google Books when Open Library has nothing (or fails). */
  googleFallback: boolean
  /** Optional: anonymous Google Books quota is shared and easily exhausted. */
  googleApiKey: string
  /** Download covers into IndexedDB so they survive offline and cache eviction. */
  cacheCovers: boolean
  currency: string
  sort: SortKey
  view: ViewMode
  showSeriesVolumes: boolean
  /** Remembered so the 3-second quick-add flow usually needs zero extra taps. */
  lastStatus: BookStatus
  lastCategoryId?: string
  lastSubCategoryId?: string
  /** Epoch ms of the last JSON export, to nudge occasional backups. */
  lastExportAt?: number
}

export const DEFAULT_SETTINGS: Settings = {
  onlineLookups: true,
  googleFallback: true,
  googleApiKey: '',
  cacheCovers: true,
  currency: guessCurrency(),
  sort: 'recent',
  view: 'grid',
  showSeriesVolumes: true,
  lastStatus: 'want-to-read',
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
  reset: () => void
}

export const SETTINGS_KEY = 'dream-bookshelf:settings'

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _set, reset: _reset, ...rest }) => rest,
    },
  ),
)

export const getSettings = (): Settings => useSettings.getState()

function guessCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    const map: Record<string, string> = {
      US: 'USD', GB: 'GBP', IN: 'INR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY',
      CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', SG: 'SGD', BR: 'BRL', MX: 'MXN', ZA: 'ZAR',
      DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', BE: 'EUR',
      AT: 'EUR', FI: 'EUR', GR: 'EUR',
    }
    return (region && map[region]) || 'USD'
  } catch {
    return 'USD'
  }
}

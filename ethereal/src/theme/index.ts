/**
 * Ethereal's palette: deep indigo night, warm mist, aged parchment, soft gold, lavender haze.
 * Every colour the UI uses comes from here.
 */
import type { ItemStatus } from '../db/types'

export const colors = {
  night: '#0E0F26',
  indigo: '#17183A',
  indigoMid: '#232457',
  indigoSoft: '#30316B',
  dusk: '#2A2350',

  parchment: '#EFE6D2',
  parchmentDim: '#D9CFBA',
  mist: '#B8B3BE',
  mistDim: '#8C8898',
  mistFaint: '#5F5C70',

  gold: '#D9B26F',
  goldSoft: '#E8CC97',
  goldGlow: 'rgba(217, 178, 111, 0.28)',
  lavender: '#B9A8E3',
  lavenderSoft: 'rgba(185, 168, 227, 0.16)',
  rose: '#D99A9A',

  glass: 'rgba(36, 37, 84, 0.42)',
  glassStrong: 'rgba(28, 29, 66, 0.78)',
  glassBorder: 'rgba(239, 230, 210, 0.10)',
  glassBorderStrong: 'rgba(239, 230, 210, 0.18)',
  hairline: 'rgba(239, 230, 210, 0.08)',
  scrim: 'rgba(8, 8, 24, 0.55)',
} as const

export const gradients = {
  sky: ['#0B0C22', '#16173C', '#241F4A', '#2D2448'] as const,
  card: ['rgba(14,15,38,0)', 'rgba(14,15,38,0.15)', 'rgba(14,15,38,0.88)'] as const,
  hero: ['rgba(14,15,38,0)', 'rgba(14,15,38,0.35)', '#0E0F26'] as const,
  goldButton: ['#E8CC97', '#D9B26F', '#C49A55'] as const,
}

export const fonts = {
  serif: 'CormorantGaramond_500Medium',
  serifSemi: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const

export const statusMeta: Record<ItemStatus, { label: string; color: string; hint: string }> = {
  dreaming: { label: 'Dreaming', color: colors.lavender, hint: 'Held softly, not yet pursued' },
  refining: { label: 'Refining', color: colors.goldSoft, hint: 'Taking shape, slowly' },
  manifested: { label: 'Manifested', color: colors.gold, hint: 'Arrived in your life' },
}

/** Soft, spring-y motion used across the app. */
export const springs = {
  gentle: { damping: 18, stiffness: 140, mass: 0.9 },
  snappy: { damping: 20, stiffness: 260, mass: 0.7 },
  sheet: { damping: 26, stiffness: 220, mass: 0.9 },
} as const

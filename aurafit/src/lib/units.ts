/** Everything is stored metric (kg, cm, ml); these helpers convert only at the UI edge. */
export type WeightUnit = 'kg' | 'lb'
export type LengthUnit = 'cm' | 'in'

export const LB_PER_KG = 2.2046226218
export const CM_PER_IN = 2.54

export function kgTo(kg: number, unit: WeightUnit) {
  return unit === 'kg' ? kg : kg * LB_PER_KG
}
export function toKg(value: number, unit: WeightUnit) {
  return unit === 'kg' ? value : value / LB_PER_KG
}
export function cmTo(cm: number, unit: LengthUnit) {
  return unit === 'cm' ? cm : cm / CM_PER_IN
}
export function toCm(value: number, unit: LengthUnit) {
  return unit === 'cm' ? value : value * CM_PER_IN
}

export function fmtWeight(kg: number | undefined, unit: WeightUnit, decimals = 1) {
  if (kg == null || !Number.isFinite(kg)) return '–'
  return `${kgTo(kg, unit).toFixed(decimals).replace(/\.0$/, '')} ${unit}`
}

export function fmtLength(cm: number | undefined, unit: LengthUnit, decimals = 1) {
  if (cm == null || !Number.isFinite(cm)) return '–'
  return `${cmTo(cm, unit).toFixed(decimals).replace(/\.0$/, '')} ${unit}`
}

export function fmtHeight(cm: number, unit: LengthUnit) {
  if (unit === 'cm') return `${Math.round(cm)} cm`
  const totalIn = Math.round(cm / CM_PER_IN)
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`
}

export function fmtMl(ml: number) {
  return ml >= 1000 ? `${parseFloat((ml / 1000).toFixed(2))} L` : `${Math.round(ml)} ml`
}

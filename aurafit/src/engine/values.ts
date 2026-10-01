import { WEEKDAYS, minutesToHHMM, type Weekday } from '../lib/dates'
import { CM_PER_IN, LB_PER_KG } from '../lib/units'

/**
 * Value parsers for free-form Markdown answers ("5'9\"", "158 lbs", "9am–5:30pm",
 * "Mon/Wed/Fri", "2.5 L", "3 meals + 1 snack"...). Each returns undefined when unsure,
 * so the caller can fall back to a default and flag it for review.
 */

const NUM = /-?\d+(?:[.,]\d+)?/

export function isNone(text: string): boolean {
  return /^\s*(none|n\/?a|nil|nothing|no|nope|-+|—|not applicable|no known\b.*|no (allergies|injuries|restrictions)\b.*)\s*\.?\s*$/i.test(text)
}

export function isBlankAnswer(text: string): boolean {
  return (
    !text.trim() ||
    isNone(text) ||
    /^\s*(\?+|tbd|tbc|unknown|not sure|auto|calculate|auto[- ]?calculate|leave blank.*|\(.*(blank|auto).*\))\s*$/i.test(text)
  )
}

/** "1,800" -> 1800, "72,5" -> 72.5, "72.5" -> 72.5 */
export function toNumber(raw: string): number {
  if (/^\d{1,3}(,\d{3})+$/.test(raw)) return Number(raw.replace(/,/g, ''))
  return Number(raw.replace(',', '.'))
}

export function parseNumber(text: string): number | undefined {
  const t = text.replace(/(\d),(\d{3})\b/g, '$1$2')
  const m = NUM.exec(t)
  if (!m) return undefined
  const n = toNumber(m[0])
  return Number.isFinite(n) ? n : undefined
}

/** Numbers like "9k" / "10,000" (for steps). */
export function parseCount(text: string): number | undefined {
  const k = /(\d+(?:\.\d+)?)\s*k\b/i.exec(text)
  if (k) return Math.round(Number(k[1]) * 1000)
  return parseNumber(text)
}

/** Average of a "1800-2000" range, else the first number. */
export function parseRangeMid(text: string): number | undefined {
  const t = text.replace(/(\d),(\d{3})\b/g, '$1$2')
  const m = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)/.exec(t)
  if (m) return (Number(m[1]) + Number(m[2])) / 2
  return parseNumber(t)
}

export function parseWeightKg(text: string, imperial = false): number | undefined {
  const t = text.toLowerCase().replace(/(\d),(\d{3})\b/g, '$1$2')
  const stone = /(\d+(?:\.\d+)?)\s*(?:st|stone)s?\b(?:\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)?)?/.exec(t)
  if (stone) return Number(stone[1]) * 6.35029 + (stone[2] ? Number(stone[2]) / LB_PER_KG : 0)
  const lb = /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?|#)(?![a-z])/.exec(t)
  if (lb) return Number(lb[1]) / LB_PER_KG
  const kg = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/.exec(t)
  if (kg) return toNumber(kg[1])
  const n = parseNumber(t)
  if (n == null) return undefined
  return imperial ? n / LB_PER_KG : n
}

export function parseHeightCm(text: string, imperial = false): number | undefined {
  const t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
  const ftIn = /(\d)\s*(?:'|′|ft|feet|foot)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|''|in|inch|inches)?)?/.exec(t)
  if (ftIn) return Number(ftIn[1]) * 30.48 + (ftIn[2] ? Number(ftIn[2]) * CM_PER_IN : 0)
  const cm = /(\d+(?:[.,]\d+)?)\s*cm\b/.exec(t)
  if (cm) return toNumber(cm[1])
  const m = /(\d(?:[.,]\d+)?)\s*(?:m|meters?|metres?)\b/.exec(t)
  if (m) return toNumber(m[1]) * 100
  const inch = /(\d+(?:\.\d+)?)\s*(?:"|″|in|inch|inches)\b/.exec(t)
  if (inch) return Number(inch[1]) * CM_PER_IN
  const n = parseNumber(t)
  if (n == null) return undefined
  if (n < 3) return n * 100
  if (n < 90 || imperial) return n * CM_PER_IN
  return n
}

/** Body measurements: centimetres unless the text or a unit hint says inches. */
export function parseLengthCm(text: string, hint?: 'cm' | 'in'): number | undefined {
  const t = text.toLowerCase()
  const n = parseNumber(t)
  if (n == null) return undefined
  if (/(\d)\s*(?:"|″|in\b|inch|inches)/.test(t)) return n * CM_PER_IN
  if (/\bcm\b/.test(t)) return n
  return hint === 'in' ? n * CM_PER_IN : n
}

function to24h(h: number, m: number, ampm?: string): number | undefined {
  if (m > 59 || h > 24) return undefined
  const mer = ampm?.replace(/\./g, '').toLowerCase()
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  if (h === 24) h = 0
  return h * 60 + m
}

const TIME_RE = /(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi

/** "6:15", "6.15am", "10 PM", "22:30", "noon" -> "HH:MM". */
export function parseTime(text: string): string | undefined {
  const t = text.toLowerCase()
  if (/\bnoon\b|\bmidday\b/.test(t)) return '12:00'
  if (/\bmidnight\b/.test(t)) return '00:00'
  for (const m of t.matchAll(TIME_RE)) {
    if (!m[2] && !m[3]) continue
    const mins = to24h(Number(m[1]), Number(m[2] ?? 0), m[3])
    if (mins != null) return minutesToHHMM(mins)
  }
  return undefined
}

/** "09:00–17:30", "9am - 5pm", "9-5" -> ["09:00", "17:00"]. */
export function parseTimeRange(text: string): [string, string] | undefined {
  const t = text.toLowerCase()
  const m = /(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/.exec(t)
  if (!m) return undefined
  let a = to24h(Number(m[1]), Number(m[2] ?? 0), m[3] ?? (m[6] && Number(m[1]) <= Number(m[4]) ? m[6] : undefined))
  let b = to24h(Number(m[4]), Number(m[5] ?? 0), m[6])
  if (a == null || b == null) return undefined
  if (!m[3] && !m[6] && b < a && a < 12 * 60) b += 12 * 60
  if (a === b) return undefined
  a = a % 1440
  return [minutesToHHMM(a), minutesToHHMM(b)]
}

const DAY_TOKEN = /\b(mon(?:day)?s?|tue(?:s(?:day)?)?s?|wed(?:nesday)?s?|weds|thu(?:r(?:s(?:day)?)?)?s?|fri(?:day)?s?|sat(?:urday)?s?|sun(?:day)?s?)\b/g

function tokenToWeekday(token: string): Weekday {
  const key = token.slice(0, 3) as Weekday
  return key
}

/** Expands "Mon–Fri", "weekdays", "Mon/Wed/Fri", "every day". Sorted Monday-first. */
export function parseDays(text: string): Weekday[] {
  const t = text.toLowerCase()
  const order: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const out = new Set<Weekday>()
  if (/\b(every ?day|daily|7 days|all week)\b/.test(t)) order.forEach((d) => out.add(d))
  if (/\bweekdays?\b/.test(t)) order.slice(0, 5).forEach((d) => out.add(d))
  if (/\bweekends?\b/.test(t)) ['sat', 'sun'].forEach((d) => out.add(d as Weekday))
  const tokens = [...t.matchAll(DAY_TOKEN)]
  const range = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*(?:-|–|—|to|through|thru)\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/.exec(t)
  if (range && tokens.length === 2) {
    let i = order.indexOf(range[1] as Weekday)
    const end = order.indexOf(range[2] as Weekday)
    for (let guard = 0; guard < 7; guard++) {
      out.add(order[i])
      if (i === end) break
      i = (i + 1) % 7
    }
  } else {
    for (const m of tokens) out.add(tokenToWeekday(m[1]))
  }
  return order.filter((d) => out.has(d))
}

/** Exact weekday key ("Monday", "Mon", "monday:") or undefined. */
export function weekdayKey(text: string): Weekday | undefined {
  const t = text.toLowerCase().trim().replace(/[:.]$/, '')
  const m = /^(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/.exec(t)
  return m ? tokenToWeekday(m[1]) : undefined
}

/** "4x per week", "4 days a week", "4 sessions/week" -> 4 */
export function parsePerWeek(text: string): number | undefined {
  const t = text.toLowerCase()
  const m = /(\d)\s*(?:-\s*\d\s*)?(?:x|×|times|days?|sessions?|workouts?|trainings?)?\s*(?:\/|per|a|each|every)\s*(?:week|wk)/.exec(t)
  if (m) return Number(m[1])
  const bare = /^\s*(\d)\s*(?:x|×|days?|sessions?)?\s*$/.exec(t)
  return bare ? Number(bare[1]) : undefined
}

/** "50 minutes", "1 hour", "1h15", "60-75 min" -> minutes. */
export function parseMinutes(text: string): number | undefined {
  const t = text.toLowerCase()
  const hm = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)(?![a-z])\.?\s*(?:(\d+)\s*(?:m|min|mins|minutes?)?)?/.exec(t)
  if (hm) return Math.round(Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0))
  const range = /(\d+)\s*(?:-|–|to)\s*(\d+)\s*(?:m|min|mins|minutes?)\b/.exec(t)
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2)
  const min = /(\d+)\s*(?:m|min|mins|minutes?)\b/.exec(t)
  if (min) return Number(min[1])
  if (/\bhour and a half\b/.test(t)) return 90
  if (/\bhalf an hour\b/.test(t)) return 30
  if (/\b(an|one) hour\b/.test(t)) return 60
  const n = parseNumber(t)
  if (n == null) return undefined
  return n <= 4 ? Math.round(n * 60) : n
}

/** "2.5 L", "2500 ml", "8 glasses", "100 oz" -> ml. */
export function parseMl(text: string): number | undefined {
  const t = text.toLowerCase().replace(/(\d),(\d{3})\b/g, '$1$2')
  const l = /(\d+(?:[.,]\d+)?)\s*(?:l|liters?|litres?|ltrs?)\b/.exec(t)
  if (l) return Math.round(toNumber(l[1]) * 1000)
  const ml = /(\d+)\s*ml\b/.exec(t)
  if (ml) return Number(ml[1])
  const glass = /(\d+)\s*(?:glasses|cups|glass)\b/.exec(t)
  if (glass) return Number(glass[1]) * 250
  const oz = /(\d+(?:\.\d+)?)\s*(?:fl\.?\s?oz|oz|ounces)\b/.exec(t)
  if (oz) return Math.round(Number(oz[1]) * 29.5735)
  const gal = /(\d+(?:\.\d+)?)\s*(?:gallons?|gal)\b/.exec(t)
  if (gal) return Math.round(Number(gal[1]) * 3785)
  const n = parseNumber(t)
  if (n == null) return undefined
  return n < 10 ? Math.round(n * 1000) : n
}

export interface MacroValue {
  grams?: number
  perKg?: number
  pct?: number
}

/** "130 g", "1.8 g/kg", "0.8 g per lb", "30%" */
export function parseMacro(text: string): MacroValue | undefined {
  const t = text.toLowerCase()
  const perKg = /(\d+(?:[.,]\d+)?)\s*(?:g|grams?)?\s*(?:\/|per)\s*(?:kg|kilo)/.exec(t)
  if (perKg) return { perKg: toNumber(perKg[1]) }
  const perLb = /(\d+(?:[.,]\d+)?)\s*(?:g|grams?)?\s*(?:\/|per)\s*(?:lb|pound)/.exec(t)
  if (perLb) return { perKg: toNumber(perLb[1]) * LB_PER_KG }
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(t)
  if (pct) return { pct: Number(pct[1]) }
  const n = parseRangeMid(t)
  return n != null && n > 0 ? { grams: n } : undefined
}

/** "40/30/30 (P/C/F)", "protein 30% carbs 40% fat 30%" -> percentages. */
export function parseMacroSplit(text: string): { protein: number; carbs: number; fat: number } | undefined {
  const t = text.toLowerCase()
  const labelled = (word: RegExp) => {
    const a = new RegExp(`${word.source}\\s*[:=]?\\s*(\\d+)\\s*%`).exec(t)
    const b = new RegExp(`(\\d+)\\s*%\\s*${word.source}`).exec(t)
    return a ? Number(a[1]) : b ? Number(b[1]) : undefined
  }
  const p = labelled(/(?:protein|prot|p)\b/)
  const c = labelled(/(?:carbs?|carbohydrates?|c)\b/)
  const f = labelled(/(?:fats?|f)\b/)
  if (p != null && c != null && f != null) return { protein: p, carbs: c, fat: f }
  const nums = /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/.exec(t)
  if (!nums) return undefined
  const values = [Number(nums[1]), Number(nums[2]), Number(nums[3])]
  if (Math.abs(values[0] + values[1] + values[2] - 100) > 3) return undefined
  const order = /\b([pcf])\s*\/\s*([pcf])\s*\/\s*([pcf])\b/.exec(t) ?? /\b(protein|carbs?|fats?)\s*\/\s*(protein|carbs?|fats?)\s*\/\s*(protein|carbs?|fats?)\b/.exec(t)
  const keys = order ? [order[1][0], order[2][0], order[3][0]] : ['p', 'c', 'f']
  const pick = (k: string) => values[keys.indexOf(k)]
  if (new Set(keys).size !== 3) return undefined
  return { protein: pick('p'), carbs: pick('c'), fat: pick('f') }
}

/** ISO date, "March 2027", "31 Mar 2027", "in 12 weeks". */
export function parseDate(text: string, now = new Date()): string | undefined {
  const t = text.toLowerCase().trim()
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`
  const rel = /in\s+(\d+)\s*(day|week|month|year)s?/.exec(t)
  if (rel) {
    const d = new Date(now)
    const n = Number(rel[1])
    if (rel[2] === 'day') d.setDate(d.getDate() + n)
    if (rel[2] === 'week') d.setDate(d.getDate() + n * 7)
    if (rel[2] === 'month') d.setMonth(d.getMonth() + n)
    if (rel[2] === 'year') d.setFullYear(d.getFullYear() + n)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = /(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:(\d{1,2})(?:st|nd|rd|th)?,?\s*)?(\d{4})/.exec(t)
  if (named) {
    const day = Number(named[1] ?? named[3] ?? 1)
    return `${named[4]}-${pad(months.indexOf(named[2]) + 1)}-${pad(day)}`
  }
  const dmy = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(t)
  if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`
  return undefined
}

export function ageFromBirthDate(iso: string, now = new Date()): number | undefined {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y) return undefined
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age > 0 && age < 120 ? age : undefined
}

export const ALL_WEEKDAYS = WEEKDAYS

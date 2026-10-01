import { addDays, dateRange, diffDays, today, type ISODate } from '../lib/dates'
import type { DayLog, JournalEntry, Plan } from '../types'
import { addMacros, itemMacros, resolvePlanned, ZERO, type Macros } from './nutrition'
import { weekdayOf } from '../lib/dates'

/** Eaten macros for a day: checked planned meals + logged foods. */
export function dayTotals(plan: Plan | undefined, day: DayLog | undefined): Macros {
  let m = ZERO
  if (!day) return m
  if (plan) {
    const meals = plan.meals.find((d) => d.weekday === weekdayOf(day.date))?.meals ?? []
    for (const pm of meals) {
      const r = resolvePlanned(pm, day)
      if (r?.eaten) m = addMacros(m, r.macros)
    }
  }
  for (const item of day.foods) m = addMacros(m, itemMacros(item))
  return m
}

export function waterTotal(day: DayLog | undefined) {
  return day?.water.reduce((s, w) => s + w.ml, 0) ?? 0
}

export interface WeightPoint {
  date: ISODate
  kg: number
}

export function weightSeries(days: Record<string, DayLog>): WeightPoint[] {
  return Object.values(days)
    .filter((d) => d.weightKg != null)
    .map((d) => ({ date: d.date, kg: d.weightKg! }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Trailing 7-day average weight at each logged point. */
export function movingAverage(points: WeightPoint[], window = 7): WeightPoint[] {
  return points.map((p) => {
    const from = addDays(p.date, -(window - 1))
    const inWindow = points.filter((q) => q.date >= from && q.date <= p.date)
    return { date: p.date, kg: inWindow.reduce((s, q) => s + q.kg, 0) / inWindow.length }
  })
}

/** kg/week from a least-squares fit over the last `days` days. */
export function weeklyTrend(points: WeightPoint[], days = 21, end = today()): number | undefined {
  const from = addDays(end, -days)
  const pts = points.filter((p) => p.date >= from)
  if (pts.length < 3) return undefined
  const xs = pts.map((p) => diffDays(p.date, from))
  const ys = pts.map((p) => p.kg)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (!den) return undefined
  return (num / den) * 7
}

export interface Readiness {
  score: number
  label: 'Low' | 'Fair' | 'Good' | 'Great'
  reasons: string[]
  source?: JournalEntry
}

/**
 * Readiness from the latest journal check-in (today or yesterday): energy, soreness,
 * mood and sleep. Drives the coach's "lighter session" suggestion.
 */
export function readiness(journal: JournalEntry[], targetSleep: number, date: ISODate = today()): Readiness | undefined {
  const recent = journal
    .filter((j) => j.date === date || j.date === addDays(date, -1))
    .filter((j) => j.energy != null || j.soreness != null || j.sleepHours != null || j.mood != null)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!recent) return undefined
  const reasons: string[] = []
  let score = 70
  if (recent.energy != null) {
    score += (recent.energy - 3) * 10
    if (recent.energy <= 2) reasons.push(`low energy (${recent.energy}/5)`)
  }
  if (recent.soreness != null) {
    score -= (recent.soreness - 2) * 9
    if (recent.soreness >= 4) reasons.push(`high soreness (${recent.soreness}/5)`)
  }
  if (recent.mood != null) {
    score += (recent.mood - 3) * 4
    if (recent.mood <= 2) reasons.push('low mood')
  }
  if (recent.sleepHours != null) {
    const short = targetSleep - recent.sleepHours
    score -= Math.max(0, short) * 8
    if (short >= 1.5) reasons.push(`short sleep (${recent.sleepHours} h)`)
  }
  score = Math.max(0, Math.min(100, Math.round(score)))
  const label = score < 45 ? 'Low' : score < 60 ? 'Fair' : score < 80 ? 'Good' : 'Great'
  return { score, label, reasons, source: recent }
}

export interface Adherence {
  days: number
  loggedDays: number
  avgKcal: number
  avgProtein: number
  workouts: number
  waterDays: number
}

export function adherence(plan: Plan | undefined, days: Record<string, DayLog>, span = 7, end = today()): Adherence {
  const range = dateRange(end, span)
  let logged = 0
  let kcal = 0
  let protein = 0
  let workouts = 0
  let waterDays = 0
  for (const d of range) {
    const day = days[d]
    if (!day) continue
    const t = dayTotals(plan, day)
    if (t.kcal > 0) {
      logged++
      kcal += t.kcal
      protein += t.p
    }
    workouts += day.workouts.filter((w) => w.finishedAt).length
    if (plan && waterTotal(day) >= plan.targets.waterMl * 0.9) waterDays++
  }
  return { days: span, loggedDays: logged, avgKcal: logged ? kcal / logged : 0, avgProtein: logged ? protein / logged : 0, workouts, waterDays }
}

/** Consecutive days (ending today or yesterday) with anything logged. */
export function streak(days: Record<string, DayLog>, end = today()): number {
  const active = (d?: DayLog) => !!d && (d.foods.length > 0 || d.water.length > 0 || d.workouts.length > 0 || Object.values(d.planned).some((p) => p.eaten) || d.weightKg != null)
  let cursor = active(days[end]) ? end : addDays(end, -1)
  let n = 0
  while (active(days[cursor])) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

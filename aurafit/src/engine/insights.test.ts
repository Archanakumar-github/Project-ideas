import { describe, expect, it } from 'vitest'
import { adherence, dayTotals, movingAverage, readiness, streak, waterTotal, weeklyTrend } from './insights'
import { generatePlan } from './plan'
import { exampleProfile } from '../test/factories'
import type { DayLog } from '../types'

const day = (date: string, patch: Partial<DayLog> = {}): DayLog => ({ date, planned: {}, foods: [], water: [], workouts: [], updatedAt: 0, ...patch })

describe('insights', () => {
  const plan = generatePlan(exampleProfile(), 9)

  it('totals checked planned meals and logged foods', () => {
    const thu = plan.meals.find((d) => d.weekday === 'thu')!
    const d = day('2026-10-01', {
      planned: { [thu.meals[0].id]: { eaten: true } },
      foods: [{ id: 'f', section: 'snacks', name: 'Apple', kcal: 95, p: 0.5, c: 25, f: 0.3, at: 0, source: 'builtin' }],
    })
    const t = dayTotals(plan, d)
    expect(t.kcal).toBeGreaterThan(95 + 300)
    expect(waterTotal(day('x', { water: [{ at: 0, ml: 250 }, { at: 1, ml: 500 }] }))).toBe(750)
  })

  it('fits a weekly weight trend and smooths noise', () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({ date: `2026-09-${String(10 + i).padStart(2, '0')}`, kg: 80 - i * 0.1 + (i % 2 ? 0.3 : -0.3) }))
    const trend = weeklyTrend(pts, 21, '2026-09-24')!
    expect(trend).toBeCloseTo(-0.7, 0)
    const avg = movingAverage(pts)
    expect(Math.abs(avg[10].kg - avg[11].kg)).toBeLessThan(Math.abs(pts[10].kg - pts[11].kg))
  })

  it('scores readiness from the latest check-in', () => {
    const good = readiness([{ id: '1', date: '2026-10-01', createdAt: 1, updatedAt: 1, body: '', energy: 5, soreness: 1, sleepHours: 8 }], 8, '2026-10-01')!
    const bad = readiness([{ id: '1', date: '2026-09-30', createdAt: 1, updatedAt: 1, body: '', energy: 1, soreness: 5, sleepHours: 5 }], 8, '2026-10-01')!
    expect(good.label).toBe('Great')
    expect(bad.label).toBe('Low')
    expect(bad.reasons).toEqual(expect.arrayContaining(['low energy (1/5)', 'high soreness (5/5)', 'short sleep (5 h)']))
    expect(readiness([], 8, '2026-10-01')).toBeUndefined()
  })

  it('counts streaks and weekly adherence', () => {
    const days = {
      '2026-09-29': day('2026-09-29', { water: [{ at: 0, ml: 3000 }] }),
      '2026-09-30': day('2026-09-30', { weightKg: 74 }),
      '2026-10-01': day('2026-10-01', { workouts: [{ id: 'w', date: '2026-10-01', title: 'Upper', focus: 'upper', startedAt: 0, finishedAt: 1, intensity: 'normal', exercises: [] }] }),
    }
    expect(streak(days, '2026-10-01')).toBe(3)
    const a = adherence(plan, days, 7, '2026-10-01')
    expect(a.workouts).toBe(1)
    expect(a.waterDays).toBe(1)
  })
})

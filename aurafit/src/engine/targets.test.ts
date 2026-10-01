import { describe, expect, it } from 'vitest'
import { bmrKatch, bmrMifflin, computeTargets } from './targets'
import { exampleProfile, makeProfile } from '../test/factories'

describe('computeTargets', () => {
  it('uses the standard BMR formulas', () => {
    expect(bmrMifflin({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780)
    expect(bmrMifflin({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' })).toBeCloseTo(1320.25)
    expect(bmrKatch(80, 20)).toBeCloseTo(1752.4)
  })

  it('derives the example profile targets and explains them', () => {
    const t = computeTargets(exampleProfile())
    expect(t.method.bmrFormula).toBe('katch')
    expect(t.calories).toBe(1610)
    expect(t.proteinG).toBe(130)
    expect(t.method.sources.protein).toBe('profile')
    expect(t.waterMl).toBe(2500)
    expect(t.steps).toBe(9000)
    expect(t.weeklyRateKg).toBe(-0.5)
    expect(t.calories).toBeLessThan(t.tdee)
    expect(t.method.notes.join(' ')).toMatch(/Katch-McArdle/)
    // Macros add back up to the calorie target.
    expect(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9).toBeGreaterThan(t.calories * 0.95)
  })

  it('maintenance goals stay at TDEE', () => {
    const t = computeTargets(makeProfile())
    expect(Math.abs(t.calories - t.tdee)).toBeLessThanOrEqual(10)
    expect(t.method.activityFactor).toBeCloseTo(1.505, 3)
  })

  it('caps aggressive deficits and never goes below the safe floor', () => {
    const t = computeTargets(makeProfile({ goal: 'lose_fat', weeklyRateKg: -2, sex: 'female', weightKg: 55, heightCm: 158, activity: 'sedentary' }))
    expect(t.weeklyRateKg).toBeGreaterThanOrEqual(-0.55)
    expect(t.calories).toBeGreaterThanOrEqual(1200)
  })

  it('respects explicit calories and macro percentages from the file', () => {
    const t = computeTargets(makeProfile({ macros: { calories: 2200, proteinPct: 30, carbsPct: 40, fatPct: 30 } }))
    expect(t.calories).toBe(2200)
    expect(t.proteinG).toBe(165)
    expect(t.carbsG).toBe(220)
    expect(t.fatG).toBe(73)
    expect(t.method.sources.calories).toBe('profile')
  })

  it('keeps keto carbs very low', () => {
    const t = computeTargets(makeProfile({ diet: { ...makeProfile().diet, styles: ['keto'] } }))
    expect(t.carbsG).toBeLessThanOrEqual(30)
    expect(t.fatG * 9).toBeGreaterThan(t.calories * 0.6)
  })

  it('bases protein on a reference weight when BMI is high', () => {
    const t = computeTargets(makeProfile({ goal: 'lose_fat', weightKg: 130, heightCm: 175 }))
    expect(t.method.referenceWeightKg).toBeLessThan(100)
    expect(t.proteinG).toBeLessThan(2 * 100)
  })
})

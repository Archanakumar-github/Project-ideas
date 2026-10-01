import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProfileMarkdown } from './profileParser'
import { FRONT_MATTER_TABLES, IMPERIAL_PROSE, MINIMAL, VEGAN_GF } from '../test/fixtures/profiles'

const now = new Date(2026, 9, 1)

describe('parseProfileMarkdown', () => {
  it('reads every section of the shipped example', () => {
    const p = parseProfileMarkdown(readFileSync('user_profile.example.md', 'utf8'), { now })
    expect(p).toMatchObject({ name: 'Alex Rivera', age: 34, sex: 'female', heightCm: 168, weightKg: 74, bodyFatPct: 30, targetWeightKg: 66, targetDate: '2027-03-31', weeklyRateKg: -0.5, goal: 'lose_fat', activity: 'light' })
    expect(p.goalsText).toContain('Run a 10K in under 60 minutes')
    expect(p.diet.styles).toEqual(['vegetarian'])
    expect(p.diet.allergies.sort()).toEqual(['lactose', 'peanut'])
    // "eggs and dairy are fine" must not become a restriction.
    expect(p.diet.allergies).not.toContain('egg')
    expect(p.diet.avoid).toEqual(['mushrooms', 'olives'])
    expect(p.diet.cuisines).toEqual(['Indian', 'Mediterranean'])
    expect(p.macros).toEqual({ proteinG: 130, waterMl: 2500 })
    expect(p.training).toMatchObject({ days: ['mon', 'tue', 'thu', 'sat'], sessionMinutes: 50, experience: 'intermediate', preferredTime: '07:00', injuries: ['knee'], location: 'home' })
    expect(p.training.equipment).toEqual(expect.arrayContaining(['dumbbell', 'band', 'pullup_bar', 'bench', 'bodyweight']))
    expect(p.training.schedule).toEqual({ mon: 'Upper body', tue: 'Lower body', thu: 'Upper body', sat: 'Long run, 45 min easy' })
    expect(p.lifestyle).toMatchObject({ wake: '06:15', sleep: '22:30', workStart: '09:00', workEnd: '17:30', stepsGoal: 9000 })
    expect(p.measurements).toEqual({ neck: 34, chest: 96, arms: 31, waist: 82, hips: 104, thighs: 60, calves: 37, bodyFat: 30 })
    expect(p.meta.defaulted).toEqual([])
  })

  it('understands imperial units and prose', () => {
    const p = parseProfileMarkdown(IMPERIAL_PROSE, { now })
    expect(p.age).toBe(41)
    expect(p.sex).toBe('male')
    expect(p.heightCm).toBeCloseTo(180.3, 0)
    expect(p.weightKg).toBeCloseTo(96.2, 0)
    expect(p.goal).toBe('lose_fat')
    expect(p.diet.allergies).toEqual(['shellfish'])
    expect(p.diet.avoid).toContain('mushrooms')
    expect(p.diet).toMatchObject({ mealsPerDay: 3, snacksPerDay: 2 })
    expect(p.macros.waterMl).toBe(2957)
    expect(p.training).toMatchObject({ daysPerWeek: 3, days: ['mon', 'wed', 'fri'], sessionMinutes: 60, experience: 'beginner', preferredTime: '18:30' })
    expect(p.training.equipment).toContain('full_gym')
    expect(p.training.injuries).toEqual(['lower_back'])
    expect(p.lifestyle).toMatchObject({ wake: '06:00', sleep: '22:30', workStart: '08:00', workEnd: '17:00' })
  })

  it('reads YAML front matter, tables and "Day N" schedules', () => {
    const p = parseProfileMarkdown(FRONT_MATTER_TABLES, { now })
    expect(p).toMatchObject({ name: 'Priya', age: 27, sex: 'female', heightCm: 160, weightKg: 58, goal: 'build_muscle', activity: 'moderate' })
    expect(p.diet.styles).toEqual(['vegetarian'])
    expect(p.diet.avoid).toContain('egg')
    expect(p.diet.allergies).toEqual([])
    expect(p.macros).toMatchObject({ proteinPct: 30, carbsPct: 45, fatPct: 25 })
    expect(p.training.days).toEqual(['mon', 'tue', 'wed', 'thu', 'fri'])
    expect(p.training.schedule).toMatchObject({ mon: 'Push', tue: 'Pull', wed: 'Legs', thu: 'Push', fri: 'Pull' })
    expect(p.training.equipment).toEqual(expect.arrayContaining(['dumbbell', 'bench', 'band']))
  })

  it('handles vegan + gluten-free + allergies + fasting window', () => {
    const p = parseProfileMarkdown(VEGAN_GF, { now })
    expect(p.sex).toBe('unspecified')
    expect(p.heightCm).toBe(172)
    expect(p.diet.styles).toEqual(['vegan'])
    expect(p.diet.allergies.sort()).toEqual(['gluten', 'nuts', 'sesame'])
    expect(p.diet.fastingWindow).toEqual({ start: '12:00', end: '20:00' })
    expect(p.diet.skipBreakfast).toBe(true)
    // "maintain and run a half marathon": weight stays flat, training is endurance-focused.
    expect(p.goal).toBe('endurance')
    expect(p.training.equipment).toEqual(['bodyweight'])
    expect(p.meta.warnings.some((w) => /Sex not specified/.test(w))).toBe(true)
  })

  it('falls back to flagged defaults for a near-empty file', () => {
    const p = parseProfileMarkdown(MINIMAL, { now })
    expect(p.meta.defaulted).toEqual(expect.arrayContaining(['age', 'heightCm', 'weightKg', 'training.days', 'training.equipment']))
    expect(p.goal).toBe('general_health')
    expect(p.meta.warnings.length).toBeGreaterThanOrEqual(3)
    expect(p.meta.sourceMarkdown).toBe(MINIMAL)
  })
})

import { describe, expect, it } from 'vitest'
import { buildContext, contextToText } from './context'
import { dailyInsight, localAnswer, priorityAnswer } from './localCoach'
import { generatePlan } from '../engine/plan'
import { exampleProfile, NOW } from '../test/factories'
import { DEFAULT_SETTINGS, type AppData } from '../store/app'
import type { JournalEntry } from '../types'

const DATE = '2026-10-01' // a Thursday: upper-body day in the example profile

function data(journal: JournalEntry[] = []): AppData {
  const profile = exampleProfile()
  return {
    profile,
    plan: generatePlan(profile, 5),
    settings: { ...DEFAULT_SETTINGS },
    days: {},
    journal: Object.fromEntries(journal.map((j) => [j.id, j])),
    chat: { messages: [], cloud: [] },
    foods: { custom: [], recents: [] },
  }
}

const ctx = (journal: JournalEntry[] = []) => buildContext(data(journal), DATE, NOW)!

describe('on-device coach', () => {
  it('turns logging phrases into one-tap actions', () => {
    expect(localAnswer('I drank 500 ml of water', ctx()).actions).toEqual([{ kind: 'addWater', label: 'Add 500 ml', ml: 500 }])
    expect(localAnswer('had 2 glasses of water', ctx()).actions?.[0]).toMatchObject({ kind: 'addWater', ml: 500 })
    expect(localAnswer('I weigh 73.4 kg', ctx()).actions?.[0]).toMatchObject({ kind: 'logWeight', kg: 73.4 })
    expect(localAnswer('I ate a banana', ctx()).actions?.[0]).toMatchObject({ kind: 'addFood', foodId: 'banana' })
  })

  it('suggests diet-safe meal swaps for the named meal', () => {
    const reply = localAnswer('Can you swap my lunch?', ctx())
    expect(reply.text).toMatch(/Instead of/)
    expect(reply.actions).toHaveLength(3)
    expect(reply.actions!.every((a) => a.kind === 'swapMeal' && a.plannedId.includes('lunch'))).toBe(true)
  })

  it('scales training down when the user is sore or tired', () => {
    const reply = localAnswer("I'm really sore today", ctx())
    expect(reply.text).toMatch(/lighter/)
    expect(reply.actions).toContainEqual({ kind: 'lighter', label: 'Make today lighter', date: DATE })
  })

  it('uses journal check-ins for readiness and the daily insight', () => {
    const tired: JournalEntry = { id: 'j1', date: DATE, createdAt: 1, updatedAt: 1, body: 'Rough night', energy: 1, soreness: 5, sleepHours: 5 }
    const c = ctx([tired])
    expect(c.readiness!.score).toBeLessThan(45)
    const insight = dailyInsight(c)
    expect(insight.tone).toBe('warn')
    expect(insight.action).toMatchObject({ kind: 'lighter' })
    expect(contextToText(c)).toMatch(/Journal 2026-10-01 \(energy 1\/5, soreness 5\/5, slept 5 h\): Rough night/)
  })

  it('finds equipment-safe exercise alternatives', () => {
    const reply = localAnswer('What is an alternative to squats? my knee hurts', ctx())
    expect(reply.text).toMatch(/don't push through/)
    expect(reply.text).not.toMatch(/Goblet squat\*\*:/)
  })

  it('answers remaining-food and target questions from the plan', () => {
    expect(localAnswer('What should I eat now?', ctx()).text).toMatch(/1,610 kcal left/)
    expect(localAnswer('Explain my targets', ctx()).text).toMatch(/Katch-McArdle/)
    expect(localAnswer('how much protein do I need', ctx()).text).toMatch(/130 g\/day/)
  })

  it('handles red-flag symptoms on-device and before anything else', () => {
    const reply = priorityAnswer('I had chest pain during my run', ctx())
    expect(reply?.text).toMatch(/stop training/i)
    expect(priorityAnswer('I want to eat 500 calories a day', ctx())?.text).toMatch(/support/)
    expect(priorityAnswer('what should I eat', ctx())).toBeUndefined()
  })
})

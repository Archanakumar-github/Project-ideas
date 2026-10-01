import { beforeAll, describe, expect, it } from 'vitest'
import { addWater, boot, flush, importProfile, setWeight, toggleMeal, upsertJournal, newJournalEntry, useApp, startWorkout, updateSession, finishWorkout } from './app'
import { Vault } from '../db/vault'
import { generatePlan } from '../engine/plan'
import { exampleProfile } from '../test/factories'

describe('app store persistence', () => {
  beforeAll(async () => {
    await boot()
  })

  it('starts in setup and becomes ready after importing a profile', () => {
    expect(useApp.getState().phase).toBe('setup')
    const profile = exampleProfile()
    importProfile(profile, generatePlan(profile, 4))
    expect(useApp.getState().phase).toBe('ready')
  })

  it('auto-saves every change, encrypted, and reloads it', async () => {
    const date = '2026-10-01'
    addWater(date, 500)
    setWeight(date, 73.5)
    const plan = useApp.getState().plan!
    toggleMeal(date, plan.meals.find((d) => d.weekday === 'thu')!.meals[0].id)
    const entry = upsertJournal({ ...newJournalEntry(date), body: 'Felt good', energy: 4 })
    const session = startWorkout(date, plan.program.days.find((d) => d.kind === 'strength')!)
    updateSession(date, session.id, (w) => ({ ...w, exercises: w.exercises.map((e, i) => (i === 0 ? { ...e, sets: e.sets.map((s) => ({ ...s, weightKg: 20, reps: 10, done: true })) } : e)) }))
    finishWorkout(date, session.id)
    await flush()

    const docs = await (await Vault.open()).loadAll()
    const day = docs.get(`day:${date}`) as { water: Array<{ ml: number }>; weightKg: number; workouts: Array<{ finishedAt?: number }> }
    expect(day.water.map((w) => w.ml)).toEqual([500])
    expect(day.weightKg).toBe(73.5)
    expect(day.workouts[0].finishedAt).toBeTypeOf('number')
    expect((docs.get(`journal:${entry.id}`) as { body: string }).body).toBe('Felt good')
    expect((docs.get('profile') as { name: string }).name).toBe('Alex Rivera')
  })
})

import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID } from '../data/exercises'
import { buildProgram, focusFromText, substitutes, suggestWeight } from './programBuilder'
import { exampleProfile, makeProfile } from '../test/factories'
import type { WorkoutSession } from '../types'

describe('program builder', () => {
  it('follows the schedule in the example profile and avoids knee-loading moves', () => {
    const p = exampleProfile()
    const prog = buildProgram(p, 1)
    const byDay = Object.fromEntries(prog.days.map((d) => [d.weekday, d]))
    expect(byDay.mon).toMatchObject({ kind: 'strength', focus: 'upper' })
    expect(byDay.tue).toMatchObject({ kind: 'strength', focus: 'lower' })
    expect(byDay.thu).toMatchObject({ kind: 'strength', focus: 'upper' })
    expect(byDay.sat).toMatchObject({ kind: 'cardio', cardio: { activity: 'Run', minutes: 45 } })
    for (const d of prog.days) {
      for (const e of d.exercises) {
        const ex = EXERCISE_BY_ID.get(e.exerciseId)!
        expect(ex.stresses).not.toContain('knee')
        // Home gym: dumbbells, bands, pull-up bar, bench (no barbell / machines / cables).
        expect(ex.needs.every((n) => ['dumbbell', 'band', 'pullup_bar', 'bench', 'bodyweight'].includes(n))).toBe(true)
      }
    }
    // The two upper days aren't identical.
    expect(byDay.mon.exercises.map((e) => e.exerciseId).join()).not.toBe(byDay.thu.exercises.map((e) => e.exerciseId).join())
  })

  it('picks a split from the number of days', () => {
    const four = buildProgram(makeProfile({ training: { ...makeProfile().training, days: ['mon', 'tue', 'thu', 'fri'], schedule: {} } }), 1)
    expect(four.split).toBe('upper_lower')
    expect(four.days.filter((d) => d.kind === 'strength').map((d) => d.focus)).toEqual(['upper', 'lower', 'upper', 'lower'])
    const six = buildProgram(makeProfile({ training: { ...makeProfile().training, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], schedule: {} } }), 1)
    expect(six.days.filter((d) => d.kind === 'strength').map((d) => d.focus)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs'])
  })

  it('uses bodyweight only when that is all there is', () => {
    const p = makeProfile({ training: { ...makeProfile().training, equipment: ['bodyweight'] } })
    for (const d of buildProgram(p, 2).days) for (const e of d.exercises) expect(EXERCISE_BY_ID.get(e.exerciseId)!.needs).toEqual([])
  })

  it('sizes sessions to the time available', () => {
    const short = buildProgram(makeProfile({ training: { ...makeProfile().training, sessionMinutes: 30 } }), 1)
    const long = buildProgram(makeProfile({ training: { ...makeProfile().training, sessionMinutes: 75 } }), 1)
    const count = (p: typeof short) => p.days.find((d) => d.kind === 'strength')!.exercises.length
    expect(count(short)).toBeLessThan(count(long))
  })

  it('reads day focus from free text', () => {
    expect(focusFromText('Push (chest, shoulders, triceps)')?.focus).toBe('push')
    expect(focusFromText('Long run 45 min')?.kind).toBe('cardio')
    expect(focusFromText('Yoga')?.kind).toBe('mobility')
    expect(focusFromText('Rest')?.kind).toBe('rest')
  })

  it('suggests equipment-aware substitutes and progressive overload', () => {
    const p = exampleProfile()
    const subs = substitutes('db-row', p)
    expect(subs.length).toBeGreaterThan(1)
    expect(subs.every((s) => s.pattern === 'h_pull')).toBe(true)
    const session = (reps: number[]): WorkoutSession => ({
      id: 'a',
      date: '2026-09-28',
      title: 'Upper',
      focus: 'upper',
      startedAt: 1,
      finishedAt: 2,
      intensity: 'normal',
      exercises: [{ uid: 'x', exerciseId: 'db-row', name: 'Row', repsMin: 8, repsMax: 12, restSec: 90, sets: reps.map((r) => ({ weightKg: 20, reps: r, done: true })) }],
    })
    expect(suggestWeight('db-row', [session([12, 12, 12])], 12)).toBe(21)
    expect(suggestWeight('db-row', [session([12, 10, 9])], 12)).toBe(20)
    expect(suggestWeight('db-row', [session([12, 12, 12])], 12, true)).toBe(17)
    expect(suggestWeight('goblet-squat', [], 12)).toBeUndefined()
  })
})

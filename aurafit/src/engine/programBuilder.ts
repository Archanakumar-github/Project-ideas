import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises'
import { WEEK_ORDER, WEEKDAY_LABEL, type Weekday } from '../lib/dates'
import { hash, seededRandom, shuffle } from '../lib/utils'
import type {
  DayFocus,
  DayKind,
  Equipment,
  Exercise,
  Experience,
  GoalType,
  MovementPattern,
  PlannedExercise,
  Profile,
  Program,
  ProgramDay,
  SplitType,
  WorkoutSession,
} from '../types'

/**
 * Weekly training program from the profile:
 *  1. Day focus: explicit schedule lines ("Monday: Upper body") win; otherwise a split
 *     is chosen from training days per week and experience.
 *  2. Each focus is a list of movement patterns; the number used depends on session length.
 *  3. Each pattern gets the best exercise the user can do with their equipment, avoiding
 *     movements that load an injured area, preferring ones matching their experience.
 *  4. Sets / reps / rest follow the goal.
 */

const PATTERNS: Record<DayFocus, MovementPattern[]> = {
  full: ['squat', 'h_push', 'hinge', 'h_pull', 'v_push', 'lunge', 'core', 'biceps', 'triceps'],
  upper: ['h_push', 'h_pull', 'v_push', 'v_pull', 'lateral', 'biceps', 'triceps', 'rear_delt'],
  lower: ['squat', 'hinge', 'lunge', 'glutes', 'hams_iso', 'calves', 'core', 'quads_iso'],
  push: ['h_push', 'v_push', 'h_push', 'lateral', 'triceps', 'chest_iso', 'triceps'],
  pull: ['v_pull', 'h_pull', 'rear_delt', 'biceps', 'h_pull', 'biceps', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'quads_iso', 'hams_iso', 'calves', 'core', 'glutes'],
  chest: ['h_push', 'h_push', 'chest_iso', 'triceps', 'triceps', 'core'],
  back: ['v_pull', 'h_pull', 'h_pull', 'rear_delt', 'biceps', 'core'],
  shoulders: ['v_push', 'lateral', 'rear_delt', 'lateral', 'core', 'core'],
  arms: ['biceps', 'triceps', 'biceps', 'triceps', 'core', 'core'],
  core: ['core', 'core', 'core', 'conditioning', 'core', 'conditioning'],
  hiit: ['conditioning', 'conditioning', 'conditioning', 'conditioning', 'core', 'conditioning'],
  cardio: [],
  mobility: [],
  rest: [],
}

/** Second variant for repeated focus days in the same week (A/B rotation). */
const PATTERNS_B: Partial<Record<DayFocus, MovementPattern[]>> = {
  full: ['hinge', 'v_push', 'lunge', 'v_pull', 'h_push', 'glutes', 'core', 'lateral', 'h_pull'],
  upper: ['v_push', 'v_pull', 'h_push', 'h_pull', 'rear_delt', 'triceps', 'biceps', 'lateral'],
  lower: ['hinge', 'lunge', 'squat', 'hams_iso', 'glutes', 'calves', 'core', 'quads_iso'],
}

const FOCUS_TITLE: Record<DayFocus, string> = {
  full: 'Full body',
  upper: 'Upper body',
  lower: 'Lower body',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  hiit: 'HIIT conditioning',
  cardio: 'Cardio',
  mobility: 'Mobility & recovery',
  rest: 'Rest day',
}

export function focusFromText(text: string): { focus: DayFocus; kind: DayKind } | undefined {
  const t = text.toLowerCase()
  if (/^(rest|off|day off|recovery day)\b|\brest\b/.test(t) && !/\brest[- ]pause\b/.test(t)) return { focus: 'rest', kind: 'rest' }
  if (/yoga|mobility|stretch|pilates|foam roll|recovery/.test(t)) return { focus: 'mobility', kind: 'mobility' }
  if (/hiit|interval|circuit|conditioning|tabata|crossfit|metcon|bootcamp/.test(t)) return { focus: 'hiit', kind: 'strength' }
  if (/push/.test(t)) return { focus: 'push', kind: 'strength' }
  if (/pull/.test(t)) return { focus: 'pull', kind: 'strength' }
  if (/upper/.test(t)) return { focus: 'upper', kind: 'strength' }
  if (/lower|glute|hamstring|quad/.test(t)) return { focus: 'lower', kind: 'strength' }
  if (/\blegs?\b/.test(t)) return { focus: 'legs', kind: 'strength' }
  if (/full|total body|whole body/.test(t)) return { focus: 'full', kind: 'strength' }
  if (/chest/.test(t)) return { focus: 'chest', kind: 'strength' }
  if (/\bback\b/.test(t)) return { focus: 'back', kind: 'strength' }
  if (/shoulder|delt/.test(t)) return { focus: 'shoulders', kind: 'strength' }
  if (/\barms?\b|bicep|tricep/.test(t)) return { focus: 'arms', kind: 'strength' }
  if (/\bcore\b|\babs\b/.test(t)) return { focus: 'core', kind: 'strength' }
  if (/run|jog|cycl|bike|swim|row|cardio|walk|hike|spin|sport|tennis|football|soccer|basketball|climb|dance|zumba|boxing class|skipping/.test(t)) return { focus: 'cardio', kind: 'cardio' }
  if (/strength|weights|lift|gym|resistance|workout|training/.test(t)) return { focus: 'full', kind: 'strength' }
  return undefined
}

function chooseSplit(n: number, exp: Experience, goal: GoalType, requested?: SplitType): { split: SplitType; foci: DayFocus[] } {
  const split = requested && requested !== 'custom' ? requested : n <= 3 ? 'full_body' : n === 4 ? 'upper_lower' : n === 5 ? 'custom' : 'push_pull_legs'
  const cycle = (arr: DayFocus[]) => Array.from({ length: n }, (_, i) => arr[i % arr.length])
  switch (split) {
    case 'full_body':
      return { split, foci: cycle(['full']) }
    case 'upper_lower':
      return { split, foci: cycle(['upper', 'lower']) }
    case 'push_pull_legs':
      return { split, foci: cycle(['push', 'pull', 'legs']) }
    case 'body_part':
      return { split, foci: cycle(['chest', 'back', 'legs', 'shoulders', 'arms']) }
    default:
      // 5 days: upper/lower + push/pull/legs hybrid.
      return { split: 'custom', foci: cycle(goal === 'endurance' || exp === 'beginner' ? ['full', 'upper', 'lower', 'full', 'hiit'] : ['upper', 'lower', 'push', 'pull', 'legs']) }
  }
}

interface Scheme {
  sets: number
  repsMin: number
  repsMax: number
  rest: number
}

export function schemeFor(goal: GoalType, exp: Experience, compound: boolean): Scheme {
  const table: Record<GoalType, [Scheme, Scheme]> = {
    strength: [{ sets: 5, repsMin: 3, repsMax: 5, rest: 180 }, { sets: 3, repsMin: 6, repsMax: 8, rest: 120 }],
    build_muscle: [{ sets: 4, repsMin: 6, repsMax: 10, rest: 120 }, { sets: 3, repsMin: 10, repsMax: 12, rest: 75 }],
    recomp: [{ sets: 4, repsMin: 6, repsMax: 10, rest: 120 }, { sets: 3, repsMin: 10, repsMax: 15, rest: 60 }],
    lose_fat: [{ sets: 3, repsMin: 8, repsMax: 12, rest: 90 }, { sets: 3, repsMin: 12, repsMax: 15, rest: 60 }],
    endurance: [{ sets: 3, repsMin: 12, repsMax: 15, rest: 60 }, { sets: 2, repsMin: 15, repsMax: 20, rest: 45 }],
    maintain: [{ sets: 3, repsMin: 8, repsMax: 12, rest: 90 }, { sets: 3, repsMin: 10, repsMax: 15, rest: 60 }],
    general_health: [{ sets: 3, repsMin: 8, repsMax: 12, rest: 90 }, { sets: 2, repsMin: 10, repsMax: 15, rest: 60 }],
  }
  const s = { ...table[goal][compound ? 0 : 1] }
  if (exp === 'beginner') {
    s.sets = Math.min(s.sets, 3)
    if (s.repsMin < 5) {
      s.repsMin = 5
      s.repsMax = 8
    }
  }
  return s
}

export function hasEquipment(ex: Exercise, owned: Equipment[]): boolean {
  if (owned.includes('full_gym')) return true
  return ex.needs.every((n) => owned.includes(n))
}

const LEVEL: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Exercises for a pattern the user can do, best first. */
export function rankExercises(pattern: MovementPattern, p: Pick<Profile, 'training'>): Exercise[] {
  return scoreExercises(pattern, p).map((x) => x.e)
}

function scoreExercises(pattern: MovementPattern, p: Pick<Profile, 'training'>): Array<{ e: Exercise; score: number }> {
  const { equipment, injuries, experience } = p.training
  const lvl = LEVEL[experience]
  const gym = equipment.includes('full_gym')
  return EXERCISES.filter((e) => e.pattern === pattern && hasEquipment(e, equipment) && !e.stresses.some((s) => injuries.includes(s)) && e.level <= lvl + (lvl === 1 ? 0 : 1))
    .map((e) => {
      let score = Math.abs(e.level - lvl) * 2
      // Use the kit people listed (and loadable kit over bands / bodyweight when they have it).
      if (e.needs.length === 0) score += gym || equipment.length > 2 ? 3 : 0.5
      if (e.needs.includes('band') && (gym || equipment.includes('dumbbell'))) score += 2
      if (gym && e.needs.includes('barbell') && e.compound) score -= 1.5
      if (gym && e.needs.includes('machine') && !e.compound) score -= 0.5
      if (!gym && e.needs.some((n) => equipment.includes(n))) score -= 1
      return { e, score }
    })
    .sort((a, b) => a.score - b.score)
}

/** Same-pattern alternatives for the "Swap" button (equipment + injury aware). */
export function substitutes(exerciseId: string, p: Pick<Profile, 'training'>, exclude: string[] = []): Exercise[] {
  const ex = EXERCISE_BY_ID.get(exerciseId)
  if (!ex) return []
  const relaxed = { training: { ...p.training, experience: 'advanced' as Experience } }
  return rankExercises(ex.pattern, relaxed).filter((e) => e.id !== exerciseId && !exclude.includes(e.id))
}

function cardioFrom(text: string, minutesFallback: number) {
  const t = text.toLowerCase()
  const minutes = Number(/(\d+)\s*(?:min|minutes)/.exec(t)?.[1] ?? (/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/.exec(t) ? Number(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/.exec(t)![1]) * 60 : minutesFallback))
  const activity = /run|jog/.test(t) ? 'Run' : /cycl|bike|spin/.test(t) ? 'Cycle' : /swim/.test(t) ? 'Swim' : /row/.test(t) ? 'Row' : /hike/.test(t) ? 'Hike' : /walk/.test(t) ? 'Brisk walk' : text.split(/[,(]/)[0].trim() || 'Cardio'
  const intensity = /easy|zone ?2|conversational|recovery|long/.test(t) ? 'Easy, conversational pace (zone 2)' : /tempo|threshold/.test(t) ? 'Tempo: comfortably hard' : /interval|sprint|hiit/.test(t) ? 'Intervals: hard efforts with easy recoveries' : 'Steady, moderate effort'
  return { activity, minutes: Math.round(minutes), intensity }
}

function buildStrengthDay(weekday: Weekday, focus: DayFocus, variant: number, p: Profile, sourceText?: string): ProgramDay {
  const base = (variant % 2 === 1 && PATTERNS_B[focus]) || PATTERNS[focus]
  const count = Math.max(3, Math.min(8, Math.round((p.training.sessionMinutes - 8) / 8)))
  const exercises: PlannedExercise[] = []
  const used = new Set<string>()
  let minutes = 6
  for (const pattern of base) {
    if (exercises.length >= count) break
    const ranked = scoreExercises(pattern, p).filter((x) => !used.has(x.e.id))
    if (!ranked.length) continue
    // Rotate variations between A/B days, but only between near-equal options.
    const alt = ranked[Math.min(variant, ranked.length - 1)]
    const pick = alt.score - ranked[0].score <= 1.5 ? alt.e : ranked[0].e
    used.add(pick.id)
    const s = schemeFor(p.goal, p.training.experience, !!pick.compound)
    const timed = !!pick.timed
    const plannedSets = focus === 'hiit' ? 4 : s.sets
    exercises.push({
      exerciseId: pick.id,
      sets: plannedSets,
      repsMin: timed ? (focus === 'hiit' ? 30 : 30) : s.repsMin,
      repsMax: timed ? (focus === 'hiit' ? 40 : 45) : s.repsMax,
      restSec: focus === 'hiit' ? 30 : timed ? 45 : s.rest,
      timed,
    })
    minutes += plannedSets * ((timed ? 40 : s.repsMax * 4) + (focus === 'hiit' ? 30 : timed ? 45 : s.rest)) / 60
  }
  return {
    weekday,
    kind: 'strength',
    focus,
    title: FOCUS_TITLE[focus],
    exercises,
    estMinutes: Math.round(minutes),
    sourceText,
  }
}

export function buildProgram(p: Profile, seed: number): Program {
  const notes: string[] = []
  const days = p.training.days
  const schedule = p.training.schedule
  const explicit = new Map<Weekday, { focus: DayFocus; kind: DayKind; text: string }>()
  for (const d of WEEK_ORDER) {
    const text = schedule[d]
    const f = text ? focusFromText(text) : undefined
    if (text && f) explicit.set(d, { ...f, text })
  }
  const strengthDays = days.filter((d) => !explicit.has(d) || explicit.get(d)!.kind === 'strength')
  const generatedFor = strengthDays.filter((d) => !explicit.has(d))
  const { split, foci } = chooseSplit(generatedFor.length || 1, p.training.experience, p.goal, p.training.split)
  if (explicit.size) notes.push('Day focus follows the schedule in your profile.')
  if (generatedFor.length) notes.push(`${generatedFor.length} day${generatedFor.length > 1 ? 's' : ''} use a ${split.replace(/_/g, ' ')} split.`)
  if (p.training.injuries.length) notes.push(`Exercises that load your ${p.training.injuries.map((i) => i.replace('_', ' ')).join(', ')} are left out.`)

  const seen = new Map<DayFocus, number>()
  const rand = seededRandom(seed ^ hash('program'))
  const cardioPref = p.training.cardio[0]
  const wantsCardio = p.goal === 'lose_fat' || p.goal === 'endurance' || !!cardioPref
  const restDays = WEEK_ORDER.filter((d) => !days.includes(d))
  // Add up to two easy cardio days on rest days when the goal or preferences call for it.
  const cardioDays = new Set<Weekday>(wantsCardio ? shuffle(restDays.filter((d) => d !== 'sun'), rand).slice(0, p.goal === 'endurance' ? 2 : 1) : [])

  let genIdx = 0
  const programDays: ProgramDay[] = WEEK_ORDER.map((weekday) => {
    const ex = explicit.get(weekday)
    if (ex && ex.kind === 'strength') {
      const variant = seen.get(ex.focus) ?? 0
      seen.set(ex.focus, variant + 1)
      return buildStrengthDay(weekday, ex.focus, variant, p, ex.text)
    }
    if (ex && ex.kind === 'cardio') {
      const cardio = cardioFrom(ex.text, 40)
      return { weekday, kind: 'cardio', focus: 'cardio', title: `${cardio.activity} · ${cardio.minutes} min`, exercises: [], cardio, estMinutes: cardio.minutes, sourceText: ex.text }
    }
    if (ex && ex.kind === 'mobility') {
      return { weekday, kind: 'mobility', focus: 'mobility', title: ex.text.length < 28 ? ex.text : 'Mobility & recovery', exercises: [], cardio: { activity: ex.text, minutes: 30, intensity: 'Gentle' }, estMinutes: 30, sourceText: ex.text }
    }
    if (days.includes(weekday) && !ex) {
      const focus = foci[genIdx++ % foci.length]
      const variant = seen.get(focus) ?? 0
      seen.set(focus, variant + 1)
      return buildStrengthDay(weekday, focus, variant, p)
    }
    if (cardioDays.has(weekday)) {
      const cardio = cardioFrom(cardioPref ?? 'brisk walk or easy cycle, 30 min easy', 30)
      return { weekday, kind: 'cardio', focus: 'cardio', title: `Easy ${cardio.activity.toLowerCase()} · ${cardio.minutes} min`, exercises: [], cardio, estMinutes: cardio.minutes }
    }
    const mobility = p.training.injuries.length > 0 || p.training.experience === 'beginner'
    return {
      weekday,
      kind: mobility ? 'mobility' : 'rest',
      focus: mobility ? 'mobility' : 'rest',
      title: mobility ? 'Mobility & a walk' : 'Rest & recover',
      exercises: [],
      cardio: mobility ? { activity: '15-min mobility flow + 20-min walk', minutes: 35, intensity: 'Gentle' } : { activity: 'Optional relaxed walk', minutes: 20, intensity: 'Easy' },
      estMinutes: mobility ? 35 : 20,
    }
  })

  const name = `${days.length}-day ${explicit.size ? 'custom' : split.replace(/_/g, ' ')} plan`
  return { split: explicit.size ? 'custom' : split, name, days: programDays, notes }
}

export function dayLabel(day: ProgramDay) {
  return `${WEEKDAY_LABEL[day.weekday]} · ${day.title}`
}

/* ------------------------------------------------------------------ progression */

export interface LastPerformance {
  date: string
  topWeightKg?: number
  reps: number[]
  hitTop: boolean
}

export function lastPerformance(exerciseId: string, sessions: WorkoutSession[], repsMax: number): LastPerformance | undefined {
  for (const s of sessions) {
    if (!s.finishedAt) continue
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId)
    const done = ex?.sets.filter((x) => x.done) ?? []
    if (!ex || !done.length) continue
    const weights = done.map((x) => x.weightKg ?? 0)
    const top = Math.max(...weights)
    return { date: s.date, topWeightKg: top || undefined, reps: done.map((x) => x.reps ?? 0), hitTop: done.every((x) => (x.reps ?? 0) >= repsMax) }
  }
  return undefined
}

/** Double progression: add load once every set hits the top of the rep range. */
export function suggestWeight(exerciseId: string, sessions: WorkoutSession[], repsMax: number, light = false): number | undefined {
  const last = lastPerformance(exerciseId, sessions, repsMax)
  if (!last?.topWeightKg) return undefined
  const ex = EXERCISE_BY_ID.get(exerciseId)
  const lower = ex && ['squat', 'hinge', 'lunge', 'glutes'].includes(ex.pattern)
  const step = ex?.needs.includes('barbell') || ex?.needs.includes('machine') ? (lower ? 5 : 2.5) : lower ? 2 : 1
  let next = last.hitTop ? last.topWeightKg + step : last.topWeightKg
  if (light) next = Math.round(next * 0.8 * 2) / 2
  return next
}

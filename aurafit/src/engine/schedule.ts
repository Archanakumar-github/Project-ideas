import { RECIPE_BY_ID } from '../data/recipes'
import { hhmmToMinutes, minutesToHHMM, type Weekday } from '../lib/dates'
import type { Plan, Profile, ScheduleItem } from '../types'
import { fmtMl } from '../lib/units'

/** A day's timeline from lifestyle routines + the generated meals and training. */
export function buildSchedule(p: Profile, plan: Plan, weekday: Weekday): ScheduleItem[] {
  const items: ScheduleItem[] = []
  const { wake, sleep, workStart, workEnd, routines } = p.lifestyle
  const wakeMin = hhmmToMinutes(wake)
  let sleepMin = hhmmToMinutes(sleep)
  if (sleepMin <= wakeMin) sleepMin += 1440

  items.push({ time: wake, kind: 'wake', label: 'Wake up', detail: 'Start with a big glass of water (≈500 ml)' })
  const morning = routines.find((r) => /morning/i.test(r))
  if (morning) items.push({ time: minutesToHHMM(wakeMin + 10), kind: 'routine', label: 'Morning routine', detail: morning.replace(/^morning routine:\s*/i, '') })

  const day = plan.program.days.find((d) => d.weekday === weekday)
  const meals = plan.meals.find((d) => d.weekday === weekday)?.meals ?? []
  for (const m of meals) {
    const r = RECIPE_BY_ID.get(m.recipeId)
    items.push({ time: m.time ?? '12:00', kind: 'meal', label: m.section === 'snacks' ? 'Snack' : m.section[0].toUpperCase() + m.section.slice(1), detail: r?.name })
  }

  if (workStart && workEnd && !['sat', 'sun'].includes(weekday)) {
    items.push({ time: workStart, kind: 'work', label: 'Work starts' })
    items.push({ time: workEnd, kind: 'work', label: 'Work ends' })
  }

  if (day && day.kind !== 'rest') {
    let at = p.training.preferredTime
    if (!at) at = workEnd ? minutesToHHMM(hhmmToMinutes(workEnd) + 45) : '18:00'
    items.push({ time: at, kind: 'workout', label: day.title, detail: `${day.estMinutes} min${day.kind === 'strength' ? ` · ${day.exercises.length} exercises` : ''}` })
  } else if (day) {
    items.push({ time: '17:30', kind: 'walk', label: day.title, detail: day.cardio?.activity })
  }

  if (plan.targets.steps) {
    const lunch = meals.find((m) => m.section === 'lunch')
    if (lunch?.time) items.push({ time: minutesToHHMM(hhmmToMinutes(lunch.time) + 35), kind: 'walk', label: '10-minute walk', detail: `Toward ${plan.targets.steps.toLocaleString()} steps` })
  }

  // Hydration check-ins every ~3 hours with a running target.
  const awake = sleepMin - 120 - wakeMin
  const checks = Math.max(2, Math.floor(awake / 180))
  for (let i = 1; i <= checks; i++) {
    const t = wakeMin + Math.round((awake * i) / (checks + 0.5))
    items.push({ time: minutesToHHMM(t), kind: 'water', label: 'Water check', detail: `Aim for ${fmtMl(Math.round((plan.targets.waterMl * i) / (checks + 1) / 250) * 250)} by now` })
  }

  const evening = routines.find((r) => /evening|night|bed/i.test(r))
  items.push({ time: minutesToHHMM(sleepMin - 60), kind: 'winddown', label: 'Wind down', detail: evening?.replace(/^evening routine:\s*/i, '') ?? 'Screens off, dim lights, prep tomorrow' })
  items.push({ time: sleep, kind: 'sleep', label: 'Lights out', detail: `${p.lifestyle.sleepHours} h until your alarm` })

  const rel = (t: string) => (hhmmToMinutes(t) - wakeMin + 1440) % 1440
  return items.sort((a, b) => rel(a.time) - rel(b.time))
}

/** Index of the next upcoming item (for the "Next up" highlight). */
export function nextIndex(items: ScheduleItem[], now: Date, wake: string): number {
  const wakeMin = hhmmToMinutes(wake)
  const nowRel = (now.getHours() * 60 + now.getMinutes() - wakeMin + 1440) % 1440
  const idx = items.findIndex((i) => (hhmmToMinutes(i.time) - wakeMin + 1440) % 1440 >= nowRel)
  return idx
}

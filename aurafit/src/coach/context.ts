import { addDays, fmtClock, minutesToHHMM, today, weekdayOf, WEEKDAY_LABEL, type ISODate } from '../lib/dates'
import { fmtNum } from '../lib/utils'
import { fmtWeight } from '../lib/units'
import { adherence, dayTotals, readiness, streak, waterTotal, weeklyTrend, weightSeries, type Adherence, type Readiness } from '../engine/insights'
import { resolvePlanned, type Macros, type ResolvedMeal } from '../engine/nutrition'
import { EXERCISE_BY_ID } from '../data/exercises'
import type { AppData } from '../store/app'
import type { DayLog, JournalEntry, Plan, Profile, ProgramDay, WorkoutSession } from '../types'

/** Everything the coach knows, assembled from local data only. */
export interface CoachContext {
  date: ISODate
  time: string
  profile: Profile
  plan: Plan
  day?: DayLog
  totals: Macros
  remaining: { kcal: number; p: number; c: number; f: number }
  water: { ml: number; target: number }
  meals: ResolvedMeal[]
  nextMeal?: ResolvedMeal
  programDay: ProgramDay
  session?: WorkoutSession
  workoutDone: boolean
  lighter: boolean
  readiness?: Readiness
  journal: JournalEntry[]
  weight: { latest?: number; latestDate?: ISODate; trendKgPerWeek?: number; logged: number }
  adherence: Adherence
  streak: number
  units: AppData['settings']['weightUnit']
}

export type ContextData = Pick<AppData, 'profile' | 'plan' | 'settings' | 'days' | 'journal'>

export function buildContext(data: ContextData, date: ISODate = today(), now = new Date()): CoachContext | undefined {
  const { profile, plan } = data
  if (!profile || !plan) return undefined
  const day = data.days[date]
  const weekday = weekdayOf(date)
  const totals = dayTotals(plan, day)
  const t = plan.targets
  const meals = (plan.meals.find((d) => d.weekday === weekday)?.meals ?? []).map((m) => resolvePlanned(m, day)).filter((m): m is ResolvedMeal => !!m)
  const programDay = plan.program.days.find((d) => d.weekday === weekday)!
  const sessions = day?.workouts ?? []
  const session = sessions.find((w) => !w.finishedAt) ?? sessions[sessions.length - 1]
  const trainingDay = programDay.kind === 'strength' || programDay.kind === 'cardio'
  const weights = weightSeries(data.days)
  const latest = weights[weights.length - 1]
  const journal = Object.values(data.journal).sort((a, b) => b.createdAt - a.createdAt)
  return {
    date,
    time: minutesToHHMM(now.getHours() * 60 + now.getMinutes()),
    profile,
    plan,
    day,
    totals,
    remaining: { kcal: t.calories - totals.kcal, p: t.proteinG - totals.p, c: t.carbsG - totals.c, f: t.fatG - totals.f },
    water: { ml: waterTotal(day), target: t.waterMl + (trainingDay ? t.trainingDayWaterBonusMl : 0) },
    meals,
    nextMeal: meals.find((m) => !m.eaten),
    programDay,
    session,
    workoutDone: sessions.some((w) => w.finishedAt),
    lighter: !!day?.lighter,
    readiness: readiness(journal, t.sleepHours, date),
    journal: journal.slice(0, 5),
    weight: { latest: latest?.kg, latestDate: latest?.date, trendKgPerWeek: weeklyTrend(weights, 21, date), logged: weights.length },
    adherence: adherence(plan, data.days, 7, date),
    streak: streak(data.days, date),
    units: data.settings.weightUnit,
  }
}

/** Compact, model-friendly snapshot for the optional cloud coach. */
export function contextToText(ctx: CoachContext): string {
  const p = ctx.profile
  const t = ctx.plan.targets
  const lines: string[] = []
  lines.push(`Current app context (${WEEKDAY_LABEL[weekdayOf(ctx.date)]} ${ctx.date}, local time ${fmtClock(ctx.time)}). Use it; don't repeat it back verbatim.`)
  lines.push(
    `Profile: ${p.name ?? 'user'}, ${p.age} y, ${p.sex}, ${p.heightCm} cm, ${p.weightKg} kg${p.bodyFatPct ? `, ${p.bodyFatPct}% body fat` : ''}. Goal: ${p.goal.replace(/_/g, ' ')}${p.targetWeightKg ? ` → ${p.targetWeightKg} kg${p.targetDate ? ` by ${p.targetDate}` : ''}` : ''}. Activity: ${p.activity.replace('_', ' ')}.`,
  )
  if (p.goalsText.length) lines.push(`Their goals: ${p.goalsText.join('; ')}.`)
  lines.push(
    `Diet: ${p.diet.styles.join(', ') || 'no specific style'}; allergies/intolerances: ${p.diet.allergies.join(', ') || 'none'}; avoids: ${p.diet.avoid.join(', ') || 'nothing listed'}; cuisines: ${p.diet.cuisines.join(', ') || 'any'}.`,
  )
  lines.push(
    `Training: ${p.training.days.map((d) => WEEKDAY_LABEL[d].slice(0, 3)).join('/')} · ${p.training.sessionMinutes} min · ${p.training.experience} · equipment: ${p.training.equipment.join(', ')}${p.training.injuries.length ? ` · injuries: ${p.training.injuries.join(', ')} (${p.training.injuryNotes.join('; ')})` : ''}.`,
  )
  lines.push(`Targets: ${t.calories} kcal, P ${t.proteinG} g, C ${t.carbsG} g, F ${t.fatG} g, water ${t.waterMl} ml, ${fmtNum(t.steps)} steps, sleep ${t.sleepHours} h.`)
  lines.push(`Today so far: ${Math.round(ctx.totals.kcal)} kcal, P ${Math.round(ctx.totals.p)} g, C ${Math.round(ctx.totals.c)} g, F ${Math.round(ctx.totals.f)} g; water ${ctx.water.ml}/${ctx.water.target} ml.`)
  lines.push(`Today's planned meals: ${ctx.meals.map((m) => `${m.planned.section} "${m.recipe.name}" (${Math.round(m.macros.kcal)} kcal, ${Math.round(m.macros.p)} g P)${m.eaten ? ' ✓eaten' : ''}`).join('; ')}.`)
  const extra = ctx.day?.foods ?? []
  if (extra.length) lines.push(`Off-plan foods logged today: ${extra.map((f) => `${f.name} ${Math.round(f.kcal)} kcal`).join('; ')}.`)
  const pd = ctx.programDay
  lines.push(
    `Today's training: ${pd.title}${pd.exercises.length ? ` (${pd.exercises.map((e) => `${EXERCISE_BY_ID.get(e.exerciseId)?.name} ${e.sets}×${e.repsMin}-${e.repsMax}`).join(', ')})` : pd.cardio ? ` (${pd.cardio.activity}, ${pd.cardio.minutes} min)` : ''}. Status: ${ctx.workoutDone ? 'done' : ctx.session ? 'in progress' : 'not started'}${ctx.lighter ? ', set to lighter' : ''}.`,
  )
  if (ctx.readiness) lines.push(`Readiness ${ctx.readiness.score}/100 (${ctx.readiness.label})${ctx.readiness.reasons.length ? `: ${ctx.readiness.reasons.join(', ')}` : ''}.`)
  if (ctx.weight.latest) {
    lines.push(
      `Weight: latest ${fmtWeight(ctx.weight.latest, 'kg')} on ${ctx.weight.latestDate}${ctx.weight.trendKgPerWeek != null ? `, trend ${ctx.weight.trendKgPerWeek > 0 ? '+' : ''}${ctx.weight.trendKgPerWeek.toFixed(2)} kg/week` : ''} (target pace ${t.weeklyRateKg} kg/week).`,
    )
  }
  const a = ctx.adherence
  lines.push(`Last 7 days: ${a.loggedDays} days with food logged (avg ${Math.round(a.avgKcal)} kcal, ${Math.round(a.avgProtein)} g protein), ${a.workouts} workouts, water target hit ${a.waterDays}×. Streak ${ctx.streak} days.`)
  const recent = ctx.journal.filter((j) => j.date >= addDays(ctx.date, -6)).slice(0, 3)
  for (const j of recent) {
    const meta = [j.energy != null && `energy ${j.energy}/5`, j.soreness != null && `soreness ${j.soreness}/5`, j.mood != null && `mood ${j.mood}/5`, j.sleepHours != null && `slept ${j.sleepHours} h`].filter(Boolean).join(', ')
    lines.push(`Journal ${j.date}${meta ? ` (${meta})` : ''}: ${j.body.replace(/\s+/g, ' ').slice(0, 400)}`)
  }
  return lines.join('\n')
}

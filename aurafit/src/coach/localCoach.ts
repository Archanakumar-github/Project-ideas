import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises'
import { FOODS } from '../data/foods'
import { fmtClock, hhmmToMinutes, WEEKDAY_LABEL, weekdayOf } from '../lib/dates'
import { fmtNum, normalize } from '../lib/utils'
import { fmtMl, fmtWeight, toKg } from '../lib/units'
import { dietRules, foodAllowed } from '../engine/dietRules'
import { swapOptions } from '../engine/mealPlanner'
import { recipeMacros, scaleFor } from '../engine/nutrition'
import { substitutes } from '../engine/programBuilder'
import type { CoachAction, Food, MealSection } from '../types'
import type { CoachContext } from './context'

/**
 * AuraFit's on-device coach. It works fully offline: questions are matched to intents and
 * answered from the user's own profile, plan, logs and journal, often with one-tap actions
 * (swap a meal, set a lighter session, log water...).
 */

export interface CoachReply {
  text: string
  actions?: CoachAction[]
}

const r0 = (n: number) => Math.round(n)

function sectionFromText(t: string): MealSection | undefined {
  if (/breakfast|morning meal/.test(t)) return 'breakfast'
  if (/lunch/.test(t)) return 'lunch'
  if (/dinner|supper|evening meal|tea time/.test(t)) return 'dinner'
  if (/snack/.test(t)) return 'snacks'
  return undefined
}

export function sectionForTime(time: string): MealSection {
  const m = hhmmToMinutes(time)
  if (m < 10 * 60 + 30) return 'breakfast'
  if (m < 15 * 60) return 'lunch'
  if (m < 17 * 60 + 30) return 'snacks'
  return 'dinner'
}

/** Allowed foods ranked by protein per calorie (for gap-filling suggestions). */
function proteinFoods(ctx: CoachContext, count = 3): Food[] {
  const rules = dietRules(ctx.profile)
  return FOODS.filter((f) => foodAllowed(f, rules) && f.p >= 8 && !['condiment'].includes(f.group))
    .sort((a, b) => b.p / b.kcal - a.p / a.kcal)
    .slice(0, count)
}

function findFood(text: string): Food | undefined {
  const q = normalize(text).replace(/\b(a|an|some|the|bowl of|cup of|plate of|piece of|slice of|serving of|handful of)\b/g, ' ').trim()
  if (!q) return undefined
  const words = q.split(' ').filter((w) => w.length > 2)
  let best: { f: Food; score: number } | undefined
  for (const f of FOODS) {
    const name = normalize(f.name)
    let score = 0
    if (name === q) score = 100
    else if (name.startsWith(q)) score = 60
    else for (const w of words) if (name.includes(w.replace(/s$/, ''))) score += 20
    if (score && (!best || score > best.score)) best = { f, score }
  }
  return best && best.score >= 20 ? best.f : undefined
}

function findExercise(text: string) {
  const t = normalize(text)
  const direct = EXERCISES.filter((e) => t.includes(normalize(e.name))).sort((a, b) => b.name.length - a.name.length)[0]
  if (direct) return direct
  const keywords: Array<[RegExp, string]> = [
    [/\bsquats?\b/, 'goblet-squat'],
    [/\bdeadlifts?\b/, 'rdl'],
    [/\bbench\b/, 'db-bench-press'],
    [/\bpush ?ups?\b/, 'push-up'],
    [/\bpull ?ups?\b|\bchin ?ups?\b/, 'pull-up'],
    [/\blunges?\b/, 'reverse-lunge'],
    [/\brows?\b/, 'db-row'],
    [/\boverhead press\b|\bshoulder press\b|\bohp\b/, 'db-shoulder-press'],
    [/\bplanks?\b/, 'plank'],
    [/\bburpees?\b/, 'burpee'],
    [/\bcurls?\b/, 'db-curl'],
    [/\bdips?\b/, 'bench-dip'],
    [/\bhip thrusts?\b/, 'hip-thrust'],
    [/\bswings?\b/, 'kb-swing'],
  ]
  for (const [re, id] of keywords) if (re.test(t)) return EXERCISE_BY_ID.get(id)
  // Also match today's planned exercises by any distinctive word.
  return undefined
}

function sessionLine(ctx: CoachContext) {
  const d = ctx.programDay
  if (d.kind === 'strength') {
    return d.exercises
      .map((e) => `- **${EXERCISE_BY_ID.get(e.exerciseId)?.name}**: ${e.sets} × ${e.repsMin}–${e.repsMax}${e.timed ? ' s' : ''} · rest ${e.restSec}s`)
      .join('\n')
  }
  return d.cardio ? `- ${d.cardio.activity} · ${d.cardio.minutes} min · ${d.cardio.intensity}` : ''
}

function greetingName(ctx: CoachContext) {
  return ctx.profile.name ? ctx.profile.name.split(' ')[0] : 'there'
}

/* ------------------------------------------------------------------ intents */

function safety(t: string): CoachReply | undefined {
  if (/chest pain|faint(ed|ing)?|passed out|blacked out|can'?t breathe|short(ness)? of breath|heart (is )?(racing|pounding)|palpitation|numb(ness)? in|sharp pain|severe pain|pop(ped)? in my|blood in/.test(t)) {
    return {
      text:
        '**Please stop training and get checked.** Chest pain, fainting, breathlessness or sharp/sudden pain are not things to push through. If symptoms are severe or ongoing, call your local emergency number. Once a clinician has cleared you, I can adapt your plan around whatever they advise.',
    }
  }
  if (/purg(e|ing)|make myself (sick|throw up)|laxative|starv(e|ing)|not eat(ing)? (at all|anything)|eat(ing)? nothing|binge|\b(3|4|5|6|7|8)00 ?(cal|kcal)/.test(t)) {
    return {
      text:
        "I'm really glad you said something. Very low intake, purging or bingeing can harm your health, and you deserve proper support rather than tighter numbers. Please consider talking to your doctor or an eating-disorder helpline in your country. I won't suggest going below your current targets, but I'm happy to help make regular, satisfying meals feel easier.",
    }
  }
  return undefined
}

function quickLog(t: string, ctx: CoachContext): CoachReply | undefined {
  const water = /(?:drank|drink|had|add|log)\s+(?:a |another )?(\d+(?:\.\d+)?)?\s*(ml|l|litres?|liters?|glass(?:es)?|cups?|bottles?)\b(?:\s+of)?(?:\s+water)?/.exec(t)
  if (water && /water|ml|\bl\b|litre|liter|glass|bottle/.test(t)) {
    const n = Number(water[1] ?? 1)
    const unit = water[2]
    const ml = /^l|lit/.test(unit) ? n * 1000 : /glass|cup/.test(unit) ? n * 250 : /bottle/.test(unit) ? n * 500 : n
    if (ml > 0 && ml <= 3000) {
      return { text: `Log **${fmtMl(ml)}** of water? You're at ${fmtMl(ctx.water.ml)} of ${fmtMl(ctx.water.target)} today.`, actions: [{ kind: 'addWater', label: `Add ${fmtMl(ml)}`, ml }] }
    }
  }
  const weight = /(?:i weigh|weighed|weight (?:is|was|today)|i'?m at|log (?:my )?weight)\s*(?:in at\s*)?(\d+(?:\.\d+)?)\s*(kg|kgs|lb|lbs|pounds)?/.exec(t)
  if (weight) {
    const unit = weight[2] ? (/^k/.test(weight[2]) ? 'kg' : 'lb') : ctx.units
    const kg = toKg(Number(weight[1]), unit)
    if (kg > 30 && kg < 350) {
      return { text: `Log **${fmtWeight(kg, ctx.units)}** for today?`, actions: [{ kind: 'logWeight', label: `Log ${fmtWeight(kg, ctx.units)}`, kg }] }
    }
  }
  const ate = /^(?:i )?(?:just )?(?:ate|had|log|add|eaten)\s+(?:a |an |some |my )?(.+)$/.exec(t)
  if (ate && !/water/.test(t)) {
    const food = findFood(ate[1])
    if (food) {
      const section = sectionForTime(ctx.time)
      const kcal = r0((food.kcal * food.serving.qty) / 100)
      const allowed = foodAllowed(food, dietRules(ctx.profile))
      return {
        text: `Found **${food.name}**: ${food.serving.label} ≈ ${kcal} kcal, ${r0((food.p * food.serving.qty) / 100)} g protein.${allowed ? '' : ' (Heads-up: this conflicts with the diet rules in your profile.)'} Add it to ${section}?`,
        actions: [{ kind: 'addFood', label: `Add to ${section}`, foodId: food.id, grams: food.serving.qty, section }],
      }
    }
  }
  return undefined
}

function exerciseSwap(t: string, ctx: CoachContext): CoachReply | undefined {
  if (!/swap|substitut|alternative|replace|instead|can'?t do|cannot do|hurts?|pain|don'?t have|no (barbell|bench|machine|gym)|hate/.test(t)) return undefined
  const ex = findExercise(t) ?? (/(exercise|movement|lift)/.test(t) ? EXERCISE_BY_ID.get(ctx.programDay.exercises[0]?.exerciseId ?? '') : undefined)
  if (!ex) return undefined
  const subs = substitutes(ex.id, ctx.profile).slice(0, 4)
  if (!subs.length) return { text: `I couldn't find a safe alternative to **${ex.name}** with your equipment. Try a lighter load and a shorter range, or skip it today.` }
  const pain = /hurt|pain/.test(t)
  return {
    text: [
      pain ? `If **${ex.name}** hurts, don't push through it. These train the same pattern (${ex.pattern.replace('_', ' ')}) with your equipment${ctx.profile.training.injuries.length ? ' and avoid your noted injuries' : ''}:` : `Good swaps for **${ex.name}** with your equipment:`,
      '',
      ...subs.map((s) => `- **${s.name}**: ${s.cues[0]}`),
      '',
      'In a workout, tap **Swap** on the exercise to switch it instantly.',
    ].join('\n'),
    actions: [{ kind: 'goto', label: 'Open workout', tab: 'train' }],
  }
}

function mealSwap(t: string, ctx: CoachContext): CoachReply | undefined {
  if (!/swap|replace|instead|alternative|change (my )?|don'?t (want|feel like|like|fancy)|something else|other option|bored of|sick of|tired of eating/.test(t)) return undefined
  const section = sectionFromText(t)
  const target = section ? ctx.meals.find((m) => m.planned.section === section && !m.eaten) ?? ctx.meals.find((m) => m.planned.section === section) : ctx.nextMeal
  if (!target) return { text: "All of today's planned meals are already checked off. Ask me about tomorrow, or log anything extra in the Diet tab." }
  const options = swapOptions(ctx.profile, ctx.plan.targets, target.planned, target.recipe.id, 3)
  if (!options.length) return { text: `I couldn't find another ${target.planned.section} that fits your diet rules. You can log something custom in the Diet tab.` }
  const lines = options.map((r) => {
    const m = recipeMacros(r, scaleFor(r, target.planned.targetKcal))
    return `- **${r.name}**: ${r0(m.kcal)} kcal · ${r0(m.p)} g protein · ${r.minutes} min`
  })
  return {
    text: [`Instead of **${target.recipe.name}** (${r0(target.macros.kcal)} kcal, ${r0(target.macros.p)} g protein) for ${target.planned.section}, try:`, '', ...lines, '', 'Portions are scaled to the same calorie target.'].join('\n'),
    actions: options.map((r) => ({ kind: 'swapMeal' as const, label: `Swap to ${r.name}`, date: ctx.date, plannedId: target.planned.id, recipeId: r.id })),
  }
}

function whatToEat(ctx: CoachContext): CoachReply {
  const rem = ctx.remaining
  const t = ctx.plan.targets
  const lines: string[] = []
  if (rem.kcal <= 0) {
    lines.push(`You've reached today's ${fmtNum(t.calories)} kcal target (${fmtNum(r0(ctx.totals.kcal))} eaten).`)
    lines.push(rem.p > 15 ? `Protein is still ${r0(rem.p)} g short. A small, lean protein snack is the best use of anything extra.` : "If you're genuinely hungry, choose high-volume foods: vegetables, a broth-based soup or fruit.")
  } else {
    lines.push(`**${fmtNum(r0(rem.kcal))} kcal left** today · protein ${r0(Math.max(0, rem.p))} g · carbs ${r0(Math.max(0, rem.c))} g · fat ${r0(Math.max(0, rem.f))} g still to go.`)
    if (ctx.nextMeal) {
      const m = ctx.nextMeal
      lines.push('', `Next on your plan: **${m.recipe.name}** for ${m.planned.section}${m.planned.time ? ` (${fmtClock(m.planned.time)})` : ''}: ${r0(m.macros.kcal)} kcal, ${r0(m.macros.p)} g protein.`)
    }
  }
  const actions: CoachAction[] = []
  if (rem.p > 25) {
    const foods = proteinFoods(ctx)
    lines.push('', 'Easy protein boosts that fit your diet:')
    for (const f of foods) {
      lines.push(`- ${f.name}: ${f.serving.label} ≈ ${r0((f.p * f.serving.qty) / 100)} g protein, ${r0((f.kcal * f.serving.qty) / 100)} kcal`)
      actions.push({ kind: 'addFood', label: `Add ${f.name.split(',')[0]}`, foodId: f.id, grams: f.serving.qty, section: sectionForTime(ctx.time) })
    }
  }
  if (ctx.nextMeal && !ctx.nextMeal.eaten) actions.push({ kind: 'goto', label: 'Open meal plan', tab: 'diet' })
  return { text: lines.join('\n'), actions }
}

function workoutAdjust(t: string, ctx: CoachContext): CoachReply | undefined {
  if (!/tired|exhausted|sore|soreness|doms|low energy|no energy|fatigue|knackered|drained|slept (badly|poorly|bad)|didn'?t sleep|bad sleep|skip|lighter|easier|deload|take it easy|short on time|no time|only have \d+|busy|sick|ill|cold|flu|stressed/.test(t)) return undefined
  const d = ctx.programDay
  const minutes = /only have (\d+)|(\d+) ?min(?:utes)?/.exec(t)
  const lines: string[] = []
  const actions: CoachAction[] = []
  if (/sick|ill|\bflu\b|fever|cold/.test(t)) {
    return { text: "If symptoms are below the neck (chest, fever, body aches), rest completely. With a mild head cold, a walk or easy mobility is plenty. Drink well, keep protein up, and pick the program back up when you've felt normal for a day." }
  }
  if (ctx.workoutDone) return { text: `You've already finished today's ${d.title}. Recovery is the job now: protein (${r0(Math.max(0, ctx.remaining.p))} g to go), water (${fmtMl(Math.max(0, ctx.water.target - ctx.water.ml))} to go) and an early night.` }
  if (d.kind !== 'strength') {
    return { text: `Today is **${d.title}**, already an easy day. Keep it truly easy: ${d.cardio?.intensity ?? 'gentle effort'}. If you feel worse after 10 minutes, stop and rest.` }
  }
  if (minutes) {
    const n = Number(minutes[1] ?? minutes[2])
    const keep = d.exercises.slice(0, Math.max(2, Math.min(d.exercises.length, Math.floor(n / 9))))
    lines.push(`Short on time? Do a **${n}-minute version** of ${d.title}: the first ${keep.length} exercises, 2–3 hard sets each, rest 60–90 s:`, '')
    keep.forEach((e) => lines.push(`- ${EXERCISE_BY_ID.get(e.exerciseId)?.name}`))
    return { text: lines.join('\n'), actions: [{ kind: 'goto', label: 'Open workout', tab: 'train' }] }
  }
  const rd = ctx.readiness
  lines.push(rd ? `Your latest check-in puts readiness at **${rd.score}/100 (${rd.label})**${rd.reasons.length ? `: ${rd.reasons.join(', ')}` : ''}.` : 'Thanks for telling me.')
  if (!rd || rd.score < 60 || /sore|tired|exhausted|lighter|easier|deload|slept|sleep|drained|fatigue|no energy|low energy/.test(t)) {
    lines.push('', `I'd keep **${d.title}** but make it lighter: one fewer set per exercise and about 80% of your usual weights, stopping 3–4 reps short of failure. Moving still helps recovery; grinding doesn't.`)
    if (!ctx.lighter) actions.push({ kind: 'lighter', label: 'Make today lighter', date: ctx.date })
    lines.push('', 'If even that feels like too much, swap it for a 20–30 minute walk and mobility, and do the session tomorrow.')
  }
  if (/skip/.test(t)) lines.push('', 'Skipping one session is fine. Consistency over weeks matters far more than any single day.')
  return { text: lines.join('\n'), actions }
}

function todaysWorkout(ctx: CoachContext): CoachReply {
  const d = ctx.programDay
  const head = `**${WEEKDAY_LABEL[weekdayOf(ctx.date)]}: ${d.title}** (~${d.estMinutes} min)${ctx.lighter ? ' · lighter today' : ''}${ctx.workoutDone ? ' · ✅ done' : ''}`
  const body = sessionLine(ctx)
  const tip = d.kind === 'strength' ? '\n\nWarm up 5 minutes, then pick weights that leave 1–3 reps in reserve. When every set hits the top of the rep range, the app suggests adding weight next time.' : ''
  return { text: `${head}\n\n${body || 'Recovery day: take a walk, stretch, and sleep well.'}${tip}`, actions: d.kind === 'strength' && !ctx.workoutDone ? [{ kind: 'goto', label: 'Start workout', tab: 'train' }] : undefined }
}

function progress(ctx: CoachContext): CoachReply {
  const t = ctx.plan.targets
  const w = ctx.weight
  const p = ctx.profile
  if (!w.latest) return { text: 'Log your weight a few mornings a week (after the bathroom, before eating) and I can show your real trend. One tap in Today → Weight.', actions: [{ kind: 'goto', label: 'Log weight', tab: 'progress' }] }
  const lines = [`Latest weight: **${fmtWeight(w.latest, ctx.units)}** (${w.latestDate}).`]
  if (p.targetWeightKg) {
    const total = Math.abs(p.weightKg - p.targetWeightKg)
    const done = Math.abs(p.weightKg - w.latest)
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 100
    lines.push(`You're **${pct}%** of the way from ${fmtWeight(p.weightKg, ctx.units)} to ${fmtWeight(p.targetWeightKg, ctx.units)}.`)
  }
  if (w.trendKgPerWeek != null) {
    const trend = w.trendKgPerWeek
    lines.push(`3-week trend: **${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg/week** (plan: ${t.weeklyRateKg > 0 ? '+' : ''}${t.weeklyRateKg} kg/week).`)
    const losing = t.weeklyRateKg < 0
    if (losing && trend > -0.1) {
      lines.push(
        '',
        "That's a plateau. Before cutting food, check the basics: are you logging everything (oils, drinks, weekends)? Is your step count on target? If both are solid for another week, I'd trim about 100–150 kcal or add 2,000 daily steps rather than cutting hard.",
      )
    } else if (losing && trend < t.weeklyRateKg * 1.6) {
      lines.push('', "You're losing faster than planned. That can cost muscle and energy. Consider adding 100–200 kcal, mostly from carbs around training.")
    } else if (!losing && t.weeklyRateKg > 0 && trend < 0.05) {
      lines.push('', 'Weight is flat while building. Add roughly 150 kcal a day (an extra snack) and make sure training loads are going up.')
    } else {
      lines.push('', 'Right on track. Keep doing exactly this. 👏')
    }
  } else {
    lines.push('', 'Log a few more weigh-ins (3+ over two weeks) for a reliable trend; single days swing with water and salt.')
  }
  const a = ctx.adherence
  lines.push('', `This week: ${a.workouts} workout${a.workouts === 1 ? '' : 's'}, food logged on ${a.loggedDays}/7 days, water target hit ${a.waterDays}×.`)
  return { text: lines.join('\n'), actions: [{ kind: 'goto', label: 'See charts', tab: 'progress' }] }
}

function protein(ctx: CoachContext): CoachReply {
  const t = ctx.plan.targets
  const foods = proteinFoods(ctx, 4)
  const perKg = (t.proteinG / ctx.profile.weightKg).toFixed(1)
  return {
    text: [
      `Your protein target is **${t.proteinG} g/day** (${perKg} g per kg${t.method.sources.protein === 'profile' ? ', from your profile' : ''}). Today: **${r0(ctx.totals.p)} g**, so ${r0(Math.max(0, ctx.remaining.p))} g to go.`,
      '',
      'Spread it over 3–4 meals (≈25–40 g each). Good sources that fit your diet:',
      ...foods.map((f) => `- ${f.name}: ${f.serving.label} ≈ ${r0((f.p * f.serving.qty) / 100)} g`),
    ].join('\n'),
    actions: ctx.remaining.p > 20 ? foods.slice(0, 2).map((f) => ({ kind: 'addFood' as const, label: `Add ${f.name.split(',')[0]}`, foodId: f.id, grams: f.serving.qty, section: sectionForTime(ctx.time) })) : undefined,
  }
}

function hydration(ctx: CoachContext): CoachReply {
  const { ml, target } = ctx.water
  const left = Math.max(0, target - ml)
  const dayFraction = Math.min(1, Math.max(0, (hhmmToMinutes(ctx.time) - hhmmToMinutes(ctx.profile.lifestyle.wake)) / ((hhmmToMinutes(ctx.profile.lifestyle.sleep) - hhmmToMinutes(ctx.profile.lifestyle.wake) + 1440) % 1440 || 960)))
  const expected = Math.round((target * dayFraction) / 250) * 250
  const behind = ml < expected - 250
  return {
    text: [
      `Water today: **${fmtMl(ml)} / ${fmtMl(target)}**${ctx.programDay.kind !== 'rest' ? ` (includes +${ctx.plan.targets.trainingDayWaterBonusMl} ml for training)` : ''}.`,
      left ? (behind ? `You're a little behind for this time of day (aim ≈ ${fmtMl(expected)} by now). A glass now and one with each meal will close the gap.` : `On pace. ${fmtMl(left)} to go.`) : 'Target reached. Nice work. 💧',
      '',
      'Tip: pale-yellow urine is the simplest check. Add a pinch of salt or an electrolyte drink on long, sweaty sessions.',
    ].join('\n'),
    actions: left ? [{ kind: 'addWater', label: '+250 ml', ml: 250 }, { kind: 'addWater', label: '+500 ml', ml: 500 }] : undefined,
  }
}

function sleep(ctx: CoachContext): CoachReply {
  const p = ctx.profile.lifestyle
  const logged = ctx.journal.filter((j) => j.sleepHours != null).slice(0, 5)
  const avg = logged.length ? logged.reduce((s, j) => s + j.sleepHours!, 0) / logged.length : undefined
  return {
    text: [
      `Your schedule allows **${p.sleepHours} h** (lights out ${fmtClock(p.sleep)}, up ${fmtClock(p.wake)}); target ${ctx.plan.targets.sleepHours} h.`,
      avg != null ? `Recent journal average: **${avg.toFixed(1)} h**${avg < ctx.plan.targets.sleepHours - 0.5 ? ', below target, which hurts recovery and appetite control.' : '. 👍'}` : 'Add sleep hours to your journal check-ins and I can track it.',
      '',
      '- Same wake time every day, weekends included',
      '- Caffeine before ~2 pm only',
      '- Last big meal 2–3 h before bed',
      '- Dark, cool room; screens off 30–60 min before lights out',
    ].join('\n'),
    actions: [{ kind: 'goto', label: 'Journal check-in', tab: 'journal' }],
  }
}

function explainTargets(ctx: CoachContext): CoachReply {
  const t = ctx.plan.targets
  return {
    text: [
      `**Daily targets**: ${fmtNum(t.calories)} kcal · protein ${t.proteinG} g · carbs ${t.carbsG} g · fat ${t.fatG} g · fibre ${t.fiberG} g · water ${fmtMl(t.waterMl)} · ${fmtNum(t.steps)} steps.`,
      '',
      'How I got there, from your user_profile.md:',
      ...ctx.plan.notes.map((n) => `- ${n}`),
      '',
      'Edit any value in Settings → Profile and the whole plan regenerates.',
    ].join('\n'),
  }
}

function aroundWorkout(t: string, ctx: CoachContext): CoachReply {
  const post = /post|after/.test(t)
  const rules = dietRules(ctx.profile)
  const pick = (ids: string[]) => ids.map((id) => FOODS.find((f) => f.id === id)).filter((f): f is Food => !!f && foodAllowed(f, rules))
  const pre = pick(['banana', 'oats', 'rice-cakes', 'dates', 'greek-yogurt', 'wholewheat-bread', 'idli'])
  const postFoods = pick(['whey', 'pea-protein', 'greek-yogurt', 'cottage-cheese', 'egg', 'tofu', 'chicken-breast', 'lentils', 'milk', 'soy-milk'])
  const list = (post ? postFoods : pre).slice(0, 4)
  return {
    text: post
      ? [`**After training**: aim for 25–40 g protein plus some carbs within a couple of hours. Options that fit your diet:`, ...list.map((f) => `- ${f.name}`), '', ctx.nextMeal ? `Your next planned meal (**${ctx.nextMeal.recipe.name}**) works well if it's within ~2 h.` : ''].join('\n')
      : [`**Before training**: something light and carb-based 60–90 min before (or just water and coffee if you train early on an empty stomach and feel fine). Options:`, ...list.map((f) => `- ${f.name}`), '', 'Keep fat and fibre low right before the session so it sits well.'].join('\n'),
  }
}

function eatingOut(ctx: CoachContext): CoachReply {
  const rem = Math.max(0, r0(ctx.remaining.kcal))
  return {
    text: [
      `You have about **${fmtNum(rem)} kcal** left today. For a meal out:`,
      '- Build it around a protein (grilled, baked or tandoori) and vegetables',
      '- Pick one "extra": a starter, dessert *or* drinks, not all three',
      '- Ask for sauces and dressings on the side; go easy on fried sides',
      '- Alcohol: each drink is ~100–200 kcal and slows recovery, so alternate with water',
      '',
      "One higher day won't undo a week. Log it honestly and carry on tomorrow; no need to compensate.",
    ].join('\n'),
  }
}

function motivation(ctx: CoachContext): CoachReply {
  const a = ctx.adherence
  const wins = [
    ctx.streak > 1 && `a **${ctx.streak}-day** logging streak`,
    a.workouts > 0 && `**${a.workouts}** workout${a.workouts > 1 ? 's' : ''} this week`,
    a.waterDays > 0 && `water target hit **${a.waterDays}×**`,
    ctx.weight.logged > 3 && `**${ctx.weight.logged}** weigh-ins logged`,
  ].filter(Boolean)
  return {
    text: [
      `Hey ${greetingName(ctx)}, hard days are part of it.`,
      wins.length ? `Look at what you've already done: ${wins.join(', ')}.` : 'Every check-in, glass of water and set counts, and it adds up faster than it feels.',
      '',
      `For today, just do the next small thing: ${ctx.nextMeal ? `eat your planned ${ctx.nextMeal.planned.section}` : 'drink a glass of water'}${ctx.programDay.kind === 'strength' && !ctx.workoutDone ? `, then even 15 minutes of ${ctx.programDay.title}` : ''}. Momentum beats motivation.`,
      ctx.profile.goalsText[0] ? `\nRemember why you started: _${ctx.profile.goalsText[0]}_.` : '',
    ].join('\n'),
  }
}

function journalSummary(ctx: CoachContext): CoachReply {
  const recent = ctx.journal.slice(0, 5)
  if (!recent.length) return { text: 'No journal entries yet. A 20-second daily check-in (energy, soreness, sleep) lets me tune your training to how you actually feel.', actions: [{ kind: 'goto', label: 'Open journal', tab: 'journal' }] }
  const avg = (k: 'energy' | 'soreness' | 'mood') => {
    const v = recent.filter((j) => j[k] != null).map((j) => j[k]!)
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'
  }
  return {
    text: [
      `From your last ${recent.length} journal entries: energy **${avg('energy')}/5**, soreness **${avg('soreness')}/5**, mood **${avg('mood')}/5**.`,
      ctx.readiness ? `Today's readiness: **${ctx.readiness.score}/100 (${ctx.readiness.label})**.` : '',
      '',
      `Latest note (${recent[0].date}): _${recent[0].body.replace(/\s+/g, ' ').slice(0, 160) || 'no text'}_`,
    ].join('\n'),
  }
}

function steps(ctx: CoachContext): CoachReply {
  const d = ctx.programDay
  return {
    text: [
      `Daily step goal: **${fmtNum(ctx.plan.targets.steps)}**. Easiest wins: a 10-minute walk after each meal (~3,000 steps), take calls on foot, and park or get off one stop early.`,
      d.kind === 'cardio' && d.cardio ? `\nToday's planned cardio: **${d.cardio.activity}, ${d.cardio.minutes} min**: ${d.cardio.intensity}.` : '',
    ].join('\n'),
  }
}

function help(ctx: CoachContext): CoachReply {
  return {
    text: [
      `Hi ${greetingName(ctx)}! I'm your AuraFit coach. I know your profile, today's plan, your logs and your journal. Try:`,
      '- "What should I eat now?"',
      '- "Swap my lunch"',
      '- "I\'m sore, adjust my workout"',
      '- "Alternative to squats?"',
      '- "Am I on track?"',
      '- "I drank 500 ml" or "I weigh 72.4"',
      '- "Explain my targets"',
    ].join('\n'),
  }
}

function summary(ctx: CoachContext): CoachReply {
  const t = ctx.plan.targets
  return {
    text: [
      `Here's today at a glance, ${greetingName(ctx)}:`,
      `- **Food:** ${fmtNum(r0(ctx.totals.kcal))} / ${fmtNum(t.calories)} kcal · protein ${r0(ctx.totals.p)} / ${t.proteinG} g`,
      `- **Water:** ${fmtMl(ctx.water.ml)} / ${fmtMl(ctx.water.target)}`,
      `- **Training:** ${ctx.programDay.title}${ctx.workoutDone ? ' ✅' : ''}`,
      ctx.readiness ? `- **Readiness:** ${ctx.readiness.score}/100 (${ctx.readiness.label})` : '',
      '',
      "I didn't quite catch the question. Try asking about meals, swaps, your workout, progress, protein, water or sleep.",
    ]
      .filter((l) => l !== '')
      .join('\n'),
  }
}

/** Intents that must be answered on-device (safety, and logging commands with actions). */
export function priorityAnswer(question: string, ctx: CoachContext): CoachReply | undefined {
  const t = question.toLowerCase().trim()
  return safety(t) ?? quickLog(t, ctx)
}

/** Routes a question to the best intent. */
export function localAnswer(question: string, ctx: CoachContext): CoachReply {
  const t = question.toLowerCase().trim()
  return (
    safety(t) ??
    quickLog(t, ctx) ??
    exerciseSwap(t, ctx) ??
    mealSwap(t, ctx) ??
    workoutAdjust(t, ctx) ??
    (/pre[- ]?workout|before (my |the )?(workout|training|gym|session|run)|post[- ]?workout|after (my |the )?(workout|training|gym|session|run)/.test(t) ? aroundWorkout(t, ctx) : undefined) ??
    (/what (should|can|do|could) i (eat|have)|calories? (left|remaining)|remaining|left (for )?today|hungry|next meal|food idea|snack idea|macros? left|what'?s for (breakfast|lunch|dinner)/.test(t) ? whatToEat(ctx) : undefined) ??
    (/(today'?s|my|the) (workout|training|session|plan for today)|what('?s| is) (my |the )?(workout|training|session)|what am i (training|doing)|workout today|train today/.test(t) ? todaysWorkout(ctx) : undefined) ??
    (/restaurant|eating out|eat out|takeaway|take-out|takeout|party|cheat|pizza|burger|alcohol|beer|wine|drinks? (tonight|out)|wedding|birthday/.test(t) ? eatingOut(ctx) : undefined) ??
    (/why|how (did|do|does) you (calculate|get|work)|explain|tdee|bmr|maintenance|calorie target|my targets|how many calories|macros?\b/.test(t) ? explainTargets(ctx) : undefined) ??
    (/progress|plateau|stuck|not losing|stalled|weight trend|how am i doing|on track|losing|gaining|weigh/.test(t) ? progress(ctx) : undefined) ??
    (/protein/.test(t) ? protein(ctx) : undefined) ??
    (/water|hydrat|thirst|drink/.test(t) ? hydration(ctx) : undefined) ??
    (/sleep|insomnia|tired in the morning|bedtime/.test(t) ? sleep(ctx) : undefined) ??
    (/motivat|give up|giving up|struggl|lazy|can'?t be bothered|hard week|failing|discourag/.test(t) ? motivation(ctx) : undefined) ??
    (/journal|how have i been|mood|energy levels?|check[- ]?in/.test(t) ? journalSummary(ctx) : undefined) ??
    (/steps?|walk|cardio|\brun\b|running/.test(t) ? steps(ctx) : undefined) ??
    (/^(hi|hello|hey|yo|hiya|good (morning|afternoon|evening))\b|help|what can you do|who are you/.test(t) ? help(ctx) : undefined) ??
    summary(ctx)
  )
}

/* ------------------------------------------------------------------ daily insight */

export interface Insight {
  tone: 'good' | 'warn' | 'info'
  title: string
  body: string
  action?: CoachAction
}

/** The single most useful nudge for the Today screen right now. */
export function dailyInsight(ctx: CoachContext): Insight {
  const rd = ctx.readiness
  const d = ctx.programDay
  if (rd && rd.score < 50 && d.kind === 'strength' && !ctx.workoutDone && !ctx.lighter) {
    return {
      tone: 'warn',
      title: `Readiness ${rd.score}/100: go lighter today`,
      body: `Your check-in shows ${rd.reasons.join(', ') || 'low readiness'}. Keep the session, with one fewer set and ~80% loads.`,
      action: { kind: 'lighter', label: 'Make today lighter', date: ctx.date },
    }
  }
  const mins = hhmmToMinutes(ctx.time)
  const wake = hhmmToMinutes(ctx.profile.lifestyle.wake)
  const sleepAt = hhmmToMinutes(ctx.profile.lifestyle.sleep)
  const span = (sleepAt - wake + 1440) % 1440 || 960
  const frac = Math.min(1, Math.max(0, ((mins - wake + 1440) % 1440) / span))
  if (frac > 0.35 && ctx.water.ml < ctx.water.target * frac - 500) {
    return { tone: 'info', title: 'Hydration is behind', body: `${fmtMl(ctx.water.ml)} so far. Aim for about ${fmtMl(Math.round((ctx.water.target * frac) / 250) * 250)} by now.`, action: { kind: 'addWater', label: '+500 ml', ml: 500 } }
  }
  if (frac > 0.7 && ctx.remaining.p > 35) {
    const f = proteinFoods(ctx, 1)[0]
    return {
      tone: 'info',
      title: `${r0(ctx.remaining.p)} g protein to go`,
      body: f ? `An easy fix: ${f.name.toLowerCase()} (${f.serving.label}) adds ≈${r0((f.p * f.serving.qty) / 100)} g.` : 'Make your next meal protein-first.',
      action: f ? { kind: 'addFood', label: `Add ${f.name.split(',')[0]}`, foodId: f.id, grams: f.serving.qty, section: sectionForTime(ctx.time) } : undefined,
    }
  }
  if (ctx.workoutDone) return { tone: 'good', title: 'Workout done ✅', body: 'Prioritise protein, water and sleep tonight; that is when the progress happens.' }
  if (d.kind === 'strength') return { tone: 'info', title: `Today: ${d.title}`, body: `${d.exercises.length} exercises · ~${d.estMinutes} min${ctx.lighter ? ' · set to lighter' : ''}.`, action: { kind: 'goto', label: 'Start workout', tab: 'train' } }
  if (ctx.streak >= 3) return { tone: 'good', title: `${ctx.streak}-day streak 🔥`, body: 'Consistency is the whole game, and you are playing it.' }
  return { tone: 'info', title: d.title, body: d.cardio ? `${d.cardio.activity} · ${d.cardio.minutes} min (${d.cardio.intensity.toLowerCase()}).` : 'Recover well today.' }
}


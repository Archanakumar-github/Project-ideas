import { RECIPES } from '../data/recipes'
import { WEEK_ORDER, hhmmToMinutes, minutesToHHMM, type Weekday } from '../lib/dates'
import { hash, normalize, seededRandom, shuffle } from '../lib/utils'
import type { DayMealPlan, MealSection, PlannedMeal, Profile, Recipe, Targets } from '../types'
import { dietRules, recipeAllowed, type DietRules } from './dietRules'
import { getFood, recipeMacros, scaleFor } from './nutrition'

/**
 * Builds a 7-day meal plan from the profile:
 *  - meal slots from "meals per day" / snacks / fasting window,
 *  - each slot gets a share of the calorie target,
 *  - candidate templates are filtered by diet rules, ranked by how well their protein
 *    density matches the target (and favourite cuisines), then rotated across the week
 *    with a seeded shuffle so "Regenerate" gives fresh variety,
 *  - a final pass upgrades snacks when a day's protein falls short.
 */

interface Slot {
  section: MealSection
  share: number
  time: string
}

const BASE_SHARE: Record<MealSection, number> = { breakfast: 0.27, lunch: 0.33, dinner: 0.32, snacks: 0.1 }

export function mealSlots(p: Profile): Slot[] {
  const { wake, sleep, mealTimes } = p.lifestyle
  const slots: Array<Omit<Slot, 'share'> & { weight: number }> = []
  const window = p.diet.fastingWindow
  const skip = p.diet.skipBreakfast || p.diet.mealsPerDay <= 2
  const wakeMin = hhmmToMinutes(wake)
  let sleepMin = hhmmToMinutes(sleep)
  if (sleepMin <= wakeMin) sleepMin += 1440

  let breakfastAt = Math.max(wakeMin + 45, window ? hhmmToMinutes(window.start) : 0)
  const trainAt = p.training.preferredTime ? hhmmToMinutes(p.training.preferredTime) : undefined
  // Morning trainers eat after the session.
  if (trainAt != null && trainAt >= wakeMin && trainAt < wakeMin + 150 && Math.abs(trainAt - breakfastAt) < 60) {
    breakfastAt = Math.min(trainAt + p.training.sessionMinutes + 15, 10 * 60)
  }
  if (!skip) slots.push({ section: 'breakfast', time: mealTimes.breakfast ?? minutesToHHMM(breakfastAt), weight: BASE_SHARE.breakfast })
  const lunchDefault = window && skip ? hhmmToMinutes(window.start) : 12 * 60 + 30
  slots.push({ section: 'lunch', time: mealTimes.lunch ?? minutesToHHMM(lunchDefault), weight: BASE_SHARE.lunch + (skip ? 0.1 : 0) })
  const dinnerDefault = Math.min(Math.max(sleepMin - 180, 18 * 60), 20 * 60 + 30)
  const dinnerAt = window ? Math.min(dinnerDefault, hhmmToMinutes(window.end) - 30) : dinnerDefault
  slots.push({ section: 'dinner', time: mealTimes.dinner ?? minutesToHHMM(dinnerAt), weight: BASE_SHARE.dinner + (skip ? 0.12 : 0) })
  const snackCount = Math.max(0, Math.min(3, p.diet.snacksPerDay))
  const snackTimes = [mealTimes.snack ?? '16:00', skip ? '19:30' : '10:30', '21:00']
  for (let i = 0; i < snackCount; i++) slots.push({ section: 'snacks', time: snackTimes[i], weight: BASE_SHARE.snacks })

  const total = slots.reduce((s, x) => s + x.weight, 0)
  return slots
    .map(({ weight, ...rest }) => ({ ...rest, share: weight / total }))
    .sort((a, b) => hhmmToMinutes(a.time) - hhmmToMinutes(b.time))
}

function cuisineBonus(recipe: Recipe, p: Profile) {
  const liked = [...p.diet.cuisines, ...p.diet.likes].map(normalize)
  if (!liked.length) return 0
  const c = normalize(recipe.cuisine)
  const name = normalize(recipe.name)
  return liked.some((l) => l && (c.includes(l) || name.includes(l))) ? 0.05 : 0
}

/** Ranked templates for a section, best first. */
export function candidatesFor(section: MealSection, targetKcal: number, targets: Targets, p: Profile, rules: DietRules = dietRules(p)): Recipe[] {
  const proteinShare = (targets.proteinG * 4) / targets.calories
  return RECIPES.filter((r) => r.sections.includes(section) && recipeAllowed(r, rules))
    .map((r) => {
      const m = recipeMacros(r)
      const share = m.kcal ? (m.p * 4) / m.kcal : 0
      const raw = targetKcal / (m.kcal || 1)
      const portionPenalty = raw < 0.5 || raw > 2.5 ? 0.25 : raw < 0.7 || raw > 1.8 ? 0.06 : 0
      // Under-shooting protein costs more than over-shooting it.
      const fit = share < proteinShare ? (proteinShare - share) * 1.4 : (share - proteinShare) * 0.6
      return { r, score: fit + portionPenalty - cuisineBonus(r, p) }
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.r)
}

export function buildMealPlan(p: Profile, targets: Targets, seed: number): DayMealPlan[] {
  const rules = dietRules(p)
  const slots = mealSlots(p)
  const rand = seededRandom(seed ^ hash('meals'))
  const pools = new Map<string, Recipe[]>()
  const poolFor = (slot: Slot, idx: number) => {
    const key = `${slot.section}-${idx}`
    if (!pools.has(key)) {
      const ranked = candidatesFor(slot.section, targets.calories * slot.share, targets, p, rules)
      const top = ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.6)))
      pools.set(key, shuffle(top, rand))
    }
    return pools.get(key)!
  }

  const plan: DayMealPlan[] = WEEK_ORDER.map((weekday, dayIdx) => {
    const used = new Set<string>()
    const meals: PlannedMeal[] = slots.map((slot, slotIdx) => {
      const pool = poolFor(slot, slotIdx)
      let recipe: Recipe | undefined
      for (let k = 0; k < pool.length && pool.length; k++) {
        const candidate = pool[(dayIdx + k) % pool.length]
        if (!used.has(candidate.id)) {
          recipe = candidate
          break
        }
      }
      recipe ??= pool[0]
      if (recipe) used.add(recipe.id)
      return {
        id: `${weekday}-${slot.section}-${slotIdx}`,
        section: slot.section,
        recipeId: recipe?.id ?? '',
        targetKcal: Math.round(targets.calories * slot.share),
        time: slot.time,
      }
    })
    return { weekday, meals: meals.filter((m) => m.recipeId) }
  })

  // Protein top-up: swap a snack for the most protein-dense allowed snack when short.
  const snackRank = RECIPES.filter((r) => r.sections.includes('snacks') && recipeAllowed(r, rules))
    .map((r) => {
      const m = recipeMacros(r)
      return { r, density: m.kcal ? m.p / m.kcal : 0 }
    })
    .sort((a, b) => b.density - a.density)
  const topSnacks = snackRank.slice(0, 3)
  plan.forEach((day, dayIdx) => {
    const protein = day.meals.reduce((s, m) => s + planMealMacros(m).p, 0)
    if (protein >= targets.proteinG * 0.88 || !topSnacks.length) return
    const snack = day.meals.find((m) => m.section === 'snacks')
    if (!snack) return
    const current = recipeMacros(getRecipe(snack.recipeId)!)
    const pick = topSnacks[dayIdx % topSnacks.length]
    if (pick.density > current.p / (current.kcal || 1)) snack.recipeId = pick.r.id
  })
  return plan
}

function getRecipe(id: string) {
  return RECIPES.find((r) => r.id === id)
}

export function planMealMacros(m: PlannedMeal) {
  const r = getRecipe(m.recipeId)
  if (!r) return { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 }
  return recipeMacros(r, scaleFor(r, m.targetKcal))
}

/** Alternatives for "Swap", best match first, excluding the current recipe. */
export function swapOptions(p: Profile, targets: Targets, meal: PlannedMeal, currentId: string, count = 3): Recipe[] {
  return candidatesFor(meal.section, meal.targetKcal, targets, p)
    .filter((r) => r.id !== currentId)
    .slice(0, count)
}

export interface GroceryItem {
  foodId: string
  name: string
  grams: number
  unit: 'g' | 'ml'
  group: string
}

/** Weekly shopping list, grouped by aisle. */
export function groceryList(plan: DayMealPlan[], days: Weekday[] = WEEK_ORDER): GroceryItem[] {
  const totals = new Map<string, number>()
  for (const day of plan) {
    if (!days.includes(day.weekday)) continue
    for (const meal of day.meals) {
      const r = getRecipe(meal.recipeId)
      if (!r) continue
      const scale = scaleFor(r, meal.targetKcal)
      for (const [id, g] of r.items) totals.set(id, (totals.get(id) ?? 0) + g * scale)
    }
  }
  const order = ['protein', 'legume', 'dairy', 'grain', 'veg', 'fruit', 'fat', 'drink', 'snack', 'condiment']
  return [...totals.entries()]
    .map(([foodId, grams]) => {
      const food = getFood(foodId)
      return { foodId, name: food?.name ?? foodId, grams: Math.round(grams), unit: food?.unit ?? 'g', group: food?.group ?? 'other' }
    })
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name))
}

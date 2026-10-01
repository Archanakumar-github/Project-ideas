import { FOOD_BY_ID } from '../data/foods'
import { RECIPE_BY_ID } from '../data/recipes'
import type { DayLog, Food, FoodLogItem, PlannedMeal, Recipe } from '../types'

export interface Macros {
  kcal: number
  p: number
  c: number
  f: number
  fiber: number
}

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 }

export function addMacros(a: Macros, b: Partial<Macros>): Macros {
  return { kcal: a.kcal + (b.kcal ?? 0), p: a.p + (b.p ?? 0), c: a.c + (b.c ?? 0), f: a.f + (b.f ?? 0), fiber: a.fiber + (b.fiber ?? 0) }
}

export function scaleMacros(m: Macros, k: number): Macros {
  return { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k, fiber: m.fiber * k }
}

export function foodMacros(food: Food, qty: number): Macros {
  const k = qty / 100
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k, fiber: (food.fiber ?? 0) * k }
}

/** Custom / Open Food Facts foods saved on this device. */
let extraFoods = new Map<string, Food>()
export function registerFoods(foods: Food[]) {
  extraFoods = new Map(foods.map((f) => [f.id, f]))
}
export function getFood(id: string): Food | undefined {
  return FOOD_BY_ID.get(id) ?? extraFoods.get(id)
}

export function recipeMacros(recipe: Recipe, scale = 1): Macros {
  let m = ZERO
  for (const [id, grams] of recipe.items) {
    const food = getFood(id)
    if (food) m = addMacros(m, foodMacros(food, grams * scale))
  }
  return m
}

/** Portion multiplier that brings a recipe to `targetKcal`, rounded to 0.05 and clamped. */
export function scaleFor(recipe: Recipe, targetKcal: number): number {
  const base = recipeMacros(recipe).kcal
  if (!base) return 1
  return Math.min(2.5, Math.max(0.5, Math.round((targetKcal / base) * 20) / 20))
}

export interface ResolvedMeal {
  planned: PlannedMeal
  recipe: Recipe
  scale: number
  macros: Macros
  eaten: boolean
  swapped: boolean
}

export function resolvePlanned(planned: PlannedMeal, day?: DayLog): ResolvedMeal | undefined {
  const state = day?.planned[planned.id]
  const recipe = RECIPE_BY_ID.get(state?.recipeId ?? planned.recipeId) ?? RECIPE_BY_ID.get(planned.recipeId)
  if (!recipe) return undefined
  const scale = scaleFor(recipe, planned.targetKcal)
  return { planned, recipe, scale, macros: recipeMacros(recipe, scale), eaten: !!state?.eaten, swapped: !!state?.recipeId && state.recipeId !== planned.recipeId }
}

export function itemMacros(item: FoodLogItem): Macros {
  return { kcal: item.kcal, p: item.p, c: item.c, f: item.f, fiber: 0 }
}

/** Rounded grams for display: eggs and such show as servings when it reads naturally. */
export function fmtPortion(foodId: string, grams: number): string {
  const food = getFood(foodId)
  const g = Math.round(grams / 5) * 5 || Math.round(grams)
  if (!food) return `${g} g`
  const unit = food.unit
  const servings = grams / food.serving.qty
  const nice = Math.round(servings * 2) / 2
  if (Math.abs(servings - nice) < 0.12 && nice >= 0.5 && nice <= 6 && !/^\d/.test(food.serving.label)) {
    return `${nice === 1 ? '' : `${nice} × `}${food.serving.label} (${g} ${unit})`
  }
  if (Math.abs(servings - nice) < 0.12 && nice >= 0.5 && nice <= 6 && /^1 /.test(food.serving.label)) {
    const label = food.serving.label.replace(/^1 /, '')
    return `${nice} ${label}${nice > 1 && !/s$/.test(label) ? 's' : ''} (${g} ${unit})`
  }
  return `${g} ${unit}`
}

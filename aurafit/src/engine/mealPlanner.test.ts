import { describe, expect, it } from 'vitest'
import { RECIPE_BY_ID } from '../data/recipes'
import { FOOD_BY_ID } from '../data/foods'
import { buildMealPlan, groceryList, mealSlots, planMealMacros, swapOptions } from './mealPlanner'
import { computeTargets } from './targets'
import { dietRules, foodAllowed, mentions } from './dietRules'
import { exampleProfile, makeProfile } from '../test/factories'
import type { Profile } from '../types'

function ingredientsOf(plan: ReturnType<typeof buildMealPlan>) {
  return plan.flatMap((d) => d.meals.flatMap((m) => RECIPE_BY_ID.get(m.recipeId)!.items.map(([id]) => FOOD_BY_ID.get(id)!)))
}

describe('meal planner', () => {
  it('builds 7 days that respect the example profile (vegetarian, no peanut, no lactose, dislikes)', () => {
    const p = exampleProfile()
    const t = computeTargets(p)
    const plan = buildMealPlan(p, t, 42)
    expect(plan).toHaveLength(7)
    for (const day of plan) {
      expect(day.meals.map((m) => m.section).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snacks'])
      const kcal = day.meals.reduce((s, m) => s + planMealMacros(m).kcal, 0)
      expect(Math.abs(kcal - t.calories) / t.calories).toBeLessThan(0.08)
    }
    for (const food of ingredientsOf(plan)) {
      expect(['meat', 'pork', 'poultry', 'fish', 'shellfish']).not.toContain(food.kind)
      expect(food.allergens).not.toContain('peanut')
      expect(food.allergens).not.toContain('lactose')
      expect(food.id).not.toBe('mushrooms')
      expect(food.id).not.toBe('olives')
    }
    // Disliking olives must not ban olive oil.
    expect(ingredientsOf(plan).some((f) => f.id === 'olive-oil')).toBe(true)
  })

  it('builds fully vegan, gluten-free, nut-free plans', () => {
    const p: Profile = makeProfile({ diet: { ...makeProfile().diet, styles: ['vegan'], allergies: ['gluten', 'nuts'] } })
    const plan = buildMealPlan(p, computeTargets(p), 7)
    for (const food of ingredientsOf(plan)) {
      expect(food.kind).toBe('plant')
      expect(food.allergens).not.toContain('gluten')
      expect(food.allergens).not.toContain('nuts')
      expect(food.id).not.toBe('honey')
    }
  })

  it('drops breakfast for a fasting window and shifts calories to later meals', () => {
    const p = makeProfile({ diet: { ...makeProfile().diet, skipBreakfast: true, mealsPerDay: 2, fastingWindow: { start: '12:00', end: '20:00' } } })
    const slots = mealSlots(p)
    expect(slots.some((s) => s.section === 'breakfast')).toBe(false)
    expect(slots[0].time).toBe('12:00')
    expect(slots.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1)
  })

  it('is deterministic per seed and varies between seeds', () => {
    const p = exampleProfile()
    const t = computeTargets(p)
    const ids = (seed: number) => buildMealPlan(p, t, seed).flatMap((d) => d.meals.map((m) => m.recipeId)).join()
    expect(ids(1)).toBe(ids(1))
    expect(ids(1)).not.toBe(ids(2))
  })

  it('offers diet-safe swaps and a weekly grocery list', () => {
    const p = exampleProfile()
    const t = computeTargets(p)
    const plan = buildMealPlan(p, t, 3)
    const lunch = plan[0].meals.find((m) => m.section === 'lunch')!
    const options = swapOptions(p, t, lunch, lunch.recipeId, 3)
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.id)).not.toContain(lunch.recipeId)
    const rules = dietRules(p)
    for (const o of options) for (const [id] of o.items) expect(foodAllowed(FOOD_BY_ID.get(id)!, rules)).toBe(true)
    const list = groceryList(plan)
    expect(list.length).toBeGreaterThan(10)
    expect(new Set(list.map((i) => i.foodId)).size).toBe(list.length)
  })

  it('matches disliked foods by whole word', () => {
    expect(mentions('Olive oil', 'olive')).toBe(false)
    expect(mentions('Olives', 'olive')).toBe(true)
    expect(mentions('Mushrooms', 'mushroom')).toBe(true)
    expect(mentions('Coconut milk', 'nut')).toBe(false)
  })
})

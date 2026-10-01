import type { Plan, Profile } from '../types'
import { buildMealPlan } from './mealPlanner'
import { buildProgram } from './programBuilder'
import { computeTargets } from './targets'
import { describeRules, dietRules } from './dietRules'

/** Everything AuraFit recommends, derived from the imported profile alone. */
export function generatePlan(profile: Profile, seed = Math.floor(Math.random() * 2 ** 31)): Plan {
  const targets = computeTargets(profile)
  const meals = buildMealPlan(profile, targets, seed)
  const program = buildProgram(profile, seed)
  const rules = describeRules(dietRules(profile))
  const notes = [...targets.method.notes, ...rules.map((r) => `Meals: ${r}.`), ...program.notes]
  if (profile.diet.allergies.includes('gluten')) notes.push('Choose certified gluten-free oats and sauces.')
  return { createdAt: Date.now(), seed, targets, meals, program, notes }
}

/** Regenerate only the meals (keeps program and targets). */
export function regenerateMeals(profile: Profile, plan: Plan, seed = Math.floor(Math.random() * 2 ** 31)): Plan {
  return { ...plan, seed, meals: buildMealPlan(profile, plan.targets, seed) }
}

export function regenerateProgram(profile: Profile, plan: Plan, seed = Math.floor(Math.random() * 2 ** 31)): Plan {
  return { ...plan, program: buildProgram(profile, seed) }
}

import { normalize } from '../lib/utils'
import type { Allergen, Food, FoodKind, Profile, Recipe } from '../types'
import { getFood, recipeMacros } from './nutrition'

/** What a profile's diet allows, as a food predicate. */
export interface DietRules {
  excludeKinds: Set<FoodKind>
  excludeAllergens: Set<Allergen>
  excludeIds: Set<string>
  excludeGroups: Set<Food['group']>
  avoidTerms: string[]
  /** Original wording of the avoid list, for display. */
  avoidLabels: string[]
  keto: boolean
  lowCarb: boolean
}

const ALLERGEN_WORDS: Record<string, Allergen> = {
  gluten: 'gluten',
  dairy: 'dairy',
  lactose: 'lactose',
  nuts: 'nuts',
  peanut: 'peanut',
  soy: 'soy',
  egg: 'egg',
  fish: 'fish',
  shellfish: 'shellfish',
  sesame: 'sesame',
}

export function dietRules(p: Profile): DietRules {
  const styles = new Set(p.diet.styles)
  const kinds = new Set<FoodKind>()
  const ids = new Set<string>()
  const groups = new Set<Food['group']>()
  if (styles.has('vegan')) {
    ;(['meat', 'pork', 'poultry', 'fish', 'shellfish', 'egg', 'dairy'] as FoodKind[]).forEach((k) => kinds.add(k))
    ids.add('honey')
  }
  if (styles.has('vegetarian') || styles.has('jain')) (['meat', 'pork', 'poultry', 'fish', 'shellfish'] as FoodKind[]).forEach((k) => kinds.add(k))
  if (styles.has('pescatarian')) (['meat', 'pork', 'poultry'] as FoodKind[]).forEach((k) => kinds.add(k))
  if (styles.has('halal') || styles.has('kosher')) kinds.add('pork')
  if (styles.has('kosher')) kinds.add('shellfish')
  if (styles.has('jain')) ['onion', 'potato', 'sweet-potato', 'carrot'].forEach((id) => ids.add(id))
  if (styles.has('paleo')) {
    groups.add('grain')
    groups.add('legume')
    kinds.add('dairy')
  }

  const allergens = new Set<Allergen>(p.diet.allergies)
  const terms: string[] = []
  for (const raw of p.diet.avoid) {
    const word = normalize(raw)
    if (!word) continue
    if (ALLERGEN_WORDS[word]) allergens.add(ALLERGEN_WORDS[word])
    else if (word === 'egg' || word === 'eggs') kinds.add('egg')
    else if (/^(red meat|beef|meat)$/.test(word)) kinds.add('meat')
    else if (/^(pork|bacon|ham)$/.test(word)) kinds.add('pork')
    else if (/^(chicken|poultry|turkey)$/.test(word)) kinds.add('poultry')
    else terms.push(singular(word))
  }
  // A lactose intolerance excludes lactose-bearing foods only (hard cheese, ghee and
  // lactose-free milk stay in).
  return {
    excludeKinds: kinds,
    excludeAllergens: allergens,
    excludeIds: ids,
    excludeGroups: groups,
    avoidTerms: terms,
    avoidLabels: p.diet.avoid.filter((a) => !ALLERGEN_WORDS[normalize(a)]),
    keto: styles.has('keto'),
    lowCarb: styles.has('low_carb'),
  }
}

/** "tomatoes" -> "tomato", "berries" -> "berry", "olives" -> "olive". */
export function singular(word: string): string {
  return word
    .split(' ')
    .map((w) => (/ies$/.test(w) ? w.slice(0, -3) + 'y' : /(oes|ses|xes|ches|shes)$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) ? w.slice(0, -1) : w))
    .join(' ')
}

/** Does a disliked term name this food? Whole words only, and "olive" doesn't ban olive oil. */
export function mentions(foodName: string, term: string): boolean {
  const tokens = normalize(foodName).split(' ').map(singular)
  const parts = term.split(' ')
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    if (parts.every((p, j) => tokens[i + j] === p)) {
      const next = tokens[i + parts.length]
      if (next === 'oil') continue
      return true
    }
  }
  return false
}

export function foodAllowed(food: Food, rules: DietRules): boolean {
  if (rules.excludeIds.has(food.id)) return false
  if (rules.excludeKinds.has(food.kind)) return false
  if (rules.excludeGroups.has(food.group) && !['sweet-potato', 'potato'].includes(food.id)) return false
  if (food.allergens.some((a) => rules.excludeAllergens.has(a))) return false
  if (rules.excludeAllergens.has('dairy') && food.kind === 'dairy') return false
  if (rules.avoidTerms.some((t) => t.length > 2 && (mentions(food.name, t) || mentions(food.id.replace(/-/g, ' '), t)))) return false
  return true
}

/** Net carbs as a share of calories: keto <= 10%, low-carb <= 26%. */
export function recipeCarbShare(recipe: Recipe) {
  const m = recipeMacros(recipe)
  return m.kcal ? ((m.c - m.fiber) * 4) / m.kcal : 0
}

export function recipeAllowed(recipe: Recipe, rules: DietRules): boolean {
  for (const [id] of recipe.items) {
    const food = getFood(id)
    if (!food || !foodAllowed(food, rules)) return false
  }
  if (rules.keto && recipeCarbShare(recipe) > 0.12) return false
  if (rules.lowCarb && recipeCarbShare(recipe) > 0.3) return false
  return true
}

/** Plain-language summary of the active rules, for the plan screen. */
export function describeRules(rules: DietRules): string[] {
  const out: string[] = []
  if (rules.excludeKinds.size) out.push(`No ${[...rules.excludeKinds].join(', ')}`)
  if (rules.excludeAllergens.size) out.push(`Free from ${[...rules.excludeAllergens].join(', ')}`)
  if (rules.avoidLabels.length) out.push(`Avoiding ${rules.avoidLabels.join(', ')}`)
  if (rules.keto) out.push('Keto: very low carb')
  else if (rules.lowCarb) out.push('Low carb')
  return out
}

import { getJSON } from './http'

/** TheMealDB (free test key "1"): recipe inspiration with photos and instructions. */

export interface RecipeIdea {
  id: string
  name: string
  thumb?: string
  category?: string
  area?: string
  instructions?: string
  ingredients?: string[]
  source?: string
  youtube?: string
}

interface MealDbMeal {
  idMeal: string
  strMeal: string
  strMealThumb?: string
  strCategory?: string
  strArea?: string
  strInstructions?: string
  strSource?: string
  strYoutube?: string
  [k: string]: string | undefined
}

export function toIdea(m: MealDbMeal): RecipeIdea {
  const ingredients: string[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = m[`strIngredient${i}`]?.trim()
    const measure = m[`strMeasure${i}`]?.trim()
    if (ing) ingredients.push(measure ? `${measure} ${ing}` : ing)
  }
  return {
    id: m.idMeal,
    name: m.strMeal,
    thumb: m.strMealThumb,
    category: m.strCategory,
    area: m.strArea,
    instructions: m.strInstructions,
    ingredients: ingredients.length ? ingredients : undefined,
    source: m.strSource || undefined,
    youtube: m.strYoutube || undefined,
  }
}

const BASE = 'https://www.themealdb.com/api/json/v1/1'

export async function searchRecipes(query: string, signal?: AbortSignal): Promise<RecipeIdea[]> {
  const res = await getJSON<{ meals: MealDbMeal[] | null }>(`${BASE}/search.php?s=${encodeURIComponent(query)}`, { signal })
  return (res.meals ?? []).slice(0, 8).map(toIdea)
}

export async function recipesByIngredient(ingredient: string, signal?: AbortSignal): Promise<RecipeIdea[]> {
  const res = await getJSON<{ meals: MealDbMeal[] | null }>(`${BASE}/filter.php?i=${encodeURIComponent(ingredient.replace(/\s+/g, '_'))}`, { signal })
  return (res.meals ?? []).slice(0, 8).map(toIdea)
}

export async function recipesByCategory(category: 'Vegetarian' | 'Vegan' | 'Seafood' | 'Chicken' | 'Breakfast', signal?: AbortSignal): Promise<RecipeIdea[]> {
  const res = await getJSON<{ meals: MealDbMeal[] | null }>(`${BASE}/filter.php?c=${category}`, { signal })
  return (res.meals ?? []).slice(0, 8).map(toIdea)
}

export async function recipeDetails(id: string, signal?: AbortSignal): Promise<RecipeIdea | undefined> {
  const res = await getJSON<{ meals: MealDbMeal[] | null }>(`${BASE}/lookup.php?i=${encodeURIComponent(id)}`, { signal })
  return res.meals?.[0] ? toIdea(res.meals[0]) : undefined
}

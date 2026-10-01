import { describe, expect, it } from 'vitest'
import { offToFood } from './openFoodFacts'
import { toIdea } from './mealDb'
import { stripHtml } from './wger'

describe('public API response parsing', () => {
  it('maps an Open Food Facts product to a food', () => {
    const food = offToFood({
      code: '3017620422003',
      product_name: 'Nutella',
      brands: 'Ferrero,Nutella',
      serving_size: '15 g',
      serving_quantity: 15,
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
      allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    })!
    expect(food).toMatchObject({ id: 'off:3017620422003', name: 'Nutella', brand: 'Ferrero', kcal: 539, p: 6.3, c: 57.5, f: 30.9, serving: { label: '15 g', qty: 15 }, kind: 'dairy', source: 'openfoodfacts' })
    expect(food.allergens.sort()).toEqual(['dairy', 'nuts', 'soy'])
    expect(offToFood({ code: '1', product_name: 'No data' })).toBeUndefined()
    expect(offToFood({ code: '2', product_name: 'kJ only', nutriments: { energy_100g: 418.4 } })?.kcal).toBe(100)
  })

  it('maps a TheMealDB meal with ingredients', () => {
    const idea = toIdea({ idMeal: '52772', strMeal: 'Teriyaki Chicken', strMealThumb: 'https://x/y.jpg', strArea: 'Japanese', strIngredient1: 'soy sauce', strMeasure1: '3/4 cup', strIngredient2: '', strIngredient3: 'water' })
    expect(idea).toMatchObject({ id: '52772', name: 'Teriyaki Chicken', area: 'Japanese', ingredients: ['3/4 cup soy sauce', 'water'] })
  })

  it('cleans wger HTML descriptions', () => {
    expect(stripHtml('<p>Stand tall.</p><ul><li>Brace</li><li>Push</li></ul>&nbsp;Done &amp; dusted')).toBe('Stand tall.\n• Brace\n• Push\n Done & dusted')
  })
})

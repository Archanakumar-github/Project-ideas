import type { Food } from '../types'
import { getJSON } from './http'

/**
 * Open Food Facts: free, open, CORS-enabled product database (barcodes + packaged foods).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

interface OffProduct {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
  allergens_tags?: string[]
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

export function offToFood(p: OffProduct): Food | undefined {
  const n = p.nutriments ?? {}
  const name = (p.product_name_en || p.product_name || '').trim()
  let kcal = num(n['energy-kcal_100g'])
  if (kcal == null && num(n['energy_100g']) != null) kcal = num(n['energy_100g'])! / 4.184
  if (!name || kcal == null || !p.code) return undefined
  const servingQty = num(p.serving_quantity)
  const allergens = (p.allergens_tags ?? []).map((t) => t.replace(/^en:/, ''))
  const map: Record<string, Food['allergens'][number]> = { gluten: 'gluten', milk: 'dairy', nuts: 'nuts', peanuts: 'peanut', soybeans: 'soy', eggs: 'egg', fish: 'fish', crustaceans: 'shellfish', molluscs: 'shellfish', 'sesame-seeds': 'sesame' }
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    kcal: Math.round(kcal),
    p: Math.round((num(n.proteins_100g) ?? 0) * 10) / 10,
    c: Math.round((num(n.carbohydrates_100g) ?? 0) * 10) / 10,
    f: Math.round((num(n.fat_100g) ?? 0) * 10) / 10,
    fiber: num(n.fiber_100g),
    unit: /ml|cl|\bl\b/i.test(p.serving_size ?? '') ? 'ml' : 'g',
    serving: servingQty && servingQty > 0 ? { label: p.serving_size?.trim() || '1 serving', qty: servingQty } : { label: '100 g', qty: 100 },
    kind: allergens.includes('milk') ? 'dairy' : 'plant',
    allergens: [...new Set(allergens.map((a) => map[a]).filter(Boolean))],
    group: 'snack',
    source: 'openfoodfacts',
  }
}

const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments,allergens_tags'

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = query.trim()
  if (!q) return []
  if (/^\d{8,14}$/.test(q)) {
    const res = await getJSON<{ status?: number; product?: OffProduct }>(`https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=${FIELDS}`, { signal })
    const food = res.product ? offToFood({ ...res.product, code: res.product.code ?? q }) : undefined
    return food ? [food] : []
  }
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`
  const res = await getJSON<{ products?: OffProduct[] }>(url, { signal })
  const seen = new Set<string>()
  return (res.products ?? [])
    .map(offToFood)
    .filter((f): f is Food => !!f && f.kcal > 0 && !seen.has(f.id) && !!seen.add(f.id))
    .slice(0, 12)
}

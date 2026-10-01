import { getFood, foodMacros } from '../engine/nutrition'
import { RECIPE_BY_ID } from '../data/recipes'
import { addFood, addWater, removeFood, restoreDay, setLighter, setWeight, swapMeal } from '../store/app'
import { closeAllSheetsAnd } from './nav'
import { toast } from '../store/ui'
import { today } from '../lib/dates'
import { fmtMl } from '../lib/units'
import type { CoachAction } from '../types'

/** Executes a one-tap coach suggestion. Every change offers Undo. */
export function runAction(a: CoachAction) {
  const date = 'date' in a ? a.date : today()
  switch (a.kind) {
    case 'addWater': {
      const prev = addWater(date, a.ml)
      toast({ message: `Added ${fmtMl(a.ml)} of water`, actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
      return
    }
    case 'logWeight': {
      const prev = setWeight(date, a.kg)
      toast({ message: 'Weight logged', actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
      return
    }
    case 'lighter':
      setLighter(a.date, true)
      toast({ message: "Today's session is now lighter", actionLabel: 'Undo', onAction: () => setLighter(a.date, false) })
      return
    case 'swapMeal': {
      const prev = swapMeal(a.date, a.plannedId, a.recipeId)
      toast({ message: `Swapped to ${RECIPE_BY_ID.get(a.recipeId)?.name ?? 'new meal'}`, actionLabel: 'Undo', onAction: () => restoreDay(a.date, prev) })
      return
    }
    case 'addFood': {
      const food = getFood(a.foodId)
      if (!food) return
      const m = foodMacros(food, a.grams)
      const item = addFood(date, { section: a.section, name: food.name, foodId: food.id, qty: a.grams, unit: food.unit, kcal: m.kcal, p: m.p, c: m.c, f: m.f, source: 'coach' })
      toast({ message: `Added ${food.name}`, actionLabel: 'Undo', onAction: () => removeFood(date, item.id) })
      return
    }
    case 'goto':
      closeAllSheetsAnd(a.tab)
      return
  }
}

import { useMemo, useState } from 'react'
import { Check, ChefHat, Copy, ExternalLink, Globe, Loader2, RefreshCw, RotateCcw, Timer } from 'lucide-react'
import { RECIPE_BY_ID } from '../../data/recipes'
import { reshuffleMeals, restoreDay, swapMeal, toggleMeal, useApp } from '../../store/app'
import { closeSheet, confirmDialog, toast } from '../../store/ui'
import { fmtClock, today, WEEK_ORDER, WEEKDAY_LABEL, weekdayOf, type ISODate } from '../../lib/dates'
import { fmtPortion, getFood, recipeMacros, resolvePlanned, scaleFor } from '../../engine/nutrition'
import { groceryList, planMealMacros, swapOptions } from '../../engine/mealPlanner'
import { recipesByIngredient, recipeDetails, type RecipeIdea } from '../../api/mealDb'
import { useOnline } from '../../hooks/useOnline'
import { cx, fmtNum } from '../../lib/utils'
import { Sheet } from '../ui/Sheet'
import { Badge, Button } from '../ui/primitives'

export function MealSheet({ date, plannedId }: { date: ISODate; plannedId: string }) {
  const plan = useApp((s) => s.plan)!
  const profile = useApp((s) => s.profile)!
  const day = useApp((s) => s.days[date])
  const planned = plan.meals.find((d) => d.weekday === weekdayOf(date))?.meals.find((m) => m.id === plannedId)
  const meal = planned ? resolvePlanned(planned, day) : undefined
  if (!planned || !meal) return null
  const options = swapOptions(profile, plan.targets, planned, meal.recipe.id, 4)
  const r = meal.recipe
  return (
    <Sheet
      title={r.name}
      subtitle={`${planned.section === 'snacks' ? 'Snack' : planned.section[0].toUpperCase() + planned.section.slice(1)}${planned.time ? ` · ${fmtClock(planned.time)}` : ''} · ${r.minutes} min`}
      onClose={closeSheet}
      full
      footer={
        <Button variant={meal.eaten ? 'secondary' : 'primary'} size="lg" block icon={<Check size={20} />} onClick={() => (toggleMeal(date, plannedId), closeSheet())}>
          {meal.eaten ? 'Mark as not eaten' : 'Mark as eaten'}
        </Button>
      }
    >
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['kcal', Math.round(meal.macros.kcal)],
          ['Protein', `${Math.round(meal.macros.p)} g`],
          ['Carbs', `${Math.round(meal.macros.c)} g`],
          ['Fat', `${Math.round(meal.macros.f)} g`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-2 py-2.5">
            <div className="text-[17px] font-bold tabular-nums text-ink">{v}</div>
            <div className="text-[11.5px] text-ink-3">{k}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">Portion scaled ×{meal.scale.toFixed(2)} to hit ~{planned.targetKcal} kcal for this meal.</p>

      <h3 className="mb-1.5 mt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Ingredients</h3>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {r.items.map(([id, g]) => (
          <li key={id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14.5px]">
            <span className="text-ink">{getFood(id)?.name ?? id}</span>
            <span className="shrink-0 text-right text-[13px] tabular-nums text-ink-3">{fmtPortion(id, g * meal.scale)}</span>
          </li>
        ))}
      </ul>
      {r.steps && (
        <>
          <h3 className="mb-1.5 mt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Method</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-ink-2">
            {r.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </>
      )}

      <div className="mb-1.5 mt-5 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Swap for</h3>
        {meal.swapped && (
          <button type="button" className="tap inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-accent-fg" onClick={() => swapMeal(date, plannedId, planned.recipeId)}>
            <RotateCcw size={14} /> Back to plan
          </button>
        )}
      </div>
      <div className="space-y-2">
        {options.map((o) => {
          const m = recipeMacros(o, scaleFor(o, planned.targetKcal))
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                const prev = swapMeal(date, plannedId, o.id)
                toast({ message: `Swapped to ${o.name}`, actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
              }}
              className="tap flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left active:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">{o.name}</span>
                <span className="text-[12.5px] tabular-nums text-ink-3">
                  {Math.round(m.kcal)} kcal · P {Math.round(m.p)} g · {o.minutes} min{o.cuisine ? ` · ${o.cuisine}` : ''}
                </span>
              </span>
              <RefreshCw size={17} className="shrink-0 text-ink-3" />
            </button>
          )
        })}
      </div>
      <RecipeIdeas ingredient={getFood(r.items[0][0])?.name ?? ''} />
    </Sheet>
  )
}

/** TheMealDB inspiration for the meal's main ingredient (online only). */
function RecipeIdeas({ ingredient }: { ingredient: string }) {
  const online = useOnline()
  const allow = useApp((s) => s.settings.online)
  const [state, setState] = useState<{ loading: boolean; ideas: RecipeIdea[]; error?: string }>({ loading: false, ideas: [] })
  const [open, setOpen] = useState<RecipeIdea | null>(null)
  const term = ingredient.split(/[,(]/)[0].replace(/\b(cooked|baked|boiled|firm|lean|mince|fillet|breast|thigh|skinless|in water|drained|0% fat|low-fat|plain)\b/gi, '').trim()
  const load = () => {
    setState({ loading: true, ideas: [] })
    recipesByIngredient(term)
      .then((ideas) => setState({ loading: false, ideas }))
      .catch((e: Error) => setState({ loading: false, ideas: [], error: e.message }))
  }
  if (!online || !allow || !term) return null
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <Globe size={13} /> Recipe ideas online
      </h3>
      {!state.ideas.length && !state.loading && !state.error && (
        <Button block icon={<ChefHat size={18} />} onClick={load}>
          Find recipes with {term.toLowerCase()}
        </Button>
      )}
      {state.loading && <Loader2 className="mx-auto animate-spin text-ink-3" aria-label="Loading" />}
      {state.error && <p className="text-[14px] text-ink-3">Couldn't load ideas ({state.error}).</p>}
      {state.ideas.length > 0 && !open && (
        <div className="grid grid-cols-2 gap-2">
          {state.ideas.map((idea) => (
            <button
              key={idea.id}
              type="button"
              className="tap overflow-hidden rounded-2xl border border-line bg-surface text-left"
              onClick={() => recipeDetails(idea.id).then((d) => setOpen(d ?? idea)).catch(() => setOpen(idea))}
            >
              {idea.thumb && <img src={`${idea.thumb}/preview`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
              <span className="block px-2.5 py-2 text-[13px] font-medium leading-snug text-ink">{idea.name}</span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="rounded-2xl border border-line bg-surface p-3.5">
          <button type="button" className="tap mb-1 min-h-10 text-[13px] font-semibold text-accent-fg" onClick={() => setOpen(null)}>
            ← All ideas
          </button>
          <h4 className="text-[16px] font-bold text-ink">{open.name}</h4>
          <p className="text-[12.5px] text-ink-3">{[open.area, open.category].filter(Boolean).join(' · ')} · from TheMealDB (macros not tracked)</p>
          {open.ingredients && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{open.ingredients.join(' · ')}</p>}
          {open.instructions && <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">{open.instructions}</p>}
          {open.source && (
            <a href={open.source} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-[13.5px] font-semibold text-accent-fg">
              Original recipe <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function WeekPlanSheet() {
  const plan = useApp((s) => s.plan)!
  const todayWd = weekdayOf(today())
  return (
    <Sheet
      title="This week's meals"
      subtitle={`${fmtNum(plan.targets.calories)} kcal · ${plan.targets.proteinG} g protein per day`}
      onClose={closeSheet}
      full
      footer={
        <Button
          block
          icon={<RefreshCw size={18} />}
          onClick={async () => {
            if (await confirmDialog({ title: 'Shuffle the meal plan?', body: 'You get a new mix of meals that fit your targets and diet rules. Meals you already checked off stay logged.', confirmLabel: 'Shuffle' })) {
              reshuffleMeals()
              toast('New meal plan generated')
            }
          }}
        >
          Shuffle meals
        </Button>
      }
    >
      <div className="space-y-3">
        {WEEK_ORDER.map((wd) => {
          const day = plan.meals.find((d) => d.weekday === wd)
          if (!day) return null
          const totals = day.meals.reduce((a, m) => {
            const mm = planMealMacros(m)
            return { kcal: a.kcal + mm.kcal, p: a.p + mm.p }
          }, { kcal: 0, p: 0 })
          return (
            <section key={wd} className={cx('rounded-[var(--radius-card)] border bg-surface p-3.5', wd === todayWd ? 'border-accent-fg/50' : 'border-line')}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <h3 className="text-[15px] font-bold text-ink">
                  {WEEKDAY_LABEL[wd]} {wd === todayWd && <Badge tone="accent">Today</Badge>}
                </h3>
                <span className="text-[12.5px] tabular-nums text-ink-3">
                  {fmtNum(Math.round(totals.kcal))} kcal · {Math.round(totals.p)} g P
                </span>
              </div>
              <ul className="space-y-1">
                {day.meals.map((m) => (
                  <li key={m.id} className="flex gap-2 text-[14px]">
                    <span className="w-[4.5rem] shrink-0 capitalize text-ink-3">{m.section === 'snacks' ? 'Snack' : m.section}</span>
                    <span className="text-ink">{RECIPE_BY_ID.get(m.recipeId)?.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

let groceryTicks = new Set<string>()

export function GrocerySheet() {
  const plan = useApp((s) => s.plan)!
  const items = useMemo(() => groceryList(plan.meals), [plan])
  // Ticked items live in memory for this session only (nothing personal goes to plain storage).
  const [got, setGotState] = useState<Set<string>>(() => groceryTicks)
  const setGot = (fn: (s: Set<string>) => Set<string>) =>
    setGotState((s) => {
      groceryTicks = fn(s)
      return groceryTicks
    })
  const groups = items.reduce<Record<string, typeof items>>((acc, it) => ((acc[it.group] ??= []).push(it), acc), {})
  const qty = (g: number, unit: string) => (g >= 1000 ? `${(g / 1000).toFixed(1)} ${unit === 'ml' ? 'L' : 'kg'}` : `${Math.round(g / 10) * 10} ${unit}`)
  const copy = async () => {
    const text = items.map((i) => `- ${i.name}: ${qty(i.grams, i.unit)}`).join('\n')
    try {
      await navigator.clipboard.writeText(`AuraFit grocery list\n${text}`)
      toast('Grocery list copied')
    } catch {
      toast('Copy not available here')
    }
  }
  const GROUP_LABEL: Record<string, string> = { protein: 'Protein', legume: 'Beans & lentils', dairy: 'Dairy', grain: 'Grains & starches', veg: 'Vegetables', fruit: 'Fruit', fat: 'Nuts, seeds & oils', drink: 'Drinks', snack: 'Snacks', condiment: 'Sauces & extras' }
  return (
    <Sheet title="Grocery list" subtitle="Everything for this week's meal plan" onClose={closeSheet} full headerRight={<Button size="sm" variant="ghost" icon={<Copy size={16} />} onClick={copy}>Copy</Button>}>
      {Object.entries(groups).map(([group, list]) => (
        <section key={group} className="mb-4">
          <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{GROUP_LABEL[group] ?? group}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((i) => {
              const done = got.has(i.foodId)
              return (
                <li key={i.foodId}>
                  <label className="tap flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() =>
                        setGot((s) => {
                          const n = new Set(s)
                          if (n.has(i.foodId)) n.delete(i.foodId)
                          else n.add(i.foodId)
                          return n
                        })
                      }
                      className="h-5 w-5 accent-[var(--c-accent)]"
                    />
                    <span className={cx('flex-1 text-[14.5px]', done ? 'text-ink-3 line-through' : 'text-ink')}>{i.name}</span>
                    <span className="text-[13px] tabular-nums text-ink-3">{qty(i.grams, i.unit)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Timer size={14} /> Quantities are cooked weights where relevant.
      </p>
    </Sheet>
  )
}

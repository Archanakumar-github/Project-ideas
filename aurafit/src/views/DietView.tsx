import { useMemo } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Repeat2, ShoppingBasket, X } from 'lucide-react'
import { removeFood, restoreDay, swapMeal, toggleMeal, useApp } from '../store/app'
import { openSheet, toast, useUI } from '../store/ui'
import { useToday } from '../hooks/useNow'
import { addDays, fmtClock, relativeDay, weekdayOf, type ISODate } from '../lib/dates'
import { cx, fmtNum, haptic } from '../lib/utils'
import { dayTotals } from '../engine/insights'
import { resolvePlanned, type ResolvedMeal } from '../engine/nutrition'
import { swapOptions } from '../engine/mealPlanner'
import { ViewHeader, ViewScroller } from '../components/layout/ViewHeader'
import { Button, Card, IconButton } from '../components/ui/primitives'
import { MacroBar } from '../components/ui/Progress'
import { WaterCard } from '../components/diet/WaterCard'
import type { FoodLogItem, MealSection } from '../types'

export const SECTIONS: Array<{ key: MealSection; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
]

export function DietView() {
  const today = useToday()
  const date = useUI((s) => s.dietDate) ?? today
  const setDate = useUI((s) => s.setDietDate)
  const plan = useApp((s) => s.plan)
  const day = useApp((s) => s.days[date])
  const profile = useApp((s) => s.profile)
  const totals = useMemo(() => dayTotals(plan, day), [plan, day])
  const meals = useMemo(() => (plan?.meals.find((d) => d.weekday === weekdayOf(date))?.meals ?? []).map((m) => resolvePlanned(m, day)).filter((m): m is ResolvedMeal => !!m), [plan, day, date])
  if (!plan || !profile) return null
  const t = plan.targets
  const go = (delta: number) => {
    const next = addDays(date, delta)
    setDate(next === today ? undefined : next)
  }

  return (
    <ViewScroller>
      <ViewHeader title="Diet" subtitle={relativeDay(date, today)} />
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-1">
        <div className="flex items-center gap-2">
          <IconButton label="Previous day" className="bg-surface-2" onClick={() => go(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <button type="button" onClick={() => setDate(undefined)} className="tap min-h-12 flex-1 rounded-2xl bg-surface-2 text-[15px] font-semibold text-ink">
            {relativeDay(date, today)} · {fmtNum(Math.round(totals.kcal))} / {fmtNum(t.calories)} kcal
          </button>
          <IconButton label="Next day" className="bg-surface-2" onClick={() => go(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </div>

        <Card className="grid grid-cols-3 gap-3">
          <MacroBar compact name="Protein" value={totals.p} target={t.proteinG} color="var(--c-protein)" />
          <MacroBar compact name="Carbs" value={totals.c} target={t.carbsG} color="var(--c-carbs)" />
          <MacroBar compact name="Fat" value={totals.f} target={t.fatG} color="var(--c-fat)" />
        </Card>

        <WaterCard date={date} />

        {SECTIONS.map((s) => {
          const planned = meals.filter((m) => m.planned.section === s.key)
          const items = day?.foods.filter((f) => f.section === s.key) ?? []
          if (s.key === 'breakfast' && !planned.length && !items.length && profile.diet.skipBreakfast) return null
          const kcal = planned.filter((m) => m.eaten).reduce((a, m) => a + m.macros.kcal, 0) + items.reduce((a, f) => a + f.kcal, 0)
          return (
            <section key={s.key} aria-labelledby={`sec-${s.key}`}>
              <div className="mb-1.5 mt-4 flex items-center justify-between">
                <h2 id={`sec-${s.key}`} className="text-[17px] font-bold text-ink">
                  {s.label}
                  {planned[0]?.planned.time && <span className="ml-2 text-[13px] font-medium text-ink-3">{fmtClock(planned[0].planned.time)}</span>}
                </h2>
                <span className="text-[13px] tabular-nums text-ink-3">{fmtNum(Math.round(kcal))} kcal</span>
              </div>
              <div className="space-y-2">
                {planned.map((m) => (
                  <PlannedCard key={m.planned.id} meal={m} date={date} />
                ))}
                {items.map((f) => (
                  <LoggedItem key={f.id} item={f} date={date} />
                ))}
                <button
                  type="button"
                  onClick={() => openSheet({ kind: 'quickAdd', date, section: s.key })}
                  className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-[14.5px] font-semibold text-ink-2 active:bg-surface-2"
                >
                  <Plus size={18} /> Add food
                </button>
              </div>
            </section>
          )
        })}

        <div className="grid grid-cols-2 gap-2 pt-4">
          <Button icon={<CalendarDays size={18} />} onClick={() => openSheet({ kind: 'weekPlan' })}>
            Week plan
          </Button>
          <Button icon={<ShoppingBasket size={18} />} onClick={() => openSheet({ kind: 'grocery' })}>
            Grocery list
          </Button>
        </div>
      </div>
    </ViewScroller>
  )
}

function PlannedCard({ meal, date }: { meal: ResolvedMeal; date: ISODate }) {
  const profile = useApp((s) => s.profile)!
  const targets = useApp((s) => s.plan)!.targets
  const swapNext = () => {
    const next = swapOptions(profile, targets, meal.planned, meal.recipe.id, 1)[0]
    if (!next) {
      toast('No other option fits your diet rules')
      return
    }
    const prev = swapMeal(date, meal.planned.id, next.id)
    toast({ message: `Swapped to ${next.name}`, actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
  }
  return (
    <div className={cx('flex items-stretch gap-1 rounded-[var(--radius-card)] border bg-surface shadow-card transition-colors', meal.eaten ? 'border-accent-fg/40' : 'border-line')}>
      <button
        type="button"
        aria-pressed={meal.eaten}
        aria-label={`${meal.eaten ? 'Unmark' : 'Mark'} ${meal.recipe.name} as eaten`}
        onClick={() => {
          haptic(12)
          toggleMeal(date, meal.planned.id)
        }}
        className="tap grid w-14 shrink-0 place-items-center"
      >
        <span className={cx('grid h-8 w-8 place-items-center rounded-full border-2 transition-colors', meal.eaten ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-transparent')}>
          <Check size={18} strokeWidth={3} />
        </span>
      </button>
      <button type="button" className="tap min-w-0 flex-1 py-3 text-left" onClick={() => openSheet({ kind: 'meal', date, plannedId: meal.planned.id })}>
        <span className={cx('block text-[15px] font-semibold leading-snug text-ink', meal.eaten && 'opacity-70')}>{meal.recipe.name}</span>
        <span className="mt-0.5 block text-[12.5px] tabular-nums text-ink-3">
          {Math.round(meal.macros.kcal)} kcal · P {Math.round(meal.macros.p)} · C {Math.round(meal.macros.c)} · F {Math.round(meal.macros.f)}
          {meal.swapped && ' · swapped'}
        </span>
      </button>
      <IconButton label={`Swap ${meal.recipe.name}`} className="self-center" onClick={swapNext}>
        <Repeat2 size={19} />
      </IconButton>
    </div>
  )
}

function LoggedItem({ item, date }: { item: FoodLogItem; date: ISODate }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 py-2 pl-4 pr-1">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium text-ink">{item.name}</div>
        <div className="text-[12.5px] tabular-nums text-ink-3">
          {item.qty ? `${Math.round(item.qty)} ${item.unit ?? 'g'} · ` : ''}
          {Math.round(item.kcal)} kcal · P {Math.round(item.p)} · C {Math.round(item.c)} · F {Math.round(item.f)}
        </div>
      </div>
      <IconButton
        label={`Remove ${item.name}`}
        onClick={() => {
          const prev = removeFood(date, item.id)
          toast({ message: `Removed ${item.name}`, actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
        }}
      >
        <X size={18} />
      </IconButton>
    </div>
  )
}

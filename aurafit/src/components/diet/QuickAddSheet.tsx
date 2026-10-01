import { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, Loader2, Plus, Search, Zap } from 'lucide-react'
import { FOODS } from '../../data/foods'
import { addFood, saveCustomFood, useApp } from '../../store/app'
import { closeSheet, toast } from '../../store/ui'
import { foodMacros, getFood } from '../../engine/nutrition'
import { dietRules, foodAllowed } from '../../engine/dietRules'
import { searchOpenFoodFacts } from '../../api/openFoodFacts'
import { useOnline } from '../../hooks/useOnline'
import { cx, haptic, normalize } from '../../lib/utils'
import type { ISODate } from '../../lib/dates'
import type { Food, MealSection } from '../../types'
import { Sheet } from '../ui/Sheet'
import { Badge, Button, Input, Segmented, Stepper } from '../ui/primitives'

/**
 * Off-plan logging in 1–3 taps:
 *  - Recents: one tap re-adds with the last portion.
 *  - Search: built-in foods, your saved foods and (online) Open Food Facts; tap a result,
 *    adjust the portion if needed, Add.
 *  - Quick: type calories/macros directly.
 */
export function QuickAddSheet({ date, section }: { date: ISODate; section: MealSection }) {
  const [mode, setMode] = useState<'search' | 'quick'>('search')
  const label = section === 'snacks' ? 'snacks' : section
  return (
    <Sheet title={`Add to ${label}`} onClose={closeSheet} full>
      <Segmented
        label="Add mode"
        className="mb-3"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'search', label: 'Search foods' },
          { value: 'quick', label: 'Quick calories' },
        ]}
      />
      {mode === 'search' ? <SearchFoods date={date} section={section} /> : <QuickCalories date={date} section={section} />}
    </Sheet>
  )
}

function SearchFoods({ date, section }: { date: ISODate; section: MealSection }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [online, setOnline] = useState<{ loading: boolean; results: Food[]; error?: string }>({ loading: false, results: [] })
  const inputRef = useRef<HTMLInputElement>(null)
  const isOnline = useOnline()
  const allowOnline = useApp((s) => s.settings.online)
  const foods = useApp((s) => s.foods)
  const profile = useApp((s) => s.profile)
  const rules = useMemo(() => (profile ? dietRules(profile) : undefined), [profile])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const local = useMemo(() => {
    const query = normalize(q)
    const pool = [...foods.custom, ...FOODS]
    if (!query) return []
    const words = query.split(' ')
    return pool
      .map((f) => {
        const name = normalize(`${f.name} ${f.brand ?? ''}`)
        const score = name.startsWith(query) ? 3 : words.every((w) => name.includes(w)) ? 2 : 0
        return { f, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
      .slice(0, 25)
      .map((x) => x.f)
  }, [q, foods.custom])

  useEffect(() => {
    if (!isOnline || !allowOnline || q.trim().length < 3) {
      setOnline({ loading: false, results: [] })
      return
    }
    const ctrl = new AbortController()
    setOnline((s) => ({ ...s, loading: true, error: undefined }))
    const timer = setTimeout(() => {
      searchOpenFoodFacts(q, ctrl.signal)
        .then((results) => setOnline({ loading: false, results }))
        .catch((e: Error) => !ctrl.signal.aborted && setOnline({ loading: false, results: [], error: e.message }))
    }, 350)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, isOnline, allowOnline])

  const recents = foods.recents
    .map((r) => ({ r, food: getFood(r.foodId) }))
    .filter((x): x is { r: (typeof foods.recents)[number]; food: Food } => !!x.food)
    .slice(0, 10)

  const add = (food: Food, qty: number) => {
    const m = foodMacros(food, qty)
    if (food.source === 'openfoodfacts') saveCustomFood(food)
    addFood(date, { section, name: food.brand ? `${food.name} (${food.brand})` : food.name, foodId: food.id, qty, unit: food.unit, kcal: m.kcal, p: m.p, c: m.c, f: m.f, source: food.source ?? 'builtin' })
    haptic(15)
    toast(`Added ${food.name} · ${Math.round(m.kcal)} kcal`)
    closeSheet()
  }

  if (selected) return <PortionPicker food={selected} warn={rules && !foodAllowed(selected, rules)} onBack={() => setSelected(null)} onAdd={(qty) => add(selected, qty)} />

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-canvas px-4 pb-2">
        <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3.5 focus-within:border-accent-fg">
          <Search size={18} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search foods or type a barcode"
            enterKeyHint="search"
            aria-label="Search foods"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-3"
          />
          {online.loading && <Loader2 size={18} className="shrink-0 animate-spin text-ink-3" aria-label="Searching online" />}
        </div>
      </div>

      {!q && recents.length > 0 && (
        <ResultGroup title="Recent · one tap adds">
          {recents.map(({ r, food }) => (
            <FoodRow key={food.id} food={food} qty={r.qty} onSelect={() => setSelected(food)} onQuickAdd={() => add(food, r.qty)} />
          ))}
        </ResultGroup>
      )}
      {!q && !recents.length && <p className="px-1 py-6 text-center text-[14px] text-ink-3">Search {FOODS.length}+ built-in foods{isOnline && allowOnline ? ' and millions more from Open Food Facts' : ''}.</p>}

      {q && (
        <ResultGroup title="On this device">
          {local.length ? local.map((f) => <FoodRow key={f.id} food={f} onSelect={() => setSelected(f)} onQuickAdd={() => add(f, f.serving.qty)} />) : <p className="px-1 py-2 text-[14px] text-ink-3">No local matches.</p>}
        </ResultGroup>
      )}

      {q.trim().length >= 3 && (
        <ResultGroup title={<span className="inline-flex items-center gap-1.5"><Globe size={13} /> Open Food Facts</span>}>
          {!isOnline || !allowOnline ? (
            <p className="px-1 py-2 text-[14px] text-ink-3">{!allowOnline ? 'Online lookups are off (Settings).' : "You're offline. Online results appear when you reconnect."}</p>
          ) : online.error ? (
            <p className="px-1 py-2 text-[14px] text-ink-3">Couldn't reach Open Food Facts ({online.error}).</p>
          ) : online.results.length ? (
            online.results.map((f) => <FoodRow key={f.id} food={f} onSelect={() => setSelected(f)} onQuickAdd={() => add(f, f.serving.qty)} />)
          ) : (
            !online.loading && <p className="px-1 py-2 text-[14px] text-ink-3">No online matches.</p>
          )}
        </ResultGroup>
      )}
    </div>
  )
}

function ResultGroup({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h3 className="mb-1 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>
    </div>
  )
}

function FoodRow({ food, qty, onSelect, onQuickAdd }: { food: Food; qty?: number; onSelect: () => void; onQuickAdd: () => void }) {
  const portion = qty ?? food.serving.qty
  const kcal = Math.round((food.kcal * portion) / 100)
  return (
    <div className="flex items-center">
      <button type="button" onClick={onSelect} className="tap min-w-0 flex-1 px-3.5 py-2.5 text-left active:bg-surface-2">
        <span className="block truncate text-[15px] font-medium text-ink">{food.name}</span>
        <span className="block truncate text-[12.5px] text-ink-3">
          {food.brand ? `${food.brand} · ` : ''}
          {qty ? `${Math.round(qty)} ${food.unit}` : food.serving.label} · {kcal} kcal · P {Math.round((food.p * portion) / 100)}
        </span>
      </button>
      <button type="button" aria-label={`Add ${food.name}`} onClick={onQuickAdd} className="tap mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-fg active:scale-95">
        <Plus size={20} />
      </button>
    </div>
  )
}

function PortionPicker({ food, onBack, onAdd, warn }: { food: Food; onBack: () => void; onAdd: (qty: number) => void; warn?: boolean }) {
  const [qty, setQty] = useState(food.serving.qty)
  const m = foodMacros(food, qty)
  const multiples = [0.5, 1, 1.5, 2]
  return (
    <div className="animate-rise-in">
      <button type="button" onClick={onBack} className="tap mb-2 min-h-10 text-[14px] font-semibold text-accent-fg">
        ← Back to results
      </button>
      <h3 className="text-[19px] font-bold leading-snug text-ink">{food.name}</h3>
      <p className="text-[13px] text-ink-3">
        {food.brand && `${food.brand} · `}per 100 {food.unit}: {Math.round(food.kcal)} kcal · P {food.p} · C {food.c} · F {food.f}
      </p>
      {warn && <Badge tone="warn" className="mt-2">Conflicts with your diet rules</Badge>}
      <div className="mt-4 flex flex-wrap gap-2">
        {multiples.map((k) => (
          <button key={k} type="button" onClick={() => setQty(Math.round(food.serving.qty * k))} className={cx('tap min-h-10 rounded-full border px-3.5 text-[14px] font-medium', Math.round(food.serving.qty * k) === Math.round(qty) ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink-2')}>
            {k === 1 ? food.serving.label : `${k} × ${food.serving.label}`}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Stepper label="Amount" value={qty} onChange={setQty} step={food.unit === 'ml' ? 25 : 10} min={1} max={3000} decimals={0} unit={food.unit} size="lg" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          ['kcal', Math.round(m.kcal)],
          ['Protein', `${Math.round(m.p)} g`],
          ['Carbs', `${Math.round(m.c)} g`],
          ['Fat', `${Math.round(m.f)} g`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-2 py-2.5">
            <div className="text-[17px] font-bold tabular-nums text-ink">{v}</div>
            <div className="text-[11.5px] text-ink-3">{k}</div>
          </div>
        ))}
      </div>
      <Button className="mt-5" variant="primary" size="lg" block icon={<Plus size={20} />} onClick={() => onAdd(qty)}>
        Add {Math.round(m.kcal)} kcal
      </Button>
    </div>
  )
}

function QuickCalories({ date, section }: { date: ISODate; section: MealSection }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const num = (s: string) => Math.max(0, Number(s.replace(',', '.')) || 0)
  const derived = num(p) * 4 + num(c) * 4 + num(f) * 9
  const total = kcal ? num(kcal) : derived
  const add = () => {
    addFood(date, { section, name: name.trim() || 'Quick add', kcal: total, p: num(p), c: num(c), f: num(f), source: 'quick' })
    haptic(15)
    toast(`Added ${Math.round(total)} kcal`)
    closeSheet()
  }
  return (
    <div className="space-y-3">
      <Input label="What was it? (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office birthday cake" autoFocus />
      <Input label="Calories" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} suffix="kcal" placeholder={derived ? String(Math.round(derived)) : '0'} hint={!kcal && derived ? 'Calculated from the macros below.' : undefined} />
      <div className="grid grid-cols-3 gap-2">
        <Input label="Protein" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} suffix="g" />
        <Input label="Carbs" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} suffix="g" />
        <Input label="Fat" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} suffix="g" />
      </div>
      <Button variant="primary" size="lg" block icon={<Zap size={20} />} disabled={!total} onClick={add}>
        Add {total ? `${Math.round(total)} kcal` : ''}
      </Button>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Plus, Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { useApp } from '../store/app'
import { openSheet } from '../store/ui'
import { useToday } from '../hooks/useNow'
import { addDays, dateRange, fmtDay, toISODate, type ISODate } from '../lib/dates'
import { cmTo, fmtLength, fmtWeight, kgTo } from '../lib/units'
import { cx, fmtNum } from '../lib/utils'
import { adherence, dayTotals, movingAverage, waterTotal, weeklyTrend, weightSeries } from '../engine/insights'
import { ViewHeader, ViewScroller } from '../components/layout/ViewHeader'
import { Button, Card, Chip, EmptyState, Segmented, SectionTitle } from '../components/ui/primitives'
import { Meter } from '../components/ui/Progress'
import { LineChart } from '../components/charts/LineChart'
import { BarChart } from '../components/charts/BarChart'
import { MEASUREMENT_FIELDS } from '../components/progress/LogSheets'
import type { MeasurementKey } from '../types'

type Pane = 'weight' | 'body' | 'week'

export function ProgressView() {
  const [pane, setPane] = useState<Pane>('weight')
  return (
    <ViewScroller>
      <ViewHeader title="Progress" />
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-1">
        <Segmented<Pane>
          label="Progress view"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'weight', label: 'Weight' },
            { value: 'body', label: 'Measurements' },
            { value: 'week', label: 'This week' },
          ]}
        />
        {pane === 'weight' && <WeightPane />}
        {pane === 'body' && <BodyPane />}
        {pane === 'week' && <WeekPane />}
      </div>
    </ViewScroller>
  )
}

const RANGES = [
  { key: '1m', label: '1M', days: 31 },
  { key: '3m', label: '3M', days: 92 },
  { key: '6m', label: '6M', days: 183 },
  { key: 'all', label: 'All', days: 100000 },
] as const

function WeightPane() {
  const today = useToday()
  const days = useApp((s) => s.days)
  const profile = useApp((s) => s.profile)!
  const plan = useApp((s) => s.plan)!
  const unit = useApp((s) => s.settings.weightUnit)
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3m')
  const series = useMemo(() => weightSeries(days), [days])
  const start = profile.weightKg
  const startDate = toISODate(new Date(profile.meta.importedAt))
  // The imported weight counts as the first data point.
  const full = useMemo(() => (series.some((p) => p.date <= startDate) ? series : [{ date: startDate, kg: start }, ...series]), [series, start, startDate])
  const latest = full.at(-1)!
  const trend = weeklyTrend(full, 21, today)
  const goal = profile.targetWeightKg
  const from = addDays(today, -(RANGES.find((r) => r.key === range)!.days - 1))
  const visible = full.filter((p) => p.date >= from)
  const avg = movingAverage(full).filter((p) => p.date >= from)

  let pct: number | undefined
  let eta: string | undefined
  if (goal != null && goal !== start) {
    pct = Math.max(0, Math.min(100, ((start - latest.kg) / (start - goal)) * 100))
    const remaining = goal - latest.kg
    if (trend && Math.sign(trend) === Math.sign(remaining) && Math.abs(trend) > 0.02) {
      const weeks = remaining / trend
      if (weeks > 0 && weeks < 260) eta = fmtDay(addDays(today, Math.round(weeks * 7)), { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  const delta = latest.kg - start

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink-3">Current</p>
            <p className="text-[40px] font-extrabold leading-none tracking-tight text-ink">{kgTo(latest.kg, unit).toFixed(1)}<span className="ml-1 text-[18px] font-semibold text-ink-3">{unit}</span></p>
            <p className="mt-1.5 flex items-center gap-1 text-[13.5px] text-ink-2">
              {delta <= 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
              {delta > 0 ? '+' : ''}
              {fmtWeight(delta, unit)} since {fmtDay(startDate, { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => openSheet({ kind: 'logWeight', date: today })}>
            Log
          </Button>
        </div>
        {goal != null && pct != null && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-ink-2">
                Goal <span className="font-semibold text-ink">{fmtWeight(goal, unit)}</span>
              </span>
              <span className="font-semibold tabular-nums text-ink">{Math.round(pct)}% there</span>
            </div>
            <Meter value={pct} max={100} height={10} label={`${Math.round(pct)}% of the way to goal`} />
            <p className="mt-2 text-[12.5px] text-ink-3">
              {fmtWeight(Math.abs(goal - latest.kg), unit)} to go
              {eta ? ` · at this pace ≈ ${eta}` : ''}
              {profile.targetDate ? ` · target ${fmtDay(profile.targetDate, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            </p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[13px]">
          <div>
            <div className="text-ink-3">3-week trend</div>
            <div className="font-semibold tabular-nums text-ink">{trend != null ? `${trend > 0 ? '+' : ''}${kgTo(trend, unit).toFixed(2)} ${unit}/wk` : 'Need 3+ weigh-ins'}</div>
          </div>
          <div>
            <div className="text-ink-3">Planned pace</div>
            <div className="font-semibold tabular-nums text-ink">{plan.targets.weeklyRateKg > 0 ? '+' : ''}{kgTo(plan.targets.weeklyRateKg, unit).toFixed(2)} {unit}/wk</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          action={
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)} className={cx('tap min-h-9 min-w-10 rounded-lg px-2 text-[12.5px] font-semibold', range === r.key ? 'bg-surface-2 text-ink' : 'text-ink-3')}>
                  {r.label}
                </button>
              ))}
            </div>
          }
        >
          Weight trend
        </SectionTitle>
        {visible.length >= 1 ? (
          <LineChart
            title={`Weight (${unit})`}
            points={visible.map((p) => ({ date: p.date, value: kgTo(p.kg, unit) }))}
            smooth={visible.length >= 5 ? avg.map((p) => ({ date: p.date, value: kgTo(p.kg, unit) })) : undefined}
            goal={goal != null ? kgTo(goal, unit) : undefined}
            goalLabel="Goal"
            color="var(--c-accent)"
          />
        ) : (
          <EmptyState icon={<Scale size={24} />} title="No weigh-ins in this range" body="Log your weight a few mornings a week to see the trend." />
        )}
      </Card>

      {series.length > 0 && (
        <Card>
          <SectionTitle>Recent weigh-ins</SectionTitle>
          <ul className="divide-y divide-line">
            {[...series].reverse().slice(0, 14).map((p) => (
              <li key={p.date}>
                <button type="button" onClick={() => openSheet({ kind: 'logWeight', date: p.date })} className="tap flex min-h-12 w-full items-center justify-between text-left">
                  <span className="text-[14.5px] text-ink-2">{fmtDay(p.date)}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">{fmtWeight(p.kg, unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function BodyPane() {
  const today = useToday()
  const days = useApp((s) => s.days)
  const profile = useApp((s) => s.profile)!
  const unit = useApp((s) => s.settings.lengthUnit)
  const [metric, setMetric] = useState<MeasurementKey>('waist')
  const startDate = toISODate(new Date(profile.meta.importedAt))
  const seriesFor = (key: MeasurementKey) => {
    const pts: Array<{ date: ISODate; value: number }> = []
    const base = profile.measurements[key]
    const logged = Object.values(days)
      .filter((d) => d.measurements?.[key] != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ date: d.date, value: d.measurements![key]! }))
    if (base != null && !logged.some((p) => p.date <= startDate)) pts.push({ date: startDate, value: base })
    return [...pts, ...logged]
  }
  const field = MEASUREMENT_FIELDS.find((f) => f.key === metric)!
  const series = seriesFor(metric)
  const fmt = (key: MeasurementKey, v: number) => (key === 'bodyFat' ? `${v.toFixed(1)}%` : fmtLength(v, unit))

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {MEASUREMENT_FIELDS.map((f) => {
          const s = seriesFor(f.key)
          const latest = s.at(-1)
          const change = s.length > 1 ? latest!.value - s[0].value : undefined
          return (
            <button key={f.key} type="button" aria-pressed={metric === f.key} onClick={() => setMetric(f.key)} className={cx('tap rounded-2xl border p-3 text-left', metric === f.key ? 'border-accent-fg bg-accent-soft' : 'border-line bg-surface')}>
              <span className="block text-[12.5px] font-medium text-ink-3">{f.label}</span>
              <span className="block text-[18px] font-bold tabular-nums text-ink">{latest ? fmt(f.key, latest.value) : '–'}</span>
              <span className="block text-[12px] tabular-nums text-ink-3">{change != null ? `${change > 0 ? '+' : change < 0 ? '−' : '±'}${f.key === 'bodyFat' ? Math.abs(change).toFixed(1) + '%' : fmtLength(Math.abs(change), unit)} since start` : 'No change yet'}</span>
            </button>
          )
        })}
      </div>
      <Button variant="primary" block icon={<Ruler size={18} />} onClick={() => openSheet({ kind: 'logMeasurements', date: today })}>
        Log measurements
      </Button>
      <Card>
        <SectionTitle>{field.label} over time</SectionTitle>
        <div className="no-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
          {MEASUREMENT_FIELDS.map((f) => (
            <Chip key={f.key} active={metric === f.key} onClick={() => setMetric(f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>
        {series.length ? (
          <LineChart title={`${field.label} (${field.pct ? '%' : unit})`} points={series.map((p) => ({ date: p.date, value: field.pct ? p.value : cmTo(p.value, unit) }))} format={(v) => v.toFixed(1)} color="var(--c-accent)" />
        ) : (
          <EmptyState icon={<Ruler size={24} />} title={`No ${field.label.toLowerCase()} data yet`} body="Measure every 2–4 weeks, same time of day, tape snug but not tight." />
        )}
      </Card>
    </>
  )
}

function WeekPane() {
  const today = useToday()
  const days = useApp((s) => s.days)
  const plan = useApp((s) => s.plan)!
  const range = dateRange(today, 7)
  const a = adherence(plan, days, 7, today)
  const label = (d: ISODate) => fmtDay(d, { weekday: 'narrow' })
  const kcalBars = range.map((d) => {
    const t = dayTotals(plan, days[d])
    return { key: d, label: label(d), value: Math.round(t.kcal), detail: `${fmtDay(d)} · ${Math.round(t.p)} g protein` }
  })
  const proteinBars = range.map((d) => ({ key: d, label: label(d), value: Math.round(dayTotals(plan, days[d]).p), detail: fmtDay(d) }))
  const waterBars = range.map((d) => ({ key: d, label: label(d), value: waterTotal(days[d]), detail: fmtDay(d) }))
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Workouts', String(a.workouts)],
          ['Days logged', `${a.loggedDays}/7`],
          ['Water goals', `${a.waterDays}/7`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-3 text-center">
            <div className="text-[22px] font-bold tabular-nums text-ink">{v}</div>
            <div className="text-[12px] text-ink-3">{k}</div>
          </div>
        ))}
      </div>
      <Card>
        <SectionTitle>Calories</SectionTitle>
        <BarChart title="Calories per day" bars={kcalBars} target={plan.targets.calories} format={(v) => fmtNum(Math.round(v))} color="var(--c-accent)" />
        <p className="mt-2 text-[13px] text-ink-3">Average on logged days: <span className="font-semibold text-ink">{fmtNum(Math.round(a.avgKcal))} kcal</span></p>
      </Card>
      <Card>
        <SectionTitle>Protein</SectionTitle>
        <BarChart title="Protein per day (g)" bars={proteinBars} target={plan.targets.proteinG} format={(v) => `${Math.round(v)} g`} color="var(--c-protein)" />
      </Card>
      <Card>
        <SectionTitle>Water</SectionTitle>
        <BarChart title="Water per day (ml)" bars={waterBars} target={plan.targets.waterMl} format={(v) => `${(v / 1000).toFixed(1)} L`} color="var(--c-water)" />
      </Card>
    </>
  )
}

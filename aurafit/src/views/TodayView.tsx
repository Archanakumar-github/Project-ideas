import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowRight, Bed, Briefcase, CheckCircle2, Dumbbell, Footprints, Droplets, Flame, Moon, Scale, Settings, Sparkles, Sunrise, Utensils, Zap } from 'lucide-react'
import { useApp, journalForDate, newJournalEntry, startWorkout, upsertJournal } from '../store/app'
import { openSheet, useUI } from '../store/ui'
import { useNow, useToday } from '../hooks/useNow'
import { buildContext } from '../coach/context'
import { dailyInsight } from '../coach/localCoach'
import { runAction } from '../coach/actions'
import { buildSchedule, nextIndex } from '../engine/schedule'
import { fmtClock, fmtDay, weekdayOf } from '../lib/dates'
import { fmtWeight } from '../lib/units'
import { cx, fmtNum } from '../lib/utils'
import { weightSeries } from '../engine/insights'
import { ViewHeader, ViewScroller } from '../components/layout/ViewHeader'
import { Badge, Button, Card, IconButton, SectionTitle } from '../components/ui/primitives'
import { MacroBar, Ring } from '../components/ui/Progress'
import { WaterCard } from '../components/diet/WaterCard'
import type { ScheduleItem } from '../types'

function greeting(h: number) {
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function TodayView() {
  // Only the slices the dashboard reads (not chat, food library or save-status churn).
  const data = useApp(useShallow((s) => ({ profile: s.profile, plan: s.plan, settings: s.settings, days: s.days, journal: s.journal })))
  const now = useNow()
  const date = useToday()
  const ctx = useMemo(() => buildContext(data, date, now), [data, date, now])
  if (!ctx) return null
  const t = ctx.plan.targets
  const insight = dailyInsight(ctx)
  const name = ctx.profile.name?.split(' ')[0]

  return (
    <ViewScroller>
      <ViewHeader
        subtitle={fmtDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${greeting(now.getHours())}${name ? `, ${name}` : ''}`}
        right={
          <IconButton label="Settings" className="mb-0.5 bg-surface-2" onClick={() => openSheet({ kind: 'settings' })}>
            <Settings size={20} />
          </IconButton>
        }
      />
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-1">
        <InsightCard insight={insight} />

        <Card>
          <div className="flex items-center gap-4">
            <Ring value={ctx.totals.kcal} max={t.calories} label={`${Math.round(ctx.totals.kcal)} of ${t.calories} kcal eaten`}>
              <div>
                <div className="text-[28px] font-extrabold leading-none text-ink">{fmtNum(Math.abs(Math.round(ctx.remaining.kcal)))}</div>
                <div className="mt-1 text-[12px] font-medium text-ink-3">{ctx.remaining.kcal >= 0 ? 'kcal left' : 'kcal over'}</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1 space-y-3">
              <MacroBar name="Protein" value={ctx.totals.p} target={t.proteinG} color="var(--c-protein)" />
              <MacroBar name="Carbs" value={ctx.totals.c} target={t.carbsG} color="var(--c-carbs)" />
              <MacroBar name="Fat" value={ctx.totals.f} target={t.fatG} color="var(--c-fat)" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="text-[13px] text-ink-3">
              <span className="font-semibold text-ink">{fmtNum(Math.round(ctx.totals.kcal))}</span> / {fmtNum(t.calories)} kcal eaten
            </span>
            <Button size="sm" variant="soft" icon={<Utensils size={16} />} onClick={() => useUI.getState().setTab('diet')}>
              Meals
            </Button>
          </div>
        </Card>

        <WaterCard date={date} compact />

        <WorkoutCard ctx={ctx} />

        <div className="grid grid-cols-2 gap-3">
          <QuickWeight date={date} />
          <StreakCard streak={ctx.streak} workouts={ctx.adherence.workouts} />
        </div>

        <CheckIn date={date} />

        <Timeline date={date} now={now} />
      </div>
    </ViewScroller>
  )
}

function InsightCard({ insight }: { insight: ReturnType<typeof dailyInsight> }) {
  return (
    <section className={cx('rounded-[var(--radius-card)] border p-4', insight.tone === 'warn' ? 'border-warn/40 bg-warn/10' : insight.tone === 'good' ? 'border-good/30 bg-good/8' : 'border-line bg-accent-soft')}>
      <div className="flex items-start gap-3">
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', insight.tone === 'warn' ? 'bg-warn/25 text-ink' : 'bg-accent text-on-accent')}>
          {insight.tone === 'warn' ? <Zap size={18} /> : <Sparkles size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Coach</p>
          <h2 className="text-[16px] font-bold leading-snug text-ink">{insight.title}</h2>
          <p className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{insight.body}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {insight.action && (
          <Button size="sm" variant="primary" onClick={() => runAction(insight.action!)}>
            {insight.action.label}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<Sparkles size={15} />} onClick={() => openSheet({ kind: 'coach' })}>
          Ask coach
        </Button>
      </div>
    </section>
  )
}

function WorkoutCard({ ctx }: { ctx: NonNullable<ReturnType<typeof buildContext>> }) {
  const d = ctx.programDay
  const active = ctx.session && !ctx.session.finishedAt
  const setTab = useUI((s) => s.setTab)
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-fg">{d.kind === 'strength' ? <Dumbbell size={20} /> : d.kind === 'cardio' ? <Footprints size={20} /> : <Bed size={20} />}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-ink">{d.title}</h2>
          <p className="truncate text-[13px] text-ink-3">
            {d.kind === 'strength' ? `${d.exercises.length} exercises · ~${d.estMinutes} min` : d.cardio ? `${d.cardio.minutes} min · ${d.cardio.intensity}` : 'Recovery'}
          </p>
        </div>
        {ctx.lighter && <Badge tone="warn">Lighter</Badge>}
        {ctx.workoutDone && <CheckCircle2 size={22} className="text-good" aria-label="Done" />}
      </div>
      {!ctx.workoutDone && d.kind !== 'rest' && (
        <Button
          className="mt-3"
          block
          variant={active ? 'primary' : 'soft'}
          icon={<ArrowRight size={18} />}
          onClick={() => {
            // One tap: strength days start the session right away.
            if (!active && d.kind === 'strength') startWorkout(ctx.date, d)
            setTab('train')
          }}
        >
          {active ? 'Continue workout' : d.kind === 'strength' ? 'Start workout' : 'Open session'}
        </Button>
      )}
    </Card>
  )
}

function QuickWeight({ date }: { date: string }) {
  const days = useApp((s) => s.days)
  const unit = useApp((s) => s.settings.weightUnit)
  const series = weightSeries(days)
  const last = series.at(-1)
  const todayLogged = days[date]?.weightKg != null
  return (
    <button type="button" onClick={() => openSheet({ kind: 'logWeight', date })} className="tap rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-card active:bg-surface-2">
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
        <Scale size={16} /> Weight
      </span>
      <span className="mt-1.5 block text-[22px] font-bold tabular-nums text-ink">{last ? fmtWeight(last.kg, unit) : '–'}</span>
      <span className="mt-0.5 block text-[12.5px] font-semibold text-accent-fg">{todayLogged ? 'Logged today ✓' : 'Tap to log'}</span>
    </button>
  )
}

function StreakCard({ streak, workouts }: { streak: number; workouts: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
        <Flame size={16} /> Streak
      </span>
      <span className="mt-1.5 block text-[22px] font-bold tabular-nums text-ink">
        {streak} <span className="text-[14px] font-medium text-ink-3">day{streak === 1 ? '' : 's'}</span>
      </span>
      <span className="mt-0.5 block text-[12.5px] text-ink-3">{workouts} workout{workouts === 1 ? '' : 's'} this week</span>
    </div>
  )
}

/** One-tap check-in that feeds the journal (and the coach's readiness score). */
function CheckIn({ date }: { date: string }) {
  const entry = useApp((s) => Object.values(s.journal).filter((j) => j.date === date).sort((a, b) => a.createdAt - b.createdAt)[0])
  const update = (patch: { energy?: number; soreness?: number }) => {
    const base = journalForDate(date) ?? newJournalEntry(date)
    upsertJournal({ ...base, ...patch })
  }
  const scale = (key: 'energy' | 'soreness', label: string, low: string, high: string) => (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px] font-medium text-ink-2">
        <span>{label}</span>
        <span className="text-[12px] text-ink-3">
          {low} → {high}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={entry?.[key] === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => update({ [key]: entry?.[key] === n ? undefined : n })}
            className={cx('tap h-12 rounded-xl text-[15px] font-semibold', entry?.[key] === n ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-3 active:bg-surface-3')}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <Card>
      <SectionTitle
        action={
          <button type="button" className="tap min-h-10 px-1 text-[13px] font-semibold text-accent-fg" onClick={() => openSheet({ kind: 'journalEntry', id: entry?.id, date })}>
            {entry?.body ? 'Edit note' : 'Add a note'}
          </button>
        }
      >
        How do you feel?
      </SectionTitle>
      <div className="space-y-3">
        {scale('energy', 'Energy', 'drained', 'great')}
        {scale('soreness', 'Soreness', 'fresh', 'very sore')}
      </div>
    </Card>
  )
}

const ICONS: Record<ScheduleItem['kind'], typeof Sunrise> = {
  wake: Sunrise,
  meal: Utensils,
  workout: Dumbbell,
  water: Droplets,
  work: Briefcase,
  winddown: Moon,
  sleep: Bed,
  routine: Sparkles,
  walk: Footprints,
}

function Timeline({ date, now }: { date: string; now: Date }) {
  const profile = useApp((s) => s.profile)
  const plan = useApp((s) => s.plan)
  const items = useMemo(() => (profile && plan ? buildSchedule(profile, plan, weekdayOf(date)) : []), [profile, plan, date])
  if (!profile) return null
  const next = nextIndex(items, now, profile.lifestyle.wake)
  return (
    <Card>
      <SectionTitle>Today's plan</SectionTitle>
      <ol className="relative">
        {items.map((it, i) => {
          const Icon = ICONS[it.kind]
          const past = next === -1 || i < next
          const isNext = i === next
          return (
            <li key={`${it.time}-${it.label}-${i}`} className={cx('relative flex gap-3 pb-3 last:pb-0', past && 'opacity-55')}>
              {i < items.length - 1 && <span className="absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px bg-line" aria-hidden />}
              <span className={cx('relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl', isNext ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2')}>
                <Icon size={17} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="w-[4.6rem] shrink-0 text-[12.5px] tabular-nums text-ink-3">{fmtClock(it.time)}</span>
                  <span className="truncate text-[14.5px] font-semibold text-ink">{it.label}</span>
                  {isNext && <Badge tone="accent">Next</Badge>}
                </div>
                {it.detail && <p className="ml-[4.6rem] truncate pl-2 text-[13px] text-ink-3">{it.detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

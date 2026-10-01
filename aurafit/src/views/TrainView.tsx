import { memo, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ClipboardList, Dumbbell, Feather, Flag, Footprints, Info, Minus, Plus, Repeat2, Trash2, Trophy } from 'lucide-react'
import { EXERCISE_BY_ID } from '../data/exercises'
import { allSessions, discardWorkout, finishWorkout, restoreDay, setLighter, startWorkout, updateSession, useApp } from '../store/app'
import { confirmDialog, openSheet, toast } from '../store/ui'
import { useNow, useToday } from '../hooks/useNow'
import { fmtDay, fmtDuration, WEEK_ORDER, WEEKDAY_LABEL, weekdayOf, type ISODate } from '../lib/dates'
import { fmtWeight, kgTo, toKg } from '../lib/units'
import { cx, fmtNum, haptic } from '../lib/utils'
import { lastPerformance, suggestWeight } from '../engine/programBuilder'
import { ViewHeader, ViewScroller } from '../components/layout/ViewHeader'
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle, Switch } from '../components/ui/primitives'
import { useRest } from '../components/train/restTimer'
import type { ProgramDay, SessionExercise, WorkoutSession } from '../types'

export function TrainView({ autoStart }: { autoStart?: boolean }) {
  const date = useToday()
  const plan = useApp((s) => s.plan)
  const day = useApp((s) => s.days[date])
  const active = day?.workouts.find((w) => !w.finishedAt)
  const [preview, setPreview] = useState(weekdayOf(date))
  useEffect(() => setPreview(weekdayOf(date)), [date])
  useEffect(() => {
    if (!autoStart || !plan || active) return
    const today = plan.program.days.find((d) => d.weekday === weekdayOf(date))
    if (today && today.kind === 'strength') startWorkout(date, today)
    // Only for the home-screen shortcut on first mount.
  }, [autoStart])
  if (!plan) return null

  return (
    <ViewScroller>
      <ViewHeader
        title="Train"
        subtitle={plan.program.name}
        right={
          <IconButton label="Weekly program" className="mb-0.5 bg-surface-2" onClick={() => openSheet({ kind: 'program' })}>
            <ClipboardList size={20} />
          </IconButton>
        }
      />
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-1">
        {active ? (
          <ActiveSession session={active} date={date} />
        ) : (
          <>
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Program day">
              {WEEK_ORDER.map((wd) => {
                const pd = plan.program.days.find((d) => d.weekday === wd)!
                const isToday = wd === weekdayOf(date)
                return (
                  <button
                    key={wd}
                    type="button"
                    role="tab"
                    aria-selected={preview === wd}
                    onClick={() => setPreview(wd)}
                    className={cx('tap flex min-h-14 min-w-[3.6rem] flex-col items-center justify-center rounded-2xl px-2 text-[12px] font-semibold', preview === wd ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2')}
                  >
                    <span>{isToday ? 'Today' : WEEKDAY_LABEL[wd].slice(0, 3)}</span>
                    <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', pd.kind === 'strength' ? 'bg-current' : pd.kind === 'cardio' ? 'border border-current' : 'opacity-0')} aria-hidden />
                  </button>
                )
              })}
            </div>
            <DayPreview day={plan.program.days.find((d) => d.weekday === preview)!} date={date} isToday={preview === weekdayOf(date)} done={!!day?.workouts.some((w) => w.finishedAt)} />
          </>
        )}
        <History />
      </div>
    </ViewScroller>
  )
}

function DayPreview({ day, date, isToday, done }: { day: ProgramDay; date: ISODate; isToday: boolean; done: boolean }) {
  const lighter = useApp((s) => !!s.days[date]?.lighter)
  const unit = useApp((s) => s.settings.weightUnit)
  const days = useApp((s) => s.days)
  const history = useMemo(() => allSessions(), [days])
  if (day.kind !== 'strength') {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-fg">{day.kind === 'cardio' ? <Footprints size={22} /> : <Feather size={22} />}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold text-ink">{day.title}</h2>
            <p className="text-[13.5px] text-ink-3">{day.cardio ? `${day.cardio.activity} · ${day.cardio.intensity}` : 'Recovery day'}</p>
          </div>
        </div>
        {day.sourceText && <p className="mt-3 text-[13px] text-ink-3">From your profile: “{day.sourceText}”</p>}
        {isToday && !done && day.kind !== 'rest' && (
          <Button
            className="mt-4"
            variant="primary"
            size="lg"
            block
            icon={<Check size={20} />}
            onClick={() => {
              const s = startWorkout(date, day)
              updateSession(date, s.id, (w) => ({ ...w, cardio: w.cardio ? { ...w.cardio, done: true } : { activity: day.title, minutes: day.estMinutes, done: true } }))
              finishWorkout(date, s.id)
              toast(`${day.title} logged ✓`)
            }}
          >
            Mark as done
          </Button>
        )}
        {isToday && done && <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-ink"><Check size={18} className="text-good" /> Done for today</p>}
      </Card>
    )
  }
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">
          <Dumbbell size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold text-ink">{day.title}</h2>
          <p className="text-[13.5px] text-ink-3">
            {day.exercises.length} exercises · ~{day.estMinutes} min{day.sourceText ? ' · from your schedule' : ''}
          </p>
        </div>
        {isToday && lighter && <Badge tone="warn">Lighter</Badge>}
      </div>
      <ol className="mt-3 divide-y divide-line">
        {day.exercises.map((pe, i) => {
          const ex = EXERCISE_BY_ID.get(pe.exerciseId)
          const w = pe.timed ? undefined : suggestWeight(pe.exerciseId, history, pe.repsMax, isToday && lighter)
          return (
            <li key={pe.exerciseId} className="flex items-center gap-3 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-bold text-ink-2">{i + 1}</span>
              <button type="button" className="tap min-w-0 flex-1 text-left" onClick={() => openSheet({ kind: 'exerciseInfo', exerciseId: pe.exerciseId })}>
                <span className="block truncate text-[15px] font-medium text-ink">{ex?.name}</span>
                <span className="text-[12.5px] text-ink-3">
                  {isToday && lighter ? Math.max(2, pe.sets - 1) : pe.sets} × {pe.repsMin}–{pe.repsMax}
                  {pe.timed ? ' s' : ''} · rest {pe.restSec}s{w ? ` · ${fmtWeight(w, unit)}` : ''}
                </span>
              </button>
              <Info size={16} className="shrink-0 text-ink-3" aria-hidden />
            </li>
          )
        })}
      </ol>
      {isToday && !done && (
        <>
          <div className="mt-2 border-t border-line">
            <Switch checked={lighter} onChange={(v) => setLighter(date, v)} label="Lighter session" description="One fewer set and ~80% loads, for low-energy or sore days." />
          </div>
          <Button className="mt-2" variant="primary" size="lg" block icon={<Dumbbell size={20} />} onClick={() => (haptic(20), startWorkout(date, day))}>
            Start workout
          </Button>
        </>
      )}
      {!isToday && (
        <Button className="mt-3" block onClick={() => startWorkout(date, day)}>
          Do this workout today instead
        </Button>
      )}
      {isToday && done && <p className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-ink"><Check size={18} className="text-good" /> Today's workout is done</p>}
    </Card>
  )
}

/** Ticking clock in its own component so the session list doesn't re-render every second. */
function Elapsed({ since }: { since: number }) {
  const now = useNow(1000)
  return <>{fmtDuration(now.getTime() - since)}</>
}

function ActiveSession({ session, date }: { session: WorkoutSession; date: ISODate }) {
  const unit = useApp((s) => s.settings.weightUnit)
  // Other sessions don't change mid-workout: compute once so memoised cards stay memoised.
  const history = useMemo(() => allSessions().filter((w) => w.id !== session.id), [session.id])
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.length, 0)
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)

  const finish = async () => {
    if (doneSets < totalSets && !(await confirmDialog({ title: 'Finish workout?', body: `${totalSets - doneSets} sets aren't ticked. They won't count toward your history.`, confirmLabel: 'Finish' }))) return
    useRest.getState().stop()
    finishWorkout(date, session.id)
    const prs = countPRs(session, history)
    const volume = sessionVolume(session)
    toast(`Workout saved · ${fmtDuration(Date.now() - session.startedAt)}${volume ? ` · ${fmtNum(Math.round(kgTo(volume, unit)))} ${unit} lifted` : ''}${prs ? ` · ${prs} PR${prs > 1 ? 's' : ''} 🏆` : ''}`)
  }

  return (
    <div className="space-y-3">
      <div className="sticky z-20 -mx-4 bg-canvas/95 px-4 py-2" style={{ top: 'calc(env(safe-area-inset-top) + 74px)' }}>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pl-4 shadow-card">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-ink">
              {session.title} {session.intensity === 'light' && <Badge tone="warn">Lighter</Badge>}
            </div>
            <div className="text-[13px] tabular-nums text-ink-3">
              <Elapsed since={session.startedAt} /> · {doneSets}/{totalSets} sets
            </div>
          </div>
          <Button variant="primary" icon={<Flag size={18} />} onClick={finish}>
            Finish
          </Button>
        </div>
      </div>

      {session.exercises.map((e, idx) => (
        <ExerciseCard key={e.uid} e={e} date={date} sessionId={session.id} unit={unit} history={history} nextName={session.exercises[idx + 1]?.name} isLast={idx === session.exercises.length - 1} />
      ))}

      <Button
        variant="danger"
        block
        icon={<Trash2 size={18} />}
        onClick={async () => {
          if (await confirmDialog({ title: 'Discard this workout?', body: 'Logged sets from this session will be removed.', confirmLabel: 'Discard', danger: true })) {
            useRest.getState().stop()
            const prev = discardWorkout(date, session.id)
            toast({ message: 'Workout discarded', actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
          }
        }}
      >
        Discard workout
      </Button>
    </div>
  )
}

/** One exercise in a running session. Memoised: ticking a set re-renders only its own card. */
const ExerciseCard = memo(function ExerciseCard({ e, date, sessionId, unit, history, nextName, isLast }: { e: SessionExercise; date: ISODate; sessionId: string; unit: 'kg' | 'lb'; history: WorkoutSession[]; nextName?: string; isLast: boolean }) {
  const startRest = useRest((s) => s.start)
  const last = useMemo(() => lastPerformance(e.exerciseId, history, e.repsMax), [e.exerciseId, history, e.repsMax])
  const updateEx = (fn: (x: SessionExercise) => SessionExercise) => updateSession(date, sessionId, (w) => ({ ...w, exercises: w.exercises.map((x) => (x.uid === e.uid ? fn(x) : x)) }))
  return (
    <Card className="p-0">
      <div className="flex items-start gap-1 p-3 pb-1 pl-4">
        <button type="button" className="tap min-w-0 flex-1 py-1 text-left" onClick={() => openSheet({ kind: 'exerciseInfo', exerciseId: e.exerciseId })}>
          <span className="block text-[16px] font-bold leading-snug text-ink">{e.name}</span>
          <span className="text-[12.5px] text-ink-3">
            {e.sets.length} × {e.repsMin}–{e.repsMax}
            {e.timed ? ' s' : ''} · rest {e.restSec}s
            {last ? ` · last: ${last.topWeightKg ? `${fmtWeight(last.topWeightKg, unit)} × ` : ''}${last.reps.join(', ')}` : ''}
          </span>
        </button>
        <IconButton label={`Exercise info for ${e.name}`} onClick={() => openSheet({ kind: 'exerciseInfo', exerciseId: e.exerciseId })}>
          <Info size={19} />
        </IconButton>
        <IconButton label={`Swap ${e.name}`} onClick={() => openSheet({ kind: 'swapExercise', date, sessionId, exerciseUid: e.uid })}>
          <Repeat2 size={19} />
        </IconButton>
      </div>
      <div className="px-3 pb-3">
        <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-2 px-1 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
          <span>Set</span>
          <span className="text-center">{unit}</span>
          <span className="text-center">{e.timed ? 'Secs' : 'Reps'}</span>
          <span />
        </div>
        {e.sets.map((s, i) => (
          <div key={i} className={cx('grid grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-2 rounded-xl px-1 py-1', s.done && 'bg-accent-soft')}>
            <span className="text-center text-[14px] font-bold text-ink-2">{i + 1}</span>
            <NumberCell
              label={`Set ${i + 1} weight`}
              value={s.weightKg != null ? kgTo(s.weightKg, unit) : undefined}
              placeholder={e.timed ? '–' : 'BW'}
              onChange={(v) => updateEx((x) => ({ ...x, sets: x.sets.map((y, j) => (j === i || (j > i && !y.done && y.weightKg === s.weightKg) ? { ...y, weightKg: v == null ? undefined : toKg(v, unit) } : y)) }))}
            />
            <NumberCell label={`Set ${i + 1} ${e.timed ? 'seconds' : 'reps'}`} value={s.reps} placeholder={String(e.repsMax)} onChange={(v) => updateEx((x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, reps: v } : y)) }))} />
            <button
              type="button"
              aria-pressed={s.done}
              aria-label={`${s.done ? 'Undo' : 'Complete'} set ${i + 1}`}
              onClick={() => {
                haptic(15)
                const finishing = !s.done
                updateEx((x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, done: finishing, doneAt: finishing ? Date.now() : undefined, reps: y.reps ?? (finishing ? e.repsMax : y.reps) } : y)) }))
                const lastSetOfAll = isLast && i === e.sets.length - 1
                if (finishing && !lastSetOfAll) startRest(e.restSec, i === e.sets.length - 1 ? nextName : `${e.name} · set ${i + 2}`)
              }}
              className={cx('tap grid h-12 w-full place-items-center rounded-xl transition-colors', s.done ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-3')}
            >
              <Check size={20} strokeWidth={3} />
            </button>
          </div>
        ))}
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => updateEx((x) => ({ ...x, sets: [...x.sets, { weightKg: x.sets.at(-1)?.weightKg, done: false }] }))}>
            Set
          </Button>
          <Button size="sm" variant="ghost" icon={<Minus size={16} />} disabled={e.sets.length <= 1} onClick={() => updateEx((x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>
            Set
          </Button>
        </div>
      </div>
    </Card>
  )
})

/** Compact numeric cell that commits on blur (decimal keypad on iOS). */
function NumberCell({ value, onChange, placeholder, label }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder: string; label: string }) {
  const fmt = (v: number | undefined) => (v == null ? '' : String(Math.round(v * 10) / 10))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(fmt(value))
  }, [value, focused])
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const n = Number(text.replace(',', '.'))
        onChange(text.trim() === '' || !Number.isFinite(n) ? undefined : Math.max(0, n))
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface text-center text-[17px] font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-3 focus:border-accent-fg"
    />
  )
}

export function sessionVolume(s: WorkoutSession) {
  return s.exercises.reduce((a, e) => a + (e.timed ? 0 : e.sets.filter((x) => x.done).reduce((b, x) => b + (x.weightKg ?? 0) * (x.reps ?? 0), 0)), 0)
}

const e1rm = (w: number, r: number) => w * (1 + r / 30)

function countPRs(s: WorkoutSession, history: WorkoutSession[]) {
  let prs = 0
  for (const e of s.exercises) {
    if (e.timed) continue
    const best = Math.max(0, ...e.sets.filter((x) => x.done && x.weightKg).map((x) => e1rm(x.weightKg!, x.reps ?? 0)))
    if (!best) continue
    const prev = Math.max(0, ...history.flatMap((h) => h.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets.filter((y) => y.done && y.weightKg).map((y) => e1rm(y.weightKg!, y.reps ?? 0)))))
    if (prev > 0 && best > prev) prs++
  }
  return prs
}

function History() {
  const days = useApp((s) => s.days)
  const unit = useApp((s) => s.settings.weightUnit)
  const sessions = useMemo(() => allSessions().filter((s) => s.finishedAt).slice(0, 15), [days])
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section className="pt-3">
      <SectionTitle>History</SectionTitle>
      {!sessions.length ? (
        <EmptyState icon={<Trophy size={24} />} title="No workouts yet" body="Finished sessions appear here with sets, volume and personal records." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {sessions.map((s) => {
            const volume = sessionVolume(s)
            const isOpen = open === s.id
            return (
              <div key={s.id}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)} className="tap flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {s.title} {s.intensity === 'light' && <Badge tone="warn">Lighter</Badge>}
                    </span>
                    <span className="text-[12.5px] text-ink-3">
                      {fmtDay(s.date)} · {fmtDuration((s.finishedAt ?? s.startedAt) - s.startedAt)}
                      {volume ? ` · ${fmtNum(Math.round(kgTo(volume, unit)))} ${unit}` : ''}
                    </span>
                  </span>
                  <ChevronDown size={18} className={cx('shrink-0 text-ink-3 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <ul className="space-y-1 px-4 pb-3 text-[13.5px]">
                    {s.cardio && <li className="text-ink-2">{s.cardio.activity} · {s.cardio.minutes} min</li>}
                    {s.exercises.map((e) => {
                      const done = e.sets.filter((x) => x.done)
                      if (!done.length) return null
                      return (
                        <li key={e.uid} className="text-ink-2">
                          <span className="font-medium text-ink">{e.name}</span>: {done.map((x) => `${x.weightKg ? `${Math.round(kgTo(x.weightKg, unit) * 10) / 10}×` : ''}${x.reps ?? '–'}`).join(', ')}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

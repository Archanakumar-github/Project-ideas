import { useEffect, useState } from 'react'
import { ExternalLink, Globe, Loader2, RefreshCw } from 'lucide-react'
import { EXERCISE_BY_ID } from '../../data/exercises'
import { allSessions, replaceProgramExercise, reshuffleProgram, updateSession, useApp } from '../../store/app'
import { closeSheet, confirmDialog, toast } from '../../store/ui'
import { substitutes, suggestWeight } from '../../engine/programBuilder'
import { exerciseInfo, type ExerciseInfo } from '../../api/wger'
import { useOnline } from '../../hooks/useOnline'
import { WEEK_ORDER, WEEKDAY_LABEL, type ISODate } from '../../lib/dates'
import { uid } from '../../lib/utils'
import { Sheet } from '../ui/Sheet'
import { Badge, Button, Switch } from '../ui/primitives'

const EQUIP: Record<string, string> = { barbell: 'Barbell', dumbbell: 'Dumbbells', kettlebell: 'Kettlebell', machine: 'Machine', cable: 'Cable', band: 'Band', pullup_bar: 'Pull-up bar', bench: 'Bench', cardio_machine: 'Cardio machine' }

export function ExerciseInfoSheet({ exerciseId }: { exerciseId: string }) {
  const ex = EXERCISE_BY_ID.get(exerciseId)
  const online = useOnline()
  const allow = useApp((s) => s.settings.online)
  const [info, setInfo] = useState<{ loading: boolean; data?: ExerciseInfo; error?: string }>({ loading: false })
  useEffect(() => {
    if (!ex || !online || !allow) return
    const ctrl = new AbortController()
    setInfo({ loading: true })
    exerciseInfo(ex.name, ctrl.signal)
      .then((data) => setInfo({ loading: false, data }))
      .catch((e: Error) => !ctrl.signal.aborted && setInfo({ loading: false, error: e.message }))
    return () => ctrl.abort()
  }, [ex, online, allow])
  if (!ex) return null
  return (
    <Sheet title={ex.name} subtitle={ex.muscles.join(' · ')} onClose={closeSheet}>
      <div className="flex flex-wrap gap-1.5">
        {(ex.needs.length ? ex.needs.map((n) => EQUIP[n] ?? n) : ['Bodyweight']).map((n) => (
          <Badge key={n}>{n}</Badge>
        ))}
        {ex.compound && <Badge tone="accent">Compound</Badge>}
        {ex.unilateral && <Badge>One side at a time</Badge>}
      </div>
      <h3 className="mb-1.5 mt-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Coaching cues</h3>
      <ul className="space-y-2">
        {ex.cues.map((c) => (
          <li key={c} className="flex gap-2.5 text-[15px] text-ink">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
      {ex.stresses.length > 0 && <p className="mt-3 text-[13px] text-ink-3">Go easy if your {ex.stresses.map((s) => s.replace('_', ' ')).join(' or ')} is sensitive. Use the swap button for alternatives.</p>}
      {online && allow && (
        <div className="mt-5">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            <Globe size={13} /> From wger.de
          </h3>
          {info.loading && <Loader2 className="animate-spin text-ink-3" aria-label="Loading" />}
          {info.error && <p className="text-[14px] text-ink-3">Couldn't load details ({info.error}).</p>}
          {!info.loading && !info.error && !info.data && <p className="text-[14px] text-ink-3">No extra details found.</p>}
          {info.data && (
            <div>
              {info.data.images.length > 0 && (
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                  {info.data.images.slice(0, 4).map((src) => (
                    <img key={src} src={src} alt={`${info.data!.name} demonstration`} loading="lazy" className="h-40 w-auto shrink-0 rounded-2xl border border-line bg-white object-contain" />
                  ))}
                </div>
              )}
              {info.data.description && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{info.data.description}</p>}
              {info.data.url && (
                <a href={info.data.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 text-[13.5px] font-semibold text-accent-fg">
                  View on wger <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

export function SwapExerciseSheet({ date, sessionId, exerciseUid }: { date: ISODate; sessionId: string; exerciseUid: string }) {
  const profile = useApp((s) => s.profile)!
  const session = useApp((s) => s.days[date]?.workouts.find((w) => w.id === sessionId))
  const [always, setAlways] = useState(false)
  const current = session?.exercises.find((e) => e.uid === exerciseUid)
  if (!session || !current) return null
  const inSession = session.exercises.map((e) => e.exerciseId)
  const options = substitutes(current.exerciseId, profile, inSession)
  const pick = (id: string) => {
    const ex = EXERCISE_BY_ID.get(id)!
    const history = allSessions()
    const w = ex.timed ? undefined : suggestWeight(id, history, current.repsMax, session.intensity === 'light')
    updateSession(date, sessionId, (s) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.uid === exerciseUid
          ? { ...e, uid: uid(), exerciseId: id, name: ex.name, timed: ex.timed, repsMin: ex.timed ? 30 : e.timed ? 8 : e.repsMin, repsMax: ex.timed ? 45 : e.timed ? 12 : e.repsMax, swappedFrom: e.swappedFrom ?? e.exerciseId, sets: e.sets.map((x) => (x.done ? x : { done: false, weightKg: w })) }
          : e,
      ),
    }))
    if (always && session.weekday) replaceProgramExercise(session.weekday, current.exerciseId, id)
    toast(`Swapped to ${ex.name}`)
    closeSheet()
  }
  return (
    <Sheet title={`Swap ${current.name}`} subtitle="Same movement pattern · fits your equipment & injuries" onClose={closeSheet}>
      <Switch checked={always} onChange={setAlways} label="Also update my program" description="Use this exercise on this day every week." />
      <div className="mt-2 space-y-2">
        {options.length === 0 && <p className="py-4 text-center text-[14px] text-ink-3">No alternatives match your equipment.</p>}
        {options.map((o) => (
          <button key={o.id} type="button" onClick={() => pick(o.id)} className="tap flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-left active:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{o.name}</span>
              <span className="block text-[12.5px] text-ink-3">
                {(o.needs.length ? o.needs.map((n) => EQUIP[n] ?? n) : ['Bodyweight']).join(' + ')} · {o.cues[0]}
              </span>
            </span>
            <span className="text-[12px] font-semibold text-ink-3">{'●'.repeat(o.level)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export function ProgramSheet() {
  const plan = useApp((s) => s.plan)!
  return (
    <Sheet
      title={plan.program.name}
      subtitle="Generated from your user_profile.md"
      onClose={closeSheet}
      full
      footer={
        <Button
          block
          icon={<RefreshCw size={18} />}
          onClick={async () => {
            if (await confirmDialog({ title: 'Regenerate program?', body: 'Exercise choices are re-picked within the same split, equipment and injury rules. Your workout history stays.', confirmLabel: 'Regenerate' })) {
              reshuffleProgram()
              toast('Program regenerated')
            }
          }}
        >
          Regenerate program
        </Button>
      }
    >
      {plan.program.notes.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">
          {plan.program.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        {WEEK_ORDER.map((wd) => {
          const d = plan.program.days.find((x) => x.weekday === wd)!
          return (
            <section key={wd} className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-bold text-ink">
                  {WEEKDAY_LABEL[wd]} · {d.title}
                </h3>
                <span className="shrink-0 text-[12.5px] text-ink-3">~{d.estMinutes} min</span>
              </div>
              {d.exercises.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-[13.5px] text-ink-2">
                  {d.exercises.map((e) => (
                    <li key={e.exerciseId}>
                      {EXERCISE_BY_ID.get(e.exerciseId)?.name}: {e.sets}×{e.repsMin}–{e.repsMax}
                      {e.timed ? 's' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13.5px] text-ink-2">{d.cardio ? `${d.cardio.activity} · ${d.cardio.intensity}` : 'Rest'}</p>
              )}
            </section>
          )
        })}
      </div>
    </Sheet>
  )
}

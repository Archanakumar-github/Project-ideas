import { Droplets, Undo2 } from 'lucide-react'
import { addWater, restoreDay, undoWater, useApp } from '../../store/app'
import { waterTotal } from '../../engine/insights'
import { fmtMl } from '../../lib/units'
import { weekdayOf, type ISODate } from '../../lib/dates'
import { toast } from '../../store/ui'
import { Card, IconButton } from '../ui/primitives'
import { Meter } from '../ui/Progress'
import { cx, haptic } from '../../lib/utils'

/** One-tap hydration: +250 / +500 / +750 ml with a live progress bar. */
export function WaterCard({ date, compact }: { date: ISODate; compact?: boolean }) {
  const day = useApp((s) => s.days[date])
  const plan = useApp((s) => s.plan)
  const ml = waterTotal(day)
  const kind = plan?.program.days.find((d) => d.weekday === weekdayOf(date))?.kind
  const target = (plan?.targets.waterMl ?? 2500) + (kind === 'strength' || kind === 'cardio' ? plan?.targets.trainingDayWaterBonusMl ?? 0 : 0)
  const glasses = Math.round(target / 250)
  const filled = Math.min(glasses, Math.floor(ml / 250))
  const add = (n: number) => {
    const prev = addWater(date, n)
    haptic(15)
    if (ml < target && ml + n >= target) toast({ message: 'Water target reached 💧', actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
  }
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-water-soft text-water">
          <Droplets size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">Water</h2>
          <p className="text-[13px] tabular-nums text-ink-3">
            <span className="font-semibold text-ink">{fmtMl(ml)}</span> of {fmtMl(target)}
            {ml >= target && ' · done ✓'}
          </p>
        </div>
        <IconButton label="Undo last water" disabled={!day?.water.length} onClick={() => undoWater(date)}>
          <Undo2 size={18} />
        </IconButton>
      </div>
      <Meter className="mt-3" value={ml} max={target} color="var(--c-water)" height={10} label={`Water ${ml} of ${target} ml`} />
      {!compact && glasses <= 20 && (
        <div className="mt-2 flex flex-wrap gap-1" aria-hidden>
          {Array.from({ length: glasses }, (_, i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < filled ? 'bg-water' : 'bg-surface-3')} />
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[250, 500, 750].map((n) => (
          <button key={n} type="button" onClick={() => add(n)} className="tap min-h-12 rounded-2xl bg-water-soft text-[15px] font-bold text-ink active:scale-[0.98]">
            +{n} ml
          </button>
        ))}
      </div>
    </Card>
  )
}

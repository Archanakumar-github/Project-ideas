import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { restoreDay, setMeasurements, setWeight, useApp } from '../../store/app'
import { closeSheet, toast } from '../../store/ui'
import { fmtDay, type ISODate } from '../../lib/dates'
import { cmTo, kgTo, toCm, toKg } from '../../lib/units'
import { weightSeries } from '../../engine/insights'
import { Button, Stepper } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'
import type { MeasurementKey, Measurements } from '../../types'

/** Prefilled with the last value, so a weigh-in is two taps: ± and Save. */
export function LogWeightSheet({ date }: { date: ISODate }) {
  const unit = useApp((s) => s.settings.weightUnit)
  const days = useApp((s) => s.days)
  const profile = useApp((s) => s.profile)
  const existing = days[date]?.weightKg
  const last = weightSeries(days).at(-1)?.kg ?? profile?.weightKg ?? 70
  const [value, setValue] = useState(kgTo(existing ?? last, unit))
  const save = () => {
    const prev = setWeight(date, toKg(value, unit))
    closeSheet()
    toast({ message: `Weight saved for ${fmtDay(date)}`, actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
  }
  return (
    <Sheet
      title="Log weight"
      subtitle={fmtDay(date, { weekday: 'long', month: 'short', day: 'numeric' })}
      onClose={closeSheet}
      footer={
        <div className="flex gap-2">
          {existing != null && (
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={() => {
                const prev = setWeight(date, undefined)
                closeSheet()
                toast({ message: 'Weigh-in removed', actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
              }}
            >
              Remove
            </Button>
          )}
          <Button variant="primary" size="lg" className="flex-1" icon={<Check size={20} />} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-[14px] text-ink-3">Best taken in the morning, after the bathroom and before eating.</p>
      <Stepper label="Weight" size="lg" value={value} onChange={setValue} step={unit === 'kg' ? 0.1 : 0.2} min={20} max={700} decimals={1} unit={unit} />
    </Sheet>
  )
}

export const MEASUREMENT_FIELDS: Array<{ key: MeasurementKey; label: string; pct?: boolean }> = [
  { key: 'neck', label: 'Neck' },
  { key: 'chest', label: 'Chest' },
  { key: 'arms', label: 'Arms' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'thighs', label: 'Thighs' },
  { key: 'calves', label: 'Calves' },
  { key: 'bodyFat', label: 'Body fat', pct: true },
]

export function latestMeasurements(days: Record<string, { date: string; measurements?: Partial<Measurements> }>, fallback: Partial<Measurements> = {}): Partial<Measurements> {
  const out: Partial<Measurements> = { ...fallback }
  for (const d of Object.values(days).sort((a, b) => a.date.localeCompare(b.date))) Object.assign(out, d.measurements ?? {})
  return out
}

export function LogMeasurementsSheet({ date }: { date: ISODate }) {
  const unit = useApp((s) => s.settings.lengthUnit)
  const days = useApp((s) => s.days)
  const profile = useApp((s) => s.profile)
  const base = latestMeasurements(days, profile?.measurements)
  const [values, setValues] = useState<Partial<Measurements>>({ ...base, ...days[date]?.measurements })
  const save = () => {
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && Number.isFinite(v) && v > 0)) as Partial<Measurements>
    const prev = setMeasurements(date, clean)
    closeSheet()
    toast({ message: 'Measurements saved', actionLabel: 'Undo', onAction: () => restoreDay(date, prev) })
  }
  return (
    <Sheet title="Body measurements" subtitle={`${fmtDay(date, { weekday: 'long', month: 'short', day: 'numeric' })} · prefilled with your last values`} onClose={closeSheet} full footer={<Button variant="primary" size="lg" block icon={<Check size={20} />} onClick={save}>Save measurements</Button>}>
      <div className="space-y-3">
        {MEASUREMENT_FIELDS.map((f) => (
          <div key={f.key}>
            <div className="mb-1 text-[13px] font-medium text-ink-2">{f.label}</div>
            <Stepper
              label={f.label}
              value={values[f.key] != null ? (f.pct ? values[f.key] : cmTo(values[f.key]!, unit)) : undefined}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: f.pct ? v : Math.round(toCm(v, unit) * 10) / 10 }))}
              step={f.pct ? 0.5 : unit === 'cm' ? 0.5 : 0.25}
              min={0}
              max={f.pct ? 70 : 300}
              decimals={1}
              unit={f.pct ? '%' : unit}
            />
          </div>
        ))}
      </div>
    </Sheet>
  )
}

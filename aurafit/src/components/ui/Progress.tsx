import type { ReactNode } from 'react'
import { cx } from '../../lib/utils'

/**
 * Meters. The filled part carries the data colour; the track is a faint step of the same
 * hue, so the reading works across the whole bar. Over-target is shown with an extra
 * marker + text label rather than colour alone.
 */

export function Ring({
  value,
  max,
  size = 148,
  stroke = 12,
  color = 'var(--c-accent)',
  track = 'var(--c-accent-soft)',
  children,
  label,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
  label: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const over = max > 0 && value > max * 1.02
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 400ms var(--ease-snap)' }}
        />
        {over && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-serious)" strokeWidth={stroke / 3} strokeDasharray={`${c * Math.min(0.25, value / max - 1)} ${c}`} strokeLinecap="round" />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Meter({ value, max, color = 'var(--c-accent)', track, className, height = 8, label }: { value: number; max: number; color?: string; track?: string; className?: string; height?: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cx('w-full overflow-hidden rounded-full', className)}
      style={{ height, background: track ?? `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 350ms var(--ease-snap)' }} />
    </div>
  )
}

export function MacroBar({ name, value, target, color, unit = 'g', compact }: { name: string; value: number; target: number; color: string; unit?: string; compact?: boolean }) {
  const over = value > target * 1.05
  return (
    <div className="min-w-0">
      <div className={cx('mb-1 flex gap-x-2', compact ? 'flex-col' : 'items-baseline justify-between')}>
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
          {name}
        </span>
        <span className="text-[12.5px] tabular-nums text-ink-3">
          <span className="font-semibold text-ink">{Math.round(value)}</span>/{Math.round(target)}
          {unit}
          {over && <span className="ml-1 font-semibold text-ink">▲</span>}
        </span>
      </div>
      <Meter value={value} max={target} color={color} label={`${name} ${Math.round(value)} of ${Math.round(target)} ${unit}${over ? ', over target' : ''}`} height={7} />
    </div>
  )
}

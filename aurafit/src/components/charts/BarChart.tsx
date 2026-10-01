import { useState } from 'react'
import { cx } from '../../lib/utils'

/**
 * Daily columns (≤24px wide, 4px rounded tops, square at the baseline) with an optional
 * target line. Each column is its own tap target and shows its value on selection.
 */
export interface Bar {
  key: string
  label: string
  value: number
  detail?: string
}

export function BarChart({
  bars,
  target,
  targetLabel = 'Target',
  color = 'var(--c-accent)',
  format = (v) => Math.round(v).toLocaleString(),
  height = 150,
  title,
}: {
  bars: Bar[]
  target?: number
  targetLabel?: string
  color?: string
  format?: (v: number) => string
  height?: number
  title: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.1
  const W = 340
  const H = height
  const pad = { l: 8, r: 8, t: 16, b: 22 }
  const band = (W - pad.l - pad.r) / bars.length
  const barW = Math.min(24, band * 0.6)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const base = H - pad.b
  const act = active != null ? bars[active] : null

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full select-none" role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${format(b.value)}`).join(', ')}`}>
        <line x1={pad.l} x2={W - pad.r} y1={base} y2={base} stroke="var(--c-line-strong)" strokeWidth="1" />
        {bars.map((b, i) => {
          const cx0 = pad.l + band * i + band / 2
          const top = y(b.value)
          const h = Math.max(0, base - top)
          const r = Math.min(4, h)
          const x0 = cx0 - barW / 2
          const path = h > 0 ? `M${x0},${base} L${x0},${top + r} Q${x0},${top} ${x0 + r},${top} L${x0 + barW - r},${top} Q${x0 + barW},${top} ${x0 + barW},${top + r} L${x0 + barW},${base} Z` : ''
          return (
            <g key={b.key}>
              <path d={path} fill={color} opacity={active == null || active === i ? 1 : 0.45} />
              <text x={cx0} y={H - 6} textAnchor="middle" className={cx('text-[10.5px]', active === i ? 'fill-[var(--c-ink)] font-semibold' : 'fill-[var(--c-ink-3)]')}>
                {b.label}
              </text>
              <rect
                x={pad.l + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${b.label}: ${format(b.value)}${b.detail ? `, ${b.detail}` : ''}`}
                onClick={() => setActive(active === i ? null : i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: 'none', cursor: 'pointer' }}
              />
            </g>
          )
        })}
        {target != null && (
          <g pointerEvents="none">
            <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke="var(--c-ink-2)" strokeWidth="1" opacity="0.75" />
            <text x={W - pad.r} y={y(target) - 4} textAnchor="end" className="fill-[var(--c-ink-2)] text-[10px] font-semibold">
              {targetLabel} {format(target)}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-1 min-h-5 text-[12.5px] text-ink-3" aria-live="polite">
        {act ? (
          <>
            <span className="font-semibold text-ink">{format(act.value)}</span> · {act.label}
            {act.detail ? ` · ${act.detail}` : ''}
          </>
        ) : (
          'Tap a day for details'
        )}
      </figcaption>
    </figure>
  )
}

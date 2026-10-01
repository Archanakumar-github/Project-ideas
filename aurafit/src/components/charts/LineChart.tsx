import { useId, useMemo, useRef, useState } from 'react'
import { Table2 } from 'lucide-react'
import { diffDays, fmtDay, type ISODate } from '../../lib/dates'
import { cx } from '../../lib/utils'

/**
 * Lightweight single-series trend chart (no chart library).
 *  - 2px line + 10% area wash in the series colour; hairline solid gridlines.
 *  - Optional goal reference line, labelled in text ink.
 *  - Crosshair snaps to the nearest point on touch/hover; the tooltip leads with the value.
 *  - End-point direct label; a table view carries every value without hovering.
 */
export interface LinePoint {
  date: ISODate
  value: number
}

export function LineChart({
  points,
  goal,
  goalLabel = 'Goal',
  color = 'var(--c-accent)',
  format = (v) => v.toFixed(1),
  height = 200,
  title,
  smooth,
}: {
  points: LinePoint[]
  goal?: number
  goalLabel?: string
  color?: string
  format?: (v: number) => string
  height?: number
  title: string
  /** Optional second, de-emphasised series (e.g. the 7-day average) drawn under the points. */
  smooth?: LinePoint[]
}) {
  const [active, setActive] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const gradId = useId()
  const W = 340
  const H = height
  const pad = { l: 40, r: 44, t: 14, b: 26 }

  const geo = useMemo(() => {
    if (!points.length) return null
    const first = points[0].date
    const span = Math.max(1, diffDays(points[points.length - 1].date, first))
    const values = [...points.map((p) => p.value), ...(smooth ?? []).map((p) => p.value), ...(goal != null ? [goal] : [])]
    let min = Math.min(...values)
    let max = Math.max(...values)
    if (max - min < 1) {
      min -= 0.5
      max += 0.5
    }
    const padY = (max - min) * 0.12
    min -= padY
    max += padY
    const single = points.length === 1
    const x = (d: ISODate) => (single ? (pad.l + W - pad.r) / 2 : pad.l + (diffDays(d, first) / span) * (W - pad.l - pad.r))
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
    const step = niceStep((max - min) / 4)
    const ticks: number[] = []
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v)
    return { x, y, ticks, min, max }
  }, [points, smooth, goal, H])

  if (!geo) return null
  const { x, y, ticks } = geo
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points[points.length - 1].date).toFixed(1)},${H - pad.b} L${x(points[0].date).toFixed(1)},${H - pad.b} Z`
  const smoothLine = smooth?.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const act = active != null ? points[active] : null

  const pick = (clientX: number) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(x(p.date) - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setActive(best)
  }

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-pan-y select-none"
          role="img"
          aria-label={`${title}: ${points.length} points, latest ${format(last.value)} on ${fmtDay(last.date)}`}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e.clientX)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.16" />
              <stop offset="1" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--c-line)" strokeWidth="1" />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--c-ink-3)] text-[10px] tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {goal != null && (
            <g>
              <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--c-ink-2)" strokeWidth="1" opacity="0.75" />
              <text x={W - pad.r + 4} y={y(goal)} dy="0.32em" className="fill-[var(--c-ink-2)] text-[10px] font-semibold">
                {goalLabel}
              </text>
              <text x={W - pad.r + 4} y={y(goal) + 12} dy="0.32em" className="fill-[var(--c-ink-3)] text-[10px] tabular-nums">
                {format(goal)}
              </text>
            </g>
          )}
          <path d={area} fill={`url(#${gradId})`} />
          {smoothLine && <path d={smoothLine} fill="none" stroke="var(--c-ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />}
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.length <= 40 &&
            points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="2.5" fill={color} stroke="var(--c-surface)" strokeWidth="1.5" />)}
          <circle cx={x(last.date)} cy={y(last.value)} r="4.5" fill={color} stroke="var(--c-surface)" strokeWidth="2" />
          <text x={x(last.date) + 8} y={y(last.value)} dy="0.32em" className="fill-[var(--c-ink)] text-[11px] font-semibold tabular-nums">
            {format(last.value)}
          </text>
          <text x={pad.l} y={H - 8} className="fill-[var(--c-ink-3)] text-[10px]">
            {fmtDay(points[0].date, { month: 'short', day: 'numeric' })}
          </text>
          {points.length > 1 && (
            <text x={W - pad.r} y={H - 8} textAnchor="end" className="fill-[var(--c-ink-3)] text-[10px]">
              {fmtDay(last.date, { month: 'short', day: 'numeric' })}
            </text>
          )}
          {act && (
            <g pointerEvents="none">
              <line x1={x(act.date)} x2={x(act.date)} y1={pad.t} y2={H - pad.b} stroke="var(--c-ink-3)" strokeWidth="1" />
              <circle cx={x(act.date)} cy={y(act.value)} r="5" fill={color} stroke="var(--c-surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
        {act && (
          <div
            className="pointer-events-none absolute top-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 shadow-float"
            style={{ left: `${(x(act.date) / W) * 100}%`, transform: `translateX(${x(act.date) > W * 0.6 ? '-105%' : '5%'})` }}
          >
            <div className="text-[14px] font-bold tabular-nums text-ink">{format(act.value)}</div>
            <div className="text-[11.5px] text-ink-3">{fmtDay(act.date)}</div>
          </div>
        )}
      </div>
      <figcaption className="mt-1 flex items-center justify-between">
        <span className="text-[12px] text-ink-3">{smooth ? 'Dots: daily · grey line: 7-day average' : 'Tap the chart to read a value'}</span>
        <button type="button" onClick={() => setTable((t) => !t)} className={cx('tap inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-medium', table ? 'bg-surface-2 text-ink' : 'text-ink-3')} aria-expanded={table}>
          <Table2 size={15} /> Table
        </button>
      </figcaption>
      {table && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-2 text-ink-2">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Date</th>
                <th className="px-3 py-1.5 text-right font-medium">{title}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-3 py-1.5 text-ink-2">{fmtDay(p.date)}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-ink">{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / pow
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow
}

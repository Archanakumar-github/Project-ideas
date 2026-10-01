import type { ReactNode } from 'react'
import { cx } from '../../lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** CSS colour for the active label + glow. */
  tone?: string
  count?: number
  icon?: ReactNode
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Segmented control with a gliding indicator (transform-only animation, 180ms). */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const active = options[index]
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('relative grid rounded-2xl bg-canvas p-1 ring-1 ring-line', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-xl bg-card ring-1 ring-line transition-transform duration-200 ease-cozy"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${active?.tone ?? 'var(--color-amber)'} 30%, transparent), 0 6px 20px -8px ${active?.tone ?? 'var(--color-amber)'}`,
        }}
      />
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 font-medium transition-colors duration-150',
              size === 'md' ? 'min-h-10 text-[13px]' : 'min-h-9 text-xs',
              selected ? '' : 'text-ink-muted hover:text-ink',
            )}
            style={selected ? { color: o.tone ?? 'var(--color-amber)' } : undefined}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
            {o.count !== undefined && (
              <span className={cx('text-[11px] tabular-nums', selected ? 'opacity-75' : 'text-ink-faint')}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/utils'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  /** CSS colour used for the active state (defaults to amber). */
  tone?: string
  icon?: ReactNode
  count?: number
  dashed?: boolean
}

export function Chip({ active, tone, icon, count, dashed, className, children, style, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={rest.role === 'tab' ? undefined : active}
      className={cx(
        'press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap transition-[background-color,color,box-shadow] duration-150',
        active
          ? 'bg-[color-mix(in_srgb,var(--chip-tone)_16%,transparent)] text-[var(--chip-tone)] ring-1 ring-[color-mix(in_srgb,var(--chip-tone)_45%,transparent)] shadow-[0_0_18px_-6px_var(--chip-tone)]'
          : dashed
            ? 'border border-dashed border-line text-ink-muted hover:border-amber/50 hover:text-ink'
            : 'bg-card text-ink-muted ring-1 ring-line hover:text-ink',
        className,
      )}
      style={{ ['--chip-tone' as string]: tone ?? 'var(--color-amber)', ...style }}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={cx('text-xs tabular-nums', active ? 'opacity-80' : 'text-ink-faint')}>{count}</span>
      )}
    </button>
  )
}

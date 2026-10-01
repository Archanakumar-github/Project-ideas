import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cx, haptic } from '../../lib/utils'

/* ------------------------------------------------------------------ buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg' | 'sm'
  icon?: ReactNode
  block?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-[0_8px_20px_-10px_var(--c-accent)] active:brightness-95',
  secondary: 'bg-surface-2 text-ink active:bg-surface-3',
  soft: 'bg-accent-soft text-accent-fg active:brightness-95',
  ghost: 'text-ink-2 active:bg-surface-2',
  danger: 'bg-critical/12 text-critical active:bg-critical/20',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        haptic()
        onClick?.(e)
      }}
      className={cx(
        'tap inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-[transform,background-color,filter] duration-100 active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100',
        size === 'lg' ? 'min-h-14 px-6 text-[17px]' : size === 'sm' ? 'min-h-10 px-3.5 text-[14px]' : 'min-h-12 px-5 text-[15px]',
        block && 'w-full',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

export function IconButton({ label, className, children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        haptic()
        onClick?.(e)
      }}
      className={cx('tap grid h-12 w-12 shrink-0 place-items-center rounded-full text-ink-2 transition-colors active:bg-surface-2 disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ layout bits */

export function Card({ className, children, as: As = 'section', ...rest }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card', className)} {...rest}>
      {children}
    </As>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2 flex min-h-8 items-center justify-between gap-3', className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{children}</h2>
      {action}
    </div>
  )
}

export function Chip({ active, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'tap inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition-colors',
        active ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink-2 active:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warn'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
        tone === 'accent' && 'bg-accent-soft text-accent-fg',
        tone === 'neutral' && 'bg-surface-2 text-ink-2',
        tone === 'good' && 'bg-good/14 text-ink',
        tone === 'warn' && 'bg-warn/18 text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; className?: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cx('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => {
            haptic()
            onChange(o.value)
          }}
          className={cx(
            'tap min-h-10 flex-1 rounded-xl px-3 text-[14px] font-semibold transition-colors',
            o.value === value ? 'bg-surface text-ink shadow-card' : 'text-ink-3',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  return (
    <label className="tap flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-[52px] rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent-fg" />
        <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------ inputs */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; suffix?: ReactNode }>(function Input(
  { label, hint, suffix, className, id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `in-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined)
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ink-2">
          {label}
        </label>
      )}
      <div className="flex min-h-12 items-center rounded-2xl border border-line bg-surface-2 px-3.5 focus-within:border-accent-fg">
        <input ref={ref} id={inputId} className="min-w-0 flex-1 bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-3" {...rest} />
        {suffix && <span className="ml-2 shrink-0 text-[14px] text-ink-3">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  )
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(function TextArea({ label, className, id, ...rest }, ref) {
  const inputId = id ?? (label ? `ta-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined)
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ink-2">
          {label}
        </label>
      )}
      <textarea ref={ref} id={inputId} className="block w-full resize-none rounded-2xl border border-line bg-surface-2 px-3.5 py-3 leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-accent-fg" {...rest} />
    </div>
  )
})

/**
 * Big −/+ stepper around a numeric field. Typing is allowed; the value is committed on blur
 * or Enter so half-typed numbers never reach state.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimals = 1,
  unit,
  label,
  size = 'md',
}: {
  value: number | undefined
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  decimals?: number
  unit?: string
  label: string
  size?: 'md' | 'lg'
}) {
  const fmt = (n: number | undefined) => (n == null || !Number.isFinite(n) ? '' : String(Number(n.toFixed(decimals))))
  const [text, setText] = useState(fmt(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmt(value))
  }, [value])
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'))
    if (raw.trim() && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
    else setText(fmt(value))
  }
  const bump = (dir: 1 | -1) => {
    const base = value ?? min
    const next = Math.min(max, Math.max(min, Math.round((base + dir * step) / step) * step))
    onChange(Number(next.toFixed(decimals)))
    setText(fmt(next))
  }
  const btn = cx('tap grid shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink active:bg-surface-3', size === 'lg' ? 'h-14 w-14' : 'h-12 w-12')
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`Decrease ${label}`} onClick={() => (haptic(), bump(-1))}>
        <Minus size={20} />
      </button>
      <div className={cx('flex min-w-0 flex-1 items-baseline justify-center rounded-2xl border border-line bg-surface px-2', size === 'lg' ? 'h-14' : 'h-12')}>
        <input
          inputMode="decimal"
          aria-label={label}
          value={text}
          onFocus={(e) => {
            focused.current = true
            e.target.select()
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => {
            focused.current = false
            commit(e.target.value)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={cx('w-full min-w-0 self-center bg-transparent text-center font-semibold tabular-nums text-ink outline-none', size === 'lg' ? 'text-[26px]' : 'text-[19px]')}
        />
        {unit && <span className="shrink-0 self-center pr-2 text-[14px] text-ink-3">{unit}</span>}
      </div>
      <button type="button" className={btn} aria-label={`Increase ${label}`} onClick={() => (haptic(), bump(1))}>
        <Plus size={20} />
      </button>
    </div>
  )
}

/** 1–5 rating as five large tap targets. */
export function Rating({ value, onChange, label, lowLabel, highLabel }: { value?: number; onChange: (v: number | undefined) => void; label: string; lowLabel: string; highLabel: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-baseline justify-between text-[13px] font-medium text-ink-2">
        <span>{label}</span>
        <span className="text-[12px] text-ink-3">{value ? `${value}/5` : 'tap to rate'}</span>
      </legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => {
              haptic()
              onChange(value === n ? undefined : n)
            }}
            className={cx(
              'tap h-12 rounded-xl text-[15px] font-semibold transition-colors',
              value != null && n <= value ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-3 active:bg-surface-3',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-ink-3">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-fg">{icon}</div>
      <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Row({ icon, title, detail, right, onClick, className }: { icon?: ReactNode; title: ReactNode; detail?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string }) {
  const body = (
    <>
      {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        {detail && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{detail}</span>}
      </span>
      {right}
    </>
  )
  if (!onClick) return <div className={cx('flex min-h-14 items-center gap-3 py-2', className)}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => {
        haptic()
        onClick()
      }}
      className={cx('tap -mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 active:bg-surface-2', className)}
    >
      {body}
    </button>
  )
}

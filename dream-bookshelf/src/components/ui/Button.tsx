import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-amber text-ink-inverse shadow-glow-sm hover:bg-amber-glow active:shadow-glow disabled:bg-line disabled:text-ink-faint disabled:shadow-none',
  secondary: 'bg-card text-ink ring-1 ring-line hover:bg-card-strong disabled:text-ink-faint',
  soft: 'bg-amber/12 text-amber ring-1 ring-amber/25 hover:bg-amber/18 disabled:opacity-50',
  ghost: 'text-ink-muted hover:text-ink hover:bg-card disabled:opacity-40',
  danger: 'bg-danger/12 text-danger ring-1 ring-danger/30 hover:bg-danger/20 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'min-h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'min-h-12 px-5 text-base gap-2 rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'press inline-flex items-center justify-center font-medium select-none transition-colors duration-150 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'amber' | 'danger'
  size?: 'sm' | 'md'
}

/** 44x44 minimum hit area (Apple HIG), even when the visual is smaller. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'press inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40',
        size === 'md' ? 'size-11' : 'size-9',
        tone === 'default' && 'text-ink-muted hover:bg-card hover:text-ink',
        tone === 'amber' && 'text-amber hover:bg-amber/10',
        tone === 'danger' && 'text-danger hover:bg-danger/10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

import { useId, type ReactNode } from 'react'
import { cx } from '../../lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex min-h-12 cursor-pointer items-center gap-4 py-2', disabled && 'opacity-50')}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{description}</span>}
      </span>
      <span className="relative inline-flex h-[30px] w-[50px] shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-line transition-colors duration-200 peer-checked:bg-amber peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber" />
        <span className="absolute top-[3px] left-[3px] size-6 rounded-full bg-ink shadow transition-transform duration-200 ease-cozy peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

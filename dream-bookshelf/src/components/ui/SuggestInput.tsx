import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { normalize, cx } from '../../lib/utils'
import { Label } from './Field'

interface SuggestInputProps {
  label?: ReactNode
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  /** Called when the user picks a suggestion or presses Enter. */
  onCommit?: (value: string) => void
  /** Shows "Create “…”" when the typed value isn't an existing suggestion. */
  createLabel?: (value: string) => ReactNode
  autoFocus?: boolean
  className?: string
  max?: number
  onBlur?: () => void
}

/** Text input with an inline (non-floating, so it never clips inside sheets) suggestion list. */
export function SuggestInput({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  onCommit,
  createLabel,
  autoFocus,
  className,
  max = 5,
  onBlur,
}: SuggestInputProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const matches = useMemo(() => {
    const q = normalize(value)
    if (!q) return []
    return suggestions
      .filter((s) => normalize(s).includes(q) && s !== value)
      .sort((a, b) => Number(normalize(b).startsWith(q)) - Number(normalize(a).startsWith(q)))
      .slice(0, max)
  }, [value, suggestions, max])

  const exact = suggestions.some((s) => s.toLowerCase() === value.trim().toLowerCase())
  const showCreate = !!createLabel && value.trim().length > 0 && !exact
  const items = [...matches.map((m) => ({ value: m, create: false })), ...(showCreate ? [{ value: value.trim(), create: true }] : [])]
  const open = focused && items.length > 0

  const pick = (v: string) => {
    onChange(v)
    onCommit?.(v)
    setHighlight(0)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(items.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = open ? items[highlight] : undefined
      pick(item ? item.value : value.trim())
    }
  }

  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        id={id}
        className="field"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="done"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          onChange(e.target.value)
          setHighlight(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 150)
          onBlur?.()
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="animate-fade-in mt-1.5 overflow-hidden rounded-xl border border-line bg-card">
          {items.map((item, i) => (
            <li key={`${item.create}-${item.value}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item.value)}
                className={cx(
                  'flex min-h-11 w-full items-center gap-2 px-3.5 text-left text-[15px]',
                  i === highlight ? 'bg-card-strong text-ink' : 'text-ink-muted',
                )}
              >
                {item.create ? (
                  <>
                    <Plus size={16} className="text-amber" />
                    {createLabel!(item.value)}
                  </>
                ) : (
                  item.value
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

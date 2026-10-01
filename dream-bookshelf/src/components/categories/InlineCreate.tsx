import { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { cx } from '../../lib/utils'

/** A dashed "+ New …" chip that turns into a small inline text field. */
export function InlineCreate({
  label,
  placeholder,
  onCreate,
  className,
}: {
  label: string
  placeholder?: string
  onCreate: (name: string) => Promise<unknown> | unknown
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const name = value.trim()
    if (name) await onCreate(name)
    setValue('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className={cx(
          'press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm text-ink-muted hover:border-amber/50 hover:text-amber',
          className,
        )}
      >
        <Plus size={14} />
        {label}
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className={cx('animate-pop-in inline-flex min-h-9 items-center gap-1 rounded-full bg-canvas py-0.5 pr-0.5 pl-3 ring-1 ring-amber/50', className)}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value.trim() && setEditing(false)}
        placeholder={placeholder ?? label}
        enterKeyHint="done"
        className="w-36 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
      />
      <button type="submit" aria-label="Create" className="grid size-8 place-items-center rounded-full bg-amber text-ink-inverse">
        <Check size={14} strokeWidth={3} />
      </button>
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => {
          setValue('')
          setEditing(false)
        }}
        className="grid size-8 place-items-center rounded-full text-ink-faint"
      >
        <X size={14} />
      </button>
    </form>
  )
}

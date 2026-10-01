import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { SuggestInput } from './SuggestInput'
import { Label } from './Field'

interface TokenInputProps {
  label?: ReactNode
  values: string[]
  onChange: (values: string[]) => void
  suggestions: string[]
  placeholder?: string
}

/** Multi-value input (authors): chips + an auto-suggesting text field. Commas split values. */
export function TokenInput({ label, values, onChange, suggestions, placeholder }: TokenInputProps) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...values]
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    onChange(next)
    setDraft('')
  }

  return (
    <div>
      {label && <Label>{label}</Label>}
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-card py-1 pr-1 pl-3 text-sm text-ink ring-1 ring-line">
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-card-strong hover:text-ink"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <SuggestInput
        value={draft}
        onChange={(v) => (/[,;]$/.test(v) ? add(v) : setDraft(v))}
        onCommit={add}
        onBlur={() => add(draft)}
        suggestions={suggestions.filter((s) => !values.includes(s))}
        placeholder={values.length ? 'Add another…' : placeholder}
      />
    </div>
  )
}

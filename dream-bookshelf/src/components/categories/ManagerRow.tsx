import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, GripVertical, Pencil, Trash } from 'lucide-react'
import { cx } from '../../lib/utils'
import { IconButton } from '../ui/Button'
import type { DragHandleProps } from './SortableList'

interface ManagerRowProps {
  name: string
  count: number
  handle: DragHandleProps
  icon?: ReactNode
  expanded?: boolean
  onToggle?: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onViewBooks?: () => void
  compact?: boolean
}

/** One row in the category / shelf managers: drag handle, inline rename, count, delete. */
export function ManagerRow({ name, count, handle, icon, expanded, onToggle, onRename, onDelete, onViewBooks, compact }: ManagerRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(name), [name])
  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== name) onRename(draft.trim())
    else setDraft(name)
  }

  return (
    <div
      className={cx(
        'flex items-center gap-0.5 rounded-xl border bg-card pr-1 transition-shadow duration-200',
        compact ? 'min-h-12 border-line-soft' : 'min-h-14 border-line shadow-card',
        handle.isDragging && 'border-amber/50',
      )}
    >
      <button
        type="button"
        ref={handle.setActivatorNodeRef}
        {...handle.attributes}
        {...handle.listeners}
        aria-label={`Reorder ${name}`}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-ink-faint active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </button>
      {icon && <span className="mr-1 text-ink-faint">{icon}</span>}

      {editing ? (
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            commit()
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            enterKeyHint="done"
            aria-label="Name"
            className="w-full rounded-lg bg-canvas px-2 py-1.5 text-[16px] text-ink ring-1 ring-amber/50 outline-none"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={onToggle ?? (() => setEditing(true))}
          className={cx('flex min-h-11 min-w-0 flex-1 items-center gap-1.5 text-left text-ink', compact ? 'text-[15px]' : 'font-serif text-[17px]')}
        >
          <span className="truncate">{name}</span>
          {onToggle && (
            <ChevronRight size={16} className={cx('shrink-0 text-ink-faint transition-transform duration-200', expanded && 'rotate-90')} />
          )}
        </button>
      )}

      {!editing && (
        <>
          <button
            type="button"
            onClick={onViewBooks}
            disabled={!onViewBooks || count === 0}
            aria-label={`View ${count} books in ${name}`}
            className="min-h-9 min-w-9 rounded-full px-2 text-xs text-ink-muted tabular-nums ring-1 ring-line enabled:hover:text-amber disabled:opacity-60"
          >
            {count}
          </button>
          <IconButton label={`Rename ${name}`} size="md" onClick={() => setEditing(true)}>
            <Pencil size={16} />
          </IconButton>
          <IconButton label={`Delete ${name}`} tone="danger" onClick={onDelete}>
            <Trash size={16} />
          </IconButton>
        </>
      )}
    </div>
  )
}

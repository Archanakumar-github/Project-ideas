import { FolderTree, Bookmark, Trash, BookCheck } from 'lucide-react'
import { useUI } from '../../store/ui'
import { deleteBooksWithUndo } from '../../lib/actions'
import { pluralize } from '../../lib/utils'

function BarButton({ icon, label, onClick, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`press flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium disabled:opacity-35 ${danger ? 'text-danger' : 'text-ink'}`}
    >
      {icon}
      {label}
    </button>
  )
}

/** Replaces the bottom navigation while multi-selecting. */
export function BatchBar() {
  const selected = useUI((s) => s.selected)
  const openSheet = useUI((s) => s.openSheet)
  const stopSelecting = useUI((s) => s.stopSelecting)
  const confirm = useUI((s) => s.confirm)
  const none = selected.length === 0

  return (
    <nav
      aria-label="Batch actions"
      className="animate-rise-in fixed inset-x-0 bottom-0 z-40 border-t border-amber/25 bg-canvas-raised/95 px-2 pt-1.5 shadow-sheet backdrop-blur-xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
    >
      <div className="mx-auto flex max-w-xl">
        <BarButton icon={<BookCheck size={20} />} label="Status" disabled={none} onClick={() => openSheet({ kind: 'batch-status' })} />
        <BarButton icon={<FolderTree size={20} />} label="Move" disabled={none} onClick={() => openSheet({ kind: 'batch-category' })} />
        <BarButton icon={<Bookmark size={20} />} label="Shelves" disabled={none} onClick={() => openSheet({ kind: 'batch-shelves' })} />
        <BarButton
          icon={<Trash size={20} />}
          label="Delete"
          danger
          disabled={none}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${pluralize(selected.length, 'book')}?`,
              message: 'You can undo this right after.',
              confirmLabel: 'Delete',
              tone: 'danger',
            })
            if (!ok) return
            await deleteBooksWithUndo(selected)
            stopSelecting()
          }}
        />
      </div>
    </nav>
  )
}

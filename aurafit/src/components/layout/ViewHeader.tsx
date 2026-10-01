import type { ReactNode } from 'react'
import { CloudOff, Lock, ShieldCheck } from 'lucide-react'
import { useApp } from '../../store/app'
import { useOnline } from '../../hooks/useOnline'

/** Large-title header with privacy + connectivity status. */
export function ViewHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="safe-top sticky top-0 z-30 bg-canvas/95">
      <div className="mx-auto flex max-w-xl items-end gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          {subtitle && <p className="truncate text-[13px] font-medium text-ink-3">{subtitle}</p>}
          <h1 className="line-clamp-2 text-[27px] font-extrabold leading-[1.15] tracking-tight text-ink">{title}</h1>
        </div>
        <StatusPill />
        {right}
      </div>
    </header>
  )
}

function StatusPill() {
  const online = useOnline()
  const storage = useApp((s) => s.storage)
  const label = storage.error ? 'Not saved' : storage.encrypted ? (storage.mode === 'passcode' ? 'Locked with passcode' : 'Encrypted on device') : 'Saved, not encrypted'
  return (
    <span className="mb-1.5 flex items-center gap-1.5" title={label}>
      {!online && (
        <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2 text-[11.5px] font-semibold text-ink-2" role="status">
          <CloudOff size={13} /> Offline
        </span>
      )}
      <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink-2" aria-label={label} role="img">
        {storage.error ? <span className="h-2 w-2 rounded-full bg-critical" /> : storage.mode === 'passcode' ? <Lock size={13} /> : <ShieldCheck size={14} />}
      </span>
    </span>
  )
}

/** Scroll container used by each tab (keeps scroll position when switching tabs). */
export function ViewScroller({ children }: { children: ReactNode }) {
  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 96px)' }}>
      {children}
    </div>
  )
}

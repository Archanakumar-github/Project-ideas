import { useEffect, useRef } from 'react'
import { useUI } from '../../store/ui'
import { cx } from '../../lib/utils'
import { Button } from './primitives'

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 76px)' }} aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'pointer-events-auto flex w-full max-w-md animate-rise-in items-center gap-3 rounded-2xl px-4 py-2.5 shadow-float',
            t.tone === 'error' ? 'bg-critical text-white' : 'bg-ink text-canvas',
          )}
        >
          <span className="min-w-0 flex-1 py-1 text-[14px] font-medium">{t.message}</span>
          {t.actionLabel && (
            <button
              type="button"
              className="tap -my-1 min-h-10 shrink-0 rounded-xl px-3 text-[14px] font-bold text-[var(--c-accent-inverse)]"
              onClick={() => {
                t.onAction?.()
                dismiss(t.id)
              }}
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const req = useUI((s) => s.confirm)
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (req) okRef.current?.focus()
  }, [req])
  if (!req) return null
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-6">
      <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => req.resolve(false)} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-sm animate-pop-in rounded-3xl border border-line bg-surface p-5 shadow-float">
        <h2 id="confirm-title" className="text-[18px] font-bold text-ink">
          {req.title}
        </h2>
        {req.body && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{req.body}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button onClick={() => req.resolve(false)}>Cancel</Button>
          <Button ref={okRef} variant={req.danger ? 'danger' : 'primary'} onClick={() => req.resolve(true)}>
            {req.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </div>
    </div>
  )
}

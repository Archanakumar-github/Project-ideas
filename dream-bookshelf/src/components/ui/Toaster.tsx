import { useEffect } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useUI, type ToastSpec } from '../../store/ui'
import { cx } from '../../lib/utils'

function Toast({ toast }: { toast: ToastSpec }) {
  const dismiss = useUI((s) => s.dismissToast)
  useEffect(() => {
    const ms = toast.duration ?? (toast.action ? 6000 : 3200)
    if (ms === Infinity) return
    const t = setTimeout(() => dismiss(toast.id), ms)
    return () => clearTimeout(t)
  }, [toast, dismiss])

  const Icon = toast.tone === 'error' || toast.tone === 'warning' ? CircleAlert : toast.tone === 'success' ? CircleCheck : Info
  return (
    <div
      role="status"
      className="animate-rise-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-card-strong/95 py-2 pr-2 pl-4 text-[14px] text-ink shadow-glow-sm backdrop-blur-xl"
    >
      <Icon
        size={18}
        className={cx(
          'shrink-0',
          toast.tone === 'error' ? 'text-danger' : toast.tone === 'warning' ? 'text-terracotta' : toast.tone === 'success' ? 'text-sage' : 'text-amber',
        )}
      />
      <span className="min-w-0 flex-1 py-1.5 leading-snug">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="press min-h-10 shrink-0 rounded-xl px-3 font-semibold text-amber hover:bg-amber/10"
          onClick={() => {
            toast.action!.run()
            dismiss(toast.id)
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-faint hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4"
      // Sits above the FAB so a toast never hides the primary action.
      style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 84px + var(--kb-inset, 0px))' }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  )
}

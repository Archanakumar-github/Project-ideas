import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUI } from '../../store/ui'
import { useMountTransition } from '../../hooks/useMountTransition'
import { cx } from '../../lib/utils'
import { Button } from './Button'

/** Promise-based confirm (`await ui.confirm({...})`), styled as a centred alert. */
export function ConfirmDialog() {
  const spec = useUI((s) => s.confirmSpec)
  const settle = useUI((s) => s.settleConfirm)
  const { mounted, visible } = useMountTransition(!!spec, 180)
  const last = useRef(spec)
  if (spec) last.current = spec
  const shown = spec ?? last.current
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!spec) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && settle(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [spec, settle])

  useEffect(() => {
    if (visible) confirmRef.current?.focus({ preventScroll: true })
  }, [visible])

  if (!mounted || !shown) return null
  return createPortal(
    <div className="fixed inset-0 z-[95] grid place-items-center p-6">
      <div
        aria-hidden
        onClick={() => settle(false)}
        className={cx('absolute inset-0 bg-[#0a0807]/70 backdrop-blur-sm transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={shown.title}
        className={cx(
          'relative w-full max-w-sm rounded-3xl border border-line bg-canvas-raised p-6 shadow-sheet transition-[transform,opacity] duration-180 ease-cozy',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
      >
        <h2 className="font-serif text-xl text-ink">{shown.title}</h2>
        {shown.message && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{shown.message}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <Button onClick={() => settle(false)}>{shown.cancelLabel ?? 'Cancel'}</Button>
          <Button ref={confirmRef} variant={shown.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
            {shown.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '../../lib/utils'
import { IconButton } from './primitives'

/**
 * Bottom sheet: slides up from the thumb zone, sits above the iOS keyboard (--vvh), closes
 * with the ✕, a backdrop tap, Escape, or a downward swipe on the grab handle.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  full,
  headerRight,
  labelledBy,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  full?: boolean
  headerRight?: ReactNode
  labelledBy?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const autoId = useId()
  const titleId = labelledBy ?? `sheet-${autoId}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col justify-end" style={{ height: 'var(--vvh)' }}>
      <div className="absolute inset-0 animate-fade-in bg-black/45" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative mx-auto flex w-full max-w-xl animate-sheet-up flex-col rounded-t-[var(--radius-sheet)] border-t border-line bg-canvas shadow-float outline-none',
          full ? 'h-[calc(var(--vvh)-env(safe-area-inset-top)-12px)]' : 'max-h-[calc(var(--vvh)-env(safe-area-inset-top)-24px)]',
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, dy: 0 }
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drag.current || !panel.current) return
            drag.current.dy = Math.max(0, e.clientY - drag.current.y)
            panel.current.style.transform = `translateY(${drag.current.dy}px)`
          }}
          onPointerUp={() => {
            if (!drag.current || !panel.current) return
            const close = drag.current.dy > 90
            panel.current.style.transform = ''
            drag.current = null
            if (close) onClose()
          }}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="flex shrink-0 items-center gap-2 px-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[19px] font-bold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="truncate text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          {headerRight}
          <IconButton label="Close" onClick={onClose} className="-mr-2 bg-surface-2">
            <X size={20} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-canvas px-4 pt-3 [padding-bottom:max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="shrink-0 safe-bottom" />}
      </div>
    </div>
  )
}

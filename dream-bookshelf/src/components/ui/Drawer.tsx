import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMountTransition } from '../../hooks/useMountTransition'
import { cx } from '../../lib/utils'
import { IconButton } from './Button'
import { useUI } from '../../store/ui'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** auto: hug content; tall: at least 70% of the screen; full: as tall as allowed. */
  size?: 'auto' | 'tall' | 'full'
  /** Position in the sheet stack (0 = bottom-most). */
  depth?: number
  /** Only the top-most sheet reacts to Escape. */
  isTop?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Hide the title row (custom headers). */
  bare?: boolean
}

/**
 * Bottom sheet: slides up in 200ms, dismisses via backdrop tap, Escape, the close button or
 * a downward swipe on its header. Rides above the iOS keyboard via --kb-inset.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  size = 'auto',
  depth = 0,
  isTop = true,
  initialFocusRef,
  bare,
}: DrawerProps) {
  const { mounted, visible } = useMountTransition(open, 200)
  const panelRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ startY: number; dy: number } | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open || !isTop) return
    // A confirm dialog on top handles its own Escape.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useUI.getState().confirmSpec && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isTop])

  useEffect(() => {
    if (!visible) return
    const el = initialFocusRef?.current
    if (el) el.focus({ preventScroll: true })
    else if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true })
  }, [visible, initialFocusRef])

  if (!mounted) return null

  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, dy: 0 }
  }
  const onHandleTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current
    const panel = panelRef.current
    if (!d || !panel) return
    d.dy = Math.max(0, e.touches[0].clientY - d.startY)
    panel.style.transition = 'none'
    panel.style.transform = `translate3d(0, ${d.dy}px, 0)`
  }
  const onHandleTouchEnd = () => {
    const d = dragRef.current
    const panel = panelRef.current
    dragRef.current = null
    if (!d || !panel) return
    panel.style.transition = ''
    panel.style.transform = ''
    if (d.dy > 90) onClose()
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 60 + depth * 2 }}>
      <div
        aria-hidden
        onClick={onClose}
        className={cx(
          'absolute inset-0 bg-[#0a0807]/60 backdrop-blur-[2px] transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cx(
          'absolute inset-x-0 mx-auto flex w-full max-w-xl flex-col rounded-t-sheet border-t border-x border-line bg-canvas-raised shadow-sheet outline-none',
          'transition-transform duration-200 ease-cozy will-change-transform',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{
          bottom: 'var(--kb-inset, 0px)',
          maxHeight: 'calc(var(--vvh, 100dvh) - env(safe-area-inset-top) - 10px)',
          height: size === 'full' ? 'calc(var(--vvh, 100dvh) - env(safe-area-inset-top) - 10px)' : undefined,
          minHeight: size === 'tall' ? 'min(70dvh, calc(var(--vvh, 100dvh) - env(safe-area-inset-top) - 10px))' : undefined,
        }}
      >
        <header
          className="shrink-0 touch-none select-none"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" />
          {!bare && (
            <div className="flex items-start gap-2 px-5 pt-2 pb-2">
              <div className="min-w-0 flex-1 pt-1.5">
                {title && <h2 className="font-serif text-[22px] leading-tight text-ink">{title}</h2>}
                {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
              </div>
              {headerRight}
              <IconButton label="Close" onClick={onClose} className="-mr-2">
                <X size={20} />
              </IconButton>
            </div>
          )}
        </header>
        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
            footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+20px)]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line-soft bg-canvas-raised/95 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {footer}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

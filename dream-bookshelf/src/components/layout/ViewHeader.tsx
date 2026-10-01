import type { ReactNode } from 'react'
import { WifiOff } from 'lucide-react'
import { useOnline } from '../../hooks/useOnline'

/** Sticky, translucent view header that clears the notch / Dynamic Island. */
export function ViewHeader({ title, subtitle, actions, children }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const online = useOnline()
  return (
    <header
      className="sticky top-0 z-20 bg-gradient-to-b from-canvas via-canvas/97 to-canvas/90 px-4 pb-3 backdrop-blur-xl"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      <div className="flex min-h-12 items-end gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[30px] leading-tight font-medium text-ink">{title}</h1>
          {(subtitle || !online) && (
            <p className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
              {!online && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta/12 px-2 py-0.5 text-[11px] font-medium text-terracotta ring-1 ring-terracotta/25">
                  <WifiOff size={11} /> Offline
                </span>
              )}
              <span className="truncate">{subtitle}</span>
            </p>
          )}
        </div>
        {actions && <div className="-mr-2 flex items-center">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  )
}

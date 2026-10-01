import { forwardRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { cx } from '../../lib/utils'

/** Pull-to-refresh indicator; usePullToRefresh drives its transform directly. */
export const PullIndicator = forwardRef<HTMLDivElement, { refreshing: boolean }>(function PullIndicator({ refreshing }, ref) {
  return (
    <div className="pointer-events-none relative z-10 h-0">
      <div ref={ref} className="absolute inset-x-0 top-0 flex justify-center opacity-0" style={{ transform: 'translate3d(0,-48px,0)' }}>
        <span className="grid size-10 place-items-center rounded-full bg-card-strong text-amber shadow-glow-sm ring-1 ring-line">
          <span data-ptr-icon className={cx('block', refreshing && 'animate-spin')}>
            <RefreshCw size={18} />
          </span>
        </span>
      </div>
    </div>
  )
})

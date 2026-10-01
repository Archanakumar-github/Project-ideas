import { BookCheck, BookOpen, ShoppingBag, type LucideProps } from 'lucide-react'
import type { BookStatus } from '../../db/types'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx } from '../../lib/utils'

export function StatusIcon({ status, ...props }: { status: BookStatus } & LucideProps) {
  const Icon = status === 'want-to-read' ? BookOpen : status === 'want-to-buy' ? ShoppingBag : BookCheck
  return <Icon {...props} />
}

export function StatusPill({ status, className, short }: { status: BookStatus; className?: string; short?: boolean }) {
  const meta = BOOK_STATUS_META[status]
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.pill, className)}>
      <StatusIcon status={status} size={12} aria-hidden />
      {short ? meta.short : meta.label}
    </span>
  )
}

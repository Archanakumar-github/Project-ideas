import { LoaderCircle } from 'lucide-react'
import { cx } from '../../lib/utils'

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <LoaderCircle size={size} className={cx('animate-spin text-amber', className)} aria-hidden />
}

import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  children,
  actions,
}: {
  icon: ReactNode
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="animate-rise-in mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-5 grid size-20 place-items-center rounded-full bg-card text-amber ring-1 ring-line">
        <span aria-hidden className="absolute inset-0 rounded-full bg-amber/10 blur-xl" />
        <span className="relative">{icon}</span>
      </div>
      <h2 className="font-serif text-2xl text-ink">{title}</h2>
      {children && <div className="mt-2 text-[15px] leading-relaxed text-ink-muted">{children}</div>}
      {actions && <div className="mt-6 flex w-full flex-col gap-2.5">{actions}</div>}
    </div>
  )
}

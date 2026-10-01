import { useEffect, useRef, useState } from 'react'
import { Timer, X } from 'lucide-react'
import { chime, useRest } from './restTimer'
import { useApp } from '../../store/app'
import { fmtDuration } from '../../lib/dates'

/** Floating rest countdown above the tab bar: −15 / +15 / skip, chime at zero. */
export function RestTimerBar() {
  const { endAt, total, label, add, stop } = useRest()
  const sound = useApp((s) => s.settings.sound)
  const [now, setNow] = useState(Date.now())
  const fired = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!endAt) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [endAt])
  useEffect(() => {
    if (!endAt || now < endAt || fired.current === endAt) return
    fired.current = endAt
    if (sound) chime()
    const t = setTimeout(stop, 2500)
    return () => clearTimeout(t)
  }, [now, endAt, sound, stop])
  if (!endAt) return null
  const left = Math.max(0, endAt - now)
  const done = left === 0
  const pct = total ? Math.min(100, (1 - left / (total * 1000)) * 100) : 100
  return (
    <div className="fixed left-0 right-[76px] z-40 flex justify-center pl-4 sm:right-0 sm:px-4" style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 14px)' }}>
      <div role="timer" aria-live="polite" aria-label={done ? 'Rest complete' : `Rest ${Math.ceil(left / 1000)} seconds left`} className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
        <div className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-200" style={{ width: `${pct}%` }} aria-hidden />
        <div className="relative flex items-center gap-1.5 py-1.5 pl-3 pr-1">
          <Timer size={18} className="shrink-0 text-accent-fg" />
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-extrabold tabular-nums leading-tight text-ink">{done ? 'Go!' : fmtDuration(left)}</div>
            {label && <div className="truncate text-[12px] text-ink-3">Next: {label}</div>}
          </div>
          <button type="button" onClick={() => add(-15)} className="tap h-11 rounded-xl bg-surface-2 px-2.5 text-[14px] font-bold text-ink">
            −15
          </button>
          <button type="button" onClick={() => add(15)} className="tap h-11 rounded-xl bg-surface-2 px-2.5 text-[14px] font-bold text-ink">
            +15
          </button>
          <button type="button" aria-label="Skip rest" onClick={stop} className="tap grid h-11 w-11 place-items-center rounded-xl text-ink-2">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../ui/primitives'

/** Registers the service worker and offers a reload when a new version is ready. */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<null | (() => void)>(null)
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let cancelled = false
    void import('workbox-window').then(({ Workbox }) => {
      if (cancelled) return
      const wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      wb.addEventListener('waiting', () => {
        setUpdate(() => () => {
          wb.addEventListener('controlling', () => location.reload())
          wb.messageSkipWaiting()
        })
      })
      void wb.register()
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!update) return null
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 safe-top">
      <div className="mt-2 flex w-full max-w-md animate-rise-in items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-float">
        <RefreshCw size={18} className="shrink-0 text-accent-fg" />
        <p className="min-w-0 flex-1 text-[14px] text-ink">A new version of AuraFit is ready.</p>
        <Button size="sm" variant="primary" onClick={update}>
          Reload
        </Button>
      </div>
    </div>
  )
}

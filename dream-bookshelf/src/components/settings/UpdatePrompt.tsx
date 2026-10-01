import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ui } from '../../store/ui'

/** Registers the service worker; offers a gentle "Reload" when a new version is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for updates hourly while the app stays open (iOS keeps PWAs alive for days).
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    ui.toast({ message: 'Ready to work offline', tone: 'success' })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    if (!needRefresh) return
    ui.toast({
      message: 'A fresh edition of Bibliotheca is ready.',
      duration: Infinity,
      action: { label: 'Reload', run: () => void updateServiceWorker(true) },
    })
  }, [needRefresh, updateServiceWorker])

  return null
}

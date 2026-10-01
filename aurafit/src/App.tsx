import { Activity, Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DatabaseZap, RotateCcw } from 'lucide-react'
import { boot, useApp } from './store/app'
import { TABS, useUI, type Tab } from './store/ui'
import { useTheme } from './hooks/useTheme'
import { useVisualViewport } from './hooks/useVisualViewport'
import { cx } from './lib/utils'
import { today } from './lib/dates'
import { BottomNav } from './components/layout/BottomNav'
import { CoachFab } from './components/layout/CoachFab'
import { SheetHost } from './components/layout/SheetHost'
import { UpdatePrompt } from './components/layout/UpdatePrompt'
import { ConfirmDialog, Toaster } from './components/ui/Feedback'
import { Button } from './components/ui/primitives'
import { RestTimerBar } from './components/train/RestTimerBar'
import { TodayView } from './views/TodayView'
import { DietView } from './views/DietView'
import { TrainView } from './views/TrainView'
import { ProgressView } from './views/ProgressView'
import { JournalView } from './views/JournalView'
import { SetupView } from './views/SetupView'
import { LockView } from './views/LockView'

/** Home-screen shortcuts: ?tab=diet&action=water etc. */
function readShortcut(): { tab?: Tab; action?: string } {
  const params = new URLSearchParams(location.search)
  const tab = params.get('tab') as Tab | null
  const action = params.get('action') ?? undefined
  if (params.size) history.replaceState(null, '', location.pathname)
  return { tab: tab && (TABS as readonly string[]).includes(tab) ? tab : undefined, action }
}

function Shell() {
  const tab = useUI((s) => s.tab)
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]))
  const [shortcut] = useState(readShortcut)
  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab))), [tab])
  useEffect(() => {
    if (shortcut.tab) useUI.getState().setTab(shortcut.tab)
    if (shortcut.action === 'new') useUI.getState().openSheet({ kind: 'journalEntry', date: today() })
  }, [shortcut])
  // Mount the other tabs in the background once the first screen is up, so every later
  // tab switch is just a visibility flip.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 600))
    let i = 0
    const next = () => {
      const t = TABS[i++]
      if (!t) return
      setVisited((v) => (v.has(t) ? v : new Set(v).add(t)))
      idle(next)
    }
    const timer = window.setTimeout(() => idle(next), 800)
    return () => window.clearTimeout(timer)
  }, [])

  // Stable elements: switching tabs re-renders the shell, not every view.
  const views = useMemo(
    () => ({
      today: <TodayView />,
      diet: <DietView />,
      train: <TrainView autoStart={shortcut.action === 'start'} />,
      progress: <ProgressView />,
      journal: <JournalView />,
    }),
    [shortcut],
  )

  return (
    <div className="relative h-full overflow-hidden">
      {TABS.map((t) => {
        if (!visited.has(t)) return null
        const active = t === tab
        // Tabs stay mounted after first visit: instant switching, state kept.
        return (
          // <Activity hidden> keeps state and DOM but defers hidden tabs' re-renders to idle time.
          <Activity key={t} mode={active ? 'visible' : 'hidden'}>
            <section data-view={t} className={cx('absolute inset-0', active && 'animate-fade-in')}>
              {views[t]}
            </section>
          </Activity>
        )
      })}
      <RestTimerBar />
      <CoachFab />
      <BottomNav />
      <SheetHost />
    </div>
  )
}

export function App() {
  const phase = useApp((s) => s.phase)
  const bootError = useApp((s) => s.bootError)
  useTheme()
  useVisualViewport()
  useEffect(() => {
    void boot()
  }, [])

  return (
    <ErrorBoundary>
      {phase === 'loading' && <Splash />}
      {phase === 'error' && (
        <FullScreenMessage
          title="Storage is unavailable"
          body={`AuraFit keeps your data on this device, but the browser refused to open local storage (${bootError ?? 'unknown error'}). Private Browsing or a full disk are the usual causes.`}
        />
      )}
      {phase === 'locked' && <LockView />}
      {phase === 'setup' && <SetupView />}
      {phase === 'ready' && <Shell />}
      <Toaster />
      <ConfirmDialog />
      <UpdatePrompt />
    </ErrorBoundary>
  )
}

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="AuraFit" className="h-16 w-16 animate-pulse rounded-[18px]" />
    </div>
  )
}

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <DatabaseZap size={36} className="mx-auto text-accent-fg" />
        <h1 className="mt-4 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
        <Button className="mt-6" variant="primary" icon={<RotateCcw size={16} />} onClick={() => location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return <FullScreenMessage title="Something went wrong" body={`Your data is safe on this device. Reloading usually fixes it. (${this.state.error.message})`} />
    }
    return this.props.children
  }
}

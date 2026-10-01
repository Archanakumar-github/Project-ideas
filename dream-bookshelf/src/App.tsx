import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { DatabaseZap, RotateCcw } from 'lucide-react'
import { db } from './db/db'
import { readLocalSnapshot, startAutoSnapshot } from './db/backup'
import { LibraryProvider, useLibrary } from './hooks/useLibrary'
import { useVisualViewport } from './hooks/useVisualViewport'
import { startSyncEngine } from './sync/queue'
import { TABS, useUI, type Tab } from './store/ui'
import { cx } from './lib/utils'
import { BottomNav } from './components/layout/BottomNav'
import { Fab } from './components/layout/Fab'
import { SheetHost } from './components/layout/SheetHost'
import { BatchBar } from './components/batch/BatchBar'
import { Toaster } from './components/ui/Toaster'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { Button } from './components/ui/Button'
import { UpdatePrompt } from './components/settings/UpdatePrompt'
import { ShelvesView } from './views/ShelvesView'
import { SeriesView } from './views/SeriesView'
import { SearchView } from './views/SearchView'

// Less-visited tabs (and the drag-and-drop library) load on demand; the service worker still
// precaches every chunk, so they open instantly offline too.
const CategoriesView = lazy(() => import('./views/CategoriesView').then((m) => ({ default: m.CategoriesView })))
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })))

function renderView(tab: Tab, active: boolean) {
  switch (tab) {
    case 'shelves':
      return <ShelvesView active={active} />
    case 'series':
      return <SeriesView active={active} />
    case 'search':
      return <SearchView active={active} />
    case 'categories':
      return <CategoriesView active={active} />
    case 'settings':
      return <SettingsView />
  }
}

function AppShell() {
  const lib = useLibrary()
  const tab = useUI((s) => s.tab)
  const selecting = useUI((s) => s.selecting)
  const stopSelecting = useUI((s) => s.stopSelecting)
  const openSheet = useUI((s) => s.openSheet)
  // Views mount on first visit and then stay mounted, so scroll position and state survive tab switches.
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]))

  useEffect(() => setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab))), [tab])
  useEffect(() => {
    if (selecting && tab !== 'shelves' && tab !== 'search') stopSelecting()
  }, [tab, selecting, stopSelecting])

  useEffect(() => startSyncEngine(), [])
  useEffect(() => startAutoSnapshot(), [])

  // Home-screen shortcut: ?action=add
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('action') === 'add') openSheet({ kind: 'add' })
    if (params.has('action') || params.has('tab')) history.replaceState(null, '', location.pathname)
  }, [openSheet])

  // Empty database but a safety snapshot exists -> offer to restore (e.g. after storage eviction).
  useEffect(() => {
    if (!lib.ready || lib.books.length + lib.series.length > 0) return
    const snap = readLocalSnapshot()
    if (snap && snap.backup.books.length + snap.backup.series.length > 0) openSheet({ kind: 'restore-snapshot' })
    // Only check once, right after the library first loads.
  }, [lib.ready])

  return (
    <div className="relative h-full overflow-hidden">
      {TABS.map((t) => {
        const active = t === tab
        if (!visited.has(t)) return null
        return (
          <section
            key={t}
            data-view={t}
            inert={!active}
            aria-hidden={!active}
            className={cx('absolute inset-0', active && 'animate-fade-in')}
            style={{ visibility: active ? 'visible' : 'hidden', contentVisibility: active ? 'visible' : 'hidden' }}
          >
            <Suspense fallback={null}>{renderView(t, active)}</Suspense>
          </section>
        )
      })}
      {selecting ? <BatchBar /> : <BottomNav />}
      <Fab />
      <SheetHost />
      <ConfirmDialog />
      <Toaster />
      <UpdatePrompt />
    </div>
  )
}

/** Opens IndexedDB up front so storage problems (private mode, quota) get a clear message. */
function DatabaseGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'opening' | 'ready' | 'error'>('opening')
  useEffect(() => {
    db.open()
      .then(() => setState('ready'))
      .catch(() => setState('error'))
  }, [])
  if (state === 'opening') return null
  if (state === 'error') {
    return (
      <FullScreenMessage
        title="Storage is unavailable"
        body="Bibliotheca keeps your library on this device, but the browser refused to open local storage. Private Browsing or a full disk are the usual causes."
      />
    )
  }
  return <>{children}</>
}

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <DatabaseZap size={36} className="mx-auto text-amber" />
        <h1 className="mt-4 font-serif text-2xl text-ink">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>
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
      return (
        <FullScreenMessage
          title="Something went sideways"
          body="Your books are safe on this device. Reloading usually fixes it."
        />
      )
    }
    return this.props.children
  }
}

export function App() {
  useVisualViewport()
  return (
    <ErrorBoundary>
      <DatabaseGate>
        <LibraryProvider>
          <AppShell />
        </LibraryProvider>
      </DatabaseGate>
    </ErrorBoundary>
  )
}

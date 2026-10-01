import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Download,
  Eraser,
  HardDrive,
  KeyRound,
  LifeBuoy,
  RefreshCw,
  Share,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react'
import { db } from '../db/db'
import {
  BackupError,
  backupFileName,
  buildBackup,
  importBackup,
  parseBackup,
  readLocalSnapshot,
  snapshotStatus,
  type ParsedBackup,
} from '../db/backup'
import { eraseEverything, requestPersistentStorage } from '../db/repo'
import { useLibrary } from '../hooks/useLibrary'
import { useOnline } from '../hooks/useOnline'
import { wishlistTotals } from '../lib/library'
import { cx, formatPrice, isStandalone, pluralize, relativeTime } from '../lib/utils'
import { clearParkedTasks, onSyncState, PARKED, processQueue, retryParkedTasks } from '../sync/queue'
import { useSettings } from '../store/settings'
import { ui, useUI } from '../store/ui'
import { ViewHeader } from '../components/layout/ViewHeader'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Label, Section } from '../components/ui/Field'
import { Switch } from '../components/ui/Switch'
import { Spinner } from '../components/ui/Spinner'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'CHF', 'SEK', 'NOK', 'DKK', 'SGD', 'BRL', 'MXN', 'ZAR']

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-card border border-line bg-card px-4 py-2 shadow-card', className)}>{children}</div>
}

function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-canvas-raised px-3 py-3 ring-1 ring-line-soft">
      <p className="font-serif text-2xl leading-none" style={{ color: tone ?? 'var(--color-ink)' }}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] tracking-wide text-ink-muted uppercase">{label}</p>
    </div>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(1)} GB`
}

async function shareOrDownload(text: string, filename: string) {
  const file = new File([text], filename, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Bibliotheca backup' })
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

export function SettingsView() {
  const lib = useLibrary()
  const online = useOnline()
  const settings = useSettings()
  const openSheet = useUI((s) => s.openSheet)
  const [includeCovers, setIncludeCovers] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [pendingImport, setPendingImport] = useState<ParsedBackup | null>(null)
  const [importing, setImporting] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const [syncing, setSyncing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const queue = useLiveQuery(async () => {
    const all = await db.syncQueue.toArray()
    return { pending: all.filter((t) => t.nextAttemptAt < PARKED).length, parked: all.filter((t) => t.nextAttemptAt >= PARKED) }
  }, [])
  const coverCount = useLiveQuery(() => db.covers.count(), [])

  useEffect(() => onSyncState((s) => setSyncing(s.running)), [])

  const refreshStorage = async () => {
    if (!navigator.storage) return
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate?.().catch(() => ({}) as StorageEstimate),
      navigator.storage.persisted?.().catch(() => false),
    ])
    setStorage({ usage: estimate?.usage, quota: estimate?.quota, persisted })
  }
  useEffect(() => {
    void refreshStorage()
  }, [lib.books.length, coverCount])

  const wishlist = wishlistTotals(lib.books)
  const snapshot = readLocalSnapshot()

  const exportNow = async () => {
    setExporting(true)
    try {
      const backup = await buildBackup({ includeCovers })
      const done = await shareOrDownload(JSON.stringify(backup), backupFileName())
      if (done) {
        settings.set({ lastExportAt: Date.now() })
        ui.toast({ message: 'Backup ready', tone: 'success' })
      }
    } catch {
      ui.toast({ message: 'Export failed. Try again without covers.', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const onFile = async (file: File) => {
    try {
      setPendingImport(parseBackup(await file.text()))
    } catch (err) {
      ui.toast({ message: err instanceof BackupError ? err.message : 'Could not read that file.', tone: 'error' })
    }
  }

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) return
    if (mode === 'replace') {
      const ok = await ui.confirm({
        title: 'Replace your whole library?',
        message: 'Everything currently on this device is removed and replaced by the backup.',
        confirmLabel: 'Replace',
        tone: 'danger',
      })
      if (!ok) return
    }
    setImporting(true)
    try {
      const summary = await importBackup(pendingImport.backup, mode)
      ui.toast({
        message: `Imported: ${summary.added} added, ${summary.updated} updated${summary.unchanged ? `, ${summary.unchanged} unchanged` : ''}`,
        tone: 'success',
      })
      setPendingImport(null)
    } catch {
      ui.toast({ message: 'Import failed — your library was not changed.', tone: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-y-contain">
      <ViewHeader title="Settings" subtitle="Private by design — everything lives on this device" />
      <div className="space-y-8 px-4" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 32px)' }}>
        <Section title="Your library">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={lib.books.length} label="Books" />
            <Stat value={lib.series.length} label="Series" />
            <Stat value={lib.statusCounts.owned} label="Owned" tone="var(--color-amber)" />
            <Stat value={lib.statusCounts['want-to-read']} label="To read" tone="var(--color-sage)" />
            <Stat value={lib.statusCounts['want-to-buy']} label="To buy" tone="var(--color-terracotta)" />
            <Stat
              value={wishlist[0] ? formatPrice(wishlist[0].amount, wishlist[0].currency) : '—'}
              label="Wishlist"
              tone="var(--color-terracotta)"
            />
          </div>
        </Section>

        <Section title="Online lookups">
          <Card>
            <Switch
              checked={settings.onlineLookups}
              onChange={(v) => settings.set({ onlineLookups: v })}
              label="Fetch book details online"
              description="Only your search text is sent to Open Library (and Google Books as a fallback). Your library itself never leaves this device."
            />
            <div className="h-px bg-line-soft" />
            <Switch
              checked={settings.googleFallback}
              disabled={!settings.onlineLookups}
              onChange={(v) => settings.set({ googleFallback: v })}
              label="Google Books fallback"
              description="Used when Open Library has no match, a cover or a description."
            />
            <div className="h-px bg-line-soft" />
            <Switch
              checked={settings.cacheCovers}
              disabled={!settings.onlineLookups}
              onChange={(v) => settings.set({ cacheCovers: v })}
              label="Save covers for offline"
              description={`Stores a compressed copy of each cover on this device${coverCount ? ` (${coverCount} saved)` : ''}.`}
            />
            {settings.onlineLookups && settings.googleFallback && (
              <div className="pt-2 pb-3">
                <Label hint={<button type="button" className="min-h-8 text-amber" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</button>}>
                  Google Books API key (optional)
                </Label>
                <div className="relative">
                  <KeyRound size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={settings.googleApiKey}
                    onChange={(e) => settings.set({ googleApiKey: e.target.value.trim() })}
                    placeholder="AIza…"
                    className="field pl-10"
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                  The anonymous quota is shared and can run out. A free key from Google Cloud Console keeps lookups reliable. It's
                  stored only on this device and never included in backups.
                </p>
              </div>
            )}
          </Card>
        </Section>

        <Section title="Background updates">
          <Card className="py-4">
            <div className="flex items-center gap-3">
              <span className={cx('grid size-10 place-items-center rounded-full ring-1', online ? 'bg-sage/12 text-sage ring-sage/25' : 'bg-terracotta/12 text-terracotta ring-terracotta/25')}>
                {syncing ? <Spinner size={18} /> : <RefreshCw size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-ink">
                  {queue?.pending ? `${pluralize(queue.pending, 'update')} queued` : 'All caught up'}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {online ? 'Missing details and covers are fetched automatically.' : 'Offline — queued work runs when you reconnect.'}
                </p>
              </div>
              <Button size="sm" disabled={!online || syncing || !queue?.pending} onClick={() => void processQueue({ force: true })}>
                Run now
              </Button>
            </div>
            {!!queue?.parked.length && (
              <div className="mt-4 rounded-xl bg-terracotta/8 p-3 text-[13px] text-ink-muted ring-1 ring-terracotta/20">
                <p className="text-terracotta">{pluralize(queue.parked.length, 'task')} gave up after several tries.</p>
                {queue.parked[0].lastError && <p className="mt-1 text-xs text-ink-faint">Last error: {queue.parked[0].lastError}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="soft" disabled={!online} onClick={() => void retryParkedTasks()}>
                    Retry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void clearParkedTasks()}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </Section>

        <Section title="Backup & restore">
          <Card className="space-y-4 py-4">
            <p className="text-[14px] leading-relaxed text-ink-muted">
              Export a JSON file you control — save it to Files, iCloud Drive or AirDrop it to another device.
              {settings.lastExportAt ? ` Last export ${relativeTime(settings.lastExportAt)}.` : ' You haven’t exported yet.'}
            </p>
            <Switch checked={includeCovers} onChange={setIncludeCovers} label="Include cover images" description="Larger file, but fully self-contained." />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" disabled={exporting} icon={exporting ? <Spinner size={16} className="text-ink-inverse" /> : <Share size={16} />} onClick={() => void exportNow()}>
                Export
              </Button>
              <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                Import
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void onFile(f)
              }}
            />
            <div className="flex items-start gap-3 rounded-xl bg-canvas-raised p-3 ring-1 ring-line-soft">
              <LifeBuoy size={18} className="mt-0.5 shrink-0 text-amber" />
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-muted">
                <p className="text-ink">Automatic safety copy</p>
                {snapshotStatus.lastError ? (
                  <p className="text-terracotta">{snapshotStatus.lastError}</p>
                ) : snapshot ? (
                  <p>
                    A copy of your library (without uploaded covers) is mirrored to local storage — saved {relativeTime(snapshot.savedAt)}.
                  </p>
                ) : (
                  <p>Created automatically once you add your first book.</p>
                )}
              </div>
              {snapshot && lib.books.length === 0 && snapshot.backup.books.length > 0 && (
                <Button size="sm" variant="soft" onClick={() => openSheet({ kind: 'restore-snapshot' })}>
                  Restore
                </Button>
              )}
            </div>
          </Card>
        </Section>

        <Section title="Storage">
          <Card className="py-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-amber/12 text-amber ring-1 ring-amber/25">
                <HardDrive size={18} />
              </span>
              <div className="min-w-0 flex-1 text-[13px] text-ink-muted">
                <p className="text-[15px] text-ink">
                  {storage.usage !== undefined ? `${formatBytes(storage.usage)} used` : 'Stored on this device'}
                </p>
                <p>
                  {storage.persisted
                    ? 'Protected: the browser won’t clear it to free space.'
                    : 'Not yet protected from automatic clean-up.'}
                </p>
              </div>
              {!storage.persisted && (
                <Button
                  size="sm"
                  variant="soft"
                  icon={<ShieldCheck size={15} />}
                  onClick={async () => {
                    const ok = await requestPersistentStorage()
                    await refreshStorage()
                    ui.toast(
                      ok
                        ? { message: 'Storage protected', tone: 'success' }
                        : { message: 'Not granted yet — installing to the Home Screen and regular use usually helps.', tone: 'warning' },
                    )
                  }}
                >
                  Protect
                </Button>
              )}
            </div>
          </Card>
        </Section>

        <Section title="Preferences">
          <Card>
            <div className="flex min-h-12 items-center justify-between gap-4 py-2">
              <div>
                <p className="text-[15px] text-ink">Default currency</p>
                <p className="text-[13px] text-ink-muted">For prices you type in.</p>
              </div>
              <select
                aria-label="Default currency"
                value={settings.currency}
                onChange={(e) => settings.set({ currency: e.target.value })}
                className="field w-28 appearance-none"
              >
                {Array.from(new Set([settings.currency, ...CURRENCIES])).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="h-px bg-line-soft" />
            <Switch
              checked={settings.showSeriesVolumes}
              onChange={(v) => settings.set({ showSeriesVolumes: v })}
              label="Show series volumes on shelves"
              description="Turn off to keep sagas in the Series tab only."
            />
          </Card>
        </Section>

        {!isStandalone() && (
          <Section title="Install on iPhone">
            <Card className="flex items-start gap-3 py-4 text-[14px] leading-relaxed text-ink-muted">
              <Smartphone size={20} className="mt-0.5 shrink-0 text-amber" />
              <p>
                In Safari, tap <Share size={14} className="inline text-ink" aria-label="Share" /> Share, then <span className="text-ink">“Add to Home Screen”</span>.
                Bibliotheca then opens full-screen, works offline, and its storage is kept safe from Safari’s clean-up.
              </p>
            </Card>
          </Section>
        )}

        <Section title="Danger zone">
          <Card className="flex items-center gap-3 border-danger/30 py-4">
            <div className="min-w-0 flex-1 text-[13px] text-ink-muted">
              <p className="text-[15px] text-ink">Erase everything</p>
              <p>Deletes all books, series and covers from this device.</p>
            </div>
            <Button
              size="sm"
              variant="danger"
              icon={<Eraser size={15} />}
              onClick={async () => {
                const ok = await ui.confirm({
                  title: 'Erase your whole library?',
                  message: 'This can’t be undone. Export a backup first if you might want it back.',
                  confirmLabel: 'Erase',
                  tone: 'danger',
                })
                if (!ok) return
                await eraseEverything()
                ui.toast({ message: 'Library erased' })
              }}
            >
              Erase
            </Button>
          </Card>
        </Section>

        <footer className="pb-4 text-center text-xs leading-relaxed text-ink-faint">
          <p className="font-serif text-sm text-ink-muted">Bibliotheca {__APP_VERSION__}</p>
          <p className="mt-1">
            Book data from <a className="underline underline-offset-2" href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a> and{' '}
            <a className="underline underline-offset-2" href="https://books.google.com" target="_blank" rel="noreferrer">Google Books</a>. No accounts, no tracking.
          </p>
        </footer>
      </div>

      <Drawer open={!!pendingImport} onClose={() => !importing && setPendingImport(null)} title="Import backup">
        {pendingImport && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 rounded-card border border-line bg-card p-4">
              <Download size={20} className="text-amber" />
              <div className="text-[14px] text-ink-muted">
                <p className="text-ink">
                  {pluralize(pendingImport.backup.books.length, 'book')}, {pluralize(pendingImport.backup.series.length, 'series', 'series')}
                </p>
                <p>
                  Exported {new Date(pendingImport.backup.exportedAt).toLocaleDateString()}
                  {pendingImport.backup.covers ? ` · ${pluralize(pendingImport.backup.covers.length, 'cover')}` : ' · no covers'}
                  {pendingImport.skipped ? ` · ${pendingImport.skipped} unreadable entries skipped` : ''}
                </p>
              </div>
            </div>
            <Button variant="primary" block size="lg" disabled={importing} onClick={() => void runImport('merge')}>
              Merge into my library
            </Button>
            <p className="-mt-2 text-center text-xs text-ink-faint">Adds new books; newer edits win where both have the same book.</p>
            <Button variant="danger" block disabled={importing} onClick={() => void runImport('replace')}>
              Replace my library
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  )
}

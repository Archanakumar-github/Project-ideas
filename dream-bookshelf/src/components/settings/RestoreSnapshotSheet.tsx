import { useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { clearLocalSnapshot, importBackup, readLocalSnapshot } from '../../db/backup'
import { pluralize, relativeTime } from '../../lib/utils'
import { ui, useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'

/**
 * Shown at launch when IndexedDB is empty but the localStorage safety copy isn't —
 * e.g. after the browser evicted site data.
 */
export function RestoreSnapshotSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'restore-snapshot' }>; depth: number; isTop: boolean }) {
  const closeSheet = useUI((s) => s.closeSheet)
  const [snapshot] = useState(readLocalSnapshot)
  const [busy, setBusy] = useState(false)
  const close = () => closeSheet(sheet.key)
  if (!snapshot) return null
  const { books, series } = snapshot.backup

  return (
    <Drawer open={!sheet.closing} onClose={close} depth={depth} isTop={isTop} bare>
      <div className="flex flex-col items-center px-2 pt-6 pb-2 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-amber/12 text-amber ring-1 ring-amber/25">
          <LifeBuoy size={28} />
        </span>
        <h2 className="mt-4 font-serif text-2xl text-ink">Restore your shelves?</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Your library looks empty, but a safety copy from {relativeTime(snapshot.savedAt)} holds{' '}
          {pluralize(books.length, 'book')} and {pluralize(series.length, 'series', 'series')}. Covers you uploaded aren’t in the
          safety copy, but online covers will re-download.
        </p>
        <div className="mt-6 grid w-full gap-2">
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await importBackup(snapshot.backup, 'replace')
              ui.toast({ message: 'Library restored', tone: 'success' })
              close()
            }}
          >
            Restore library
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearLocalSnapshot()
              close()
            }}
          >
            Start fresh
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

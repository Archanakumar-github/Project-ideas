import { useRef, useState } from 'react'
import { createSeries, updateSeries } from '../../db/repo'
import { SERIES_STATUSES, type SeriesStatus } from '../../db/types'
import { useLibrary } from '../../hooks/useLibrary'
import { SERIES_STATUS_META } from '../../lib/status'
import { parseNumber } from '../../lib/utils'
import { ui, useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Label, TextArea, TextField } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { TokenInput } from '../ui/TokenInput'
import { CategoryPicker, type CategoryValue } from '../categories/CategoryPicker'
import { ShelfPicker } from '../categories/ShelfPicker'

export function SeriesFormSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'series-form' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const existing = sheet.id ? lib.seriesById.get(sheet.id) : undefined
  const closeSheet = useUI((s) => s.closeSheet)
  const replaceSheet = useUI((s) => s.replaceSheet)
  const [title, setTitle] = useState(existing?.title ?? sheet.prefill?.title ?? '')
  const [authors, setAuthors] = useState<string[]>(existing?.authors ?? sheet.prefill?.authors ?? [])
  const [status, setStatus] = useState<SeriesStatus>(existing?.status ?? 'want-to-read')
  const [total, setTotal] = useState(existing?.totalVolumes ? String(existing.totalVolumes) : '')
  const [category, setCategory] = useState<CategoryValue>({ categoryId: existing?.categoryId, subCategoryId: existing?.subCategoryId })
  const [shelfIds, setShelfIds] = useState<string[]>(existing?.shelfIds ?? [])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const close = () => closeSheet(sheet.key)

  const save = async () => {
    if (!title.trim()) {
      setError(true)
      titleRef.current?.focus()
      return
    }
    const fields = {
      title,
      authors,
      status,
      totalVolumes: parseNumber(total),
      categoryId: category.categoryId,
      subCategoryId: category.subCategoryId,
      shelfIds,
      notes: notes.trim() || undefined,
    }
    if (existing) {
      await updateSeries(existing.id, fields)
      close()
    } else {
      const created = await createSeries(fields)
      ui.toast({ message: `Created series “${created.title}”`, tone: 'success' })
      replaceSheet(sheet.key, { kind: 'series', id: created.id })
    }
  }

  return (
    <Drawer
      open={!sheet.closing}
      onClose={close}
      depth={depth}
      isTop={isTop}
      size="full"
      title={existing ? 'Edit series' : 'New series'}
      subtitle={existing ? undefined : 'Track a saga volume by volume'}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()}>
            {existing ? 'Save changes' : 'Create series'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5 pt-1"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <TextField
          ref={titleRef}
          label="Series name"
          value={title}
          autoFocus={!existing}
          onChange={(e) => {
            setTitle(e.target.value)
            setError(false)
          }}
          placeholder="The Stormlight Archive"
          hint={error ? <span className="text-danger">Required</span> : undefined}
        />
        <TokenInput label="Author" values={authors} onChange={setAuthors} suggestions={lib.authors} placeholder="Brandon Sanderson" />
        <div>
          <Label>Status</Label>
          <Segmented
            label="Series status"
            size="sm"
            value={status}
            onChange={setStatus}
            options={SERIES_STATUSES.map((s) => ({ value: s, label: SERIES_STATUS_META[s].short, tone: SERIES_STATUS_META[s].color }))}
          />
        </div>
        <TextField
          label="Total books in series"
          hint="Optional — shows the gaps"
          inputMode="numeric"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="10"
        />
        <div>
          <Label>Category</Label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div>
          <Label>Shelves</Label>
          <ShelfPicker value={shelfIds} onChange={setShelfIds} />
        </div>
        <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reading order, editions to collect…" />
        <button type="submit" hidden />
      </form>
    </Drawer>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ChevronDown, Search, Trash } from 'lucide-react'
import { searchBooks } from '../../api/metadata'
import { BOOK_STATUSES, type Book, type BookDraft, type BookStatus } from '../../db/types'
import { createBook, createSeries, deleteBooks, removeLocalCover, setLocalCover, updateBook } from '../../db/repo'
import { useLibrary } from '../../hooks/useLibrary'
import { useOnline } from '../../hooks/useOnline'
import { seriesStatusFor } from '../../lib/actions'
import { toIsbn13 } from '../../lib/isbn'
import { BOOK_STATUS_META } from '../../lib/status'
import { cx, parseNumber, titleKey } from '../../lib/utils'
import { useSettings } from '../../store/settings'
import { ui, useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Button, IconButton } from '../ui/Button'
import { Label, TextArea, TextField } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { SuggestInput } from '../ui/SuggestInput'
import { Switch } from '../ui/Switch'
import { TokenInput } from '../ui/TokenInput'
import { Spinner } from '../ui/Spinner'
import { CategoryPicker } from '../categories/CategoryPicker'
import { ShelfPicker } from '../categories/ShelfPicker'
import { BookCover } from './BookCover'
import { CoverInput } from './CoverInput'
import { StatusIcon } from './StatusBadge'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'CHF', 'SEK', 'NOK', 'DKK', 'SGD', 'BRL', 'MXN', 'ZAR']

interface FormState {
  title: string
  subtitle: string
  authors: string[]
  status: BookStatus
  categoryId?: string
  subCategoryId?: string
  shelfIds: string[]
  seriesTitle: string
  seriesIndex: string
  publishYear: string
  pageCount: string
  isbn: string
  price: string
  currency: string
  link: string
  notes: string
  description: string
  coverUrl?: string
}

const str = (v: number | string | undefined) => (v === undefined ? '' : String(v))

function initialState(
  book: Book | undefined,
  prefill: Partial<BookDraft> | undefined,
  seriesTitle: string,
  seriesIndex: number | undefined,
  defaults: { status: BookStatus; currency: string; categoryId?: string; subCategoryId?: string },
): FormState {
  const src: Partial<Book> = book ?? prefill ?? {}
  return {
    title: src.title ?? '',
    subtitle: src.subtitle ?? '',
    authors: src.authors ?? [],
    status: src.status ?? defaults.status,
    categoryId: book ? book.categoryId : (src.categoryId ?? defaults.categoryId),
    subCategoryId: book ? book.subCategoryId : (src.subCategoryId ?? defaults.subCategoryId),
    shelfIds: src.shelfIds ?? [],
    seriesTitle,
    seriesIndex: str(src.seriesIndex ?? seriesIndex),
    publishYear: str(src.publishYear),
    pageCount: str(src.pageCount),
    isbn: src.isbn ?? '',
    price: str(src.price),
    currency: src.currency ?? defaults.currency,
    link: src.link ?? '',
    notes: src.notes ?? '',
    description: src.description ?? '',
    coverUrl: src.coverUrl,
  }
}

/** Manual add / full edit — essentials up front, everything else behind "More details". */
export function BookFormSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'book-form' }>; depth: number; isTop: boolean }) {
  const lib = useLibrary()
  const online = useOnline()
  const settings = useSettings()
  const closeSheet = useUI((s) => s.closeSheet)
  const existing = sheet.id ? lib.booksById.get(sheet.id) : undefined
  const isEdit = !!sheet.id
  const targetSeries = sheet.target ? lib.seriesById.get(sheet.target.seriesId) : undefined
  const existingSeries = existing?.seriesId ? lib.seriesById.get(existing.seriesId) : undefined

  const [form, setForm] = useState<FormState>(() =>
    initialState(existing, sheet.prefill, (existingSeries ?? targetSeries)?.title ?? '', sheet.target?.seriesIndex, {
      status: settings.lastStatus,
      currency: settings.currency,
      // Only inherit a category from the series being added to; never guess for standalone books.
      categoryId: isEdit ? undefined : targetSeries?.categoryId,
      subCategoryId: isEdit ? undefined : targetSeries?.subCategoryId,
    }),
  )
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [showMore, setShowMore] = useState(isEdit || !!sheet.target)
  const [fetchOnline, setFetchOnline] = useState(!isEdit && settings.onlineLookups)
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const coverPreview = useMemo(() => (coverBlob ? URL.createObjectURL(coverBlob) : undefined), [coverBlob])
  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    },
    [coverPreview],
  )

  useEffect(() => {
    if (!isEdit && !form.title) titleRef.current?.focus({ preventScroll: true })
  }, [])

  const close = () => closeSheet(sheet.key)

  const lookupIsbn = async () => {
    const isbn = toIsbn13(form.isbn)
    if (!isbn) {
      ui.toast({ message: 'That doesn’t look like a valid ISBN.', tone: 'warning' })
      return
    }
    setLookingUp(true)
    try {
      const { results } = await searchBooks(isbn, 'isbn')
      const c = results[0]
      if (!c) {
        ui.toast({ message: 'No book found for that ISBN.', tone: 'warning' })
        return
      }
      setForm((f) => ({
        ...f,
        title: f.title || c.title,
        subtitle: f.subtitle || c.subtitle || '',
        authors: f.authors.length ? f.authors : c.authors,
        publishYear: f.publishYear || str(c.publishYear),
        pageCount: f.pageCount || str(c.pageCount),
        description: f.description || c.description || '',
        link: f.link || c.link || '',
        price: f.price || str(c.price),
        currency: f.price ? f.currency : (c.currency ?? f.currency),
        seriesTitle: f.seriesTitle || c.seriesName || '',
        seriesIndex: f.seriesIndex || str(c.seriesIndex),
        coverUrl: f.coverUrl ?? c.coverUrl,
      }))
      ui.toast({ message: `Found “${c.title}”`, tone: 'success' })
    } catch {
      ui.toast({ message: 'Lookup failed — you can save anyway and it’ll retry later.', tone: 'warning' })
    } finally {
      setLookingUp(false)
    }
  }

  const resolveSeriesId = async (): Promise<string | undefined> => {
    const name = form.seriesTitle.trim()
    if (!name) return undefined
    const match = lib.series.find((s) => titleKey(s.title) === titleKey(name))
    if (match) return match.id
    const created = await createSeries({
      title: name,
      authors: form.authors,
      status: seriesStatusFor(form.status),
      categoryId: form.categoryId,
      subCategoryId: form.subCategoryId,
    })
    return created.id
  }

  const save = async () => {
    const title = form.title.trim()
    if (!title) {
      setTitleError(true)
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const seriesId = await resolveSeriesId()
      const fields: Partial<Book> = {
        title,
        subtitle: form.subtitle,
        authors: form.authors,
        status: form.status,
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId,
        shelfIds: form.shelfIds,
        seriesId,
        seriesIndex: seriesId ? parseNumber(form.seriesIndex) : undefined,
        publishYear: parseNumber(form.publishYear),
        pageCount: parseNumber(form.pageCount),
        isbn: form.isbn,
        price: parseNumber(form.price),
        currency: form.price.trim() ? form.currency : undefined,
        link: form.link,
        notes: form.notes,
        description: form.description,
        coverUrl: coverRemoved ? undefined : form.coverUrl,
      }

      if (existing) {
        await updateBook(existing.id, fields)
        if (coverBlob) await setLocalCover({ kind: 'book', id: existing.id }, coverBlob)
        else if (coverRemoved) await removeLocalCover({ kind: 'book', id: existing.id })
        ui.toast({ message: 'Saved', tone: 'success' })
        close()
      } else {
        const book = await createBook({ ...fields, title } as BookDraft, {
          coverBlob: coverBlob ?? undefined,
          enrich: fetchOnline,
        })
        settings.set({ lastStatus: form.status, lastCategoryId: form.categoryId, lastSubCategoryId: form.subCategoryId })
        ui.toast({
          message: `Added “${book.title}” to ${BOOK_STATUS_META[book.status].label}`,
          tone: 'success',
          action: { label: 'Undo', run: () => void deleteBooks([book.id]) },
        })
        // Close this form and the search sheet it may have come from.
        const { sheets } = useUI.getState()
        sheets.filter((s) => s.kind === 'add' && !s.closing).forEach((s) => closeSheet(s.key))
        close()
      }
    } finally {
      setSaving(false)
    }
  }

  const coverSrcOverride = coverPreview
  const showCover = !coverRemoved

  return (
    <Drawer
      open={!sheet.closing}
      onClose={close}
      depth={depth}
      isTop={isTop}
      size="full"
      title={isEdit ? 'Edit book' : 'Add a book'}
      subtitle={isEdit ? undefined : targetSeries ? `To ${targetSeries.title}` : 'Only the title is required'}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to shelf'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        className="space-y-5 pt-1"
      >
        <CoverInput
          ref={coverInput}
          onPicked={(blob) => {
            setCoverBlob(blob)
            setCoverRemoved(false)
          }}
        />
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="press group relative w-24 shrink-0"
            aria-label="Choose cover image"
          >
            {coverSrcOverride ? (
              <img src={coverSrcOverride} alt="" className="aspect-[2/3] w-full rounded-[10px] object-cover shadow-glow" />
            ) : (
              <BookCover
                title={form.title || 'New book'}
                authors={form.authors}
                coverId={showCover ? existing?.coverId : undefined}
                coverUrl={showCover ? form.coverUrl : undefined}
                size="sm"
              />
            )}
            <span className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-canvas/80 py-1 text-[11px] text-ink backdrop-blur">
              <Camera size={12} /> Cover
            </span>
          </button>
          <div className="min-w-0 flex-1 space-y-3">
            <TextField
              ref={titleRef}
              label="Title"
              value={form.title}
              aria-invalid={titleError}
              onChange={(e) => {
                set('title', e.target.value)
                setTitleError(false)
              }}
              placeholder="The Name of the Wind"
              enterKeyHint="next"
              hint={titleError ? <span className="text-danger">Required</span> : undefined}
            />
            {(coverBlob || existing?.coverId || form.coverUrl) && showCover && (
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1 text-xs text-ink-faint hover:text-danger"
                onClick={() => {
                  setCoverBlob(null)
                  setCoverRemoved(true)
                }}
              >
                <Trash size={12} /> Remove cover
              </button>
            )}
          </div>
        </div>

        <TokenInput
          label="Author"
          values={form.authors}
          onChange={(v) => set('authors', v)}
          suggestions={lib.authors}
          placeholder="Patrick Rothfuss"
        />

        <div>
          <Label>Status</Label>
          <Segmented
            label="Status"
            value={form.status}
            onChange={(v) => set('status', v)}
            options={BOOK_STATUSES.map((s) => ({
              value: s,
              label: BOOK_STATUS_META[s].label,
              tone: BOOK_STATUS_META[s].color,
              icon: <StatusIcon status={s} size={14} className="max-[380px]:hidden" />,
            }))}
          />
        </div>

        <div>
          <Label>Category</Label>
          <CategoryPicker
            value={{ categoryId: form.categoryId, subCategoryId: form.subCategoryId }}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v.categoryId, subCategoryId: v.subCategoryId }))}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line-soft px-4 text-[15px] text-ink-muted"
        >
          More details
          <ChevronDown size={18} className={cx('transition-transform duration-200', showMore && 'rotate-180')} />
        </button>

        {showMore && (
          <div className="animate-fade-in space-y-5">
            <div className="grid grid-cols-[1fr_88px] gap-3">
              <SuggestInput
                label="Series"
                value={form.seriesTitle}
                onChange={(v) => set('seriesTitle', v)}
                suggestions={lib.series.map((s) => s.title)}
                placeholder="Standalone"
                createLabel={(v) => <>New series “{v}”</>}
              />
              <TextField
                label="Book #"
                inputMode="decimal"
                value={form.seriesIndex}
                disabled={!form.seriesTitle.trim()}
                onChange={(e) => set('seriesIndex', e.target.value)}
                placeholder="1"
              />
            </div>

            <TextField
              label="ISBN"
              inputMode="numeric"
              value={form.isbn}
              onChange={(e) => set('isbn', e.target.value)}
              placeholder="978…"
              trailing={
                online && settings.onlineLookups ? (
                  <IconButton label="Look up ISBN" size="sm" tone="amber" disabled={lookingUp || !form.isbn.trim()} onClick={() => void lookupIsbn()}>
                    {lookingUp ? <Spinner size={16} /> : <Search size={16} />}
                  </IconButton>
                ) : undefined
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <TextField label="Published" inputMode="numeric" value={form.publishYear} onChange={(e) => set('publishYear', e.target.value)} placeholder="2007" />
              <TextField label="Pages" inputMode="numeric" value={form.pageCount} onChange={(e) => set('pageCount', e.target.value)} placeholder="662" />
            </div>

            <div className="grid grid-cols-[1fr_96px] gap-3">
              <TextField label="Price" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
              <div>
                <Label>Currency</Label>
                <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="field appearance-none" aria-label="Currency">
                  {Array.from(new Set([form.currency, ...CURRENCIES])).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <TextField label="Link" type="url" inputMode="url" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://bookshop.org/…" />

            <div>
              <Label>Shelves</Label>
              <ShelfPicker value={form.shelfIds} onChange={(v) => set('shelfIds', v)} />
            </div>

            <TextField label="Subtitle" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
            <TextArea label="Private notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Who recommended it, which edition…" />
            <TextArea label="Description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        )}

        {!isEdit && settings.onlineLookups && (
          <Switch
            checked={fetchOnline}
            onChange={setFetchOnline}
            label="Fill in missing details online"
            description={online ? 'Cover, year, pages and description — never overwrites what you typed.' : 'Will run automatically when you’re back online.'}
          />
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  )
}

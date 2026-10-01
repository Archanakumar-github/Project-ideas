import { useEffect, useMemo, useRef, useState } from 'react'
import { Bold, CheckSquare, Heading2, Italic, List, NotebookPen, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { deleteJournal, newJournalEntry, upsertJournal, useApp } from '../store/app'
import { closeSheet, confirmDialog, openSheet, toast } from '../store/ui'
import { useToday } from '../hooks/useNow'
import { fmtDateTime, fmtDay, fmtTime, type ISODate } from '../lib/dates'
import { Markdown, stripMarkdown } from '../lib/markdown'
import { cx, debounce, normalize } from '../lib/utils'
import { readiness } from '../engine/insights'
import { ViewHeader, ViewScroller } from '../components/layout/ViewHeader'
import { Badge, Button, Card, EmptyState, IconButton, Rating, Segmented, Stepper } from '../components/ui/primitives'
import { Sheet } from '../components/ui/Sheet'
import type { JournalEntry } from '../types'

export function JournalView() {
  const today = useToday()
  const journal = useApp((s) => s.journal)
  const plan = useApp((s) => s.plan)
  const [q, setQ] = useState('')
  const entries = useMemo(() => {
    const all = Object.values(journal).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    const query = normalize(q)
    return query ? all.filter((e) => normalize(e.body).includes(query) || e.date.includes(q)) : all
  }, [journal, q])
  const groups = entries.reduce<Array<{ month: string; items: JournalEntry[] }>>((acc, e) => {
    const month = fmtDay(e.date, { month: 'long', year: 'numeric' })
    const last = acc.at(-1)
    if (last?.month === month) last.items.push(e)
    else acc.push({ month, items: [e] })
    return acc
  }, [])
  const rd = readiness(Object.values(journal), plan?.targets.sleepHours ?? 8, today)

  return (
    <ViewScroller>
      <ViewHeader
        title="Journal"
        right={
          <IconButton label="New entry" className="mb-0.5 bg-accent text-on-accent" onClick={() => openSheet({ kind: 'journalEntry', date: today })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="mx-auto max-w-xl space-y-3 px-4 pt-1">
        <Card className="flex items-start gap-3 bg-accent-soft">
          <Sparkles size={20} className="mt-0.5 shrink-0 text-accent-fg" />
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {rd ? (
              <>
                Readiness today: <span className="font-semibold text-ink">{rd.score}/100 ({rd.label})</span>
                {rd.reasons.length ? `: ${rd.reasons.join(', ')}` : ''}. The coach uses your energy, soreness, mood, sleep and notes to tune training and advice.
              </>
            ) : (
              'Rate energy, soreness and sleep, and jot anything notable. Your coach reads these to adjust workouts (e.g. a lighter session after a rough night).'
            )}
          </p>
        </Card>

        {Object.keys(journal).length > 3 && (
          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-3.5">
            <Search size={18} className="text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" aria-label="Search journal" className="min-w-0 flex-1 bg-transparent py-2.5 text-ink outline-none placeholder:text-ink-3" />
          </div>
        )}

        {!entries.length ? (
          <EmptyState
            icon={<NotebookPen size={24} />}
            title={q ? 'No matching entries' : 'Your journal is empty'}
            body={q ? undefined : 'Supports Markdown: **bold**, lists, checklists. Everything auto-saves, encrypted on this device.'}
            action={!q && <Button variant="primary" icon={<Plus size={18} />} onClick={() => openSheet({ kind: 'journalEntry', date: today })}>Write today's entry</Button>}
          />
        ) : (
          groups.map((g) => (
            <section key={g.month}>
              <h2 className="mb-1.5 mt-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{g.month}</h2>
              <div className="space-y-2">
                {g.items.map((e) => (
                  <button key={e.id} type="button" onClick={() => openSheet({ kind: 'journalEntry', id: e.id })} className="tap block w-full rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-left shadow-card active:bg-surface-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14.5px] font-semibold text-ink">{fmtDay(e.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-[12px] text-ink-3">{fmtTime(e.updatedAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {e.energy != null && <Badge>Energy {e.energy}/5</Badge>}
                      {e.soreness != null && <Badge>Soreness {e.soreness}/5</Badge>}
                      {e.mood != null && <Badge>Mood {e.mood}/5</Badge>}
                      {e.sleepHours != null && <Badge>Sleep {e.sleepHours} h</Badge>}
                    </div>
                    {e.body.trim() && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{stripMarkdown(e.body)}</p>}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </ViewScroller>
  )
}

const TOOLS: Array<{ label: string; Icon: typeof Bold; apply: (sel: string) => [string, string, string] }> = [
  { label: 'Bold', Icon: Bold, apply: (s) => ['**', s || 'bold', '**'] },
  { label: 'Italic', Icon: Italic, apply: (s) => ['_', s || 'italic', '_'] },
  { label: 'Heading', Icon: Heading2, apply: (s) => ['\n## ', s || 'Heading', '\n'] },
  { label: 'Bullet list', Icon: List, apply: (s) => ['\n- ', s || 'item', ''] },
  { label: 'Checklist', Icon: CheckSquare, apply: (s) => ['\n- [ ] ', s || 'to do', ''] },
]

/** Editor that saves itself: every keystroke is persisted (debounced 400 ms) with a timestamp. */
export function JournalEntrySheet({ id, date }: { id?: string; date?: ISODate }) {
  const existing = useApp((s) => (id ? s.journal[id] : undefined))
  const sameDay = useApp((s) => (!id && date ? Object.values(s.journal).find((j) => j.date === date) : undefined))
  const [entry, setEntry] = useState<JournalEntry>(() => existing ?? sameDay ?? newJournalEntry(date))
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [savedAt, setSavedAt] = useState<number | undefined>(existing?.updatedAt ?? sameDay?.updatedAt)
  const ta = useRef<HTMLTextAreaElement>(null)
  const latest = useRef(entry)
  latest.current = entry
  const deleted = useRef(false)

  const hasContent = (e: JournalEntry) => !!(e.body.trim() || e.energy != null || e.soreness != null || e.mood != null || e.sleepHours != null)
  const save = useMemo(
    () =>
      debounce((e: JournalEntry) => {
        if (deleted.current || (!hasContent(e) && !useApp.getState().journal[e.id])) return
        const saved = upsertJournal(e)
        setSavedAt(saved.updatedAt)
      }, 400),
    [],
  )
  // Flush on close.
  useEffect(
    () => () => {
      const e = latest.current
      if (!deleted.current && (hasContent(e) || useApp.getState().journal[e.id])) upsertJournal(e)
    },
    [],
  )
  const change = (patch: Partial<JournalEntry>) => {
    const next = { ...latest.current, ...patch }
    setEntry(next)
    save(next)
  }

  const insert = (tool: (typeof TOOLS)[number]) => {
    const el = ta.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    const [pre, mid, post] = tool.apply(value.slice(a, b))
    const next = value.slice(0, a) + pre + mid + post + value.slice(b)
    change({ body: next })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + pre.length, a + pre.length + mid.length)
    })
  }

  return (
    <Sheet
      title={fmtDay(entry.date, { weekday: 'long', month: 'long', day: 'numeric' })}
      subtitle={savedAt ? `Saved ${fmtDateTime(savedAt)} · encrypted on device` : 'Auto-saves as you type'}
      onClose={closeSheet}
      full
      headerRight={
        useApp.getState().journal[entry.id] ? (
          <IconButton
            label="Delete entry"
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Delete this entry?', confirmLabel: 'Delete', danger: true }))) return
              deleted.current = true
              const prev = deleteJournal(entry.id)
              closeSheet()
              toast({ message: 'Entry deleted', actionLabel: 'Undo', onAction: () => prev && upsertJournal(prev) })
            }}
          >
            <Trash2 size={19} />
          </IconButton>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <Rating label="Energy" value={entry.energy} onChange={(v) => change({ energy: v })} lowLabel="drained" highLabel="great" />
          <Rating label="Soreness" value={entry.soreness} onChange={(v) => change({ soreness: v })} lowLabel="fresh" highLabel="very sore" />
          <Rating label="Mood" value={entry.mood} onChange={(v) => change({ mood: v })} lowLabel="low" highLabel="great" />
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink-2">Sleep last night</div>
            <Stepper label="Sleep hours" value={entry.sleepHours} onChange={(v) => change({ sleepHours: v })} step={0.5} min={0} max={14} decimals={1} unit="h" />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Segmented
              label="Editor mode"
              className="flex-1"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'write', label: 'Write' },
                { value: 'preview', label: 'Preview' },
              ]}
            />
          </div>
          {mode === 'write' ? (
            <>
              <div className="mb-2 flex gap-1" role="toolbar" aria-label="Formatting">
                {TOOLS.map((t) => (
                  <IconButton key={t.label} label={t.label} className="h-11 w-11 bg-surface-2" onClick={() => insert(t)}>
                    <t.Icon size={18} />
                  </IconButton>
                ))}
              </div>
              <textarea
                ref={ta}
                value={entry.body}
                onChange={(e) => change({ body: e.target.value })}
                placeholder={'How did training feel? Anything about food, stress, sleep?\n\nMarkdown works: **bold**, _italic_, - lists, - [ ] checklists'}
                aria-label="Journal entry"
                rows={10}
                className="block min-h-56 w-full resize-y rounded-2xl border border-line bg-surface px-3.5 py-3 leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-accent-fg"
              />
            </>
          ) : (
            <div className={cx('min-h-56 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink')}>{entry.body.trim() ? <Markdown text={entry.body} /> : <p className="text-ink-3">Nothing written yet.</p>}</div>
          )}
        </div>
        <p className="text-[12px] text-ink-3">Created {fmtDateTime(entry.createdAt)}</p>
      </div>
    </Sheet>
  )
}

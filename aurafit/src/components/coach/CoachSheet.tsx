import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Cloud, Cpu, Square, Trash2 } from 'lucide-react'
import { clearChat, patchChat, pushChat, setCloudHistory, useApp } from '../../store/app'
import { closeSheet, confirmDialog } from '../../store/ui'
import { buildContext, contextToText } from '../../coach/context'
import { localAnswer, priorityAnswer } from '../../coach/localCoach'
import { runAction } from '../../coach/actions'
import { useOnline } from '../../hooks/useOnline'
import { Markdown } from '../../lib/markdown'
import { cx, haptic } from '../../lib/utils'
import { fmtTime } from '../../lib/dates'
import type { ChatMessage } from '../../types'
import { Sheet } from '../ui/Sheet'
import { IconButton } from '../ui/primitives'

const SUGGESTIONS = ['What should I eat now?', 'Swap my next meal', "I'm sore, adjust today's workout", 'Am I on track?', 'Explain my targets', 'Alternative to squats?']

export function CoachSheet({ prompt }: { prompt?: string }) {
  const messages = useApp((s) => s.chat.messages)
  const cloud = useApp((s) => s.settings.cloudCoach)
  const online = useOnline()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const useCloud = cloud.enabled && !!cloud.apiKey && online

  useEffect(() => {
    list.current?.scrollIntoView({ block: 'end' })
  }, [messages])
  // A prompt passed in by another screen is sent once (the ref survives StrictMode's double effect).
  const sentPrompt = useRef(false)
  useEffect(() => {
    if (!prompt || sentPrompt.current) return
    sentPrompt.current = true
    void send(prompt)
  }, [])

  async function send(raw: string) {
    const question = raw.trim()
    if (!question || busy) return
    haptic()
    setText('')
    pushChat({ role: 'user', text: question })
    const ctx = buildContext(useApp.getState())
    if (!ctx) return
    const priority = priorityAnswer(question, ctx)
    const local = priority ?? localAnswer(question, ctx)
    if (!useCloud || priority) {
      pushChat({ role: 'coach', text: local.text, actions: local.actions, source: 'local' })
      return
    }
    setBusy(true)
    const msg = pushChat({ role: 'coach', text: '', source: 'cloud', actions: local.actions })
    let streamed = ''
    let frame = 0
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      const { askCloud } = await import('../../coach/cloudCoach')
      const result = await askCloud({
        apiKey: cloud.apiKey,
        model: cloud.model,
        history: useApp.getState().chat.cloud as never[],
        question,
        context: contextToText(ctx),
        signal: ctrl.signal,
        onText: (delta) => {
          streamed += delta
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => patchChat(msg.id, { text: streamed }))
        },
      })
      cancelAnimationFrame(frame)
      patchChat(msg.id, { text: result.reset ? `${result.text}\n\n_(Started a fresh cloud conversation to keep things fast.)_` : result.text })
      setCloudHistory(result.history)
    } catch (err) {
      cancelAnimationFrame(frame)
      const e = err as { kind?: string; message?: string }
      if (e.kind === 'aborted') patchChat(msg.id, { text: streamed ? `${streamed}\n\n_(stopped)_` : '_(stopped)_' })
      else patchChat(msg.id, { text: `${local.text}\n\n_${e.message ?? 'Cloud coach unavailable.'} This answer came from the on-device coach._`, source: 'local', error: true })
    } finally {
      abort.current = null
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Coach"
      subtitle={
        <span className="inline-flex items-center gap-1">
          {useCloud ? <Cloud size={12} /> : <Cpu size={12} />}
          {useCloud ? `Cloud coach · ${cloud.model}` : 'On-device · private · works offline'}
        </span>
      }
      onClose={closeSheet}
      full
      headerRight={
        messages.length > 0 && (
          <IconButton
            label="Clear conversation"
            onClick={async () => {
              if (await confirmDialog({ title: 'Clear the conversation?', confirmLabel: 'Clear', danger: true })) clearChat()
            }}
          >
            <Trash2 size={19} />
          </IconButton>
        )
      }
      footer={
        <div>
          <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => void send(s)} className="tap min-h-10 shrink-0 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-medium text-ink-2 active:bg-surface-2">
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
          >
            <textarea
              ref={input}
              value={text}
              rows={1}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(text)
                }
              }}
              placeholder="Ask your coach…"
              aria-label="Message the coach"
              enterKeyHint="send"
              className="max-h-36 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-3 leading-snug text-ink outline-none placeholder:text-ink-3 focus:border-accent-fg"
            />
            {busy ? (
              <button type="button" aria-label="Stop" onClick={() => abort.current?.abort()} className="tap grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-3 text-ink">
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" aria-label="Send" disabled={!text.trim()} className="tap grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-40">
                <ArrowUp size={22} />
              </button>
            )}
          </form>
        </div>
      }
    >
      {messages.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-fg">
            <Cpu size={26} />
          </div>
          <h3 className="mt-4 text-[18px] font-bold text-ink">Your coach knows your plan</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-ink-3">It reads your profile, today's meals and training, your progress and journal notes, all on this device. Try a suggestion below.</p>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {messages.map((m) => (
            <Bubble key={m.id} m={m} streaming={busy && m === messages.at(-1) && m.role === 'coach'} />
          ))}
        </div>
      )}
      <div ref={list} />
    </Sheet>
  )
}

function Bubble({ m, streaming }: { m: ChatMessage; streaming: boolean }) {
  const mine = m.role === 'user'
  return (
    <div className={cx('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div className={cx('max-w-[88%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed', mine ? 'rounded-br-lg bg-accent text-on-accent' : 'rounded-bl-lg border border-line bg-surface text-ink')}>
        {mine ? <p className="whitespace-pre-wrap">{m.text}</p> : m.text ? <Markdown text={m.text} /> : <TypingDots />}
        {streaming && m.text && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-ink-3 align-middle" aria-hidden />}
      </div>
      {!mine && m.actions && m.actions.length > 0 && !streaming && (
        <div className="mt-1.5 flex max-w-[92%] flex-wrap gap-1.5">
          {m.actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={m.actionsUsed && a.kind !== 'goto'}
              onClick={() => {
                haptic(12)
                if (a.kind !== 'goto') patchChat(m.id, { actionsUsed: true })
                runAction(a)
              }}
              className="tap min-h-10 rounded-full bg-accent-soft px-3.5 text-[13.5px] font-semibold text-accent-fg active:brightness-95 disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <span className="mt-1 px-2 text-[11px] text-ink-3">
        {fmtTime(m.at)}
        {!mine && m.source === 'cloud' ? ' · cloud' : ''}
      </span>
    </div>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1.5" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  )
}

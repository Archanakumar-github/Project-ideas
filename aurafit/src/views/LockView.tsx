import { useEffect, useRef, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { unlock, wipeAll } from '../store/app'
import { confirmDialog } from '../store/ui'
import { Button } from '../components/ui/primitives'
import { cx } from '../lib/utils'

/** Passcode gate: the decryption key is derived here and never stored. */
export function LockView() {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const submit = async () => {
    if (!code || busy) return
    setBusy(true)
    setError(false)
    const ok = await unlock(code)
    setBusy(false)
    if (!ok) {
      setError(true)
      setCode('')
      input.current?.focus()
    }
  }
  return (
    <div className="safe-top grid min-h-full place-items-center px-6">
      <form
        className="w-full max-w-xs text-center"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto h-16 w-16 rounded-[18px]" />
        <h1 className="mt-5 flex items-center justify-center gap-2 text-[24px] font-extrabold text-ink">
          <Lock size={20} /> AuraFit is locked
        </h1>
        <p className="mt-1 text-[14px] text-ink-3">Enter your passcode to decrypt your data.</p>
        <input
          ref={input}
          type="password"
          autoComplete="current-password"
          aria-label="Passcode"
          aria-invalid={error}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={cx('mt-6 h-14 w-full rounded-2xl border bg-surface px-4 text-center text-[22px] tracking-[0.3em] text-ink outline-none focus:border-accent-fg', error ? 'animate-pop-in border-critical' : 'border-line')}
        />
        {error && (
          <p role="alert" className="mt-2 text-[14px] font-medium text-ink">
            Wrong passcode. Try again.
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block className="mt-4" disabled={!code || busy} icon={busy ? <Loader2 size={20} className="animate-spin" /> : undefined}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
        <button
          type="button"
          className="tap mt-8 min-h-10 text-[13px] text-ink-3 underline underline-offset-2"
          onClick={async () => {
            if (!(await confirmDialog({ title: 'Forgot your passcode?', body: "Without it, your encrypted data can't be recovered. You can erase everything and start over (or restore a backup).", confirmLabel: 'Erase & start over', danger: true }))) return
            await wipeAll()
          }}
        >
          Forgot passcode?
        </button>
      </form>
    </div>
  )
}

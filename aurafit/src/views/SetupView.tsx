import { useMemo, useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, ArrowRight, ClipboardPaste, Download, FileText, FileUp, History, ShieldCheck, Sparkles, TriangleAlert, WifiOff } from 'lucide-react'
import sampleProfile from '../../user_profile.example.md?raw'
import { parseProfileMarkdown } from '../engine/profileParser'
import { generatePlan } from '../engine/plan'
import { importProfile, replaceAll, useApp } from '../store/app'
import { parseBackup, BackupError } from '../db/backup'
import { downloadText, cx, readFileText, fmtNum } from '../lib/utils'
import { WEEKDAY_LABEL } from '../lib/dates'
import { fmtMl } from '../lib/units'
import { Button, Badge, TextArea } from '../components/ui/primitives'
import { ProfileEditor, GOAL_LABEL } from '../components/profile/ProfileEditor'
import { toast } from '../store/ui'
import type { Profile } from '../types'

/**
 * First run: bring your own user_profile.md. Everything AuraFit recommends is generated
 * from it, so this screen is about getting that file in and confirming what was read.
 */
export function SetupView() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const settings = useApp((s) => s.settings)

  const load = (markdown: string, fileName?: string) => {
    setError(null)
    if (!markdown.trim()) {
      setError('That file is empty.')
      return
    }
    if (markdown.trim().startsWith('{')) {
      setError('That looks like a JSON backup. Use "Restore a backup" below instead.')
      return
    }
    setProfile(parseProfileMarkdown(markdown, { fileName }))
    window.scrollTo({ top: 0 })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 2_000_000) {
      setError('That file is too large for a profile (max 2 MB).')
      return
    }
    try {
      const text = await readFileText(file)
      if (/\.json$/i.test(file.name)) await restore(text)
      else load(text, file.name)
    } catch {
      setError('Could not read that file.')
    }
  }

  const restore = async (text: string) => {
    try {
      const data = parseBackup(text)
      await replaceAll(data)
      toast('Backup restored')
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Could not restore that backup.')
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void onFile(e.dataTransfer.files?.[0])
  }

  if (profile) return <Review profile={profile} onChange={setProfile} onBack={() => setProfile(null)} weightUnit={settings.weightUnit} lengthUnit={settings.lengthUnit} />

  return (
    <div
      className="min-h-full overflow-y-auto"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="safe-top mx-auto max-w-xl px-5 pb-12">
        <div className="pt-10 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto h-20 w-20 rounded-[22px] shadow-float" />
          <h1 className="mt-5 text-[34px] font-extrabold tracking-tight text-ink">AuraFit</h1>
          <p className="mx-auto mt-2 max-w-sm text-[16px] leading-relaxed text-ink-2">Your private fitness & diet coach. Every target, meal and workout is built from one file you own: <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[14px]">user_profile.md</code>.</p>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cx(
            'tap mt-8 flex w-full flex-col items-center rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-colors',
            dragging ? 'border-accent-fg bg-accent-soft' : 'border-line-strong bg-surface active:bg-surface-2',
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-accent">
            <FileUp size={26} />
          </span>
          <span className="mt-4 text-[18px] font-bold text-ink">{dragging ? 'Drop it here' : 'Import user_profile.md'}</span>
          <span className="mt-1 text-[14px] text-ink-3">Tap to choose from Files, or drag & drop</span>
        </button>
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-critical/10 px-4 py-3 text-[14px] text-ink">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-critical" /> {error}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button icon={<ClipboardPaste size={18} />} onClick={() => setPasting((p) => !p)}>
            Paste text
          </Button>
          <Button icon={<Sparkles size={18} />} variant="soft" onClick={() => load(sampleProfile, 'user_profile.example.md')}>
            Try a sample
          </Button>
        </div>

        {pasting && (
          <div className="mt-3 animate-rise-in">
            <TextArea label="Paste your profile Markdown" rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'# My profile\n- Age: 32\n- Height: 175 cm\n- Weight: 80 kg\n- Goal: lose fat\n…'} />
            <Button className="mt-2" variant="primary" block disabled={!pasteText.trim()} onClick={() => load(pasteText, 'pasted.md')}>
              Read profile
            </Button>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Feature icon={<FileText size={18} />} title="Write it your way" body="Bullets, tables or free text. Units in kg/lb, cm/ft, any order. Missing details get safe defaults you can review." />
          <Feature icon={<ShieldCheck size={18} />} title="Private by design" body="No account, no cloud. Data is AES-256 encrypted on this device, with an optional passcode and 1-tap export." />
          <Feature icon={<WifiOff size={18} />} title="Works offline" body="Install to your Home Screen. Food, recipe and exercise libraries extend from public databases when you're online." />
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6">
          <Button variant="ghost" icon={<Download size={18} />} onClick={() => downloadText('user_profile.md', sampleProfile, 'text/markdown')}>
            Download the template
          </Button>
          <Button variant="ghost" icon={<History size={18} />} onClick={() => backupRef.current?.click()}>
            Restore a backup (.json)
          </Button>
          <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) await restore(await readFileText(f))
          }} />
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-fg">{icon}</span>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-3">{body}</p>
      </div>
    </div>
  )
}

function Review({ profile, onChange, onBack, weightUnit, lengthUnit }: { profile: Profile; onChange: (p: Profile) => void; onBack: () => void; weightUnit: 'kg' | 'lb'; lengthUnit: 'cm' | 'in' }) {
  const plan = useMemo(() => generatePlan(profile, 7), [profile])
  const t = plan.targets
  const detected = profile.meta.detected.length
  const defaulted = profile.meta.defaulted.length
  const strengthDays = plan.program.days.filter((d) => d.kind === 'strength')

  return (
    <div className="min-h-full">
      <div className="safe-top sticky top-0 z-20 bg-canvas/95">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={onBack}>
            Back
          </Button>
          <span className="flex-1 truncate text-center text-[15px] font-semibold text-ink">{profile.meta.fileName ?? 'Your profile'}</span>
          <span className="w-[76px]" />
        </div>
      </div>
      <div className="mx-auto max-w-xl px-4 pb-40">
        <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-ink">{profile.name ? `Hi ${profile.name.split(' ')[0]}, here's your plan` : "Here's what I read"}</h1>
        <p className="mt-1 text-[14.5px] text-ink-2">
          <Badge tone="good">{detected} values found</Badge> {defaulted > 0 && <Badge tone="warn">{defaulted} estimated</Badge>}
        </p>
        {profile.meta.warnings.length > 0 && (
          <ul className="mt-3 space-y-1.5 rounded-2xl border border-warn/40 bg-warn/10 p-3.5 text-[13.5px] text-ink">
            {profile.meta.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-serious" /> {w}
              </li>
            ))}
          </ul>
        )}

        <section className="mt-4 rounded-[var(--radius-card)] bg-accent p-4 text-on-accent shadow-float">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] opacity-80">Daily targets · {GOAL_LABEL[profile.goal]}</p>
          <p className="mt-1 text-[40px] font-extrabold leading-none">
            {fmtNum(t.calories)} <span className="text-[18px] font-semibold opacity-80">kcal</span>
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Protein', `${t.proteinG} g`],
              ['Carbs', `${t.carbsG} g`],
              ['Fat', `${t.fatG} g`],
              ['Water', fmtMl(t.waterMl)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/14 px-1 py-2">
                <div className="text-[16px] font-bold">{v}</div>
                <div className="text-[11.5px] opacity-80">{k}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed opacity-90">
            {plan.program.name}: {strengthDays.map((d) => `${WEEKDAY_LABEL[d.weekday].slice(0, 3)} ${d.title.toLowerCase()}`).join(' · ') || 'recovery focus'}.
          </p>
        </section>

        <details className="mt-3 rounded-2xl bg-surface px-4 py-3 text-[13.5px] text-ink-2">
          <summary className="tap min-h-8 cursor-pointer font-semibold text-ink">How these numbers were calculated</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>

        <h2 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Check & adjust</h2>
        <ProfileEditor profile={profile} onChange={onChange} weightUnit={weightUnit} lengthUnit={lengthUnit} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 px-4 pt-3" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-xl">
          <Button variant="primary" size="lg" block icon={<ArrowRight size={20} />} onClick={() => importProfile(profile, generatePlan(profile))}>
            Create my plan
          </Button>
        </div>
      </div>
    </div>
  )
}

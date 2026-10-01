import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bot, ChevronRight, Database, Download, FileDown, FileText, FileUp, HardDrive, KeyRound, Lock, Palette, RefreshCw, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react'
import { DEFAULT_CLOUD_MODEL, lockNow, removePasscode, replaceAll, reshuffleMeals, reshuffleProgram, setPasscode, snapshot, updateProfile, updateSettings, useApp, wipeAll, importProfile } from '../../store/app'
import { closeSheet, confirmDialog, toast } from '../../store/ui'
import { backupFileName, parseBackup, toBackup, toMarkdownReport, BackupError } from '../../db/backup'
import { parseProfileMarkdown } from '../../engine/profileParser'
import { generatePlan } from '../../engine/plan'
import { downloadText, fmtNum, readFileText } from '../../lib/utils'
import { fmtDateTime } from '../../lib/dates'
import { fmtMl } from '../../lib/units'
import { Sheet } from '../ui/Sheet'
import { Badge, Button, Input, Row, Segmented, Switch } from '../ui/primitives'
import { ProfileEditor, GOAL_LABEL } from '../profile/ProfileEditor'
import type { Profile, ThemePref } from '../../types'

type Page = 'main' | 'profile' | 'source' | 'security' | 'coach'


export function SettingsSheet({ section }: { section?: 'profile' | 'security' | 'data' | 'coach' }) {
  const [page, setPage] = useState<Page>(section === 'profile' ? 'profile' : section === 'security' ? 'security' : section === 'coach' ? 'coach' : 'main')
  const back = page !== 'main' && (
    <Button size="sm" variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setPage('main')}>
      Back
    </Button>
  )
  const titles: Record<Page, string> = { main: 'Settings', profile: 'Edit profile', source: 'user_profile.md', security: 'Privacy & security', coach: 'AI coach' }
  return (
    <Sheet title={titles[page]} onClose={closeSheet} full headerRight={back}>
      {page === 'main' && <Main go={setPage} />}
      {page === 'profile' && <EditProfile done={() => setPage('main')} />}
      {page === 'source' && <Source />}
      {page === 'security' && <Security />}
      {page === 'coach' && <CoachSettings />}
    </Sheet>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-1">{children}</div>
    </section>
  )
}

function Main({ go }: { go: (p: Page) => void }) {
  const profile = useApp((s) => s.profile)!
  const plan = useApp((s) => s.plan)!
  const settings = useApp((s) => s.settings)
  const storage = useApp((s) => s.storage)
  const fileRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const [usage, setUsage] = useState<{ used?: number; persisted?: boolean }>({})
  useEffect(() => {
    void (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined)
      const persisted = await navigator.storage?.persisted?.().catch(() => undefined)
      setUsage({ used: est?.usage, persisted })
    })()
  }, [])
  const t = plan.targets

  const reimport = async (file: File | undefined) => {
    if (!file) return
    const md = await readFileText(file)
    const next = parseProfileMarkdown(md, { fileName: file.name })
    if (!(await confirmDialog({ title: `Re-import ${file.name}?`, body: `Found ${next.meta.detected.length} values. Your targets, meal plan and program will be rebuilt from this file. Logs, journal and history are kept.`, confirmLabel: 'Rebuild plan' }))) return
    importProfile(next, generatePlan(next))
    toast('Plan rebuilt from your new profile')
  }

  const exportJson = () => {
    downloadText(backupFileName('json'), JSON.stringify(toBackup(snapshot(), __APP_VERSION__), null, 2), 'application/json')
    toast('Backup downloaded (not encrypted: keep it safe)')
  }
  const exportMd = () => {
    downloadText(backupFileName('md'), toMarkdownReport(snapshot()), 'text/markdown')
    toast('Markdown report downloaded')
  }
  const importBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = parseBackup(await readFileText(file))
      if (!(await confirmDialog({ title: 'Replace all data with this backup?', body: `Everything currently on this device is replaced by ${file.name}.`, confirmLabel: 'Restore', danger: true }))) return
      await replaceAll(data)
      closeSheet()
      toast('Backup restored')
    } catch (e) {
      toast({ message: e instanceof BackupError ? e.message : 'Could not read that backup', tone: 'error' })
    }
  }

  return (
    <div>
      <Group title="Profile">
        <Row icon={<UserRound size={19} />} title={profile.name ?? 'Your profile'} detail={`${GOAL_LABEL[profile.goal]} · ${profile.age} y · imported ${fmtDateTime(profile.meta.importedAt)}`} onClick={() => go('profile')} right={<ChevronRight size={18} className="text-ink-3" />} />
        <Row icon={<FileText size={19} />} title="View imported Markdown" detail={profile.meta.fileName ?? 'user_profile.md'} onClick={() => go('source')} right={<ChevronRight size={18} className="text-ink-3" />} />
        <Row icon={<FileUp size={19} />} title="Re-import user_profile.md" detail="Rebuild every target and plan; logs are kept" onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => void reimport(e.target.files?.[0])} />
      </Group>

      <Group title="Plan">
        <div className="py-3 text-[13.5px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">{fmtNum(t.calories)} kcal</span> · P {t.proteinG} g · C {t.carbsG} g · F {t.fatG} g · water {fmtMl(t.waterMl)} · {fmtNum(t.steps)} steps
          <details className="mt-1">
            <summary className="tap min-h-9 cursor-pointer font-semibold text-accent-fg">How it's calculated</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </div>
        <Row icon={<RefreshCw size={19} />} title="Shuffle meal plan" detail="New mix of meals, same targets and rules" onClick={async () => (await confirmDialog({ title: 'Shuffle meals?', confirmLabel: 'Shuffle' })) && (reshuffleMeals(), toast('New meal plan generated'))} />
        <Row icon={<RefreshCw size={19} />} title="Regenerate program" detail="Re-pick exercises within your split" onClick={async () => (await confirmDialog({ title: 'Regenerate program?', confirmLabel: 'Regenerate' })) && (reshuffleProgram(), toast('Program regenerated'))} />
      </Group>

      <Group title="Preferences">
        <div className="py-3">
          <div className="mb-1.5 flex items-center gap-2 text-[14px] font-medium text-ink">
            <Palette size={16} /> Appearance
          </div>
          <Segmented<ThemePref>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 pb-3">
          <Segmented label="Weight unit" value={settings.weightUnit} onChange={(weightUnit) => updateSettings({ weightUnit })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          <Segmented label="Length unit" value={settings.lengthUnit} onChange={(lengthUnit) => updateSettings({ lengthUnit })} options={[{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]} />
        </div>
        <Switch checked={settings.sound} onChange={(sound) => updateSettings({ sound })} label="Rest-timer sound" description="Chime (and vibration where supported) when rest is over." />
        <Switch checked={settings.online} onChange={(online) => updateSettings({ online })} label="Online enhancements" description="Food search (Open Food Facts), recipe ideas (TheMealDB) and exercise images (wger) when connected. Only search terms leave the device." />
      </Group>

      <Group title="Coach">
        <Row icon={<Bot size={19} />} title="AI coach" detail={settings.cloudCoach.enabled && settings.cloudCoach.apiKey ? `Cloud: ${settings.cloudCoach.model}` : 'On-device (private, offline)'} onClick={() => go('coach')} right={<ChevronRight size={18} className="text-ink-3" />} />
      </Group>

      <Group title="Privacy & data">
        <Row
          icon={<ShieldCheck size={19} />}
          title={storage.encrypted ? 'AES-256 encryption on' : 'Not encrypted (needs HTTPS)'}
          detail={storage.mode === 'passcode' ? 'Passcode lock enabled' : storage.encrypted ? 'Device key · add a passcode for extra protection' : 'Open AuraFit over HTTPS to enable encryption'}
          onClick={() => go('security')}
          right={<ChevronRight size={18} className="text-ink-3" />}
        />
        <Row icon={<Download size={19} />} title="Export backup (JSON)" detail="Complete, re-importable copy of your data" onClick={exportJson} />
        <Row icon={<FileDown size={19} />} title="Export report (Markdown)" detail="Readable profile, plan, logs and journal" onClick={exportMd} />
        <Row icon={<Upload size={19} />} title="Import backup" detail="Replace data on this device from a JSON backup" onClick={() => backupRef.current?.click()} />
        <input ref={backupRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void importBackup(e.target.files?.[0])} />
        <Row
          icon={<HardDrive size={19} />}
          title="Storage"
          detail={`${usage.used != null ? `${(usage.used / 1024 / 1024).toFixed(1)} MB used · ` : ''}${usage.persisted ? 'protected from automatic cleanup' : 'add to Home Screen to protect from cleanup'}${storage.lastSavedAt ? ` · saved ${fmtDateTime(storage.lastSavedAt)}` : ''}`}
        />
        <Row
          icon={<Trash2 size={19} className="text-critical" />}
          title="Erase all data"
          detail="Deletes everything on this device"
          onClick={async () => {
            if (!(await confirmDialog({ title: 'Erase all AuraFit data?', body: 'Your profile, plan, logs, journal and chat are permanently deleted from this device. Export a backup first if you want to keep them.', confirmLabel: 'Erase', danger: true }))) return
            await wipeAll()
            closeSheet()
          }}
        />
      </Group>

      <p className="pb-4 text-center text-[12px] text-ink-3">
        AuraFit {__APP_VERSION__} · works offline · <Database size={11} className="inline" /> local-first
      </p>
    </div>
  )
}

function EditProfile({ done }: { done: () => void }) {
  const profile = useApp((s) => s.profile)!
  const settings = useApp((s) => s.settings)
  const [draft, setDraft] = useState<Profile>(profile)
  return (
    <div>
      <p className="mb-3 text-[13.5px] text-ink-3">Changes rebuild your targets, meals and program. Logged history is kept.</p>
      <ProfileEditor profile={draft} onChange={setDraft} weightUnit={settings.weightUnit} lengthUnit={settings.lengthUnit} />
      <Button
        className="mt-4"
        variant="primary"
        size="lg"
        block
        onClick={() => {
          updateProfile(draft)
          toast('Profile updated, plan rebuilt')
          done()
        }}
      >
        Save & rebuild plan
      </Button>
    </div>
  )
}

function Source() {
  const profile = useApp((s) => s.profile)!
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Button size="sm" icon={<Download size={16} />} onClick={() => downloadText(profile.meta.fileName ?? 'user_profile.md', profile.meta.sourceMarkdown, 'text/markdown')}>
          Download
        </Button>
        <Badge tone="good">{profile.meta.detected.length} values read</Badge>
        {profile.meta.defaulted.length > 0 && <Badge tone="warn">{profile.meta.defaulted.length} estimated</Badge>}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface p-3.5 font-mono text-[12.5px] leading-relaxed text-ink-2">{profile.meta.sourceMarkdown}</pre>
    </div>
  )
}

function Security() {
  const storage = useApp((s) => s.storage)
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [working, setWorking] = useState(false)
  const valid = code.length >= 4 && code === confirm
  const apply = async () => {
    setWorking(true)
    try {
      await setPasscode(code)
      setCode('')
      setConfirm('')
      toast('Passcode set: data re-encrypted')
    } catch (e) {
      toast({ message: (e as Error).message, tone: 'error' })
    } finally {
      setWorking(false)
    }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-4 text-[14px] leading-relaxed text-ink-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <ShieldCheck size={18} className="text-good" /> {storage.encrypted ? 'Encrypted at rest' : 'Encryption unavailable'}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Every document (profile, logs, journal, chat, settings) is sealed with AES-GCM-256 before it's written to IndexedDB.</li>
          <li>{storage.mode === 'passcode' ? 'The key is derived from your passcode (PBKDF2-SHA-256, 600,000 rounds) and only lives in memory while unlocked.' : 'The key is a non-extractable device key: the app can use it, but its bytes can never be read or exported.'}</li>
          <li>No accounts, analytics or trackers. Online lookups send only search terms.</li>
        </ul>
      </div>
      {storage.encrypted && storage.mode !== 'passcode' && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <KeyRound size={17} /> Add a passcode
          </h3>
          <p className="text-[13px] text-ink-3">AuraFit will ask for it each launch. There is no recovery: if you forget it, your data can't be decrypted. Export a backup first.</p>
          <Input label="Passcode" type="password" autoComplete="new-password" inputMode="text" value={code} onChange={(e) => setCode(e.target.value)} hint="At least 4 characters" />
          <Input label="Confirm passcode" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button variant="primary" block disabled={!valid || working} onClick={apply}>
            {working ? 'Encrypting…' : 'Set passcode'}
          </Button>
        </div>
      )}
      {storage.mode === 'passcode' && (
        <div className="space-y-2">
          <Button block icon={<Lock size={18} />} onClick={() => (closeSheet(), void lockNow())}>
            Lock now
          </Button>
          <Button
            block
            variant="danger"
            disabled={working}
            onClick={async () => {
              if (!(await confirmDialog({ title: 'Remove passcode?', body: 'Data stays encrypted with a device key instead.', confirmLabel: 'Remove' }))) return
              setWorking(true)
              await removePasscode()
              setWorking(false)
              toast('Passcode removed')
            }}
          >
            Remove passcode
          </Button>
        </div>
      )}
    </div>
  )
}

function CoachSettings() {
  const cloud = useApp((s) => s.settings.cloudCoach)
  const [key, setKey] = useState(cloud.apiKey)
  const [model, setModel] = useState(cloud.model)
  const save = (patch: Partial<typeof cloud>) => updateSettings({ cloudCoach: { ...useApp.getState().settings.cloudCoach, ...patch } })
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-4 text-[14px] leading-relaxed text-ink-2">
        <p className="font-semibold text-ink">On-device coach (default)</p>
        <p className="mt-1">Answers instantly and offline from your profile, plan, logs and journal. Nothing leaves your phone.</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface px-4 py-2">
        <Switch
          checked={cloud.enabled}
          onChange={(enabled) => save({ enabled })}
          label="Cloud coach (Claude)"
          description="Free-form answers from Claude using your own Anthropic API key. When on, each question plus a summary of your profile, today's logs and recent journal notes is sent directly from this device to Anthropic's API."
        />
        {cloud.enabled && (
          <div className="space-y-3 pb-3">
            <Input
              label="Anthropic API key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value.trim())}
              onBlur={() => save({ apiKey: key })}
              placeholder="sk-ant-…"
              hint="Stored encrypted on this device and never included in backups. Create one at console.anthropic.com."
            />
            <Input label="Model" value={model} onChange={(e) => setModel(e.target.value.trim())} onBlur={() => save({ model: model || DEFAULT_CLOUD_MODEL })} hint={`Default: ${DEFAULT_CLOUD_MODEL}`} spellCheck={false} />
            <Button variant="primary" block onClick={() => (save({ apiKey: key, model: model || DEFAULT_CLOUD_MODEL }), toast('Coach settings saved'))}>
              Save
            </Button>
            <p className="text-[12.5px] text-ink-3">Offline, or if the API is unreachable, the on-device coach answers instead. Safety questions and quick logging ("I drank 500 ml") are always handled on-device.</p>
          </div>
        )}
      </div>
    </div>
  )
}

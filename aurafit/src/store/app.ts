import { create } from 'zustand'
import { Vault, type KeyMode } from '../db/vault'
import { today, weekdayOf, type ISODate } from '../lib/dates'
import { uid } from '../lib/utils'
import { generatePlan, regenerateMeals, regenerateProgram } from '../engine/plan'
import { registerFoods } from '../engine/nutrition'
import { suggestWeight } from '../engine/programBuilder'
import { EXERCISE_BY_ID } from '../data/exercises'
import type {
  ChatMessage,
  ChatState,
  DayLog,
  Food,
  FoodLibrary,
  FoodLogItem,
  JournalEntry,
  Measurements,
  Plan,
  Profile,
  ProgramDay,
  SessionExercise,
  Settings,
  WorkoutSession,
} from '../types'

/**
 * Single source of truth. State lives in memory (every tap updates instantly) and each
 * changed document is written behind, encrypted, within ~50 ms; the queue is flushed again
 * on pagehide / visibilitychange so nothing is lost when iOS suspends the app.
 */

export const DEFAULT_CLOUD_MODEL = 'claude-opus-5-5'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  weightUnit: 'kg',
  lengthUnit: 'cm',
  online: true,
  sound: true,
  cloudCoach: { enabled: false, apiKey: '', model: DEFAULT_CLOUD_MODEL },
}

export interface AppData {
  profile?: Profile
  plan?: Plan
  settings: Settings
  days: Record<ISODate, DayLog>
  journal: Record<string, JournalEntry>
  chat: ChatState
  foods: FoodLibrary
}

export type Phase = 'loading' | 'locked' | 'setup' | 'ready' | 'error'

export interface StorageInfo {
  mode: KeyMode
  encrypted: boolean
  saving: boolean
  lastSavedAt?: number
  error?: string
}

export interface AppState extends AppData {
  phase: Phase
  bootError?: string
  storage: StorageInfo
}

const emptyData = (): AppData => ({
  settings: { ...DEFAULT_SETTINGS },
  days: {},
  journal: {},
  chat: { messages: [], cloud: [] },
  foods: { custom: [], recents: [] },
})

export const useApp = create<AppState>(() => ({
  ...emptyData(),
  phase: 'loading',
  storage: { mode: 'device', encrypted: true, saving: false },
}))

const get = useApp.getState
const set = useApp.setState

/* ------------------------------------------------------------------ persistence */

let vault: Vault | undefined
const pending = new Map<string, unknown>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushing: Promise<void> = Promise.resolve()

function docKey(kind: 'day' | 'journal', id: string) {
  return `${kind}:${id}`
}

/** Snapshot of all documents in storage form. */
function allDocs(state: AppData = get()): Map<string, unknown> {
  const docs = new Map<string, unknown>()
  if (state.profile) docs.set('profile', state.profile)
  if (state.plan) docs.set('plan', state.plan)
  docs.set('settings', state.settings)
  docs.set('chat', state.chat)
  docs.set('foods', state.foods)
  for (const d of Object.values(state.days)) docs.set(docKey('day', d.date), d)
  for (const j of Object.values(state.journal)) docs.set(docKey('journal', j.id), j)
  return docs
}

function persist(key: string, value: unknown) {
  pending.set(key, value)
  if (!get().storage.saving) set((s) => ({ storage: { ...s.storage, saving: true } }))
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void flush()
  }, 50)
}

export function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  flushing = flushing.then(async () => {
    if (!pending.size || !vault || vault.locked) return
    const batch = [...pending.entries()]
    pending.clear()
    try {
      await vault.write(batch)
      set((s) => ({ storage: { ...s.storage, saving: pending.size > 0, lastSavedAt: Date.now(), error: undefined } }))
    } catch (err) {
      // Keep the unsaved docs queued (newer values win) and surface the problem.
      for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v)
      set((s) => ({ storage: { ...s.storage, saving: false, error: err instanceof Error ? err.message : String(err) } }))
    }
  })
  return flushing
}

function hydrate(docs: Map<string, unknown>): AppData {
  const data = emptyData()
  for (const [k, v] of docs) {
    if (k === 'profile') data.profile = v as Profile
    else if (k === 'plan') data.plan = v as Plan
    else if (k === 'settings') data.settings = { ...DEFAULT_SETTINGS, ...(v as Settings), cloudCoach: { ...DEFAULT_SETTINGS.cloudCoach, ...(v as Settings).cloudCoach } }
    else if (k === 'chat') data.chat = Object.assign({ messages: [], cloud: [] }, v as ChatState)
    else if (k === 'foods') data.foods = Object.assign({ custom: [], recents: [] }, v as FoodLibrary)
    else if (k.startsWith('day:')) data.days[(v as DayLog).date] = v as DayLog
    else if (k.startsWith('journal:')) data.journal[(v as JournalEntry).id] = v as JournalEntry
  }
  registerFoods(data.foods.custom)
  return data
}

export async function boot(): Promise<void> {
  try {
    vault = await Vault.open()
  } catch (err) {
    set({ phase: 'error', bootError: err instanceof Error ? err.message : String(err) })
    return
  }
  set({ storage: { mode: vault.mode, encrypted: vault.encrypted, saving: false } })
  if (vault.locked) {
    set({ phase: 'locked' })
    return
  }
  await loadFromVault()
}

async function loadFromVault() {
  const data = hydrate(await vault!.loadAll())
  set({ ...data, phase: data.profile && data.plan ? 'ready' : 'setup' })
  rememberTheme(data.settings.theme)
  // Ask the browser not to evict our storage under pressure (installed PWAs usually get it).
  void navigator.storage?.persist?.().catch(() => undefined)
}

export async function unlock(passcode: string): Promise<boolean> {
  if (!vault) return false
  const ok = await vault.unlock(passcode)
  if (ok) await loadFromVault()
  return ok
}

export async function lockNow() {
  if (!vault || vault.mode !== 'passcode') return
  await flush()
  vault.lock()
  set({ ...emptyData(), phase: 'locked' })
}

export async function setPasscode(passcode: string) {
  if (!vault) return
  await flush()
  await vault.setPasscode(passcode, allDocs())
  set((s) => ({ storage: { ...s.storage, mode: vault!.mode, encrypted: vault!.encrypted } }))
}

export async function removePasscode() {
  if (!vault) return
  await flush()
  await vault.removePasscode(allDocs())
  set((s) => ({ storage: { ...s.storage, mode: vault!.mode, encrypted: vault!.encrypted } }))
}

export async function wipeAll() {
  pending.clear()
  await vault?.wipe()
  set({ ...emptyData(), phase: 'setup', storage: { mode: vault?.mode ?? 'device', encrypted: vault?.encrypted ?? true, saving: false } })
}

/** Replace everything with imported data (backup restore). */
export async function replaceAll(data: Partial<AppData>) {
  const next: AppData = { ...emptyData(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } }
  // Keep this device's API key: backups never carry it.
  next.settings.cloudCoach = { ...next.settings.cloudCoach, apiKey: get().settings.cloudCoach.apiKey }
  registerFoods(next.foods.custom)
  pending.clear()
  if (vault) {
    await vault.wipe()
    await vault.write([...allDocs(next).entries()])
  }
  set({ ...next, phase: next.profile && next.plan ? 'ready' : 'setup' })
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

/* ------------------------------------------------------------------ settings */

export function rememberTheme(theme: Settings['theme']) {
  try {
    localStorage.setItem('aurafit:theme', theme)
  } catch {
    // Storage blocked: theme just follows the system next launch.
  }
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...get().settings, ...patch }
  set({ settings })
  persist('settings', settings)
  if (patch.theme) rememberTheme(patch.theme)
}

/* ------------------------------------------------------------------ profile & plan */

export function importProfile(profile: Profile, plan: Plan = generatePlan(profile)) {
  set({ profile, plan, phase: 'ready' })
  persist('profile', profile)
  persist('plan', plan)
}

/** Edits a profile value and re-derives the plan with the same seed (keeps logs). */
export function updateProfile(patch: Partial<Profile>) {
  const { profile, plan } = get()
  if (!profile) return
  const next = { ...profile, ...patch }
  const nextPlan = generatePlan(next, plan?.seed)
  set({ profile: next, plan: nextPlan })
  persist('profile', next)
  persist('plan', nextPlan)
}

export function reshuffleMeals() {
  const { profile, plan } = get()
  if (!profile || !plan) return
  const next = regenerateMeals(profile, plan)
  set({ plan: next })
  persist('plan', next)
}

export function reshuffleProgram() {
  const { profile, plan } = get()
  if (!profile || !plan) return
  const next = regenerateProgram(profile, plan)
  set({ plan: next })
  persist('plan', next)
}

/** Permanently replace a planned exercise in the program ("always use this swap"). */
export function replaceProgramExercise(weekday: ProgramDay['weekday'], fromId: string, toId: string) {
  const { plan } = get()
  if (!plan) return
  const days = plan.program.days.map((d) =>
    d.weekday === weekday ? { ...d, exercises: d.exercises.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: toId } : e)) } : d,
  )
  const next = { ...plan, program: { ...plan.program, days } }
  set({ plan: next })
  persist('plan', next)
}

/* ------------------------------------------------------------------ day logs */

export function emptyDay(date: ISODate): DayLog {
  return { date, planned: {}, foods: [], water: [], workouts: [], updatedAt: Date.now() }
}

export function getDay(date: ISODate): DayLog | undefined {
  return get().days[date]
}

/** Immutable update of one day's log; returns the previous version for undo. */
export function updateDay(date: ISODate, fn: (d: DayLog) => DayLog): DayLog | undefined {
  const prev = get().days[date]
  const next = { ...fn(prev ?? emptyDay(date)), updatedAt: Date.now() }
  set((s) => ({ days: { ...s.days, [date]: next } }))
  persist(docKey('day', date), next)
  return prev
}

export function restoreDay(date: ISODate, snapshot: DayLog | undefined) {
  set((s) => {
    const days = { ...s.days }
    if (snapshot) days[date] = snapshot
    else delete days[date]
    return { days }
  })
  persist(docKey('day', date), snapshot)
}

export function toggleMeal(date: ISODate, plannedId: string, eaten?: boolean) {
  return updateDay(date, (d) => {
    const cur = d.planned[plannedId] ?? {}
    return { ...d, planned: { ...d.planned, [plannedId]: { ...cur, eaten: eaten ?? !cur.eaten } } }
  })
}

export function swapMeal(date: ISODate, plannedId: string, recipeId: string) {
  return updateDay(date, (d) => ({ ...d, planned: { ...d.planned, [plannedId]: { ...d.planned[plannedId], recipeId } } }))
}

export function addFood(date: ISODate, item: Omit<FoodLogItem, 'id' | 'at'>) {
  const full: FoodLogItem = { ...item, id: uid(), at: Date.now() }
  updateDay(date, (d) => ({ ...d, foods: [...d.foods, full] }))
  if (item.foodId && item.qty) {
    const foods = get().foods
    const recents = [{ foodId: item.foodId, qty: item.qty, section: item.section, at: Date.now() }, ...foods.recents.filter((r) => r.foodId !== item.foodId)].slice(0, 30)
    const next = { ...foods, recents }
    set({ foods: next })
    persist('foods', next)
  }
  return full
}

export function removeFood(date: ISODate, id: string) {
  return updateDay(date, (d) => ({ ...d, foods: d.foods.filter((f) => f.id !== id) }))
}

export function addWater(date: ISODate, ml: number) {
  return updateDay(date, (d) => ({ ...d, water: [...d.water, { at: Date.now(), ml }] }))
}

export function undoWater(date: ISODate) {
  return updateDay(date, (d) => ({ ...d, water: d.water.slice(0, -1) }))
}

export function setWeight(date: ISODate, kg: number | undefined) {
  return updateDay(date, (d) => ({ ...d, weightKg: kg == null ? undefined : Math.round(kg * 100) / 100 }))
}

export function setMeasurements(date: ISODate, m: Partial<Measurements> | undefined) {
  return updateDay(date, (d) => ({ ...d, measurements: m && Object.keys(m).length ? m : undefined }))
}

export function setLighter(date: ISODate, lighter: boolean) {
  updateDay(date, (d) => ({ ...d, lighter }))
  // Retune an unfinished session that's already running.
  const day = get().days[date]
  const active = day?.workouts.find((w) => !w.finishedAt)
  if (active) updateSession(date, active.id, (w) => applyIntensity(w, lighter ? 'light' : 'normal'))
}

export function saveCustomFood(food: Food) {
  const foods = get().foods
  const custom = [food, ...foods.custom.filter((f) => f.id !== food.id)].slice(0, 300)
  const next = { ...foods, custom }
  registerFoods(custom)
  set({ foods: next })
  persist('foods', next)
}

/* ------------------------------------------------------------------ workouts */

export function allSessions(): WorkoutSession[] {
  return Object.values(get().days)
    .flatMap((d) => d.workouts)
    .sort((a, b) => b.startedAt - a.startedAt)
}

function applyIntensity(w: WorkoutSession, intensity: WorkoutSession['intensity']): WorkoutSession {
  if (w.intensity === intensity) return w
  const exercises = w.exercises.map((e) => {
    const doneCount = e.sets.filter((s) => s.done).length
    if (intensity === 'light') {
      // One fewer set (min 2) and ~80% load for the sets still to do.
      const keep = Math.max(2, e.sets.length - 1, doneCount)
      return { ...e, sets: e.sets.slice(0, keep).map((s) => (s.done || s.weightKg == null ? s : { ...s, weightKg: Math.round(s.weightKg * 0.8 * 2) / 2 })) }
    }
    return e
  })
  return { ...w, intensity, exercises }
}

export function startWorkout(date: ISODate, day: ProgramDay, opts: { light?: boolean } = {}): WorkoutSession {
  const existing = get().days[date]?.workouts.find((w) => !w.finishedAt)
  if (existing) return existing
  const history = allSessions()
  const light = opts.light ?? !!get().days[date]?.lighter
  const exercises: SessionExercise[] = day.exercises.map((pe) => {
    const ex = EXERCISE_BY_ID.get(pe.exerciseId)
    const weight = pe.timed ? undefined : suggestWeight(pe.exerciseId, history, pe.repsMax, light)
    const sets = light ? Math.max(2, pe.sets - 1) : pe.sets
    return {
      uid: uid(),
      exerciseId: pe.exerciseId,
      name: ex?.name ?? pe.exerciseId,
      repsMin: pe.repsMin,
      repsMax: pe.repsMax,
      restSec: pe.restSec,
      timed: pe.timed,
      sets: Array.from({ length: sets }, () => ({ weightKg: weight, done: false })),
    }
  })
  const session: WorkoutSession = {
    id: uid(),
    date,
    weekday: weekdayOf(date),
    title: day.title,
    focus: day.focus,
    startedAt: Date.now(),
    intensity: light ? 'light' : 'normal',
    exercises,
    cardio: day.cardio && day.kind !== 'strength' ? { activity: day.cardio.activity, minutes: day.cardio.minutes, done: false } : undefined,
  }
  updateDay(date, (d) => ({ ...d, workouts: [...d.workouts, session] }))
  return session
}

export function updateSession(date: ISODate, id: string, fn: (w: WorkoutSession) => WorkoutSession) {
  updateDay(date, (d) => ({ ...d, workouts: d.workouts.map((w) => (w.id === id ? fn(w) : w)) }))
}

export function finishWorkout(date: ISODate, id: string) {
  updateSession(date, id, (w) => ({ ...w, finishedAt: Date.now() }))
}

export function discardWorkout(date: ISODate, id: string) {
  return updateDay(date, (d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) }))
}

/* ------------------------------------------------------------------ journal */

export function upsertJournal(entry: JournalEntry) {
  const next = { ...entry, updatedAt: Date.now() }
  set((s) => ({ journal: { ...s.journal, [entry.id]: next } }))
  persist(docKey('journal', entry.id), next)
  return next
}

export function deleteJournal(id: string) {
  const prev = get().journal[id]
  set((s) => {
    const journal = { ...s.journal }
    delete journal[id]
    return { journal }
  })
  persist(docKey('journal', id), undefined)
  return prev
}

export function newJournalEntry(date: ISODate = today()): JournalEntry {
  const now = Date.now()
  return { id: uid(), date, createdAt: now, updatedAt: now, body: '' }
}

/** The single check-in entry for a date (created on first use). */
export function journalForDate(date: ISODate): JournalEntry | undefined {
  return Object.values(get().journal)
    .filter((j) => j.date === date)
    .sort((a, b) => a.createdAt - b.createdAt)[0]
}

/* ------------------------------------------------------------------ chat */

export function pushChat(msg: Omit<ChatMessage, 'id' | 'at'> & { id?: string }): ChatMessage {
  const full: ChatMessage = { at: Date.now(), ...msg, id: msg.id ?? uid() }
  const chat = { ...get().chat, messages: [...get().chat.messages, full].slice(-300) }
  set({ chat })
  persist('chat', chat)
  return full
}

export function patchChat(id: string, patch: Partial<ChatMessage>) {
  const chat = { ...get().chat, messages: get().chat.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
  set({ chat })
  persist('chat', chat)
}

export function setCloudHistory(cloud: unknown[]) {
  const chat = { ...get().chat, cloud }
  set({ chat })
  persist('chat', chat)
}

export function clearChat() {
  const chat: ChatState = { messages: [], cloud: [] }
  set({ chat })
  persist('chat', chat)
}

/** Snapshot used by backups. */
export function snapshot(): AppData {
  const { profile, plan, settings, days, journal, chat, foods } = get()
  return { profile, plan, settings, days, journal, chat, foods }
}

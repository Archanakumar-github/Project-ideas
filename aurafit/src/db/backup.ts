import { RECIPE_BY_ID } from '../data/recipes'
import { EXERCISE_BY_ID } from '../data/exercises'
import { WEEKDAY_LABEL, fmtDateTime } from '../lib/dates'
import { fmtNum } from '../lib/utils'
import { dayTotals, waterTotal } from '../engine/insights'
import type { AppData } from '../store/app'

/**
 * Data ownership: full JSON backups (lossless, re-importable) and a readable Markdown
 * report. Backups are plain text, so the API key for the optional cloud coach is never
 * included.
 */

export const BACKUP_FORMAT = 'aurafit-backup'
export const BACKUP_VERSION = 1

export interface Backup extends AppData {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  app: { name: 'AuraFit'; version: string }
}

export function toBackup(data: AppData, appVersion = '1.0.0'): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: 'AuraFit', version: appVersion },
    ...data,
    settings: { ...data.settings, cloudCoach: { ...data.settings.cloudCoach, apiKey: '' } },
  }
}

export function backupFileName(ext: 'json' | 'md', date = new Date()) {
  const d = date.toISOString().slice(0, 10)
  return ext === 'json' ? `aurafit-backup-${d}.json` : `aurafit-report-${d}.md`
}

export class BackupError extends Error {}

/** Validates a backup file's shape; throws BackupError with a readable message. */
export function parseBackup(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not valid JSON.')
  }
  const b = raw as Partial<Backup>
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) throw new BackupError('That file is not an AuraFit backup.')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of AuraFit.')
  const isObj = (v: unknown) => v != null && typeof v === 'object' && !Array.isArray(v)
  if (b.days != null && !isObj(b.days)) throw new BackupError('Backup "days" section is malformed.')
  if (b.journal != null && !isObj(b.journal)) throw new BackupError('Backup "journal" section is malformed.')
  const days = Object.fromEntries(
    Object.entries(b.days ?? {}).filter(([k, d]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(d)).map(([k, d]) => [k, Object.assign({ planned: {}, foods: [], water: [], workouts: [] }, d, { date: k })]),
  )
  const journal = Object.fromEntries(Object.entries(b.journal ?? {}).filter(([, j]) => isObj(j) && typeof (j as { body?: unknown }).body === 'string'))
  return {
    profile: b.profile,
    plan: b.plan,
    settings: b.settings!,
    days: days as AppData['days'],
    journal: journal as AppData['journal'],
    chat: b.chat ?? { messages: [], cloud: [] },
    foods: b.foods ?? { custom: [], recents: [] },
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** A human-readable report of everything: profile, plan, logs and journal. */
export function toMarkdownReport(data: AppData): string {
  const { profile: p, plan } = data
  const out: string[] = []
  out.push(`# AuraFit report${p?.name ? `: ${p.name}` : ''}`, '', `_Exported ${fmtDateTime(Date.now())}_`, '')
  if (p) {
    out.push('## Profile', '')
    out.push(`- Age: ${p.age}`, `- Sex: ${p.sex}`, `- Height: ${p.heightCm} cm`, `- Weight: ${p.weightKg} kg`)
    if (p.targetWeightKg) out.push(`- Target weight: ${p.targetWeightKg} kg${p.targetDate ? ` by ${p.targetDate}` : ''}`)
    out.push(`- Goal: ${p.goal.replace(/_/g, ' ')}`, `- Activity: ${p.activity.replace('_', ' ')}`)
    if (p.diet.styles.length) out.push(`- Diet: ${p.diet.styles.join(', ')}`)
    if (p.diet.allergies.length) out.push(`- Allergies / intolerances: ${p.diet.allergies.join(', ')}`)
    if (p.diet.avoid.length) out.push(`- Avoid: ${p.diet.avoid.join(', ')}`)
    out.push(`- Training: ${p.training.days.map((d) => WEEKDAY_LABEL[d]).join(', ')} · ${p.training.sessionMinutes} min · ${p.training.experience}`)
    out.push('')
  }
  if (plan) {
    const t = plan.targets
    out.push('## Daily targets', '', '| Target | Value |', '|---|---|')
    out.push(`| Calories | ${fmtNum(t.calories)} kcal |`, `| Protein | ${t.proteinG} g |`, `| Carbs | ${t.carbsG} g |`, `| Fat | ${t.fatG} g |`, `| Fibre | ${t.fiberG} g |`, `| Water | ${t.waterMl} ml |`, `| Steps | ${fmtNum(t.steps)} |`, '')
    out.push('### How these were calculated', '', ...plan.notes.map((n) => `- ${n}`), '')
    out.push('## Meal plan', '')
    for (const day of plan.meals) {
      out.push(`### ${WEEKDAY_LABEL[day.weekday]}`, '')
      for (const m of day.meals) out.push(`- **${m.section}** (${m.time ?? ''}): ${RECIPE_BY_ID.get(m.recipeId)?.name ?? m.recipeId} · ~${m.targetKcal} kcal`)
      out.push('')
    }
    out.push('## Training program', '', `_${plan.program.name}_`, '')
    for (const d of plan.program.days) {
      out.push(`### ${WEEKDAY_LABEL[d.weekday]}: ${d.title}`, '')
      if (d.exercises.length) {
        for (const e of d.exercises) out.push(`- ${EXERCISE_BY_ID.get(e.exerciseId)?.name ?? e.exerciseId}: ${e.sets} × ${e.repsMin}–${e.repsMax}${e.timed ? ' s' : ''}, rest ${e.restSec}s`)
      } else if (d.cardio) out.push(`- ${d.cardio.activity} · ${d.cardio.minutes} min (${d.cardio.intensity})`)
      out.push('')
    }
  }
  const days = Object.values(data.days).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length) {
    out.push('## Daily log', '', '| Date | kcal | Protein | Water | Weight | Workouts |', '|---|---|---|---|---|---|')
    for (const d of days) {
      const t = dayTotals(plan, d)
      const w = d.workouts.filter((x) => x.finishedAt).map((x) => x.title).join(', ')
      out.push(`| ${d.date} | ${Math.round(t.kcal)} | ${Math.round(t.p)} g | ${waterTotal(d)} ml | ${d.weightKg != null ? `${round1(d.weightKg)} kg` : ''} | ${w} |`)
    }
    out.push('')
    const measured = days.filter((d) => d.measurements)
    if (measured.length) {
      out.push('## Measurements (cm, body fat %)', '', '| Date | Neck | Chest | Arms | Waist | Hips | Thighs | Calves | Body fat |', '|---|---|---|---|---|---|---|---|---|')
      for (const d of measured) {
        const m = d.measurements!
        out.push(`| ${d.date} | ${m.neck ?? ''} | ${m.chest ?? ''} | ${m.arms ?? ''} | ${m.waist ?? ''} | ${m.hips ?? ''} | ${m.thighs ?? ''} | ${m.calves ?? ''} | ${m.bodyFat ?? ''} |`)
      }
      out.push('')
    }
    const sessions = days.flatMap((d) => d.workouts.filter((w) => w.finishedAt))
    if (sessions.length) {
      out.push('## Workouts', '')
      for (const s of sessions) {
        out.push(`### ${s.date}: ${s.title}${s.intensity === 'light' ? ' (lighter)' : ''}`, '')
        for (const e of s.exercises) {
          const sets = e.sets.filter((x) => x.done).map((x) => `${x.weightKg != null ? `${x.weightKg} kg × ` : ''}${x.reps ?? '–'}${e.timed ? ' s' : ''}`)
          if (sets.length) out.push(`- ${e.name}: ${sets.join(', ')}`)
        }
        out.push('')
      }
    }
  }
  const journal = Object.values(data.journal).sort((a, b) => a.createdAt - b.createdAt)
  if (journal.length) {
    out.push('## Journal', '')
    for (const j of journal) {
      const meta = [j.energy != null && `energy ${j.energy}/5`, j.soreness != null && `soreness ${j.soreness}/5`, j.mood != null && `mood ${j.mood}/5`, j.sleepHours != null && `sleep ${j.sleepHours} h`].filter(Boolean).join(' · ')
      out.push(`### ${j.date} · ${fmtDateTime(j.createdAt)}`, '')
      if (meta) out.push(`_${meta}_`, '')
      if (j.body.trim()) out.push(j.body.trim(), '')
    }
  }
  return out.join('\n')
}

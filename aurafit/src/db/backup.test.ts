import { describe, expect, it } from 'vitest'
import { BackupError, parseBackup, toBackup, toMarkdownReport } from './backup'
import { generatePlan } from '../engine/plan'
import { exampleProfile } from '../test/factories'
import { DEFAULT_SETTINGS, type AppData } from '../store/app'

function data(): AppData {
  const profile = exampleProfile()
  return {
    profile,
    plan: generatePlan(profile, 1),
    settings: { ...DEFAULT_SETTINGS, cloudCoach: { enabled: true, apiKey: 'sk-ant-secret', model: 'm' } },
    days: { '2026-10-01': { date: '2026-10-01', planned: {}, foods: [], water: [{ at: 1, ml: 500 }], workouts: [], weightKg: 73.6, measurements: { waist: 81 }, updatedAt: 1 } },
    journal: { j: { id: 'j', date: '2026-10-01', createdAt: 1, updatedAt: 1, body: '**Felt strong**', energy: 4 } },
    chat: { messages: [], cloud: [] },
    foods: { custom: [], recents: [] },
  }
}

describe('backups', () => {
  it('round-trips through JSON without the API key', () => {
    const json = JSON.stringify(toBackup(data()))
    expect(json).not.toContain('sk-ant-secret')
    const restored = parseBackup(json)
    expect(restored.profile?.name).toBe('Alex Rivera')
    expect(restored.days['2026-10-01'].weightKg).toBe(73.6)
    expect(restored.journal.j.body).toBe('**Felt strong**')
    expect(restored.settings.cloudCoach.apiKey).toBe('')
  })

  it('rejects files that are not AuraFit backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not an AuraFit backup/)
    expect(() => parseBackup(JSON.stringify({ ...toBackup(data()), version: 99 }))).toThrow(/newer version/)
  })

  it('writes a readable Markdown report', () => {
    const md = toMarkdownReport(data())
    for (const heading of ['# AuraFit report: Alex Rivera', '## Daily targets', '## Meal plan', '## Training program', '## Daily log', '## Measurements', '## Journal']) expect(md).toContain(heading)
    expect(md).toContain('| 2026-10-01 |')
    expect(md).toContain('**Felt strong**')
  })
})

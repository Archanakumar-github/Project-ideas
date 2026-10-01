import { readFileSync } from 'node:fs'
import { parseProfileMarkdown } from '../engine/profileParser'
import type { Profile } from '../types'

export const NOW = new Date(2026, 9, 1, 12, 0)

export function exampleProfile(): Profile {
  return parseProfileMarkdown(readFileSync('user_profile.example.md', 'utf8'), { now: NOW })
}

/** A plain profile with overrides, for focused engine tests. */
export function makeProfile(patch: Partial<Profile> = {}, md = '# Test\n- Age: 30\n- Sex: male\n- Height: 180 cm\n- Weight: 80 kg\n- Goal: maintain\n- Activity: moderate\n- Training days: Mon, Wed, Fri\n- Equipment: full gym'): Profile {
  const base = parseProfileMarkdown(md, { now: NOW })
  return {
    ...base,
    ...patch,
    diet: { ...base.diet, ...patch.diet },
    training: { ...base.training, ...patch.training },
    macros: { ...base.macros, ...patch.macros },
    lifestyle: { ...base.lifestyle, ...patch.lifestyle },
  }
}

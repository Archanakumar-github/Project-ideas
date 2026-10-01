import type { ActivityLevel, GoalType, Profile, Targets } from '../types'
import { clamp, round } from '../lib/utils'

/**
 * Daily targets from the profile, with every step recorded in `method.notes` so the app
 * (and the coach) can explain exactly where a number came from.
 *
 *  BMR: Katch-McArdle when body-fat % is known, otherwise Mifflin-St Jeor.
 *  TDEE: BMR × (daily-life factor + 0.035 per weekly training session).
 *  Goal: deficit / surplus from the requested weekly rate, capped for safety.
 *  Macros: explicit values from the file win; otherwise protein by goal (g/kg),
 *  fat by % of calories, carbs fill the rest.
 */

const NEAT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.3,
  moderate: 1.4,
  active: 1.5,
  very_active: 1.65,
}

const PROTEIN_PER_KG: Record<GoalType, number> = {
  lose_fat: 2.0,
  recomp: 2.0,
  build_muscle: 1.8,
  strength: 1.8,
  endurance: 1.5,
  maintain: 1.6,
  general_health: 1.4,
}

const DEFAULT_RATE: Partial<Record<GoalType, number>> = {
  lose_fat: -0.5,
  build_muscle: 0.25,
}

export function bmrMifflin(p: Pick<Profile, 'weightKg' | 'heightCm' | 'age' | 'sex'>) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return base + (p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78)
}

export function bmrKatch(weightKg: number, bodyFatPct: number) {
  return 370 + 21.6 * weightKg * (1 - bodyFatPct / 100)
}

export function computeTargets(p: Profile): Targets {
  const notes: string[] = []
  const sources: Targets['method']['sources'] = {
    calories: 'calculated',
    protein: 'calculated',
    carbs: 'calculated',
    fat: 'calculated',
    water: 'calculated',
    steps: 'calculated',
  }

  const useKatch = p.bodyFatPct != null && p.bodyFatPct > 3 && p.bodyFatPct < 60
  const bmr = useKatch ? bmrKatch(p.weightKg, p.bodyFatPct!) : bmrMifflin(p)
  notes.push(
    useKatch
      ? `BMR ${Math.round(bmr)} kcal (Katch-McArdle, using ${p.bodyFatPct}% body fat).`
      : `BMR ${Math.round(bmr)} kcal (Mifflin-St Jeor${p.sex === 'unspecified' ? ', sex-averaged' : ''}).`,
  )

  const strengthSessions = p.training.days.length
  const activityFactor = round(NEAT[p.activity] + 0.035 * strengthSessions, 0.005)
  const tdee = bmr * activityFactor
  notes.push(`Maintenance ≈ ${Math.round(tdee)} kcal: ${p.activity.replace('_', ' ')} lifestyle (×${NEAT[p.activity]}) + ${strengthSessions} training sessions a week (+${(0.035 * strengthSessions).toFixed(2)}).`)

  // Weekly rate: explicit, else from target weight + date, else goal default.
  let rate = p.weeklyRateKg
  if (rate == null && p.targetWeightKg && p.targetDate) {
    const weeks = (new Date(p.targetDate).getTime() - p.meta.importedAt) / (7 * 86_400_000)
    if (weeks > 1) rate = (p.targetWeightKg - p.weightKg) / weeks
  }
  rate ??= DEFAULT_RATE[p.goal] ?? 0
  const maxLoss = -Math.min(1, p.weightKg * 0.01)
  if (rate < maxLoss) {
    notes.push(`Requested pace capped at ${Math.abs(maxLoss).toFixed(2)} kg/week (1% of body weight) to protect muscle.`)
    rate = maxLoss
  }
  if (rate > 0.5) rate = 0.5
  if (p.goal === 'maintain' || p.goal === 'general_health' || p.goal === 'endurance') rate = p.weeklyRateKg ?? 0

  let adjustment = (rate * 7700) / 7
  if (p.goal === 'recomp') adjustment = -0.1 * tdee
  if (p.goal === 'strength' && rate === 0) adjustment = 0.05 * tdee
  adjustment = clamp(adjustment, -0.25 * tdee, 0.15 * tdee)

  const floor = p.sex === 'male' ? 1500 : p.sex === 'female' ? 1200 : 1350
  let calories = tdee + adjustment
  if (calories < Math.max(floor, bmr * 0.95)) {
    calories = Math.max(floor, bmr * 0.95)
    notes.push(`Calories held at a safe minimum of ${Math.round(calories)} kcal.`)
  }
  if (Math.round(adjustment)) {
    notes.push(`${adjustment < 0 ? 'Deficit' : 'Surplus'} of ${Math.abs(Math.round(adjustment))} kcal/day for ${rate > 0 ? '+' : ''}${rate.toFixed(2)} kg/week.`)
  }

  const m = p.macros
  if (m.calories) {
    calories = m.calories
    sources.calories = 'profile'
    notes.push(`Calories set to ${m.calories} kcal from your profile.`)
  } else if (m.proteinG && m.carbsG && m.fatG) {
    calories = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9
    sources.calories = 'profile'
    notes.push('Calories derived from the protein, carb and fat grams in your profile.')
  }
  calories = round(calories, 10)

  // Protein
  const bmi = p.weightKg / (p.heightCm / 100) ** 2
  let referenceWeightKg = p.weightKg
  if (bmi > 30) {
    referenceWeightKg = p.targetWeightKg ?? 25 * (p.heightCm / 100) ** 2
    notes.push(`Protein is based on a reference weight of ${referenceWeightKg.toFixed(0)} kg rather than current weight (BMI ${bmi.toFixed(0)}).`)
  }
  let protein: number
  if (m.proteinG) {
    protein = m.proteinG
    sources.protein = 'profile'
  } else if (m.proteinPerKg) {
    protein = m.proteinPerKg * referenceWeightKg
    sources.protein = 'profile'
  } else if (m.proteinPct) {
    protein = (calories * m.proteinPct) / 100 / 4
    sources.protein = 'profile'
  } else {
    const perKg = PROTEIN_PER_KG[p.goal] + (p.diet.styles.includes('high_protein') ? 0.2 : 0)
    protein = perKg * referenceWeightKg
    notes.push(`Protein ${perKg.toFixed(1)} g/kg for your goal.`)
  }
  protein = Math.min(protein, (calories * 0.4) / 4)

  // Fat
  const styles = p.diet.styles
  const fatPct = m.fatPct ?? (styles.includes('keto') ? 70 : styles.includes('low_carb') ? 40 : styles.includes('mediterranean') ? 35 : 28)
  let fat = m.fatG ?? (calories * fatPct) / 100 / 9
  if (m.fatG || m.fatPct) sources.fat = 'profile'
  fat = Math.max(fat, 0.6 * referenceWeightKg)

  // Carbs: explicit, else whatever is left.
  let carbs: number
  if (m.carbsG) {
    carbs = m.carbsG
    sources.carbs = 'profile'
  } else if (m.carbsPct) {
    carbs = (calories * m.carbsPct) / 100 / 4
    sources.carbs = 'profile'
  } else {
    carbs = (calories - protein * 4 - fat * 9) / 4
    const cap = styles.includes('keto') ? 30 : styles.includes('low_carb') ? 100 : Infinity
    if (carbs > cap) {
      carbs = cap
      if (!m.fatG) fat = (calories - protein * 4 - carbs * 4) / 9
    }
    if (carbs < 20) {
      carbs = 20
      if (!m.fatG) fat = Math.max(0.5 * referenceWeightKg, (calories - protein * 4 - carbs * 4) / 9)
    }
  }

  const fiber = m.fiberG ?? Math.max(25, Math.round((calories / 1000) * 14))

  let waterMl = m.waterMl
  if (waterMl) sources.water = 'profile'
  else waterMl = clamp(round(p.weightKg * 35, 250), 2000, 4500)

  let steps = p.lifestyle.stepsGoal
  if (steps) sources.steps = 'profile'
  else steps = p.goal === 'lose_fat' ? 9000 : p.activity === 'sedentary' ? 7000 : 8000

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    proteinG: Math.round(protein),
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
    fiberG: fiber,
    waterMl,
    trainingDayWaterBonusMl: 500,
    steps,
    sleepHours: clamp(Math.max(7, p.lifestyle.sleepHours), 7, 9),
    weeklyRateKg: Math.round(rate * 100) / 100,
    method: {
      bmrFormula: useKatch ? 'katch' : 'mifflin',
      activityFactor,
      adjustmentKcal: Math.round(adjustment),
      referenceWeightKg: Math.round(referenceWeightKg),
      sources,
      notes,
    },
  }
}

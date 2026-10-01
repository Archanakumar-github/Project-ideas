import type { ISODate, Weekday } from './lib/dates'

/* ------------------------------------------------------------------ profile (from user_profile.md) */

export type Sex = 'male' | 'female' | 'unspecified'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalType = 'lose_fat' | 'build_muscle' | 'recomp' | 'strength' | 'endurance' | 'maintain' | 'general_health'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Equipment =
  | 'full_gym'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'band'
  | 'bodyweight'
  | 'pullup_bar'
  | 'bench'
  | 'cardio_machine'
export type DietStyle =
  | 'vegan'
  | 'vegetarian'
  | 'pescatarian'
  | 'keto'
  | 'low_carb'
  | 'mediterranean'
  | 'paleo'
  | 'high_protein'
  | 'halal'
  | 'kosher'
  | 'jain'
export type Allergen = 'gluten' | 'dairy' | 'lactose' | 'nuts' | 'peanut' | 'soy' | 'egg' | 'fish' | 'shellfish' | 'sesame'
export type Injury = 'knee' | 'lower_back' | 'shoulder' | 'wrist' | 'elbow' | 'hip' | 'neck' | 'ankle'
export type SplitType = 'full_body' | 'upper_lower' | 'push_pull_legs' | 'body_part' | 'custom'
export type MealSection = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export interface Measurements {
  neck: number
  chest: number
  arms: number
  waist: number
  hips: number
  thighs: number
  calves: number
  bodyFat: number
}
export type MeasurementKey = keyof Measurements

export interface Profile {
  name?: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  bodyFatPct?: number
  targetWeightKg?: number
  targetDate?: ISODate
  /** Desired change per week in kg (negative = loss). */
  weeklyRateKg?: number
  goal: GoalType
  goalsText: string[]
  activity: ActivityLevel
  occupation?: string
  diet: {
    styles: DietStyle[]
    allergies: Allergen[]
    /** Free-text foods to avoid (dislikes, religious or personal exclusions). */
    avoid: string[]
    likes: string[]
    cuisines: string[]
    mealsPerDay: number
    snacksPerDay: number
    skipBreakfast: boolean
    fastingWindow?: { start: string; end: string }
    notes: string[]
  }
  macros: {
    calories?: number
    proteinG?: number
    proteinPerKg?: number
    carbsG?: number
    fatG?: number
    fiberG?: number
    proteinPct?: number
    carbsPct?: number
    fatPct?: number
    waterMl?: number
  }
  training: {
    daysPerWeek: number
    days: Weekday[]
    /** Explicit per-day focus text from the file ("Monday: Upper body"). */
    schedule: Partial<Record<Weekday, string>>
    sessionMinutes: number
    experience: Experience
    equipment: Equipment[]
    location: 'gym' | 'home' | 'outdoor' | 'mixed'
    split?: SplitType
    preferredTime?: string
    cardio: string[]
    injuries: Injury[]
    injuryNotes: string[]
  }
  lifestyle: {
    wake: string
    sleep: string
    sleepHours: number
    workStart?: string
    workEnd?: string
    stepsGoal?: number
    stress?: string
    mealTimes: Partial<Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string>>
    routines: string[]
  }
  measurements: Partial<Measurements>
  meta: {
    sourceMarkdown: string
    fileName?: string
    importedAt: number
    /** Field paths that came from the file. */
    detected: string[]
    /** Field paths filled with a default because the file didn't say. */
    defaulted: string[]
    warnings: string[]
  }
}

/* ------------------------------------------------------------------ catalogues */

export type FoodKind = 'plant' | 'meat' | 'pork' | 'poultry' | 'fish' | 'shellfish' | 'egg' | 'dairy'
export type FoodGroup = 'protein' | 'grain' | 'veg' | 'fruit' | 'dairy' | 'fat' | 'legume' | 'snack' | 'drink' | 'condiment'

export interface Food {
  id: string
  name: string
  /** Per 100 g (or 100 ml for drinks). */
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
  unit: 'g' | 'ml'
  serving: { label: string; qty: number }
  kind: FoodKind
  allergens: Allergen[]
  group: FoodGroup
  brand?: string
  source?: 'builtin' | 'openfoodfacts' | 'custom'
}

export interface Recipe {
  id: string
  name: string
  sections: MealSection[]
  /** [foodId, grams] for a base portion. */
  items: Array<[string, number]>
  minutes: number
  cuisine?: string
  tags?: string[]
  steps?: string[]
}

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'glutes'
  | 'quads_iso'
  | 'hams_iso'
  | 'calves'
  | 'h_push'
  | 'v_push'
  | 'chest_iso'
  | 'h_pull'
  | 'v_pull'
  | 'lateral'
  | 'rear_delt'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'conditioning'

export interface Exercise {
  id: string
  name: string
  pattern: MovementPattern
  /** All of these are required; an empty list means bodyweight only. */
  needs: Equipment[]
  level: 1 | 2 | 3
  /** Body areas this movement tends to aggravate. */
  stresses: Injury[]
  muscles: string[]
  cues: string[]
  compound?: boolean
  timed?: boolean
  unilateral?: boolean
}

/* ------------------------------------------------------------------ generated plan */

export interface Targets {
  bmr: number
  tdee: number
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  waterMl: number
  trainingDayWaterBonusMl: number
  steps: number
  sleepHours: number
  weeklyRateKg: number
  method: {
    bmrFormula: 'mifflin' | 'katch'
    activityFactor: number
    adjustmentKcal: number
    referenceWeightKg: number
    sources: Record<'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'steps', 'profile' | 'calculated'>
    notes: string[]
  }
}

export interface PlannedMeal {
  id: string
  section: MealSection
  recipeId: string
  targetKcal: number
  time?: string
}

export interface DayMealPlan {
  weekday: Weekday
  meals: PlannedMeal[]
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repsMin: number
  repsMax: number
  restSec: number
  timed?: boolean
}

export type DayKind = 'strength' | 'cardio' | 'mobility' | 'rest'
export type DayFocus =
  | 'full'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'hiit'
  | 'mobility'
  | 'rest'

export interface ProgramDay {
  weekday: Weekday
  kind: DayKind
  focus: DayFocus
  title: string
  exercises: PlannedExercise[]
  cardio?: { activity: string; minutes: number; intensity: string }
  estMinutes: number
  sourceText?: string
}

export interface Program {
  split: SplitType
  name: string
  days: ProgramDay[]
  notes: string[]
}

export interface Plan {
  createdAt: number
  seed: number
  targets: Targets
  meals: DayMealPlan[]
  program: Program
  notes: string[]
}

export interface ScheduleItem {
  time: string
  kind: 'wake' | 'meal' | 'workout' | 'water' | 'work' | 'winddown' | 'sleep' | 'routine' | 'walk'
  label: string
  detail?: string
}

/* ------------------------------------------------------------------ logs */

export interface FoodLogItem {
  id: string
  section: MealSection
  name: string
  foodId?: string
  qty?: number
  unit?: 'g' | 'ml'
  kcal: number
  p: number
  c: number
  f: number
  at: number
  source: 'builtin' | 'openfoodfacts' | 'custom' | 'quick' | 'coach'
}

export interface SessionSet {
  weightKg?: number
  reps?: number
  done: boolean
  doneAt?: number
}

export interface SessionExercise {
  uid: string
  exerciseId: string
  name: string
  repsMin: number
  repsMax: number
  restSec: number
  timed?: boolean
  swappedFrom?: string
  sets: SessionSet[]
}

export interface WorkoutSession {
  id: string
  date: ISODate
  weekday?: Weekday
  title: string
  focus: DayFocus
  startedAt: number
  finishedAt?: number
  intensity: 'normal' | 'light'
  exercises: SessionExercise[]
  cardio?: { activity: string; minutes: number; done: boolean }
  notes?: string
}

export interface DayLog {
  date: ISODate
  /** Per planned meal: eaten state and an optional swapped recipe. */
  planned: Record<string, { eaten?: boolean; recipeId?: string }>
  foods: FoodLogItem[]
  water: Array<{ at: number; ml: number }>
  workouts: WorkoutSession[]
  /** Coach-suggested "lighter session" for this day. */
  lighter?: boolean
  weightKg?: number
  measurements?: Partial<Measurements>
  steps?: number
  updatedAt: number
}

export interface JournalEntry {
  id: string
  date: ISODate
  createdAt: number
  updatedAt: number
  body: string
  energy?: number
  soreness?: number
  mood?: number
  sleepHours?: number
}

/* ------------------------------------------------------------------ settings & chat */

export type ThemePref = 'system' | 'light' | 'dark'

export interface Settings {
  theme: ThemePref
  weightUnit: 'kg' | 'lb'
  lengthUnit: 'cm' | 'in'
  online: boolean
  sound: boolean
  cloudCoach: { enabled: boolean; apiKey: string; model: string }
}

export type CoachAction =
  | { kind: 'swapMeal'; label: string; date: ISODate; plannedId: string; recipeId: string }
  | { kind: 'lighter'; label: string; date: ISODate }
  | { kind: 'addWater'; label: string; ml: number }
  | { kind: 'logWeight'; label: string; kg: number }
  | { kind: 'addFood'; label: string; foodId: string; grams: number; section: MealSection }
  | { kind: 'goto'; label: string; tab: 'today' | 'diet' | 'train' | 'progress' | 'journal' }

export interface ChatMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  at: number
  source?: 'local' | 'cloud'
  actions?: CoachAction[]
  actionsUsed?: boolean
  error?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  /** Raw Messages API history for the optional cloud coach (kept append-only). */
  cloud: unknown[]
}

export interface FoodLibrary {
  custom: Food[]
  recents: Array<{ foodId: string; qty: number; section: MealSection; at: number }>
}

import type { ReactNode } from 'react'
import { WEEK_ORDER, WEEKDAY_LABEL, type Weekday } from '../../lib/dates'
import { cmTo, kgTo, toCm, toKg, type LengthUnit, type WeightUnit } from '../../lib/units'
import { cx } from '../../lib/utils'
import type { ActivityLevel, Allergen, DietStyle, Equipment, Experience, GoalType, Profile, Sex } from '../../types'
import { Badge, Chip, Input, Segmented, Stepper } from '../ui/primitives'

export const GOAL_LABEL: Record<GoalType, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  recomp: 'Recomposition',
  strength: 'Get stronger',
  endurance: 'Endurance',
  maintain: 'Maintain',
  general_health: 'General health',
}
export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Active',
  very_active: 'Very active',
}
const STYLE_LABEL: Record<DietStyle, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  pescatarian: 'Pescatarian',
  keto: 'Keto',
  low_carb: 'Low carb',
  mediterranean: 'Mediterranean',
  paleo: 'Paleo',
  high_protein: 'High protein',
  halal: 'Halal',
  kosher: 'Kosher',
  jain: 'Jain',
}
const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'Gluten',
  dairy: 'Dairy',
  lactose: 'Lactose',
  nuts: 'Tree nuts',
  peanut: 'Peanuts',
  soy: 'Soy',
  egg: 'Eggs',
  fish: 'Fish',
  shellfish: 'Shellfish',
  sesame: 'Sesame',
}
const EQUIPMENT_LABEL: Record<Equipment, string> = {
  full_gym: 'Full gym',
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebells',
  machine: 'Machines',
  cable: 'Cables',
  band: 'Bands',
  bodyweight: 'Bodyweight',
  pullup_bar: 'Pull-up bar',
  bench: 'Bench',
  cardio_machine: 'Cardio machine',
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, defaulted, children }: { label: string; defaulted?: boolean; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-ink-2">
        {label}
        {defaulted && <Badge tone="warn">Estimated: please check</Badge>}
      </div>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

/** Editable view of the values that drive every calculation. */
export function ProfileEditor({ profile, onChange, weightUnit, lengthUnit }: { profile: Profile; onChange: (p: Profile) => void; weightUnit: WeightUnit; lengthUnit: LengthUnit }) {
  const d = new Set(profile.meta.defaulted)
  const set = (patch: Partial<Profile>, field?: string) => {
    const meta = field ? { ...profile.meta, defaulted: profile.meta.defaulted.filter((x) => x !== field) } : profile.meta
    onChange({ ...profile, ...patch, meta })
  }
  const setDiet = (patch: Partial<Profile['diet']>) => onChange({ ...profile, diet: { ...profile.diet, ...patch } })
  const setTraining = (patch: Partial<Profile['training']>, field?: string) =>
    onChange({ ...profile, training: { ...profile.training, ...patch }, meta: field ? { ...profile.meta, defaulted: profile.meta.defaulted.filter((x) => x !== field) } : profile.meta })

  return (
    <div className="space-y-3">
      <Group title="Body">
        <Input label="Name (optional)" value={profile.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} placeholder="What should the coach call you?" autoComplete="given-name" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" defaulted={d.has('age')}>
            <Stepper label="Age" value={profile.age} onChange={(v) => set({ age: Math.round(v) }, 'age')} min={13} max={100} decimals={0} />
          </Field>
          <Field label="Sex" defaulted={d.has('sex')}>
            <Segmented<Sex>
              label="Sex"
              value={profile.sex}
              onChange={(v) => set({ sex: v }, 'sex')}
              options={[
                { value: 'female', label: 'F' },
                { value: 'male', label: 'M' },
                { value: 'unspecified', label: '–' },
              ]}
            />
          </Field>
        </div>
        <Field label={`Height (${lengthUnit})`} defaulted={d.has('heightCm')}>
          <Stepper label="Height" value={cmTo(profile.heightCm, lengthUnit)} onChange={(v) => set({ heightCm: Math.round(toCm(v, lengthUnit) * 10) / 10 }, 'heightCm')} min={lengthUnit === 'cm' ? 120 : 48} max={lengthUnit === 'cm' ? 230 : 90} step={lengthUnit === 'cm' ? 1 : 0.5} decimals={1} unit={lengthUnit} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Weight (${weightUnit})`} defaulted={d.has('weightKg')}>
            <Stepper label="Weight" value={kgTo(profile.weightKg, weightUnit)} onChange={(v) => set({ weightKg: Math.round(toKg(v, weightUnit) * 10) / 10 }, 'weightKg')} min={30} max={700} step={weightUnit === 'kg' ? 0.5 : 1} decimals={1} />
          </Field>
          <Field label={`Target (${weightUnit})`}>
            <Stepper label="Target weight" value={profile.targetWeightKg != null ? kgTo(profile.targetWeightKg, weightUnit) : undefined} onChange={(v) => set({ targetWeightKg: Math.round(toKg(v, weightUnit) * 10) / 10 })} min={30} max={700} step={weightUnit === 'kg' ? 0.5 : 1} decimals={1} />
          </Field>
        </div>
        <Field label="Body fat % (optional)">
          <Stepper label="Body fat" value={profile.bodyFatPct} onChange={(v) => set({ bodyFatPct: v || undefined, measurements: { ...profile.measurements, bodyFat: v || undefined } })} min={0} max={60} step={0.5} decimals={1} unit="%" />
        </Field>
      </Group>

      <Group title="Goal & activity">
        <Field label="Main goal" defaulted={d.has('goal')}>
          <ChipRow>
            {(Object.keys(GOAL_LABEL) as GoalType[]).map((g) => (
              <Chip key={g} active={profile.goal === g} onClick={() => set({ goal: g }, 'goal')}>
                {GOAL_LABEL[g]}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Daily activity (outside workouts)" defaulted={d.has('activity')}>
          <ChipRow>
            {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((a) => (
              <Chip key={a} active={profile.activity === a} onClick={() => set({ activity: a }, 'activity')}>
                {ACTIVITY_LABEL[a]}
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Group>

      <Group title="Nutrition">
        <Field label="Diet style">
          <ChipRow>
            {(Object.keys(STYLE_LABEL) as DietStyle[]).map((s) => (
              <Chip key={s} active={profile.diet.styles.includes(s)} onClick={() => setDiet({ styles: toggle(profile.diet.styles, s) })}>
                {STYLE_LABEL[s]}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Field label="Allergies & intolerances">
          <ChipRow>
            {(Object.keys(ALLERGEN_LABEL) as Allergen[]).map((a) => (
              <Chip key={a} active={profile.diet.allergies.includes(a)} onClick={() => setDiet({ allergies: toggle(profile.diet.allergies, a) })}>
                {ALLERGEN_LABEL[a]}
              </Chip>
            ))}
          </ChipRow>
        </Field>
        <Input label="Foods to avoid (comma-separated)" value={profile.diet.avoid.join(', ')} onChange={(e) => setDiet({ avoid: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) })} placeholder="e.g. mushrooms, olives" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Main meals" defaulted={d.has('diet.mealsPerDay')}>
            <Stepper label="Meals per day" value={profile.diet.mealsPerDay} onChange={(v) => setDiet({ mealsPerDay: Math.round(v), skipBreakfast: v <= 2 })} min={2} max={3} decimals={0} />
          </Field>
          <Field label="Snacks">
            <Stepper label="Snacks per day" value={profile.diet.snacksPerDay} onChange={(v) => setDiet({ snacksPerDay: Math.round(v) })} min={0} max={3} decimals={0} />
          </Field>
        </div>
      </Group>

      <Group title="Training">
        <Field label="Training days" defaulted={d.has('training.days')}>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_ORDER.map((day: Weekday) => {
              const on = profile.training.days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_LABEL[day]}
                  onClick={() => {
                    const days = WEEK_ORDER.filter((x) => (x === day ? !on : profile.training.days.includes(x)))
                    setTraining({ days, daysPerWeek: days.length }, 'training.days')
                  }}
                  className={cx('tap h-12 rounded-xl text-[13px] font-semibold', on ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-3')}
                >
                  {WEEKDAY_LABEL[day].slice(0, 2)}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Session length" defaulted={d.has('training.sessionMinutes')}>
          <Stepper label="Session length" value={profile.training.sessionMinutes} onChange={(v) => setTraining({ sessionMinutes: Math.round(v) }, 'training.sessionMinutes')} min={20} max={120} step={5} decimals={0} unit="min" />
        </Field>
        <Field label="Experience" defaulted={d.has('training.experience')}>
          <Segmented<Experience>
            label="Experience"
            value={profile.training.experience}
            onChange={(v) => setTraining({ experience: v }, 'training.experience')}
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </Field>
        <Field label="Equipment" defaulted={d.has('training.equipment')}>
          <ChipRow>
            {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
              <Chip key={e} active={profile.training.equipment.includes(e)} onClick={() => setTraining({ equipment: toggle(profile.training.equipment, e) }, 'training.equipment')}>
                {EQUIPMENT_LABEL[e]}
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Group>
    </div>
  )
}

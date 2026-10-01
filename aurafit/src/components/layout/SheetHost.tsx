import { lazy, Suspense } from 'react'
import { useUI, type Sheet } from '../../store/ui'
import { QuickAddSheet } from '../diet/QuickAddSheet'
import { GrocerySheet, MealSheet, WeekPlanSheet } from '../diet/PlanSheets'
import { ExerciseInfoSheet, ProgramSheet, SwapExerciseSheet } from '../train/TrainSheets'
import { LogMeasurementsSheet, LogWeightSheet } from '../progress/LogSheets'
import { JournalEntrySheet } from '../../views/JournalView'

// Less-used sheets load on demand (the service worker still precaches them for offline use).
const CoachSheet = lazy(() => import('../coach/CoachSheet').then((m) => ({ default: m.CoachSheet })))
const SettingsSheet = lazy(() => import('../settings/SettingsSheet').then((m) => ({ default: m.SettingsSheet })))

function render(s: Sheet) {
  switch (s.kind) {
    case 'quickAdd':
      return <QuickAddSheet date={s.date} section={s.section} />
    case 'meal':
      return <MealSheet date={s.date} plannedId={s.plannedId} />
    case 'weekPlan':
      return <WeekPlanSheet />
    case 'grocery':
      return <GrocerySheet />
    case 'program':
      return <ProgramSheet />
    case 'swapExercise':
      return <SwapExerciseSheet date={s.date} sessionId={s.sessionId} exerciseUid={s.exerciseUid} />
    case 'exerciseInfo':
      return <ExerciseInfoSheet exerciseId={s.exerciseId} />
    case 'logWeight':
      return <LogWeightSheet date={s.date} />
    case 'logMeasurements':
      return <LogMeasurementsSheet date={s.date} />
    case 'journalEntry':
      return <JournalEntrySheet id={s.id} date={s.date} />
    case 'settings':
      return <SettingsSheet section={s.section} />
    case 'coach':
      return <CoachSheet prompt={s.prompt} />
    case 'profileSource':
      return <SettingsSheet section="profile" />
  }
}

/** Only the top sheet renders, so stacked sheets stay light. */
export function SheetHost() {
  const sheets = useUI((s) => s.sheets)
  const top = sheets.at(-1)
  if (!top) return null
  return (
    <Suspense fallback={null} key={sheets.length}>
      {render(top)}
    </Suspense>
  )
}

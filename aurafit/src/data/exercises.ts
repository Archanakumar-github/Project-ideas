import type { Equipment, Exercise, Injury, MovementPattern } from '../types'

/**
 * Offline exercise library. `needs` lists every piece of kit required (empty = bodyweight);
 * `stresses` lists body areas the movement tends to load, so programs can route around
 * injuries noted in user_profile.md. wger.de adds images and long descriptions when online.
 */
function x(
  id: string,
  name: string,
  pattern: MovementPattern,
  needs: Equipment[],
  level: 1 | 2 | 3,
  stresses: Injury[],
  muscles: string[],
  cues: string[],
  extra: Partial<Pick<Exercise, 'compound' | 'timed' | 'unilateral'>> = {},
): Exercise {
  return { id, name, pattern, needs, level, stresses, muscles, cues, ...extra }
}
const C = { compound: true }

export const EXERCISES: Exercise[] = [
  // Squat
  x('back-squat', 'Barbell back squat', 'squat', ['barbell'], 2, ['knee', 'lower_back'], ['quads', 'glutes'], ['Brace before you descend', 'Knees track over toes', 'Drive up through mid-foot'], C),
  x('front-squat', 'Front squat', 'squat', ['barbell'], 3, ['knee', 'wrist'], ['quads', 'core'], ['Elbows high', 'Stay tall', 'Sit between your heels'], C),
  x('goblet-squat', 'Goblet squat', 'squat', ['dumbbell'], 1, ['knee'], ['quads', 'glutes'], ['Hold the weight at your chest', 'Elbows inside knees at the bottom', 'Chest up'], C),
  x('kb-goblet-squat', 'Kettlebell goblet squat', 'squat', ['kettlebell'], 1, ['knee'], ['quads', 'glutes'], ['Hold the bell by the horns', 'Sit down between your heels', 'Push the floor away'], C),
  x('leg-press', 'Leg press', 'squat', ['machine'], 1, ['knee'], ['quads', 'glutes'], ['Feet shoulder-width', 'Lower until hips start to tuck', 'Do not lock the knees'], C),
  x('hack-squat', 'Hack squat', 'squat', ['machine'], 2, ['knee'], ['quads'], ['Back flat on the pad', 'Controlled descent', 'Drive through the whole foot'], C),
  x('box-squat', 'Box squat (to bench)', 'squat', [], 1, [], ['quads', 'glutes'], ['Sit back to touch the box', 'Pause lightly, do not relax', 'Stand tall'], C),
  x('bodyweight-squat', 'Bodyweight squat', 'squat', [], 1, ['knee'], ['quads', 'glutes'], ['Arms forward for balance', 'Hips back and down', 'Full foot contact'], C),
  x('band-squat', 'Banded squat', 'squat', ['band'], 1, ['knee'], ['quads', 'glutes'], ['Stand on the band, handles at shoulders', 'Sit back', 'Squeeze glutes at the top'], C),
  x('wall-sit', 'Wall sit', 'squat', [], 1, [], ['quads'], ['Thighs parallel to the floor', 'Back flat on the wall', 'Breathe steadily'], { timed: true }),
  // Hinge
  x('deadlift', 'Conventional deadlift', 'hinge', ['barbell'], 3, ['lower_back'], ['hamstrings', 'glutes', 'back'], ['Bar over mid-foot', 'Lats tight, chest up', 'Push the floor away'], C),
  x('rdl', 'Romanian deadlift', 'hinge', ['barbell'], 2, ['lower_back'], ['hamstrings', 'glutes'], ['Soft knees', 'Hips back until hamstrings stretch', 'Bar close to legs'], C),
  x('db-rdl', 'Dumbbell Romanian deadlift', 'hinge', ['dumbbell'], 1, ['lower_back'], ['hamstrings', 'glutes'], ['Neutral spine', 'Push hips back', 'Squeeze glutes to stand'], C),
  x('kb-deadlift', 'Kettlebell deadlift', 'hinge', ['kettlebell'], 1, ['lower_back'], ['hamstrings', 'glutes'], ['Bell between the feet', 'Hinge, do not squat', 'Stand tall'], C),
  x('kb-swing', 'Kettlebell swing', 'hinge', ['kettlebell'], 2, ['lower_back'], ['glutes', 'hamstrings'], ['Hike the bell back', 'Snap the hips', 'Float the bell to chest height'], C),
  x('single-leg-rdl', 'Single-leg RDL', 'hinge', [], 1, [], ['hamstrings', 'glutes'], ['Reach the free leg back', 'Hips square', 'Slow and controlled'], { unilateral: true }),
  x('cable-pull-through', 'Cable pull-through', 'hinge', ['cable'], 1, [], ['glutes', 'hamstrings'], ['Hinge at the hips', 'Arms just hold the rope', 'Lock out with the glutes'], C),
  x('band-good-morning', 'Banded good morning', 'hinge', ['band'], 1, ['lower_back'], ['hamstrings'], ['Band behind the neck', 'Hips back', 'Neutral spine'], C),
  x('back-extension', '45° back extension', 'hinge', ['machine'], 1, ['lower_back'], ['glutes', 'lower back'], ['Hinge at the hips', 'Squeeze glutes at the top', 'Do not hyperextend'], C),
  // Lunge
  x('walking-lunge', 'Walking lunge', 'lunge', [], 1, ['knee'], ['quads', 'glutes'], ['Long stride', 'Back knee kisses the floor', 'Torso upright'], { unilateral: true }),
  x('db-walking-lunge', 'Dumbbell walking lunge', 'lunge', ['dumbbell'], 2, ['knee'], ['quads', 'glutes'], ['Weights at your sides', 'Controlled step', 'Drive through the front heel'], { unilateral: true }),
  x('reverse-lunge', 'Reverse lunge', 'lunge', [], 1, [], ['glutes', 'quads'], ['Step back softly', 'Front shin vertical', 'Push through the front heel'], { unilateral: true }),
  x('db-reverse-lunge', 'Dumbbell reverse lunge', 'lunge', ['dumbbell'], 1, [], ['glutes', 'quads'], ['Step back softly', 'Front shin vertical', 'Stand tall between reps'], { unilateral: true }),
  x('bulgarian-split-squat', 'Bulgarian split squat', 'lunge', ['bench'], 2, ['knee'], ['quads', 'glutes'], ['Rear foot on the bench', 'Drop straight down', 'Front knee tracks over toes'], { unilateral: true }),
  x('db-step-up', 'Dumbbell step-up', 'lunge', ['dumbbell', 'bench'], 1, ['knee'], ['quads', 'glutes'], ['Whole foot on the box', 'Drive through the top leg', 'Control the descent'], { unilateral: true }),
  x('step-up', 'Step-up', 'lunge', [], 1, ['knee'], ['quads', 'glutes'], ['Use a sturdy step or stair', 'Drive through the top leg', 'Stand fully tall'], { unilateral: true }),
  // Glutes & isolation legs
  x('hip-thrust', 'Barbell hip thrust', 'glutes', ['barbell', 'bench'], 2, [], ['glutes'], ['Shoulders on the bench', 'Chin tucked', 'Squeeze 1s at the top'], C),
  x('db-hip-thrust', 'Dumbbell hip thrust', 'glutes', ['dumbbell', 'bench'], 1, [], ['glutes'], ['Weight on the hip crease', 'Ribs down', 'Full lockout'], C),
  x('glute-bridge', 'Glute bridge', 'glutes', [], 1, [], ['glutes'], ['Heels close to hips', 'Drive hips up', 'Squeeze at the top'], {}),
  x('single-leg-bridge', 'Single-leg glute bridge', 'glutes', [], 1, [], ['glutes'], ['Hips level', 'Drive through the heel', 'Pause at the top'], { unilateral: true }),
  x('band-lateral-walk', 'Banded lateral walk', 'glutes', ['band'], 1, [], ['glute med'], ['Band above the knees', 'Small steps', 'Stay low'], {}),
  x('cable-kickback', 'Cable glute kickback', 'glutes', ['cable'], 1, [], ['glutes'], ['Slight forward lean', 'Kick back and up', 'No lower-back arch'], { unilateral: true }),
  x('leg-extension', 'Leg extension', 'quads_iso', ['machine'], 1, ['knee'], ['quads'], ['Pad above the ankle', 'Squeeze at the top', 'Slow lowering'], {}),
  x('spanish-squat', 'Band Spanish squat', 'quads_iso', ['band'], 1, [], ['quads'], ['Band behind the knees, anchored', 'Sit back, shins vertical', 'Knee-friendly quad work'], {}),
  x('leg-curl', 'Lying leg curl', 'hams_iso', ['machine'], 1, [], ['hamstrings'], ['Hips pressed down', 'Curl fully', 'Control the return'], {}),
  x('slider-curl', 'Slider hamstring curl', 'hams_iso', [], 2, [], ['hamstrings'], ['Bridge up first', 'Slide heels in', 'Keep hips high'], {}),
  x('band-leg-curl', 'Banded leg curl', 'hams_iso', ['band'], 1, [], ['hamstrings'], ['Anchor the band low', 'Curl heel to glute', 'Slow return'], {}),
  x('calf-raise', 'Standing calf raise', 'calves', [], 1, ['ankle'], ['calves'], ['Full stretch at the bottom', 'Pause at the top', 'Use a step for range'], {}),
  x('db-calf-raise', 'Dumbbell calf raise', 'calves', ['dumbbell'], 1, ['ankle'], ['calves'], ['Hold a dumbbell', 'Slow lowering', 'Pause at the top'], {}),
  x('seated-calf-raise', 'Seated calf raise', 'calves', ['machine'], 1, [], ['calves'], ['Knees at 90°', 'Full range', 'Pause at the top'], {}),
  // Horizontal push
  x('bench-press', 'Barbell bench press', 'h_push', ['barbell', 'bench'], 2, ['shoulder'], ['chest', 'triceps'], ['Shoulder blades pinned', 'Bar to lower chest', 'Feet planted'], C),
  x('db-bench-press', 'Dumbbell bench press', 'h_push', ['dumbbell', 'bench'], 1, ['shoulder'], ['chest', 'triceps'], ['Elbows ~45°', 'Full stretch at the bottom', 'Press up and slightly in'], C),
  x('incline-db-press', 'Incline dumbbell press', 'h_push', ['dumbbell', 'bench'], 2, ['shoulder'], ['upper chest', 'shoulders'], ['Bench at 30°', 'Elbows under the wrists', 'Control the stretch'], C),
  x('db-floor-press', 'Dumbbell floor press', 'h_push', ['dumbbell'], 1, [], ['chest', 'triceps'], ['Lie on the floor', 'Elbows touch down softly', 'Shoulder-friendly range'], C),
  x('machine-chest-press', 'Machine chest press', 'h_push', ['machine'], 1, [], ['chest', 'triceps'], ['Handles at mid-chest', 'Shoulders down', 'Smooth reps'], C),
  x('push-up', 'Push-up', 'h_push', [], 1, ['wrist'], ['chest', 'triceps', 'core'], ['Body in one line', 'Chest to the floor', 'Elbows ~45°'], C),
  x('incline-push-up', 'Incline push-up', 'h_push', [], 1, ['wrist'], ['chest', 'triceps'], ['Hands on a bench or counter', 'Body straight', 'Lower with control'], C),
  x('band-chest-press', 'Banded chest press', 'h_push', ['band'], 1, [], ['chest', 'triceps'], ['Anchor behind you', 'Press forward', 'Slow return'], C),
  // Vertical push
  x('overhead-press', 'Barbell overhead press', 'v_push', ['barbell'], 2, ['shoulder', 'lower_back'], ['shoulders', 'triceps'], ['Glutes and abs tight', 'Head through at the top', 'Bar over mid-foot'], C),
  x('db-shoulder-press', 'Dumbbell shoulder press', 'v_push', ['dumbbell'], 1, ['shoulder'], ['shoulders', 'triceps'], ['Wrists over elbows', 'Press to just short of lockout', 'Ribs down'], C),
  x('landmine-press', 'Landmine press', 'v_push', ['barbell'], 2, [], ['shoulders', 'chest'], ['Half-kneeling', 'Press up and forward', 'Shoulder-friendly angle'], C),
  x('machine-shoulder-press', 'Machine shoulder press', 'v_push', ['machine'], 1, ['shoulder'], ['shoulders'], ['Back on the pad', 'Smooth press', 'Control the return'], C),
  x('pike-push-up', 'Pike push-up', 'v_push', [], 2, ['shoulder', 'wrist'], ['shoulders', 'triceps'], ['Hips high', 'Head between the hands', 'Elbows track back'], C),
  x('band-overhead-press', 'Banded overhead press', 'v_push', ['band'], 1, ['shoulder'], ['shoulders'], ['Stand on the band', 'Press overhead', 'Ribs down'], C),
  x('kb-press', 'Kettlebell overhead press', 'v_push', ['kettlebell'], 2, ['shoulder'], ['shoulders', 'triceps'], ['Bell in the rack', 'Press with a slight rotation', 'Squeeze glutes'], { ...C, unilateral: true }),
  // Chest isolation
  x('db-fly', 'Dumbbell fly', 'chest_iso', ['dumbbell', 'bench'], 1, ['shoulder'], ['chest'], ['Slight elbow bend', 'Wide arc', 'Stop at a comfortable stretch'], {}),
  x('cable-fly', 'Cable fly', 'chest_iso', ['cable'], 1, [], ['chest'], ['Step forward, slight lean', 'Hug a tree', 'Squeeze at the middle'], {}),
  x('pec-deck', 'Pec deck', 'chest_iso', ['machine'], 1, [], ['chest'], ['Elbows soft', 'Squeeze 1s', 'Slow return'], {}),
  x('band-fly', 'Banded chest fly', 'chest_iso', ['band'], 1, [], ['chest'], ['Anchor behind you', 'Arms wide to together', 'Control the return'], {}),
  // Horizontal pull
  x('barbell-row', 'Bent-over barbell row', 'h_pull', ['barbell'], 2, ['lower_back'], ['back', 'biceps'], ['Hinge to ~45°', 'Pull to the belly button', 'No jerking'], C),
  x('db-row', 'One-arm dumbbell row', 'h_pull', ['dumbbell'], 1, [], ['lats', 'upper back'], ['Hand on a bench or knee', 'Pull elbow to hip', 'Pause at the top'], { ...C, unilateral: true }),
  x('chest-supported-row', 'Chest-supported dumbbell row', 'h_pull', ['dumbbell', 'bench'], 1, [], ['upper back', 'lats'], ['Chest on an incline bench', 'Squeeze shoulder blades', 'Back-friendly'], C),
  x('cable-row', 'Seated cable row', 'h_pull', ['cable'], 1, [], ['back', 'biceps'], ['Sit tall', 'Pull to the stomach', 'Shoulders down'], C),
  x('machine-row', 'Machine row', 'h_pull', ['machine'], 1, [], ['back'], ['Chest on the pad', 'Lead with the elbows', 'Squeeze'], C),
  x('inverted-row', 'Inverted row (table or low bar)', 'h_pull', [], 2, [], ['back', 'biceps'], ['Body straight', 'Pull chest to the edge', 'Lower slowly'], C),
  x('band-row', 'Banded row', 'h_pull', ['band'], 1, [], ['back'], ['Anchor at chest height', 'Pull elbows back', 'Pause and squeeze'], C),
  x('kb-row', 'Kettlebell row', 'h_pull', ['kettlebell'], 1, [], ['lats', 'upper back'], ['Hinge, flat back', 'Row to the hip', 'Control the lowering'], { ...C, unilateral: true }),
  // Vertical pull
  x('pull-up', 'Pull-up', 'v_pull', ['pullup_bar'], 3, ['shoulder', 'elbow'], ['lats', 'biceps'], ['Start from a dead hang', 'Chest to the bar', 'Control the descent'], C),
  x('chin-up', 'Chin-up', 'v_pull', ['pullup_bar'], 2, ['elbow'], ['lats', 'biceps'], ['Palms facing you', 'Pull chin over the bar', 'Full range'], C),
  x('band-pull-up', 'Band-assisted pull-up', 'v_pull', ['pullup_bar', 'band'], 2, ['shoulder'], ['lats', 'biceps'], ['Knee or foot in the band', 'Chest up', 'Slow lowering'], C),
  x('negative-pull-up', 'Negative pull-up', 'v_pull', ['pullup_bar'], 2, ['shoulder', 'elbow'], ['lats', 'biceps'], ['Jump to the top', 'Lower in 3–5 seconds', 'Reset each rep'], C),
  x('lat-pulldown', 'Lat pulldown', 'v_pull', ['cable'], 1, [], ['lats', 'biceps'], ['Chest up', 'Pull to the upper chest', 'Elbows down and in'], C),
  x('band-pulldown', 'Banded lat pulldown', 'v_pull', ['band'], 1, [], ['lats'], ['Anchor high', 'Pull elbows to ribs', 'Control the return'], C),
  x('db-pullover', 'Dumbbell pullover', 'v_pull', ['dumbbell', 'bench'], 1, ['shoulder'], ['lats', 'chest'], ['Slight elbow bend', 'Stretch overhead', 'Pull with the lats'], {}),
  x('straight-arm-pulldown', 'Straight-arm pulldown', 'v_pull', ['cable'], 1, [], ['lats'], ['Arms long', 'Sweep to the thighs', 'Hips still'], {}),
  // Shoulders
  x('db-lateral-raise', 'Dumbbell lateral raise', 'lateral', ['dumbbell'], 1, ['shoulder'], ['side delts'], ['Lead with the elbows', 'Up to shoulder height', 'Slow lowering'], {}),
  x('cable-lateral-raise', 'Cable lateral raise', 'lateral', ['cable'], 1, [], ['side delts'], ['Cable from low and across', 'Smooth arc', 'No swinging'], {}),
  x('band-lateral-raise', 'Banded lateral raise', 'lateral', ['band'], 1, [], ['side delts'], ['Stand on the band', 'Raise to shoulder height', 'Control'], {}),
  x('face-pull', 'Face pull', 'rear_delt', ['cable'], 1, [], ['rear delts', 'rotator cuff'], ['Rope to the eyebrows', 'Elbows high', 'Rotate out'], {}),
  x('band-pull-apart', 'Band pull-apart', 'rear_delt', ['band'], 1, [], ['rear delts', 'upper back'], ['Arms straight', 'Pull to the chest', 'Squeeze shoulder blades'], {}),
  x('reverse-fly', 'Dumbbell reverse fly', 'rear_delt', ['dumbbell'], 1, [], ['rear delts'], ['Hinge forward', 'Arms wide', 'Pinkies lead'], {}),
  x('prone-ytw', 'Prone Y-T-W raise', 'rear_delt', [], 1, [], ['rear delts', 'lower traps'], ['Lie face down', 'Thumbs up', 'Slow positions'], {}),
  // Arms
  x('db-curl', 'Dumbbell curl', 'biceps', ['dumbbell'], 1, [], ['biceps'], ['Elbows pinned', 'Full range', 'No swinging'], {}),
  x('hammer-curl', 'Hammer curl', 'biceps', ['dumbbell'], 1, [], ['biceps', 'forearms'], ['Neutral grip', 'Elbows still', 'Slow lowering'], {}),
  x('barbell-curl', 'Barbell curl', 'biceps', ['barbell'], 1, ['elbow', 'wrist'], ['biceps'], ['Shoulder-width grip', 'Elbows at your sides', 'Control down'], {}),
  x('cable-curl', 'Cable curl', 'biceps', ['cable'], 1, [], ['biceps'], ['Constant tension', 'Squeeze at the top', 'Elbows still'], {}),
  x('band-curl', 'Banded curl', 'biceps', ['band'], 1, [], ['biceps'], ['Stand on the band', 'Curl to shoulders', 'Slow return'], {}),
  x('kb-curl', 'Kettlebell curl', 'biceps', ['kettlebell'], 1, [], ['biceps'], ['Hold by the horns', 'Elbows still', 'Full range'], {}),
  x('pushdown', 'Triceps pushdown', 'triceps', ['cable'], 1, [], ['triceps'], ['Elbows at your sides', 'Lock out fully', 'Control up'], {}),
  x('overhead-db-extension', 'Overhead dumbbell extension', 'triceps', ['dumbbell'], 1, ['elbow', 'shoulder'], ['triceps'], ['Elbows point forward', 'Deep stretch', 'Extend fully'], {}),
  x('skull-crusher', 'Dumbbell skull crusher', 'triceps', ['dumbbell', 'bench'], 2, ['elbow'], ['triceps'], ['Lower beside the head', 'Upper arms still', 'Extend fully'], {}),
  x('bench-dip', 'Bench dip', 'triceps', [], 1, ['shoulder', 'wrist'], ['triceps'], ['Hands on a bench or chair', 'Elbows back', 'Shallow if shoulders complain'], {}),
  x('close-grip-push-up', 'Close-grip push-up', 'triceps', [], 2, ['wrist'], ['triceps', 'chest'], ['Hands under shoulders', 'Elbows brush ribs', 'Body straight'], {}),
  x('band-pushdown', 'Banded pushdown', 'triceps', ['band'], 1, [], ['triceps'], ['Anchor high', 'Elbows at your sides', 'Lock out'], {}),
  // Core
  x('plank', 'Plank', 'core', [], 1, [], ['core'], ['Elbows under shoulders', 'Squeeze glutes', 'Breathe'], { timed: true }),
  x('side-plank', 'Side plank', 'core', [], 1, ['shoulder'], ['obliques'], ['Hips high', 'Body in one line', 'Switch sides'], { timed: true }),
  x('dead-bug', 'Dead bug', 'core', [], 1, [], ['deep core'], ['Low back on the floor', 'Opposite arm and leg', 'Slow exhale'], {}),
  x('bird-dog', 'Bird dog', 'core', [], 1, [], ['core', 'lower back'], ['Reach long', 'Hips level', 'Pause 2s'], {}),
  x('hanging-knee-raise', 'Hanging knee raise', 'core', ['pullup_bar'], 2, ['shoulder'], ['abs'], ['No swinging', 'Knees to chest', 'Slow lowering'], {}),
  x('band-pallof', 'Pallof press', 'core', ['band'], 1, [], ['obliques', 'core'], ['Band anchored to the side', 'Press out and resist rotation', 'Hips square'], {}),
  x('cable-pallof', 'Cable Pallof press', 'core', ['cable'], 1, [], ['obliques', 'core'], ['Stand side-on', 'Press and hold', 'Do not rotate'], {}),
  x('hollow-hold', 'Hollow hold', 'core', [], 2, ['lower_back'], ['abs'], ['Low back pressed down', 'Arms overhead', 'Tuck knees to scale'], { timed: true }),
  x('russian-twist', 'Russian twist', 'core', [], 1, ['lower_back'], ['obliques'], ['Lean back slightly', 'Rotate from the ribs', 'Feet down to scale'], {}),
  // Conditioning
  x('burpee', 'Burpee', 'conditioning', [], 2, ['knee', 'wrist', 'shoulder'], ['full body'], ['Chest to floor', 'Jump and clap overhead', 'Steady pace'], { timed: true }),
  x('mountain-climber', 'Mountain climbers', 'conditioning', [], 1, ['wrist'], ['core', 'cardio'], ['Hands under shoulders', 'Drive knees fast', 'Hips low'], { timed: true }),
  x('jumping-jack', 'Jumping jacks', 'conditioning', [], 1, ['knee', 'ankle'], ['cardio'], ['Light on your feet', 'Arms fully overhead', 'Steady rhythm'], { timed: true }),
  x('high-knees', 'High knees', 'conditioning', [], 1, ['knee'], ['cardio'], ['Knees to hip height', 'Pump the arms', 'Stay tall'], { timed: true }),
  x('shadow-boxing', 'Shadow boxing', 'conditioning', [], 1, [], ['cardio', 'shoulders'], ['Stay on the balls of your feet', 'Mix punches', 'Breathe out on each punch'], { timed: true }),
  x('march-in-place', 'Fast marching (low impact)', 'conditioning', [], 1, [], ['cardio'], ['Arms pumping', 'Quick cadence', 'Joint-friendly'], { timed: true }),
  x('bike-intervals', 'Bike intervals', 'conditioning', ['cardio_machine'], 1, [], ['cardio', 'legs'], ['Hard for the work interval', 'Easy spin to recover', 'Seat at hip height'], { timed: true }),
  x('rower-intervals', 'Rower intervals', 'conditioning', ['cardio_machine'], 2, ['lower_back'], ['cardio', 'full body'], ['Legs, hips, then arms', 'Reverse on the return', 'Strong drive'], { timed: true }),
  x('kb-swing-intervals', 'Kettlebell swing intervals', 'conditioning', ['kettlebell'], 2, ['lower_back'], ['glutes', 'cardio'], ['Hips do the work', 'Brace at the top', 'Breathe out on the snap'], { timed: true }),
]

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

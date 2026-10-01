import type { Weekday } from '../lib/dates'
import { normalize, uniq } from '../lib/utils'
import type {
  ActivityLevel,
  Allergen,
  DietStyle,
  Equipment,
  Experience,
  GoalType,
  Injury,
  Measurements,
  Profile,
  Sex,
  SplitType,
} from '../types'
import {
  ageFromBirthDate,
  isBlankAnswer,
  isNone,
  parseCount,
  parseDate,
  parseDays,
  parseHeightCm,
  parseLengthCm,
  parseMacro,
  parseMacroSplit,
  parseMinutes,
  parseMl,
  parseNumber,
  parsePerWeek,
  parseRangeMid,
  parseTime,
  parseTimeRange,
  parseWeightKg,
  weekdayKey,
} from './values'

/**
 * user_profile.md -> Profile.
 *
 * The file is free-form Markdown, so parsing works in two passes:
 *  1. Flatten the document into entries: every list item, plain line, table row and YAML
 *     front-matter pair becomes { section path, key?, value }.
 *  2. Match entries to profile fields by key synonyms (and section context), then fall back
 *     to scanning prose. Anything not found gets a sensible default and is listed in
 *     `meta.defaulted` so the review screen can highlight it.
 */

interface Entry {
  /** Normalized heading path, e.g. "user profile goals". */
  section: string
  /** Normalized key ("current weight"), '' for keyless items. */
  key: string
  /** Raw key text (for weekday detection etc.). */
  rawKey: string
  value: string
  /** The full cleaned line. */
  line: string
  /** Table header cells, when the entry is a table row. */
  header?: string[]
}

function cleanInline(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<!--.*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => cleanInline(c))
}

const KV = /^([^:：]{1,60}?)\s*[:：]\s*(.*)$/
const BOLD_KEY = /^\*\*([^*]{1,60}?)\*\*\s*[:：\-–—]?\s*(.+)$/

export function flatten(md: string): Entry[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const entries: Entry[] = []
  const headings: string[] = []
  let i = 0

  // YAML front matter.
  if (lines[0]?.trim() === '---') {
    let lastKey = ''
    for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const line = lines[i]
      const item = /^\s*-\s+(.*)$/.exec(line)
      if (item && lastKey) {
        entries.push({ section: 'front matter', key: normalize(lastKey), rawKey: lastKey, value: cleanInline(item[1]), line: cleanInline(item[1]) })
        continue
      }
      const kv = /^([A-Za-z_][\w -]*):\s*(.*)$/.exec(line)
      if (kv) {
        lastKey = kv[1].replace(/_/g, ' ')
        const value = kv[2].replace(/^["']|["']$/g, '')
        if (value) entries.push({ section: 'front matter', key: normalize(lastKey), rawKey: lastKey, value: cleanInline(value), line: `${lastKey}: ${value}` })
      }
    }
    i++
  }

  let table: { header: string[]; section: string } | null = null
  let inCode = false
  for (; i < lines.length; i++) {
    const raw = lines[i]
    if (/^\s*```/.test(raw)) {
      inCode = !inCode
      continue
    }
    if (inCode || !raw.trim()) {
      if (!raw.trim()) table = null
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(raw)
    if (heading) {
      headings.length = heading[1].length - 1
      headings[heading[1].length - 1] = cleanInline(heading[2])
      table = null
      continue
    }
    const section = normalize(headings.filter(Boolean).join(' '))

    if (/^\s*\|.*\|\s*$/.test(raw)) {
      if (/^\s*\|?\s*:?-{2,}/.test(raw)) continue
      const cells = splitRow(raw)
      if (!table) {
        // A header row is followed by a separator row; otherwise treat every row as data.
        if (i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
          table = { header: cells, section }
          continue
        }
        table = { header: [], section }
      }
      if (cells.length >= 2 && cells[0]) {
        const value = cells.slice(1).filter(Boolean).join(' · ')
        entries.push({ section, key: normalize(cells[0]), rawKey: cells[0], value, line: `${cells[0]}: ${value}`, header: table.header })
      } else if (cells[0]) {
        entries.push({ section, key: '', rawKey: '', value: cells[0], line: cells[0] })
      }
      continue
    }
    table = null

    let body = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/^\[[ xX]\]\s+/, '').replace(/^\s*>\s?/, '')
    if (!body.trim()) continue
    const bold = BOLD_KEY.exec(body.trim())
    if (bold) {
      const key = cleanInline(bold[1]).replace(/[:：]$/, '')
      const value = cleanInline(bold[2])
      entries.push({ section, key: normalize(key), rawKey: key, value, line: `${key}: ${value}` })
      continue
    }
    body = cleanInline(body)
    const kv = KV.exec(body)
    if (kv && /[a-z]/i.test(kv[1]) && !/^https?$/i.test(kv[1]) && kv[1].split(' ').length <= 7) {
      entries.push({ section, key: normalize(kv[1]), rawKey: kv[1].trim(), value: kv[2].trim(), line: body })
    } else {
      entries.push({ section, key: '', rawKey: '', value: body, line: body })
    }
  }
  return entries
}

/* ------------------------------------------------------------------ keyword tables */

const ALLERGEN_TERMS: Array<[RegExp, Allergen]> = [
  [/\b(gluten|wheat|celiac|coeliac|barley|rye)\b/, 'gluten'],
  [/\blactose\b/, 'lactose'],
  [/\b(dairy|milk|cheese|casein|whey|butter|cream)\b/, 'dairy'],
  [/\bpeanuts?\b/, 'peanut'],
  [/\b(tree ?nuts?|nuts?|almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|macadamias?)\b/, 'nuts'],
  [/\b(soy|soya|soybeans?|tofu)\b/, 'soy'],
  [/\beggs?\b/, 'egg'],
  [/\b(shellfish|shrimps?|prawns?|crabs?|lobsters?|mussels?|oysters?|clams?|scallops?)\b/, 'shellfish'],
  [/\b(fish|salmon|tuna|cod|sardines?)\b/, 'fish'],
  [/\b(sesame|tahini)\b/, 'sesame'],
]

function allergensIn(text: string): Allergen[] {
  const t = text.toLowerCase()
  const out: Allergen[] = []
  for (const [re, a] of ALLERGEN_TERMS) if (re.test(t)) out.push(a)
  // "lactose" mentions shouldn't also imply a full dairy ban.
  if (out.includes('lactose') && !/\b(dairy|casein|milk protein)\b/.test(t)) return out.filter((a) => a !== 'dairy')
  return out
}

const STYLE_TERMS: Array<[RegExp, DietStyle]> = [
  [/\b(vegan|plant[- ]based)\b/, 'vegan'],
  [/\b(vegetarian|veggie|lacto[- ]?ovo|ovo[- ]?lacto|eggetarian|lacto[- ]vegetarian)\b/, 'vegetarian'],
  [/\b(pescatarian|pescetarian)\b/, 'pescatarian'],
  [/\b(keto|ketogenic)\b/, 'keto'],
  [/\b(low[- ]carb|lchf|atkins)\b/, 'low_carb'],
  [/\bmediterranean\b/, 'mediterranean'],
  [/\b(paleo|primal)\b/, 'paleo'],
  [/\bhigh[- ]protein\b/, 'high_protein'],
  [/\bhalal\b/, 'halal'],
  [/\bkosher\b/, 'kosher'],
  [/\bjain\b/, 'jain'],
]

const EQUIPMENT_TERMS: Array<[RegExp, Equipment]> = [
  [/\b(full gym|commercial gym|gym membership|fully equipped|gym access|big box gym)\b/, 'full_gym'],
  [/\bbarbells?\b|\bsquat rack\b|\bpower rack\b/, 'barbell'],
  [/\b(dumbbells?|dbs?)\b/, 'dumbbell'],
  [/\bkettlebells?\b|\bkbs?\b/, 'kettlebell'],
  [/\bmachines?\b|\bsmith\b/, 'machine'],
  [/\bcables?\b|\bpulley\b/, 'cable'],
  [/\b(bands?|resistance bands?|loop bands?|tubes)\b/, 'band'],
  [/\b(pull[- ]?up bar|chin[- ]?up bar|doorway bar)\b/, 'pullup_bar'],
  [/\bbench\b/, 'bench'],
  [/\b(treadmill|exercise bike|stationary bike|spin bike|rower|rowing machine|elliptical|cross trainer|assault bike)\b/, 'cardio_machine'],
  [/\b(bodyweight|body weight|no equipment|calisthenics)\b/, 'bodyweight'],
]

const INJURY_TERMS: Array<[RegExp, Injury]> = [
  [/\b(knees?|acl|mcl|meniscus|patella\w*)\b/, 'knee'],
  [/\b(lower back|low back|back pain|lumbar|disc|discs|sciatica|spine|spinal|herniat\w*|back)\b/, 'lower_back'],
  [/\b(shoulders?|rotator cuff|impingement|labrum tear in shoulder)\b/, 'shoulder'],
  [/\b(wrists?|carpal)\b/, 'wrist'],
  [/\b(elbows?|tennis elbow|golfer'?s elbow)\b/, 'elbow'],
  [/\b(hips?|hip flexor)\b/, 'hip'],
  [/\b(neck|cervical)\b/, 'neck'],
  [/\b(ankles?|achilles)\b/, 'ankle'],
]

function goalFrom(text: string): GoalType | undefined {
  const t = text.toLowerCase()
  if (/\brecomp|recomposition|lose fat (and|&|while) (build|gain)|build muscle (and|&|while) los/.test(t)) return 'recomp'
  if (/\b(lose|losing|loss|cut|cutting|slim|lean out|shred|burn fat|drop|reduce (body )?fat|tone up)\b/.test(t)) return 'lose_fat'
  if (/\b(build|gain|bulk|bulking|hypertrophy|add|put on) (\w+ )?(muscle|mass|size|weight)\b|\bbulk\b|\bhypertrophy\b|\bmuscle gain\b/.test(t)) return 'build_muscle'
  if (/\b(strength|stronger|powerlifting|1rm|pr\b|personal record)/.test(t)) return 'strength'
  if (/\b(endurance|marathon|half marathon|10k|5k|triathlon|stamina|cardio fitness|run|running|race)\b/.test(t)) return 'endurance'
  if (/\b(maintain|maintenance|stay|keep)\b/.test(t)) return 'maintain'
  if (/\b(health|healthy|wellbeing|well-being|energy|fit|fitness|mobility)\b/.test(t)) return 'general_health'
  return undefined
}

function activityFrom(text: string): ActivityLevel | undefined {
  const t = text.toLowerCase()
  if (/\b(very active|extremely active|athlete|manual labou?r|physical job|construction|6-7|twice a day)\b/.test(t)) return 'very_active'
  if (/\b(sedentary|inactive|desk|office|sitting|little (or no )?exercise|wfh|work from home)\b/.test(t)) {
    // "Desk job but walk a lot" -> light.
    return /\b(walk|walks|walking|on my feet|active commute|cycle to work)\b/.test(t) ? 'light' : 'sedentary'
  }
  if (/\b(lightly active|light|somewhat active|1-3)\b/.test(t)) return 'light'
  if (/\b(moderately active|moderate|3-5|average)\b/.test(t)) return 'moderate'
  if (/\bactive\b/.test(t)) return 'active'
  return undefined
}

function experienceFrom(text: string): Experience | undefined {
  const t = text.toLowerCase()
  if (/\b(beginner|novice|new to|never|just start\w*|returning|starting out|newbie)\b/.test(t)) return 'beginner'
  if (/\b(advanced|expert|competitive|competitor|elite)\b/.test(t)) return 'advanced'
  if (/\b(intermediate|some experience|moderate)\b/.test(t)) return 'intermediate'
  const months = /(\d+)\s*months?/.exec(t)
  if (months) return Number(months[1]) >= 12 ? 'intermediate' : 'beginner'
  const years = /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/.exec(t)
  if (years) {
    const y = Number(years[1])
    return y < 1 ? 'beginner' : y < 4 ? 'intermediate' : 'advanced'
  }
  return undefined
}

function sexFrom(text: string): Sex | undefined {
  const t = text.toLowerCase().trim()
  if (/\b(female|woman|women|f|she|her|girl|lady)\b/.test(t)) return 'female'
  if (/\b(male|man|men|m|he|him|guy|boy)\b/.test(t)) return 'male'
  if (/\b(non[- ]?binary|nb|other|prefer not|x)\b/.test(t)) return 'unspecified'
  return undefined
}

function splitFrom(text: string): SplitType | undefined {
  const t = text.toLowerCase()
  if (/push[\s/,&-]*pull[\s/,&-]*legs?|\bppl\b/.test(t)) return 'push_pull_legs'
  if (/upper[\s/,&-]*(body)?[\s/,&-]*lower|\bu\/l\b/.test(t)) return 'upper_lower'
  if (/full[- ]?body|total[- ]?body/.test(t)) return 'full_body'
  if (/bro split|body[- ]?part|one muscle/.test(t)) return 'body_part'
  return undefined
}

function timeOfDay(text: string): string | undefined {
  const exact = parseTime(text)
  if (exact) return exact
  const t = text.toLowerCase()
  if (/early morning|before work|dawn/.test(t)) return '06:30'
  if (/morning|am\b/.test(t)) return '07:30'
  if (/lunch|midday|noon/.test(t)) return '12:30'
  if (/after work|evening/.test(t)) return '18:30'
  if (/afternoon/.test(t)) return '16:30'
  if (/night|late/.test(t)) return '20:00'
  return undefined
}

/** Splits "Mushrooms, olives and very spicy food" into terms. */
function splitList(text: string): string[] {
  return text
    .split(/[,;/•·]|\band\b|\bor\b|\+/i)
    .map((s) => s.replace(/[.!]+$/, '').trim())
    .filter((s) => s && !isNone(s))
}

/** Remove parentheticals that *allow* something ("lactose-free milk is fine"). */
function dropAllowances(text: string): string {
  return text.replace(/\(([^)]*)\)/g, (m, inner: string) =>
    /\b(fine|ok|okay|allowed|tolerate[ds]?|is good|are good|no problem|in moderation)\b/i.test(inner) ? '' : m,
  )
}

/* ------------------------------------------------------------------ main */

export interface ParseOptions {
  fileName?: string
  now?: Date
}

export function parseProfileMarkdown(md: string, opts: ParseOptions = {}): Profile {
  const now = opts.now ?? new Date()
  const entries = flatten(md)
  const detected = new Set<string>()
  const defaulted = new Set<string>()
  const warnings: string[] = []
  const lower = md.toLowerCase()

  const imperialVotes = (lower.match(/\b(lbs?|pounds?|ft|feet|inches|stone)\b|\d\s*'\s*\d/g) ?? []).length
  const metricVotes = (lower.match(/\b(kg|kgs|cm|kilos?)\b/g) ?? []).length
  const imperial = imperialVotes > metricVotes

  const keyed = entries.filter((e) => e.key)
  const DIET_SECTION = /diet|nutrition|food|eat|meal|macro|calor/
  const TRAINING_SECTION = /train|workout|exercise|fitness|gym|program|routine|schedule|cardio|sport|activity/

  /** First keyed entry whose key matches, optionally preferring a section. */
  function find(keyRe: RegExp, opts: { prefer?: RegExp; exclude?: RegExp; reject?: (e: Entry) => boolean } = {}): Entry | undefined {
    const matches = keyed.filter((e) => keyRe.test(e.key) && !(opts.exclude && opts.exclude.test(e.key)) && !(opts.reject && opts.reject(e)) && !isBlankAnswer(e.value))
    if (!matches.length) return undefined
    if (opts.prefer) return matches.find((e) => opts.prefer!.test(e.section)) ?? matches[0]
    return matches[0]
  }
  const findAll = (keyRe: RegExp, exclude?: RegExp) => keyed.filter((e) => keyRe.test(e.key) && !(exclude && exclude.test(e.key)))
  const itemsUnder = (sectionRe: RegExp) => entries.filter((e) => sectionRe.test(e.section))

  /* -------- identity & body */
  let name = find(/^(name|full name|first name|preferred name|nickname)$/)?.value
  if (!name) {
    const h1 = /^#\s+(.+)$/m.exec(md)?.[1]
    if (h1) {
      const cleaned = cleanInline(h1)
      const dash = /(?:profile|user|about)\s*[-–—:|]\s*(.+)$/i.exec(cleaned) ?? /^(.+?)(?:'s|’s)\s+(?:fitness\s+)?profile/i.exec(cleaned)
      if (dash && !/profile/i.test(dash[1])) name = dash[1].trim()
    }
  }
  if (name) detected.add('name')

  let age: number | undefined
  const ageEntry = find(/^(age|age years|age in years|current age)$|\bage\b/, { exclude: /stage|average|target|usage|storage|percentage|image/ })
  if (ageEntry) age = parseNumber(ageEntry.value)
  if (age == null) {
    const dob = find(/\b(dob|date of birth|birth ?date|birthday|born)\b/)
    const iso = dob && parseDate(dob.value, now)
    if (iso) age = ageFromBirthDate(iso, now)
  }
  if (age == null) {
    const m = /\b(\d{2})[- ]?(?:years?[- ]old|yrs?[- ]old|yo\b|y\/o\b)/i.exec(md)
    if (m) age = Number(m[1])
  }
  if (age != null && (age < 13 || age > 100)) {
    warnings.push(`Age ${age} looks unusual; AuraFit's formulas are designed for adults.`)
  }
  if (age != null) detected.add('age')
  else {
    age = 30
    defaulted.add('age')
    warnings.push('No age found, so AuraFit assumed 30. Edit it below for accurate calorie targets.')
  }

  let sex: Sex | undefined
  const sexEntry = find(/\b(sex|gender)\b/)
  if (sexEntry) sex = sexFrom(sexEntry.value)
  if (!sex) {
    const m = /\b\d{2}[- ]?(?:year|yr)s?[- ]old\s+(woman|man|female|male)\b|\bI(?:'m| am) an? (woman|man|female|male)\b/i.exec(md)
    if (m) sex = sexFrom(m[1] ?? m[2])
  }
  if (sex && sex !== 'unspecified') detected.add('sex')
  else {
    sex = sex ?? 'unspecified'
    defaulted.add('sex')
    warnings.push('Sex not specified: calorie targets use the average of the male and female BMR formulas.')
  }

  let heightCm: number | undefined
  const heightEntry = find(/\bheight\b|\btall\b/)
  if (heightEntry) heightCm = parseHeightCm(heightEntry.value, imperial)
  if (heightCm == null) {
    const m = /\b(\d)\s*['′]\s*(\d{1,2})\s*["″]?/.exec(md) ?? /\b(1[.,]\d{2})\s*m\b|\b(1\d{2})\s*cm\b/.exec(md)
    if (m) heightCm = parseHeightCm(m[0], imperial)
  }
  if (heightCm != null && heightCm > 100 && heightCm < 250) detected.add('heightCm')
  else {
    heightCm = 170
    defaulted.add('heightCm')
    warnings.push('No height found, so AuraFit assumed 170 cm. Please correct it.')
  }

  let weightKg: number | undefined
  const weightEntry = find(/\b(weight|weigh|body weight|bodyweight|current weight|starting weight|start weight)\b/, {
    exclude: /target|goal|ideal|desired|dream|lifting|loss|gain|change|per week|rate|class|lifted|max/,
  })
  if (weightEntry) weightKg = parseWeightKg(weightEntry.value, imperial)
  if (weightKg == null) {
    const m = /\bweigh(?:s|ing)?\s+(?:about\s+|around\s+)?(\d+(?:[.,]\d+)?\s*(?:kg|kgs|lbs?|pounds|st))/i.exec(md)
    if (m) weightKg = parseWeightKg(m[1], imperial)
  }
  if (weightKg != null && weightKg > 30 && weightKg < 350) detected.add('weightKg')
  else {
    weightKg = 70
    defaulted.add('weightKg')
    warnings.push('No current weight found, so AuraFit assumed 70 kg. Please correct it.')
  }

  const bfEntry = find(/\b(body ?fat|bf|fat percentage|fat %|body fat %|bodyfat)\b/, { exclude: /target|goal|grams?|\bg\b/ })
  const bodyFatPct = bfEntry ? parseNumber(bfEntry.value) : undefined
  if (bodyFatPct != null) detected.add('bodyFatPct')

  /* -------- goals */
  const targetEntry = find(/(target|goal|ideal|desired|dream) (body )?weight|weight (goal|target)|goal weight/)
  const targetWeightKg = targetEntry ? parseWeightKg(targetEntry.value, imperial) : undefined
  if (targetWeightKg) detected.add('targetWeightKg')

  const dateEntry = find(/(target|goal) date|deadline|by when|timeline|time ?frame|target by|goal by/)
  const targetDate = dateEntry ? parseDate(dateEntry.value, now) : undefined
  if (targetDate) detected.add('targetDate')

  const goalSection = itemsUnder(/goal|objective|aim/)
  const goalsText = uniq(
    [
      ...findAll(/^(primary |main |fitness |health |overall |top |secondary |other |long term |short term )?goals?$|objective|^focus$|^aim$/).map((e) => e.value),
      ...goalSection.filter((e) => !e.key || /goal|objective/.test(e.key)).map((e) => e.value),
    ].filter((v) => v && !isBlankAnswer(v)),
  )
  let goal: GoalType | undefined
  const primary = find(/^(primary |main |fitness |overall |top )?goals?$|objective|^focus$/)
  if (primary) goal = goalFrom(primary.value)
  if (!goal) for (const g of goalsText) if ((goal = goalFrom(g))) break
  if (!goal && targetWeightKg) {
    if (targetWeightKg < weightKg - 1) goal = 'lose_fat'
    else if (targetWeightKg > weightKg + 1) goal = 'build_muscle'
  }
  if (goal) detected.add('goal')
  else {
    goal = 'general_health'
    defaulted.add('goal')
  }

  let weeklyRateKg: number | undefined
  const rateEntry = find(/\b(rate|pace|weekly (loss|gain|change)|per week|loss per week|gain per week)\b/, { exclude: /heart|resting|sleep/ })
  if (rateEntry && /\d/.test(rateEntry.value)) {
    const v = parseWeightKg(rateEntry.value, imperial)
    if (v != null && v > 0 && v <= 2) weeklyRateKg = goal === 'build_muscle' ? v : -v
  }
  if (weeklyRateKg != null) detected.add('weeklyRateKg')

  /* -------- activity */
  const activityEntry = find(/\b(activity|activity level|how active|daily activity|job activity|lifestyle activity|neat)\b/)
  const occupation = find(/\b(occupation|job|profession|work type|career)\b/, { exclude: /hours|time|schedule/ })?.value
  let activity = activityEntry ? activityFrom(activityEntry.value) : undefined
  if (!activity && occupation) activity = activityFrom(occupation)
  if (activity) detected.add('activity')
  else {
    activity = 'light'
    defaulted.add('activity')
  }

  /* -------- nutrition */
  const dietValueEntries = keyed.filter(
    (e) => /diet|eating style|eating pattern|food preference|dietary|nutrition style|^preferences?$|^style$|^type$/.test(e.key) && !/cuisine|like|favou?rite|enjoy|dislike|allerg|intoler|restrict|avoid/.test(e.key),
  )
  const dietSectionItems = itemsUnder(DIET_SECTION).filter((e) => !e.key)
  // Parentheticals that negate something ("Jain-friendly not required") don't declare a style.
  const styleText = [...dietValueEntries.map((e) => e.value), ...dietSectionItems.map((e) => e.value)]
    .join(' \n ')
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, (m, inner: string) => (/\bnot\b|\bno longer\b|\bwas\b/.test(inner) ? '' : m))
  let styles: DietStyle[] = []
  for (const [re, s] of STYLE_TERMS) if (re.test(styleText) && !new RegExp(`\\bnot\\s+(strictly\\s+)?${re.source}`).test(styleText)) styles.push(s)
  if (styles.includes('jain') && !styles.includes('vegetarian')) styles.push('vegetarian')
  if (styles.includes('vegan')) styles = styles.filter((s) => s !== 'vegetarian' && s !== 'pescatarian')
  if (styles.length) detected.add('diet.styles')

  const allergies = new Set<Allergen>()
  const avoid = new Set<string>()
  const restrictionEntries = [
    ...findAll(/allerg|intoleran|sensitiv|restrict|avoid|exclu|can ?t eat|cannot eat|don ?t eat|do not eat|no go|never eat/),
    ...itemsUnder(/allerg|intoleran|restrict|avoid|exclu/).filter((e) => !e.key),
  ]
  for (const e of restrictionEntries) {
    if (isNone(e.value)) continue
    const strict = /allerg|intoleran|sensitiv/.test(e.key) || /allerg|intoleran/.test(e.section)
    for (const term of splitList(dropAllowances(e.value).replace(/\([^)]*\)/g, ''))) {
      const found = allergensIn(term)
      if (found.length) found.forEach((a) => (strict ? allergies.add(a) : avoid.add(a)))
      else if (!/^(severe|mild|some|none|minor|anaphylaxis|intolerance|allergy|allergic)$/i.test(term)) avoid.add(term.toLowerCase())
    }
  }
  const dislikeEntries = [...findAll(/dislike|hate|don ?t like|not a fan|aversion/), ...itemsUnder(/dislike/).filter((e) => !e.key)]
  for (const e of dislikeEntries) {
    if (isNone(e.value)) continue
    for (const term of splitList(e.value.replace(/\([^)]*\)/g, ''))) avoid.add(term.toLowerCase())
  }
  // Prose dislikes in food sections: "I hate mushrooms", "not a fan of olives".
  for (const e of itemsUnder(DIET_SECTION).filter((x) => !x.key)) {
    const m = /\b(?:hate|dislike|can'?t stand|don'?t like|do not like|not a fan of|avoid)\s+(.+)$/i.exec(e.value)
    if (m) for (const term of splitList(m[1].replace(/\([^)]*\)/g, ''))) if (!allergensIn(term).length) avoid.add(term.toLowerCase())
  }
  // Restrictive phrases in diet prose: "no eggs", "gluten-free", "allergic to shellfish".
  const dietProse = dropAllowances([...dietValueEntries, ...dietSectionItems].map((e) => e.value).join(' \n ').toLowerCase())
  for (const m of dietProse.matchAll(/\b(?:no|avoid|avoids|without|free from|allergic to|intolerant to|can't eat|cannot eat|don't eat)\s+([a-z][a-z ,&/-]{1,40})/g)) {
    for (const a of allergensIn(m[1].split(/[.;(]/)[0])) {
      if (a === 'egg' && /vegetarian/.test(dietProse)) avoid.add('egg')
      else if (/allergic|intolerant/.test(m[0])) allergies.add(a)
      else avoid.add(a)
    }
  }
  for (const m of dietProse.matchAll(/\b([a-z]+)[\s-](?:free|allergy|intolerance|intolerant|allergic)\b/g)) {
    for (const a of allergensIn(m[1])) allergies.add(a)
  }
  if (/\b(eggless|lacto[- ]vegetarian|no eggs?)\b/.test(dietProse) || styles.includes('jain')) avoid.add('egg')
  if (allergies.size) detected.add('diet.allergies')
  if (avoid.size) detected.add('diet.avoid')

  const likes = uniq(findAll(/^(likes?|loves?|favou?rite foods?|foods? i (like|love|enjoy)|enjoy|preferred foods?)$/).flatMap((e) => splitList(e.value)))
  const cuisines = uniq(findAll(/cuisines?/).flatMap((e) => splitList(e.value)))

  let mealsPerDay: number | undefined
  let snacksPerDay: number | undefined
  let skipBreakfast = false
  let fastingWindow: { start: string; end: string } | undefined
  const mealsEntry = find(/^(meals?|meals? per day|meals? a day|meals? daily|meal frequency|meal pattern|meal count|number of meals|eating (pattern|schedule|frequency)|meal structure)$/)
  if (mealsEntry) {
    const v = mealsEntry.value.toLowerCase()
    const meals = /(\d)\s*(?:main\s+)?meals?/.exec(v)
    const snacks = /(\d)\s*snacks?/.exec(v)
    if (meals) mealsPerDay = Number(meals[1])
    if (snacks) snacksPerDay = Number(snacks[1])
    if (!meals && !snacks) {
      const n = parseNumber(v)
      if (n != null) {
        mealsPerDay = Math.min(3, n)
        snacksPerDay = Math.max(0, n - 3)
      }
    }
  }
  const snacksEntry = find(/^snacks?( per day| a day)?$/)
  if (snacksEntry && snacksPerDay == null) {
    const n = parseNumber(snacksEntry.value)
    if (n != null && n <= 4) snacksPerDay = n
  }
  const fastingEntry = find(/fasting|eating window|feeding window|\bif\b|time restricted/)
  const fastingText = (fastingEntry?.value ?? '') + ' ' + (mealsEntry?.value ?? '') + ' ' + dietProse
  if (/\b(16|18|20|14)\s*[:/]\s*(8|6|4|10)\b|intermittent fasting|\bomad\b|time[- ]restricted/.test(fastingText.toLowerCase())) {
    const range = fastingEntry ? parseTimeRange(fastingEntry.value) : undefined
    const ratio = /\b(16|18|20|14)\s*[:/]\s*(8|6|4|10)\b/.exec(fastingText)
    const windowHours = ratio ? Number(ratio[2]) : /omad/i.test(fastingText) ? 2 : 8
    fastingWindow = range ? { start: range[0], end: range[1] } : { start: '12:00', end: `${String(12 + windowHours).padStart(2, '0')}:00` }
    detected.add('diet.fastingWindow')
  }
  if (/\b(skip(s|ping)? breakfast|no breakfast|don'?t eat breakfast)\b/.test(lower) || (fastingWindow && Number(fastingWindow.start.slice(0, 2)) >= 11)) {
    skipBreakfast = true
  }
  if (mealsPerDay != null) detected.add('diet.mealsPerDay')
  else defaulted.add('diet.mealsPerDay')

  const macros: Profile['macros'] = {}
  const calEntry = find(/\b(calories|calorie|kcal|energy|daily calories|calorie target|calorie goal|daily intake)\b/, { exclude: /burn|burned|expenditure|tdee|bmr/ })
  if (calEntry) {
    const n = parseRangeMid(calEntry.value)
    if (n != null && n >= 1000 && n <= 6000) macros.calories = Math.round(n)
  }
  const macroFor = (re: RegExp, exclude?: RegExp) => {
    const e = find(re, { exclude, prefer: DIET_SECTION, reject: (x) => /measure|body|composition/.test(x.section) })
    return e ? parseMacro(e.value) : undefined
  }
  const protein = macroFor(/\bprotein\b/, /powder|shake|source|bar/)
  if (protein?.grams) macros.proteinG = protein.grams
  if (protein?.perKg) macros.proteinPerKg = protein.perKg
  if (protein?.pct) macros.proteinPct = protein.pct
  const carbs = macroFor(/\b(carbs?|carbohydrates?)\b/, /source|timing/)
  if (carbs?.grams) macros.carbsG = carbs.grams
  if (carbs?.pct) macros.carbsPct = carbs.pct
  const fat = macroFor(/^(fat|fats|dietary fat|fat target|fat intake|fat grams|fat g)$/)
  if (fat?.grams) macros.fatG = fat.grams
  if (fat?.pct) macros.fatPct = fat.pct
  const fiber = macroFor(/\b(fiber|fibre)\b/)
  if (fiber?.grams) macros.fiberG = fiber.grams
  const splitEntry = find(/\b(macros?|macro split|macro ratio|ratio|split)\b/, { reject: (e) => TRAINING_SECTION.test(e.section) && !DIET_SECTION.test(e.section) })
  const split = splitEntry ? parseMacroSplit(splitEntry.value) : undefined
  if (split) {
    macros.proteinPct ??= split.protein
    macros.carbsPct ??= split.carbs
    macros.fatPct ??= split.fat
  }
  const waterEntry = find(/\b(water|hydration|fluids?|fluid intake)\b/)
  if (waterEntry) {
    const ml = parseMl(waterEntry.value)
    if (ml != null && ml >= 500 && ml <= 8000) macros.waterMl = ml
  }
  for (const k of Object.keys(macros)) detected.add(`macros.${k}`)

  /* -------- training */
  const schedule: Partial<Record<Weekday, string>> = {}
  for (const e of keyed) {
    const day = weekdayKey(e.rawKey)
    if (day && !DIET_SECTION.test(e.section) && !/meal|breakfast|lunch|dinner/.test(e.value.toLowerCase())) schedule[day] = e.value
  }
  const orderedDays = keyed
    .filter((e) => /^day ?\d$/.test(e.key) && !DIET_SECTION.test(e.section))
    .sort((a, b) => Number(a.key.replace(/\D/g, '')) - Number(b.key.replace(/\D/g, '')))
    .map((e) => e.value)

  const isRest = (text: string) => /^(rest|off|recovery|rest day|day off|none|-)\b/i.test(text.trim())
  let days: Weekday[] = []
  const daysEntry = find(/(training|workout|gym|exercise|lifting) days|days (i|to) (train|workout|lift)|^(days|schedule|training schedule|workout schedule|when)$/, {
    prefer: TRAINING_SECTION,
  })
  if (daysEntry) days = parseDays(daysEntry.value)
  const scheduleDays = (Object.keys(schedule) as Weekday[]).filter((d) => !isRest(schedule[d]!))
  for (const d of scheduleDays) if (!days.includes(d)) days.push(d)
  const freqEntry = find(/(days|sessions|times|workouts) (per|a) week|frequency|per week|weekly sessions|how often/, { prefer: TRAINING_SECTION, exclude: /loss|gain|rate|weight|alcohol|drink/ })
  let daysPerWeek = freqEntry ? parsePerWeek(freqEntry.value) ?? parseNumber(freqEntry.value) : undefined
  if (!daysPerWeek && daysEntry && !days.length) daysPerWeek = parsePerWeek(daysEntry.value)
  const trainingProse = itemsUnder(TRAINING_SECTION).filter((e) => !e.key).map((e) => e.value)
  if (!daysPerWeek && !days.length) {
    for (const line of trainingProse) {
      const n = parsePerWeek(line)
      if (n && n <= 7) {
        daysPerWeek = n
        break
      }
    }
  }
  if (daysPerWeek != null && (daysPerWeek < 1 || daysPerWeek > 7)) daysPerWeek = undefined
  const SPREAD: Record<number, Weekday[]> = {
    1: ['wed'],
    2: ['mon', 'thu'],
    3: ['mon', 'wed', 'fri'],
    4: ['mon', 'tue', 'thu', 'fri'],
    5: ['mon', 'tue', 'wed', 'fri', 'sat'],
    6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    7: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  }
  if (!days.length && orderedDays.length) days = SPREAD[Math.min(7, orderedDays.length)].slice()
  if (!days.length && daysPerWeek) days = SPREAD[daysPerWeek].slice()
  const WEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  days = WEEK.filter((d) => days.includes(d))
  if (orderedDays.length) days.forEach((d, idx) => (schedule[d] ??= orderedDays[idx % orderedDays.length]))
  if (days.length) detected.add('training.days')
  else {
    days = ['mon', 'wed', 'fri']
    defaulted.add('training.days')
  }
  daysPerWeek = days.length

  const expEntry = find(/\b(experience|training (age|level|history|background|experience)|fitness level|lifting experience|level)\b/, {
    exclude: /activity|stress|energy|water|sugar/,
  })
  let experience = expEntry ? experienceFrom(expEntry.value) : undefined
  if (experience) detected.add('training.experience')
  else {
    experience = 'beginner'
    defaulted.add('training.experience')
  }

  const durationEntry = find(/\b(session (length|duration|time)|workout (length|duration)|duration|length|time per (session|workout)|minutes per|how long|time available)\b/, {
    prefer: TRAINING_SECTION,
    reject: (e) => /sleep|fast/.test(e.key),
  })
  let sessionMinutes = durationEntry ? parseMinutes(durationEntry.value) : undefined
  if (sessionMinutes == null) {
    const line = trainingProse.find((l) => /\b\d+\s*(?:min|mins|minutes|h|hrs?|hours?)\b|\b(?:an|one|half an) hour\b|hour and a half/i.test(l))
    if (line) sessionMinutes = parseMinutes(line)
  }
  if (sessionMinutes != null && (sessionMinutes < 10 || sessionMinutes > 180)) sessionMinutes = undefined
  if (sessionMinutes) detected.add('training.sessionMinutes')
  else {
    sessionMinutes = experience === 'beginner' ? 45 : 60
    defaulted.add('training.sessionMinutes')
  }

  const equipmentText = [
    ...findAll(/\b(equipment|gear|access|location|where|setup|set up|home gym|gym|train at|training location|facility|kit)\b/, /days|time|membership fee/).map((e) => e.value),
    ...itemsUnder(/equipment|gear|home gym|setup/).map((e) => e.line),
  ]
    .join(' \n ')
    .toLowerCase()
  let equipment: Equipment[] = []
  for (const [re, eq] of EQUIPMENT_TERMS) if (re.test(equipmentText)) equipment.push(eq)
  const atGym = /\bgym\b/.test(equipmentText) && !/home gym/.test(equipmentText)
  const atHome = /\b(home|apartment|garage|living room|house)\b/.test(equipmentText)
  const outdoor = /\b(outdoor|outdoors|park|outside)\b/.test(equipmentText)
  const location: Profile['training']['location'] = atGym && atHome ? 'mixed' : atGym ? 'gym' : atHome ? 'home' : outdoor ? 'outdoor' : 'gym'
  if (atGym && !equipment.includes('full_gym') && equipment.filter((e) => e !== 'bodyweight').length === 0) equipment.push('full_gym')
  if (equipment.length) detected.add('training.equipment')
  else {
    equipment = atHome || outdoor ? ['bodyweight'] : ['dumbbell', 'bodyweight']
    defaulted.add('training.equipment')
  }
  if (!equipment.includes('bodyweight')) equipment.push('bodyweight')

  const splitText = [find(/\b(split|program|routine style|training style|style|plan type)\b/, { prefer: TRAINING_SECTION })?.value ?? '', ...itemsUnder(TRAINING_SECTION).map((e) => e.line)].join(' ')
  const splitType = splitFrom(splitText)
  if (splitType) detected.add('training.split')

  const timeEntry = find(/(preferred|usual|best) (training |workout |gym )?time|(training|workout|gym) time|time of day|when do you (train|work out)/)
  let preferredTime = timeEntry ? timeOfDay(timeEntry.value) : undefined
  if (!preferredTime) {
    const line = trainingProse.find((l) => /\b(prefer|usually|best|like to|train(?:ing)? (?:in the|after|before|at))\b/i.test(l) && /morning|evening|after work|before work|lunch|night|afternoon|\d\s*(?:am|pm)|\d:\d\d/i.test(l))
    if (line) preferredTime = timeOfDay(line)
  }
  if (preferredTime) detected.add('training.preferredTime')

  const cardio = uniq(
    [
      ...findAll(/\b(cardio|sports?|activities|conditioning|running|endurance|other training)\b/, /machine/).flatMap((e) => splitList(e.value)),
      ...itemsUnder(/cardio|sport/).filter((e) => !e.key).map((e) => e.value),
    ].filter((v) => v && !isNone(v)),
  )

  const injuryEntries = [
    ...findAll(/\b(injur\w*|limitations?|pain|conditions?|medical|health (issues?|conditions?|notes?)|physio|surgery|surgeries|mobility issues?)\b/).filter((e) => !DIET_SECTION.test(e.section) || /injur/.test(e.key)),
    ...itemsUnder(/injur|limitation|medical|health (notes|conditions)|physio|condition/).filter((e) => !e.key),
    // Prose in training sections: "Bad lower back (disc issue), no heavy deadlifts".
    ...itemsUnder(TRAINING_SECTION).filter((e) => !e.key && /\b(bad|injur\w*|pain\w*|hurts?|issues?|problems?|surgery|torn|tear|strain\w*|sprain\w*|tendon\w*|arthritis|disc|sciatica|weak|dodgy|niggle)\b/i.test(e.value)),
  ]
  const injuries = new Set<Injury>()
  const injuryNotes: string[] = []
  for (const e of injuryEntries) {
    if (isNone(e.value)) continue
    injuryNotes.push(e.value)
    const text = e.value.toLowerCase()
    for (const [re, inj] of INJURY_TERMS) {
      if (!re.test(text)) continue
      // "back" alone is too broad unless the line is about pain/injury.
      if (inj === 'lower_back' && /\bback\b/.test(text) && !/lower|low|lumbar|disc|sciatica|spine|pain|injur|herniat|tight|sore|strain/.test(text)) continue
      injuries.add(inj)
    }
  }
  if (injuries.size) detected.add('training.injuries')
  const medical = /\b(pregnan\w*|diabet\w*|hypertension|high blood pressure|heart (condition|disease)|asthma|eating disorder|kidney)\b/i.exec(md)
  if (medical) warnings.push(`Your profile mentions "${medical[1]}". AuraFit's plans are general guidance; check targets with your doctor.`)

  /* -------- lifestyle */
  const wakeEntry = find(/\b(wake|wake up|wake-up|get up|rise|alarm|wake time|morning start)\b/)
  let wake = wakeEntry ? parseTime(wakeEntry.value) ?? timeOfDay(wakeEntry.value) : undefined
  const bedEntry = find(/\b(bed ?time|sleep time|go to (bed|sleep)|lights out|sleep at|bed)\b/)
  let sleep = bedEntry ? parseTime(bedEntry.value) : undefined
  const sleepEntry = find(/^(sleep|sleep schedule|sleep window|sleep hours|sleep duration|sleep goal|sleep target|hours of sleep|average sleep)$/)
  let sleepHours: number | undefined
  if (sleepEntry) {
    const range = parseTimeRange(sleepEntry.value)
    if (range) {
      sleep ??= range[0]
      wake ??= range[1]
    } else {
      const h = parseRangeMid(sleepEntry.value)
      if (h != null && h >= 4 && h <= 12) sleepHours = h
    }
  }
  if (wake) detected.add('lifestyle.wake')
  else {
    wake = '07:00'
    defaulted.add('lifestyle.wake')
  }
  if (sleep) detected.add('lifestyle.sleep')
  else {
    sleep = '23:00'
    defaulted.add('lifestyle.sleep')
  }
  if (sleepHours == null) {
    const [wh, wm] = wake.split(':').map(Number)
    const [sh, sm] = sleep.split(':').map(Number)
    const mins = (wh * 60 + wm - (sh * 60 + sm) + 1440) % 1440
    sleepHours = mins >= 240 ? Math.round((mins / 60) * 4) / 4 : 8
  }

  const workEntry = find(/^(work|work hours|working hours|work schedule|office hours|job hours|shift|shifts|work time)$/)
  const workRange = workEntry ? parseTimeRange(workEntry.value) : undefined
  const stepsEntry = find(/\bsteps?\b/)
  const stepsGoal = stepsEntry ? parseCount(stepsEntry.value) : undefined
  const stress = find(/\bstress\b/)?.value

  const mealTimes: Profile['lifestyle']['mealTimes'] = {}
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
    const e = keyed.find((x) => new RegExp(`^${meal}s?( time)?$`).test(x.key) && parseTime(x.value))
    if (e) mealTimes[meal] = parseTime(e.value)
  }
  const routineSection = itemsUnder(/lifestyle|routine|habit|daily|morning|evening/)
  const used = /wake|bed|sleep|work|steps?|stress|breakfast|lunch|dinner|snack|occupation|job|activity/
  const routines = uniq(
    [
      ...routineSection.filter((e) => !e.key || !used.test(e.key)).map((e) => e.line),
      ...findAll(/routine|habit/).map((e) => e.line),
    ].filter((v) => v && !isBlankAnswer(v)),
  )

  /* -------- measurements */
  const measurements: Partial<Measurements> = {}
  const MEASURE_KEYS: Array<[RegExp, keyof Measurements]> = [
    [/^neck\b/, 'neck'],
    [/^(chest|bust)\b/, 'chest'],
    [/^(arms?|biceps?|upper arms?|arm circumference)\b/, 'arms'],
    [/^(waist|natural waist|belly)\b/, 'waist'],
    [/^(hips?|glutes?)\b/, 'hips'],
    [/^(thighs?|upper thighs?)\b/, 'thighs'],
    [/^(calf|calves)\b/, 'calves'],
  ]
  for (const e of keyed) {
    if (/goal|target/.test(e.key) || TRAINING_SECTION.test(e.section) && !/measure/.test(e.section)) continue
    for (const [re, k] of MEASURE_KEYS) {
      if (!re.test(e.key) || measurements[k] != null) continue
      const hintText = `${e.section} ${(e.header ?? []).join(' ').toLowerCase()} ${e.key}`
      const hint = /\b(in|inch|inches)\b/.test(hintText) ? 'in' : /\bcm\b/.test(hintText) ? 'cm' : imperial ? 'in' : undefined
      const v = parseLengthCm(e.value, hint)
      if (v != null && v > 10 && v < 250) measurements[k] = Math.round(v * 10) / 10
    }
  }
  if (bodyFatPct != null) measurements.bodyFat = bodyFatPct
  if (Object.keys(measurements).length) detected.add('measurements')

  return {
    name,
    age: Math.round(age),
    sex,
    heightCm: Math.round(heightCm * 10) / 10,
    weightKg: Math.round(weightKg * 10) / 10,
    bodyFatPct,
    targetWeightKg: targetWeightKg != null ? Math.round(targetWeightKg * 10) / 10 : undefined,
    targetDate,
    weeklyRateKg,
    goal,
    goalsText,
    activity,
    occupation,
    diet: {
      styles,
      allergies: [...allergies],
      avoid: [...avoid].filter((a) => !allergies.has(a as Allergen)),
      likes,
      cuisines,
      mealsPerDay: mealsPerDay ?? (skipBreakfast ? 2 : 3),
      snacksPerDay: snacksPerDay ?? (goal === 'build_muscle' ? 2 : 1),
      skipBreakfast,
      fastingWindow,
      notes: dietSectionItems.map((e) => e.value).filter((v) => !isBlankAnswer(v)),
    },
    macros,
    training: {
      daysPerWeek,
      days,
      schedule,
      sessionMinutes,
      experience,
      equipment: uniq(equipment),
      location,
      split: splitType,
      preferredTime,
      cardio,
      injuries: [...injuries],
      injuryNotes,
    },
    lifestyle: {
      wake,
      sleep,
      sleepHours,
      workStart: workRange?.[0],
      workEnd: workRange?.[1],
      stepsGoal: stepsGoal && stepsGoal >= 1000 && stepsGoal <= 40000 ? stepsGoal : undefined,
      stress,
      mealTimes,
      routines,
    },
    measurements,
    meta: {
      sourceMarkdown: md,
      fileName: opts.fileName,
      importedAt: now.getTime(),
      detected: [...detected],
      defaulted: [...defaulted],
      warnings,
    },
  }
}

import type { ActivityType, ExerciseSet } from './fitness'

// ─── Daily Log Detection ──────────────────────────────────────────────────────

export interface ParsedDailyFields {
  calories?: number
  protein?: number
  water?: number
  weight?: number
  sleepHours?: number
  steps?: number
  screenTime?: number
  instagramTime?: number
  smokedToday?: boolean
  drankToday?: boolean
  mood?: number
}

export interface DailyParseResult {
  detected: boolean
  fields: ParsedDailyFields
  projectHints: string[]
}

// ─── Training Detection ───────────────────────────────────────────────────────

export interface ParsedTraining {
  detected: boolean
  type: ActivityType
  label?: string
  exercises: ExerciseSet[]
  distance?: number
  duration?: number
  steps?: number
  notes?: string
  confidence: 'high' | 'medium' | 'low'
}

// Activity type keyword patterns
const STRENGTH_RE = /\b(bench(ed)?|squat(ted)?|deadlift(ed)?|press(ed)?|pull[- ]?up|pull[- ]?down|row(ed)?|curl(ed)?|lift(ed)?|strength|workout|gym|train(ed|ing)?|weights?|barbell|dumbbell|dumbell|cable|overhead|incline|lateral|tricep|bicep)\b/i
const RUN_RE = /\b(run|ran|jog(ged)?|sprint(ed)?|mile|km|kilometer)\b/i
const ROW_RE = /\b(row(ed|ing)?|erg(ed)?)\b/i
const WALK_RE = /\b(walk(ed|ing)?|hike(d)?)\b/i
const RECOVERY_RE = /\b(recovery|recover(ed|ing)?|rest(ed)?|active recovery|mobility|stretch(ed|ing)?|light day)\b/i
const SWIM_RE = /\b(swim|swam|swimming|laps?|pool)\b/i
const BIKE_RE = /\b(bike|biked?|cycling|cycled?|rode)\b/i

// Metric patterns
const DISTANCE_RE = /(\d+(?:\.\d+)?)\s*(?:mile|mi(?!\w)|km|kilometer)/i
const STEPS_RE = /(\d{1,3}(?:[,\s]?\d{3})*|[\d]+k)\s*steps?/i
const DURATION_RE = /(\d+)\s*(?:min(?:utes?)?|hrs?|hours?)/i
const ROWING_DURATION_RE = /(?:row(?:ed|ing)?|erg)\s+(?:for\s+)?(\d+)\s*min/i

// Exercise + weight + reps: "benched 275 for 6", "225 for 8 on incline"
const EX_WEIGHT_REPS_RE = /([a-z][\w\s'-]{2,30}?)\s+(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)?\s+(?:for|x|×)\s+(\d+)\s*(?:reps?)?/gi
// Weighted pull-up special form: "weighted pull-ups plus 70 for 5"
const WEIGHTED_PULLUP_RE = /weighted\s+pull[- ]?ups?\s+(?:plus|[+])\s*(\d+)\s*(?:lbs?|pounds?)?\s+(?:for\s+)?(\d+)/i

// Named exercise keywords (no weight provided)
const NAMED_EXERCISES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bincline\s+(?:bench|db|dumbbell|press)\b/i, name: 'Incline Press' },
  { pattern: /\bcable\s+rows?\b/i, name: 'Cable Row' },
  { pattern: /\blat\s+pull(?:down)?\b/i, name: 'Lat Pulldown' },
  { pattern: /\b(?:arms?|arm day)\b/i, name: 'Arms' },
  { pattern: /\bRDL\b|romanian\s+deadlift/i, name: 'Romanian Deadlift' },
  { pattern: /\bleg\s+press\b/i, name: 'Leg Press' },
  { pattern: /\boverhead\s+press\b|OHP\b/i, name: 'Overhead Press' },
  { pattern: /\blateral\s+raise\b/i, name: 'Lateral Raise' },
  { pattern: /\bbicep\s+curls?\b/i, name: 'Bicep Curl' },
  { pattern: /\btricep\b/i, name: 'Tricep Work' },
  { pattern: /\bpull[- ]?ups?\b(?!\s+(?:for|\+|plus|\d))/i, name: 'Pull-Up' },
  { pattern: /\bdips?\b/i, name: 'Dips' },
]

function detectType(text: string): ActivityType {
  if (RECOVERY_RE.test(text) && !STRENGTH_RE.test(text)) return 'recovery'
  if (SWIM_RE.test(text)) return 'swim'
  if (BIKE_RE.test(text)) return 'bike'
  if (STRENGTH_RE.test(text)) return 'strength'
  if (RUN_RE.test(text)) return 'run'
  if (ROW_RE.test(text)) return 'row'
  if (WALK_RE.test(text)) return 'walk'
  return 'custom'
}

function parseSteps(text: string): number | undefined {
  const m = text.match(STEPS_RE)
  if (!m) return undefined
  const raw = m[1].replace(/[\s,]/g, '').toLowerCase()
  if (raw.endsWith('k')) return Math.round(parseFloat(raw) * 1000)
  return parseInt(raw, 10)
}

function parseDistance(text: string): number | undefined {
  const m = text.match(DISTANCE_RE)
  if (!m) return undefined
  return parseFloat(m[1])
}

function parseDuration(text: string): number | undefined {
  // Check rowing-specific pattern first
  const rowMatch = text.match(ROWING_DURATION_RE)
  if (rowMatch) return parseInt(rowMatch[1], 10)
  const m = text.match(DURATION_RE)
  if (!m) return undefined
  const val = parseInt(m[1], 10)
  return /hrs?|hours?/i.test(m[0]) ? val * 60 : val
}

function parseExercises(text: string): ExerciseSet[] {
  const exercises: ExerciseSet[] = []
  const seen = new Set<string>()

  // Weighted pull-up special case
  const pullupM = text.match(WEIGHTED_PULLUP_RE)
  if (pullupM) {
    exercises.push({
      exercise: 'Weighted Pull-Up',
      weight: parseFloat(pullupM[1]),
      weightUnit: 'lb',
      reps: parseInt(pullupM[2], 10),
    })
    seen.add('weighted pull-up')
  }

  // Exercise + weight + reps
  EX_WEIGHT_REPS_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EX_WEIGHT_REPS_RE.exec(text)) !== null) {
    const raw = m[1].trim().replace(/^(and|then|also|did|do)\s+/i, '').trim()
    if (raw.length < 3 || raw.length > 35) continue
    const key = raw.toLowerCase()
    if (seen.has(key)) continue
    // Skip false positives (pure prepositions etc.)
    if (/^(the|a|an|for|on|in|at)$/i.test(raw)) continue
    seen.add(key)
    exercises.push({
      exercise: raw.charAt(0).toUpperCase() + raw.slice(1),
      weight: parseFloat(m[2]),
      weightUnit: 'lb',
      reps: parseInt(m[3], 10),
    })
  }

  // Named exercises without weight
  for (const { pattern, name } of NAMED_EXERCISES) {
    if (pattern.test(text) && !seen.has(name.toLowerCase())) {
      exercises.push({ exercise: name })
      seen.add(name.toLowerCase())
    }
  }

  return exercises
}

export function parseTrainingFromVoiceLog(transcript: string): ParsedTraining {
  if (!transcript || transcript.trim().length < 8) {
    return { detected: false, type: 'custom', exercises: [], confidence: 'low' }
  }

  const type = detectType(transcript)

  const hasActivityKeyword =
    STRENGTH_RE.test(transcript) || RUN_RE.test(transcript) ||
    ROW_RE.test(transcript) || WALK_RE.test(transcript) ||
    RECOVERY_RE.test(transcript) || SWIM_RE.test(transcript) ||
    BIKE_RE.test(transcript)

  if (!hasActivityKeyword) {
    return { detected: false, type: 'custom', exercises: [], confidence: 'low' }
  }

  const exercises = (type === 'strength' || STRENGTH_RE.test(transcript))
    ? parseExercises(transcript)
    : []

  const distance = parseDistance(transcript)
  const steps = parseSteps(transcript)
  const duration = parseDuration(transcript)

  const confidence: 'high' | 'medium' | 'low' =
    exercises.filter((e) => e.weight).length >= 2 || (distance !== undefined && type === 'run') ? 'high' :
    exercises.length > 0 || distance !== undefined || (steps !== undefined && steps > 1000) ? 'medium' :
    'low'

  return {
    detected: true,
    type,
    exercises,
    distance,
    steps,
    duration,
    confidence,
  }
}

// ─── Daily log field detection ────────────────────────────────────────────────

const DAILY_CAL_RE = /(?:(?:ate?|consumed?|had|tracked|logged|hit)\s+)?(\d{3,4})\s*(?:cal(?:ories?)?|kcal)/i
const DAILY_PROTEIN_RE = /(\d{2,3})\s*g(?:rams?)?\s*(?:of\s+)?protein|protein\s+(?:(?:was|is|of|hit|at)\s+)?(\d{2,3})/i
const DAILY_WATER_RE = /(\d+(?:\.\d+)?)\s*glasses?\s*(?:of\s+)?water|drank\s+(\d+(?:\.\d+)?)\s*glass/i
const DAILY_BW_RE = /(?:weigh(?:ed|t)|bodyweight|body\s+weight|bw|scale(?:\s+said)?)\s+(?:(?:was|is|at|came\s+in(?:\s+at)?)\s+)?(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)?/i
const DAILY_SLEEP_RE = /(?:slept?|sleep|got)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i
const DAILY_SCREEN_RE = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s+)?screen[\s-]?time|screen[\s-]?time\s+(?:(?:was|is)\s+)?(\d+(?:\.\d+)?)/i
const DAILY_IG_RE = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s+)?(?:instagram|ig\b)|(?:instagram|ig)\s*(?:time\s+)?(?:(?:was|is)\s+)?(\d+(?:\.\d+)?)/i
const DAILY_SMOKED_NO_RE = /\b(?:didn'?t\s+smoke|no\s+smoke|smoke[\s-]?free|tobacco[\s-]?free|no\s+cigarette)\b/i
const DAILY_SMOKED_YES_RE = /\b(?:smoked|had\s+a\s+cigarette|cigarettes?)\b/i
const DAILY_DRANK_NO_RE = /\b(?:didn'?t\s+drink|alcohol[\s-]?free|sober|no\s+drinks?|dry\s+day|streak\s+continues)\b/i
const DAILY_DRANK_YES_RE = /\b(?:had\s+(?:a\s+)?(?:drink|beer|wine|whiskey|cocktail)|drank\s+alcohol|had\s+drinks?)\b/i
const DAILY_MOOD_NUM_RE = /(?:mood|energy|feeling)\s+(?:(?:is|was)\s+)?(?:a\s+)?([1-5])(?:\s*(?:out\s+of\s+5|\/5))?/i
const DAILY_MOOD_WORD_RE = /(?:feeling|feel)\s+(amazing|great|good|alright|okay|ok\b|meh|bad|terrible|awful)/i
const DAILY_MOOD_MAP: Record<string, number> = {
  amazing: 5, great: 5, good: 4, alright: 3, okay: 3, ok: 3, meh: 2, bad: 2, terrible: 1, awful: 1,
}
const PROJECT_HINT_RE = /(?:working\s+on|updated?|progress(?:\s+on)?|finished?|completed?|blocked\s+on)\s+([A-Z][a-zA-Z\s]{2,30}?)(?:[.,;]|$)/gm

function firstNum(m: RegExpMatchArray | null, ...groups: number[]): number | undefined {
  if (!m) return undefined
  for (const g of groups) if (m[g]) return parseFloat(m[g])
  return undefined
}

export function parseDailyFromVoiceLog(transcript: string): DailyParseResult {
  if (!transcript || transcript.trim().length < 5) return { detected: false, fields: {}, projectHints: [] }

  const t = transcript
  const f: ParsedDailyFields = {}

  const cal = firstNum(t.match(DAILY_CAL_RE), 1)
  if (cal && cal >= 100 && cal <= 9999) f.calories = cal

  const prot = firstNum(t.match(DAILY_PROTEIN_RE), 1, 2)
  if (prot && prot >= 10 && prot <= 500) f.protein = prot

  const water = firstNum(t.match(DAILY_WATER_RE), 1, 2)
  if (water && water >= 1 && water <= 30) f.water = water

  const bw = firstNum(t.match(DAILY_BW_RE), 1)
  if (bw && bw >= 80 && bw <= 400) f.weight = bw

  const sleep = firstNum(t.match(DAILY_SLEEP_RE), 1)
  if (sleep && sleep >= 1 && sleep <= 14) f.sleepHours = sleep

  const stM = t.match(STEPS_RE)
  if (stM) {
    const raw = stM[1].replace(/[\s,]/g, '').toLowerCase()
    const steps = raw.endsWith('k') ? Math.round(parseFloat(raw) * 1000) : parseInt(raw, 10)
    if (steps >= 100 && steps <= 100_000) f.steps = steps
  }

  const screen = firstNum(t.match(DAILY_SCREEN_RE), 1, 2)
  if (screen && screen >= 0.1 && screen <= 24) f.screenTime = screen

  const ig = firstNum(t.match(DAILY_IG_RE), 1, 2)
  if (ig && ig >= 0.05 && ig <= 12) f.instagramTime = ig

  if (DAILY_SMOKED_NO_RE.test(t)) f.smokedToday = false
  else if (DAILY_SMOKED_YES_RE.test(t)) f.smokedToday = true

  if (DAILY_DRANK_NO_RE.test(t)) f.drankToday = false
  else if (DAILY_DRANK_YES_RE.test(t)) f.drankToday = true

  const moodNumM = t.match(DAILY_MOOD_NUM_RE)
  if (moodNumM) {
    f.mood = parseInt(moodNumM[1], 10)
  } else {
    const moodWordM = t.match(DAILY_MOOD_WORD_RE)
    if (moodWordM) f.mood = DAILY_MOOD_MAP[moodWordM[1].toLowerCase()]
  }

  const projectHints: string[] = []
  PROJECT_HINT_RE.lastIndex = 0
  let pm: RegExpExecArray | null
  while ((pm = PROJECT_HINT_RE.exec(t)) !== null) {
    const h = pm[1].trim()
    if (h.length > 2 && !projectHints.includes(h)) projectHints.push(h)
  }

  return {
    detected: Object.keys(f).length > 0 || projectHints.length > 0,
    fields: f,
    projectHints,
  }
}

// Rule-based fallback for the XODUS agent router.
// Server-safe — pure functions, no window/localStorage access.
//
// Covers the common Picard OS phrasings so the agent stays useful when the
// AI provider is unreachable. Extracted here (not in chat-fallback.ts) because
// the agent emits the broader XodusAction union with new types like
// log_manual_health, create_workout_log, create_memory_candidate.

import { parseXodusInput } from '../daily-goals'
import { computeReadiness } from './readiness'
import type {
  XodusAction,
  XodusAgentResult,
  CreateGroceryAction,
  CreateNoteAction,
  LogFoodAction,
  LogManualHealthAction,
  CreateWorkoutLogAction,
  CompleteGoalAction,
  CreateMemoryCandidateAction,
  CreateProjectUpdateAction,
  TrainingRecommendationAction,
  WorkoutExerciseInput,
} from './action-types'
import { classifyIntent } from './action-types'
import type { XodusChatContext } from './chat-types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = () => new Date().toISOString().slice(0, 10)

function num(str: string): number {
  return parseFloat(str.replace(/,/g, ''))
}

// ─── Grocery ──────────────────────────────────────────────────────────────────

const GROCERY_WORD  = /\bgrocer/i
const GROCERY_VERB  = /\b(add|buy|pick\s+up|get)\b/i
const GROCERY_ITEMS = /(food|eggs|chicken|yogurt|rice|milk|bread|fruit|veg|protein\s+powder|oats|beef|salmon|tuna|banana|apple|spinach)/i

function detectGrocery(text: string): CreateGroceryAction | null {
  const isGrocery = GROCERY_WORD.test(text) || (GROCERY_VERB.test(text) && GROCERY_ITEMS.test(text))
  if (!isGrocery) return null

  const trimmed = text
    .replace(/.*?\b(?:add|buy|pick\s+up|get)\b\s*/i, '')
    .replace(/\bto\s+groceries?\b.*$/i, '')
    .replace(/\bfor\s+groceries?\b.*$/i, '')
    .trim()

  const items = trimmed
    .split(/,| and /i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 60)

  if (items.length === 0) return null
  return { type: 'create_grocery', items, confidence: 0.85 }
}

// ─── Food log ─────────────────────────────────────────────────────────────────

function detectLogFood(text: string): LogFoodAction | null {
  const lower = text.toLowerCase()
  if (!/\b(ate|eaten|had|consumed|so\s+far|today)\b/.test(lower)) return null

  const action: LogFoodAction = { type: 'log_food', confidence: 0.8 }
  let found = false

  const cal = lower.match(/(\d{2,4})\s*(?:cal(?:ories?)?|kcal)\b/)
  if (cal) { action.calories = parseInt(cal[1], 10); found = true }

  const prot = lower.match(/(\d{2,3})\s*g?\s*(?:of\s+)?protein\b/)
  if (prot) { action.protein = parseInt(prot[1], 10); found = true }

  const carb = lower.match(/(\d{2,3})\s*g?\s*(?:of\s+)?carbs?\b/)
  if (carb) { action.carbs = parseInt(carb[1], 10); found = true }

  const fat = lower.match(/(\d{2,3})\s*g?\s*(?:of\s+)?fat\b/)
  if (fat) { action.fat = parseInt(fat[1], 10); found = true }

  return found ? action : null
}

// ─── Manual health ────────────────────────────────────────────────────────────
// "log 8500 steps", "walked 4 miles", "active energy 600", "slept 7.5 hours",
// "health sync: steps 8500, distance 4.2 miles, active energy 600"

function detectManualHealth(text: string): LogManualHealthAction | null {
  const lower = text.toLowerCase()
  const action: LogManualHealthAction = { type: 'log_manual_health', confidence: 0.8 }
  let found = false

  const stepsM = lower.match(/(\d[\d,]{2,6})\s*steps\b/) || lower.match(/\bsteps?\s*[:=]?\s*(\d[\d,]{2,6})\b/)
  if (stepsM) { action.steps = Math.round(num(stepsM[1])); found = true }

  const distM = lower.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles)\b/) || lower.match(/\b(?:walked|ran|distance)\s*(?:for\s*)?(\d+(?:\.\d+)?)\s*(?:mi|miles)?\b/)
  if (distM && /\b(walk|ran|run|distance|miles?|mi\b)/.test(lower)) {
    action.distanceMiles = num(distM[1]); found = true
  }

  const energyM = lower.match(/active\s+energy\s*[:=]?\s*(\d{2,4})/) || lower.match(/(\d{3,4})\s*(?:active\s+)?kcal/)
  if (energyM) { action.activeEnergyKcal = parseInt(energyM[1], 10); found = true }

  const sleepM = lower.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours)\s*(?:of\s+)?sleep/) || lower.match(/\bslept\s+(\d+(?:\.\d+)?)\s*(?:hrs?|hours)/)
  if (sleepM) { action.sleepHours = num(sleepM[1]); found = true }

  const weightM = lower.match(/\b(?:weighed?|weight)\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)/)
  if (weightM) { action.weightLb = num(weightM[1]); found = true }

  return found ? action : null
}

// ─── Workout log ──────────────────────────────────────────────────────────────
// "did 3 sets of pull-ups, 4 sets of bench, 5 sets of dead hangs"
// "ran 3 miles", "rowed 2k"

const SET_PATTERN = /(\d+)\s*sets?\s*(?:of\s+)?([a-z][a-z\- ]{2,30}?)(?=,|$|\sand\b|\.\s)/gi
const REP_DETAIL  = /(\d+)\s*reps?/

function detectWorkout(text: string): CreateWorkoutLogAction | null {
  const lower = text.toLowerCase()
  const exercises: WorkoutExerciseInput[] = []

  // Strength: N sets of X
  let m: RegExpExecArray | null
  const pattern = new RegExp(SET_PATTERN.source, 'gi')
  while ((m = pattern.exec(lower)) !== null) {
    const sets = parseInt(m[1], 10)
    const name = m[2].trim().replace(/\s+/g, ' ')
    if (name.length < 2) continue
    const repM = lower.slice(m.index, m.index + 80).match(REP_DETAIL)
    exercises.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      sets,
      reps: repM ? parseInt(repM[1], 10) : undefined,
    })
  }

  // Cardio shorthand: "ran 3 miles", "rowed 2k", "biked 12 miles"
  const cardio = lower.match(/\b(ran|rowed|biked|swam|hiked)\s+(\d+(?:\.\d+)?)\s*(mi|miles|k|km)?/)

  if (exercises.length > 0) {
    return {
      type: 'create_workout_log',
      activityType: 'strength',
      exercises,
      date: TODAY(),
      confidence: 0.85,
    }
  }

  if (cardio) {
    const verb = cardio[1]
    const map: Record<string, string> = { ran: 'run', rowed: 'row', biked: 'bike', swam: 'swim', hiked: 'walk' }
    const type = map[verb] ?? 'custom'
    return {
      type: 'create_workout_log',
      activityType: type,
      title: `${cardio[2]} ${cardio[3] ?? 'mi'} ${type}`,
      date: TODAY(),
      confidence: 0.8,
    }
  }

  return null
}

// ─── Goal completion ──────────────────────────────────────────────────────────
// "I dunked today", "finished the brain page"

const COMPLETE_VERBS = /\b(finished|completed|did|done\s+with|crushed|hit|dunked|nailed)\b/i

function detectCompleteGoal(text: string, todayGoals: { text: string }[]): CompleteGoalAction | null {
  if (!COMPLETE_VERBS.test(text)) return null
  const lower = text.toLowerCase()

  // Try to match an existing goal text by keyword overlap.
  for (const g of todayGoals) {
    const words = g.text.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const hits = words.filter(w => lower.includes(w)).length
    if (hits >= 1) {
      return { type: 'complete_goal', goalQuery: g.text, date: TODAY(), confidence: 0.8 }
    }
  }

  // Generic "I X today" — flag for review since we couldn't match a goal
  const verbWord = (text.match(COMPLETE_VERBS)?.[1] ?? '').toLowerCase()
  if (verbWord === 'dunked') {
    return { type: 'complete_goal', goalQuery: 'dunk', date: TODAY(), confidence: 0.7 }
  }
  return null
}

// ─── Memory candidate ─────────────────────────────────────────────────────────
// "remember that X", "new fact: X", "I prefer X over Y"

const MEMORY_TRIGGERS = /\b(remember\s+that|new\s+fact\s*:|note\s+to\s+self|i\s+prefer)\b/i

function detectMemoryCandidate(text: string): CreateMemoryCandidateAction | null {
  if (!MEMORY_TRIGGERS.test(text)) return null
  const summary = text.replace(MEMORY_TRIGGERS, '').replace(/^[:\s]+/, '').trim()
  if (summary.length < 4) return null
  return {
    type:    'create_memory_candidate',
    title:   summary.split(/[.!?]/)[0].slice(0, 80),
    category: 'needs_confirmation',
    summary,
    status:  'needs_confirmation',
    confidence: 0.7,
  }
}

// ─── Project update ───────────────────────────────────────────────────────────
// "add note to Porsche: order brake rotors"
// "Picard OS update: shipped the agent router"

const PROJECT_PHRASE = /\b(?:note\s+to|update\s+(?:on|for|to)|for)\s+(porsche|picard\s*os|xodus|play|flying\s+elephants|apartment|neurobuild|graton)\b\s*[:\-]?\s*(.+)$/i

function detectProjectUpdate(text: string): { project: CreateProjectUpdateAction; note: CreateNoteAction } | null {
  const m = text.match(PROJECT_PHRASE)
  if (!m) return null
  const projectName = m[1].trim()
  const body        = m[2].trim()
  if (body.length < 2) return null

  const project: CreateProjectUpdateAction = {
    type:       'create_project_update',
    projectName,
    update:     body,
    confidence: 0.6,
  }
  // Also create a note pinned to the project category for the Obsidian export.
  const note: CreateNoteAction = {
    type:      'create_note',
    title:     `${projectName}: ${body.slice(0, 40)}`,
    body,
    category:  /porsche/i.test(projectName) ? 'car' : 'project',
    confidence: 0.8,
  }
  return { project, note }
}

// ─── Free-form note ───────────────────────────────────────────────────────────

const NOTE_TRIGGERS = /\b(log\s+(?:this|that)|note\s+that|just\s+log|reflect|frustrat|rough\s+day|feeling|i\s+talked\s+to)\b/i

function detectFreeNote(text: string): CreateNoteAction | null {
  if (!NOTE_TRIGGERS.test(text)) return null
  return {
    type:       'create_note',
    body:       text,
    category:   'personal',
    confidence: 0.7,
  }
}

// ─── Training recommendation ──────────────────────────────────────────────────

const TRAINING_Q = /\b(what\s+(?:kind\s+of\s+)?training|should\s+i\s+train|train\s+today|run\s+today|workout\s+today|lift\s+today|keep\s+(?:it|training)\s+(?:lighter|easier|chill))/i
const LIGHTER    = /\b(lighter|easier|chill|deload|low)\b/i

function detectTraining(text: string, ctx: XodusChatContext): TrainingRecommendationAction | null {
  if (!TRAINING_Q.test(text)) return null
  const readiness = computeReadiness(ctx)
  let intensity: 'low' | 'moderate' | 'high'
  let summary: string

  if (readiness.signal === 'green') {
    summary = 'Recovery is green — full effort is on the table. Keep load aligned with your cut.'
    intensity = 'high'
  } else if (readiness.signal === 'amber') {
    summary = 'Moderate session: lifts at RPE 7, or run easy.'
    intensity = 'moderate'
  } else if (readiness.signal === 'red') {
    summary = 'Active recovery or walk. Skip high intensity.'
    intensity = 'low'
  } else {
    summary = 'Not enough data — log recovery and sleep first.'
    intensity = 'moderate'
  }
  if (LIGHTER.test(text)) intensity = 'low'

  return { type: 'training_recommendation', summary, intensity, confidence: 0.9 }
}

// ─── Reply builder ────────────────────────────────────────────────────────────

function buildReply(actions: XodusAction[], ctx: XodusChatContext): string {
  const parts: string[] = []
  const counts = { goals: 0, notes: 0, groc: 0, food: 0, health: 0, workout: 0, mem: 0, proj: 0 }

  for (const a of actions) {
    switch (a.type) {
      case 'create_goal':            counts.goals++;    break
      case 'create_note':            counts.notes++;    break
      case 'create_grocery':         counts.groc++;     break
      case 'log_food':               counts.food++;     break
      case 'log_manual_health':      counts.health++;   break
      case 'create_workout_log':     counts.workout++;  break
      case 'create_memory_candidate':counts.mem++;      break
      case 'create_project_update':  counts.proj++;     break
    }
  }

  if (counts.workout > 0) parts.push('Logged the workout.')
  if (counts.health > 0)  parts.push('Manual health logged.')
  if (counts.food > 0)    parts.push('Food logged.')
  if (counts.goals > 0)   parts.push(`Captured ${counts.goals} goal${counts.goals > 1 ? 's' : ''}.`)
  // Rule-based fallback talks like XODUS, not like a form receipt. This path
  // runs only when the AI provider is unreachable or returns nothing parseable.
  if (counts.groc > 0)    parts.push("Got it — I'd add those to the grocery list once Telegram saves are wired.")
  if (counts.notes > 0 && counts.groc === 0 && counts.proj === 0) parts.push("Holding that as a note for /xodus to pick up.")
  if (counts.proj > 0)    parts.push("Treating that as a project update — pending review on /xodus.")
  if (counts.mem > 0)     parts.push("That sounds like a memory candidate — flagging for review.")

  const training = actions.find(a => a.type === 'training_recommendation') as TrainingRecommendationAction | undefined
  if (training) parts.push(training.summary)

  if (parts.length === 0) {
    // No actions extracted — give an honest, useful reply.
    const log = ctx.dailyLog
    if (log?.protein !== null && log?.protein !== undefined && ctx.nutritionProfile.proteinTarget) {
      const gap = ctx.nutritionProfile.proteinTarget - log.protein
      if (gap > 0) parts.push(`You're ${gap}g short of your ${ctx.nutritionProfile.proteinTarget}g protein target — easy fix.`)
      else parts.push(`Protein target met (${log.protein}g). Solid.`)
    } else {
      parts.push("AI provider is offline so I'm in fallback mode. Tell me what's on your plate and I'll help rank it.")
    }
  }

  return parts.join(' ')
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function fallbackRoute(text: string, ctx: XodusChatContext): XodusAgentResult {
  const actions: XodusAction[] = []

  // 1. Daily-goals parser handles goals + nutrition profile updates
  const parsed = parseXodusInput(text)
  for (const g of parsed.goals) {
    actions.push({
      type:       'create_goal',
      title:      g.text,
      date:       parsed.targetDate,
      category:   g.category,
      confidence: 0.75,
    })
  }
  if (parsed.nutritionUpdate) {
    actions.push({
      type:       'update_nutrition_profile',
      updates:    parsed.nutritionUpdate,
      confidence: 0.7,
    })
  }

  // 2. Workout — strong signal, runs before generic note detection
  const workout = detectWorkout(text)
  if (workout) actions.push(workout)

  // 3. Manual health
  const health = detectManualHealth(text)
  if (health) {
    // Don't double-log when workout also captured distance
    if (workout && health.distanceMiles && !health.steps && !health.activeEnergyKcal) {
      // skip — workout already covers it
    } else {
      actions.push(health)
    }
  }

  // 4. Food log
  const food = detectLogFood(text)
  if (food) actions.push(food)

  // 5. Grocery (replaces note)
  const groc = detectGrocery(text)
  if (groc) {
    // Strip leaked grocery items out of any captured goals
    const grocLower = groc.items.join(' ').toLowerCase()
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i]
      if (a.type === 'create_goal' && grocLower.includes(a.title.toLowerCase())) {
        actions.splice(i, 1)
      }
    }
    actions.push(groc)
  }

  // 6. Project update (also creates a note)
  const proj = detectProjectUpdate(text)
  if (proj) {
    actions.push(proj.note)
    actions.push(proj.project)
  }

  // 7. Memory candidate
  const mem = detectMemoryCandidate(text)
  if (mem) actions.push(mem)

  // 8. Goal completion (matches today's goals if possible)
  const complete = detectCompleteGoal(text, ctx.todayGoals.map(g => ({ text: g.text })))
  if (complete) actions.push(complete)

  // 9. Free-form note (only if nothing else captured)
  if (actions.length === 0) {
    const note = detectFreeNote(text)
    if (note) actions.push(note)
  }

  // 10. Training advice
  const train = detectTraining(text, ctx)
  if (train) actions.push(train)

  // 11. Splits
  const autoApply: XodusAction[] = []
  const needsReview: XodusAction[] = []
  for (const a of actions) {
    const auto = isAutoApplyableInline(a)
    if (auto) autoApply.push(a)
    else needsReview.push(a)
  }

  const reply = buildReply(actions, ctx)
  const confidence = actions.length > 0
    ? actions.reduce((s, a) => s + (('confidence' in a ? a.confidence : undefined) ?? 0.7), 0) / actions.length
    : 0.4

  return {
    reply,
    intent:             classifyIntent(actions),
    actions,
    autoApplyActions:   autoApply,
    needsReviewActions: needsReview,
    confidence,
    source:             'rule_based',
    missingDataSignals: ctx.missingDataSignals,
  }
}

// Local copy to avoid a circular import quirk between modules.
function isAutoApplyableInline(action: XodusAction): boolean {
  const conf = 'confidence' in action ? (action.confidence ?? 1.0) : 1.0
  switch (action.type) {
    case 'create_note':
    case 'create_grocery':
    case 'create_goal':
    case 'log_food':
    case 'log_manual_health':
    case 'create_workout_log':
    case 'add_open_loop':
    case 'complete_goal':
    case 'update_goal':
    case 'update_note':
      return conf >= 0.6
    case 'update_nutrition_profile':
      return conf >= 0.85
    case 'training_recommendation':
    case 'no_op':
      return true
    case 'create_project_update':
    case 'create_memory_candidate':
    case 'save_pending_review':
      return false
  }
}

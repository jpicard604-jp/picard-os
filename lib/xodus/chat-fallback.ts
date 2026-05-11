// Rule-based fallback for the XODUS chat route.
// Pure functions only — no localStorage, no window access. Runs on server.
// Produces a conversational reply + best-effort structured actions.

import { parseXodusInput } from '../daily-goals'
import { computeReadiness } from './readiness'
import type {
  XodusChatContext,
  XodusChatResponse,
  XodusChatAction,
  CreateNoteAction,
  LogFoodAction,
} from './chat-types'

// ─── Grocery detection ────────────────────────────────────────────────────────

const GROCERY_VERBS = /\b(add|buy|pick\s+up|get)\b/i
const GROCERY_WORD  = /\bgrocer/i

function detectGrocery(text: string): CreateNoteAction | null {
  const isGrocery = GROCERY_WORD.test(text) || (GROCERY_VERBS.test(text) && /(food|eggs|chicken|yogurt|rice|milk|bread|fruit|veg|protein\s+powder)/i.test(text))
  if (!isGrocery) return null

  // Strip leading verb/preamble like "add X to groceries" or "buy X, Y, Z"
  const items = text
    .replace(/.*?\b(?:add|buy|pick\s+up|get)\b\s*/i, '')
    .replace(/\bto\s+groceries?\b.*$/i, '')
    .replace(/\bfor\s+groceries?\b.*$/i, '')
    .trim()

  return {
    type:     'create_note',
    title:    'Grocery list',
    body:     items.length > 0 ? items : text,
    category: 'grocery',
  }
}

// ─── Food log detection ───────────────────────────────────────────────────────
// "I ate 900 calories and 80g protein" / "had 2200 cal so far"

function detectLogFood(text: string): LogFoodAction | null {
  const lower = text.toLowerCase()
  const action: LogFoodAction = { type: 'log_food' }
  let found = false

  if (!/\b(ate|eaten|had|consumed|so\s+far|today)\b/.test(lower)) return null

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

// ─── Note phrasing detection ──────────────────────────────────────────────────

const NOTE_TRIGGERS = /\b(log\s+(?:this|that)|note\s+that|just\s+log|reflect|frustrat|rough\s+day|feeling|i\s+talked\s+to)\b/i

function detectFreeNote(text: string): CreateNoteAction | null {
  if (!NOTE_TRIGGERS.test(text)) return null
  return {
    type:     'create_note',
    body:     text,
    category: 'personal',
  }
}

// ─── Training-question detection ──────────────────────────────────────────────

const TRAINING_Q = /\b(what\s+(?:kind\s+of\s+)?training|should\s+i\s+train|train\s+today|run\s+today|workout\s+today|lift\s+today|keep\s+(?:it|training)\s+(?:lighter|easier|chill))/i
const LIGHTER    = /\b(lighter|easier|chill|deload|low)\b/i

// ─── Conversation builder ─────────────────────────────────────────────────────

function buildMessage(
  ctx: XodusChatContext,
  actions: XodusChatAction[],
  trainingQ: boolean,
  lighterHint: boolean,
): { message: string; readiness: ReturnType<typeof computeReadiness> } {
  const readiness = computeReadiness(ctx)
  const parts: string[] = []

  // Confirmation lines for actions taken
  const goalCount   = actions.filter(a => a.type === 'create_goal').length
  const noteCount   = actions.filter(a => a.type === 'create_note').length
  const nutritionCount = actions.filter(a => a.type === 'update_nutrition').length
  const foodLog     = actions.find(a => a.type === 'log_food') as LogFoodAction | undefined

  if (goalCount > 0) parts.push(`Captured ${goalCount} goal${goalCount > 1 ? 's' : ''}.`)
  if (noteCount > 0) {
    const isGroc = actions.some(a => a.type === 'create_note' && a.category === 'grocery')
    parts.push(isGroc ? 'Added to your grocery note.' : 'Logged as a note.')
  }
  if (nutritionCount > 0) parts.push('Updated your nutrition profile.')
  if (foodLog) {
    const bits = [
      foodLog.calories ? `${foodLog.calories} cal` : null,
      foodLog.protein  ? `${foodLog.protein}g protein` : null,
    ].filter(Boolean).join(' · ')
    if (bits) parts.push(`Logged ${bits} for today.`)
  }

  // Training guidance
  if (trainingQ || actions.some(a => a.type === 'training_recommendation')) {
    if (readiness.signal === 'green') {
      parts.push('Recovery looks green — full-effort training is on the table. Keep nutrition aligned with your cut.')
    } else if (readiness.signal === 'amber') {
      parts.push('Mixed signal today. Moderate intensity, prioritize technique over load.')
    } else if (readiness.signal === 'red') {
      parts.push('Low readiness. Active recovery, walk, or skip the session.')
    } else {
      parts.push('Not enough check-in data to call it — log recovery and sleep first.')
    }
  }

  if (lighterHint && !trainingQ) {
    parts.push('Noted — keeping the recommendation lighter.')
  }

  // Nutrition gap nudge (only if user didn't ask about something else specifically)
  if (parts.length === 0) {
    const log = ctx.dailyLog
    if (log && log.protein !== null && ctx.nutritionProfile.proteinTarget) {
      const gap = ctx.nutritionProfile.proteinTarget - log.protein
      if (gap > 0) parts.push(`You're ${gap}g short of your ${ctx.nutritionProfile.proteinTarget}g protein target.`)
      else parts.push(`Protein target met (${log.protein}g).`)
    } else if (!log) {
      parts.push('No daily log yet today. Log recovery and nutrition for a full readout.')
    } else {
      parts.push('Got it.')
    }
  }

  return { message: parts.join(' '), readiness }
}

// ─── Main fallback entry ──────────────────────────────────────────────────────

export function buildFallbackResponse(
  userText: string,
  ctx: XodusChatContext,
): XodusChatResponse {
  const actions: XodusChatAction[] = []
  const missingData: string[] = []

  // 1. Goals + nutrition profile updates from existing parser
  const parsed = parseXodusInput(userText)
  for (const g of parsed.goals) {
    actions.push({
      type:     'create_goal',
      title:    g.text,
      date:     parsed.targetDate,
      category: g.category,
    })
  }
  if (parsed.nutritionUpdate) {
    actions.push({ type: 'update_nutrition', updates: parsed.nutritionUpdate })
  }

  // 2. Grocery → note
  const groc = detectGrocery(userText)
  if (groc) {
    // Strip out grocery items that may have leaked into goals
    const grocItems = groc.body.toLowerCase()
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i]
      if (a.type === 'create_goal' && grocItems.includes(a.title.toLowerCase())) {
        actions.splice(i, 1)
      }
    }
    actions.push(groc)
  }

  // 3. Free-form note
  if (!groc) {
    const note = detectFreeNote(userText)
    if (note && actions.length === 0) actions.push(note)
  }

  // 4. Food log
  const food = detectLogFood(userText)
  if (food) actions.push(food)

  // 5. Training recommendation if asked
  const trainingQ   = TRAINING_Q.test(userText)
  const lighterHint = LIGHTER.test(userText)

  if (trainingQ) {
    const readiness = computeReadiness(ctx)
    let summary: string
    let intensity: 'low' | 'moderate' | 'high'
    if (readiness.signal === 'green') {
      summary = 'Recovery is green — full effort is on the table. Keep load aligned with your cut.'
      intensity = 'high'
    } else if (readiness.signal === 'amber') {
      summary = 'Moderate session: hit the lifts at RPE 7 or run easy.'
      intensity = 'moderate'
    } else if (readiness.signal === 'red') {
      summary = 'Active recovery or walk. Skip high intensity.'
      intensity = 'low'
    } else {
      summary = 'Not enough data to call it. Log recovery/sleep first.'
      intensity = 'moderate'
    }
    if (lighterHint) intensity = 'low'
    actions.push({ type: 'training_recommendation', summary, intensity })
  }

  // 6. Missing data warnings
  if (!ctx.dailyLog) missingData.push('daily log')
  else {
    if (ctx.dailyLog.recoveryScore === null) missingData.push('recovery score')
    if (ctx.dailyLog.sleepHours === null)    missingData.push('sleep hours')
  }

  const { message, readiness } = buildMessage(ctx, actions, trainingQ, lighterHint)

  return {
    message,
    actions: actions.length > 0 ? actions : undefined,
    source:  'rule_based',
    confidence: 0.6,
    missingData: missingData.length > 0 ? missingData : undefined,
    readiness,
  }
}

// XODUS Brain Router — central agent entry point.
//
// SERVER-ONLY. Imports callAI from lib/ai/provider (which holds API keys).
// Every input channel (web_chat, telegram, voice, shortcut, upload, screenshot,
// manual) calls routeXodusInput() and gets back a structured XodusAgentResult.
//
// The router never writes localStorage directly — application happens client-side
// via lib/xodus/action-applier.ts, or server-side via a future inbox/Supabase
// applier. This separation is what makes the agent reusable across channels.

import { callAI } from '../ai/provider'
import { fallbackRoute } from './fallback-router'
import { computeReadiness } from './readiness'
import { isAutoApplyable, classifyIntent } from './action-types'
import type {
  XodusAction,
  XodusAgentResult,
  XodusInputMedia,
  XodusInputSource,
  CreateNoteAction,
  CreateGoalAction,
  CreateGroceryAction,
  UpdateNutritionProfileAction,
  LogFoodAction,
  LogManualHealthAction,
  CreateWorkoutLogAction,
  CreateProjectUpdateAction,
  CreateMemoryCandidateAction,
  TrainingRecommendationAction,
  CompleteGoalAction,
  UpdateGoalAction,
  UpdateNoteAction,
  AddOpenLoopAction,
  SavePendingReviewAction,
} from './action-types'
import type { XodusChatContext } from './chat-types'

// ─── Public input shape ───────────────────────────────────────────────────────

export interface XodusRouteInput {
  text:     string
  source:   XodusInputSource
  now?:     string                  // YYYY-MM-DD (defaults to today)
  context:  XodusChatContext
  media?:   XodusInputMedia[]
}

// ─── Compact context for the prompt ───────────────────────────────────────────

function summarizeContext(ctx: XodusChatContext): string {
  const log = ctx.dailyLog
  const lines: string[] = [`Today: ${ctx.todayDate}`]

  if (log) {
    const bits: string[] = []
    if (log.recoveryScore !== null) bits.push(`recovery ${log.recoveryScore}`)
    if (log.hrv          !== null) bits.push(`HRV ${log.hrv}ms`)
    if (log.restingHR    !== null) bits.push(`RHR ${log.restingHR}`)
    if (log.strain       !== null) bits.push(`strain ${log.strain}`)
    if (log.sleepHours   !== null) bits.push(`sleep ${log.sleepHours}h`)
    if (log.mood         !== null) bits.push(`mood ${log.mood}/5`)
    if (log.weight       !== null) bits.push(`weight ${log.weight}lb`)
    if (log.steps        !== null) bits.push(`${log.steps.toLocaleString()} steps`)
    if (bits.length) lines.push(`Vitals: ${bits.join(', ')}`)

    const nut: string[] = []
    if (log.protein  !== null) nut.push(`${log.protein}g protein`)
    if (log.calories !== null) nut.push(`${log.calories} cal`)
    if (nut.length) lines.push(`Eaten today: ${nut.join(', ')}`)
  } else {
    lines.push('No daily log yet today.')
  }

  const np = ctx.nutritionProfile
  lines.push(`Targets: ${np.proteinTarget ?? '?'}g protein, ${np.calorieTarget ?? '?'} cal, phase ${np.phase}`)

  if (ctx.todayGoals.length > 0) {
    const done = ctx.todayGoals.filter(g => g.done).length
    lines.push(`Goals: ${done}/${ctx.todayGoals.length} done — ${ctx.todayGoals.slice(0, 6).map(g => g.text).join('; ')}`)
  }

  if (ctx.recentActivities.length > 0) {
    lines.push(`Recent training: ${ctx.recentActivities.map(a => `${a.date} ${a.label ?? a.type}`).join('; ')}`)
  }
  lines.push(`This week sessions: ${ctx.weekActivityCount}`)

  if (ctx.recentNotes.length > 0) {
    lines.push(`Recent notes: ${ctx.recentNotes.map(n => `[${n.category}] ${n.body}`).join(' | ')}`)
  }

  if (ctx.missingDataSignals?.includes('steps_apple_health_planned')) {
    lines.push('Data gap: steps not connected yet (Apple Health planned).')
  }

  return lines.join('\n')
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are XODUS, Jackson's AI operator inside Picard OS.

You are NOT just a chatbot. You are an action-taking agent inside a personal OS. Your job is to turn messy user input into structured Picard OS actions AND give a short, useful reply.

Voice: direct, confident, chill, non-cringe. 1–3 short sentences. No "as an AI". No emojis unless the user uses them. No fake certainty.

Profile facts (do NOT change these unless the user explicitly says to):
- Cutting phase, ~184 lb, hybrid athlete.
- Targets: 2,200 kcal, 210g protein, ~210g carbs, ~58–61g fat.
- Active projects: Picard OS/XODUS, Porsche 981 Boxster (brakes/rotors), PLAY/Graton, Flying Elephants, Apartment, NeuroBuild.

Safety rules (NEVER break):
- Never diagnose or infer mental health from text or voice tone.
- Never invent data: no fabricated steps, calendar entries, Apple Health values, or food numbers.
- For rough-day / mood statements: create a personal note + optional training_recommendation (lighter). NEVER mental-health language.
- For high-impact changes (nutrition_profile, deleting things) use confidence ≤0.85 so they land in needs-review.
- For screenshots/images with no extraction available: emit save_pending_review.

Return STRICT JSON only — no markdown fences, no prose outside JSON:
{
  "reply": "1–3 sentence conversational reply",
  "actions": [ ...zero or more action objects... ],
  "confidence": 0.0,
  "warnings": []
}

Each action MUST have a "type" and a "confidence" (0..1). Action shapes:

{ "type": "create_note", "title"?: "...", "body": "...", "category"?: "grocery|fitness|school|project|personal|car|money|other", "date"?: "YYYY-MM-DD", "confidence": 0.9 }
{ "type": "update_note", "noteQuery": "fuzzy match", "updates": { "title"?, "body"?, "category"?, "status"?: "open|done" }, "confidence": 0.7 }
{ "type": "create_goal", "title": "...", "date": "YYYY-MM-DD", "category"?: "fitness|nutrition|project|school|errand|personal|other", "confidence": 0.85 }
{ "type": "complete_goal", "goalQuery": "fuzzy match against goal title", "date"?: "YYYY-MM-DD", "confidence": 0.8 }
{ "type": "update_goal", "goalQuery": "...", "updates": { "title"?, "category"?, "date"?, "status"? }, "confidence": 0.7 }
{ "type": "create_grocery", "items": ["eggs", "rice"], "confidence": 0.9 }
{ "type": "update_nutrition_profile", "updates": { "proteinTarget"?: 210, "calorieTarget"?: 2200, "carbTarget"?: 210, "fatTarget"?: 58, "phase"?: "cutting|maintenance|bulking" }, "confidence": 0.8 }
{ "type": "log_food", "calories"?: 900, "protein"?: 80, "carbs"?: 0, "fat"?: 0, "confidence": 0.9 }
{ "type": "log_manual_health", "steps"?: 8500, "distanceMiles"?: 4.2, "activeEnergyKcal"?: 600, "sleepHours"?: 7.5, "weightLb"?: 184, "confidence": 0.85 }
{ "type": "create_workout_log", "activityType"?: "strength|run|row|walk|swim|bike|recovery|mobility|hiit|custom", "title"?: "...", "exercises"?: [{ "name": "Pull-up", "sets": 3, "reps": 8, "weight"?: 45 }], "durationMinutes"?: 45, "date"?: "YYYY-MM-DD", "confidence": 0.85 }
{ "type": "create_project_update", "projectName"?: "Porsche|Picard OS|...", "update": "...", "nextAction"?: "...", "confidence": 0.6 }
{ "type": "create_memory_candidate", "title": "...", "category": "identity|fitness|design_preference|...", "summary": "...", "status"?: "current|historical|needs_confirmation", "confidence": 0.7 }
{ "type": "training_recommendation", "summary": "...", "intensity": "low|moderate|high", "confidence": 0.9 }
{ "type": "add_open_loop", "title": "...", "body"?: "...", "category"?: "...", "confidence": 0.8 }
{ "type": "save_pending_review", "reason": "why this needs human review", "payload"?: {...}, "confidence": 0.5 }
{ "type": "no_op", "reason": "..." }

Routing rules:
- "I did 3 sets of pull-ups, 4 sets of bench, 5 sets of dead hangs" → create_workout_log with exercises array. Optionally a brief fitness note.
- "I dunked today" / "finished X" → complete_goal (goalQuery="dunk" or matched goal). If the goal doesn't exist, ALSO emit create_memory_candidate.
- "Health sync: steps 8500, distance 4.2, active energy 600" → log_manual_health.
- "I ate 900 cal and 80g protein" → log_food (NOT update_nutrition_profile).
- "Set protein to 220" / "switching to maintenance" → update_nutrition_profile.
- "Add eggs and rice to groceries" → create_grocery with items array.
- "Add note to Porsche: order brake rotors" → create_note (category: car) + create_project_update (projectName: Porsche).
- "Rough day, keep training lighter" → create_note (personal) + training_recommendation (low). NO mental-health diagnosis.
- "Remember that I prefer Telegram input" → create_memory_candidate (category: design_preference, status: needs_confirmation).
- "What should I train today" → training_recommendation using recovery context.
- If user attaches a screenshot/image and no parser is available → save_pending_review.
- If the message is just chat ("what's up", "thanks") → reply only, actions: [].

Temporal:
- "tomorrow" → next calendar day relative to Today: in the context.
- weekday name → nearest upcoming instance.
- No date mentioned → today.

Confidence calibration:
- 0.9+ : explicit, unambiguous, single action.
- 0.7–0.85 : clear intent but fuzzy match (goal completion, project name, note category).
- 0.5–0.65 : ambiguous — should land in needs-review.
- ≤0.4 : weak — prefer save_pending_review or no_op.

You MUST output strict JSON. Nothing else.`

// ─── JSON parse + validate ────────────────────────────────────────────────────

interface AIShape {
  reply?:      unknown
  actions?:    unknown
  confidence?: unknown
  warnings?:   unknown
}

function parseAIResponse(raw: string): { reply: string; actions: XodusAction[]; confidence: number; warnings: string[] } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim()
    const json = JSON.parse(cleaned) as AIShape

    const reply = typeof json.reply === 'string' && json.reply.length > 0 ? json.reply : ''
    if (!reply) return null

    const rawActions = Array.isArray(json.actions) ? json.actions : []
    const actions: XodusAction[] = []
    for (const a of rawActions) {
      const ok = validateAction(a)
      if (ok) actions.push(ok)
    }

    return {
      reply,
      actions,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.7,
      warnings: Array.isArray(json.warnings) ? json.warnings.filter(w => typeof w === 'string') as string[] : [],
    }
  } catch {
    return null
  }
}

function validateAction(a: unknown): XodusAction | null {
  if (typeof a !== 'object' || a === null) return null
  const obj = a as Record<string, unknown>
  const t = obj.type
  const conf = typeof obj.confidence === 'number' ? obj.confidence : undefined

  switch (t) {
    case 'create_note':
      if (typeof obj.body !== 'string') return null
      return {
        type:       'create_note',
        title:      typeof obj.title === 'string'    ? obj.title    : undefined,
        body:       obj.body,
        category:   typeof obj.category === 'string' ? obj.category as CreateNoteAction['category'] : undefined,
        date:       typeof obj.date === 'string'     ? obj.date     : undefined,
        confidence: conf,
      }
    case 'update_note':
      if (typeof obj.noteQuery !== 'string' || typeof obj.updates !== 'object' || obj.updates === null) return null
      return { type: 'update_note', noteQuery: obj.noteQuery, updates: obj.updates as UpdateNoteAction['updates'], confidence: conf }
    case 'create_goal':
      if (typeof obj.title !== 'string' || typeof obj.date !== 'string') return null
      return {
        type:       'create_goal',
        title:      obj.title,
        date:       obj.date,
        category:   typeof obj.category === 'string' ? obj.category as CreateGoalAction['category'] : undefined,
        confidence: conf,
      }
    case 'complete_goal':
      if (typeof obj.goalQuery !== 'string') return null
      return { type: 'complete_goal', goalQuery: obj.goalQuery, date: typeof obj.date === 'string' ? obj.date : undefined, confidence: conf }
    case 'update_goal':
      if (typeof obj.goalQuery !== 'string' || typeof obj.updates !== 'object' || obj.updates === null) return null
      return { type: 'update_goal', goalQuery: obj.goalQuery, updates: obj.updates as UpdateGoalAction['updates'], confidence: conf }
    case 'create_grocery':
      if (!Array.isArray(obj.items)) return null
      return {
        type:       'create_grocery',
        items:      obj.items.filter(x => typeof x === 'string') as string[],
        date:       typeof obj.date === 'string' ? obj.date : undefined,
        confidence: conf,
      }
    case 'update_nutrition_profile':
      if (typeof obj.updates !== 'object' || obj.updates === null) return null
      return { type: 'update_nutrition_profile', updates: obj.updates as UpdateNutritionProfileAction['updates'], confidence: conf }
    case 'log_food': {
      const f: LogFoodAction = { type: 'log_food', confidence: conf }
      if (typeof obj.calories === 'number') f.calories = obj.calories
      if (typeof obj.protein  === 'number') f.protein  = obj.protein
      if (typeof obj.carbs    === 'number') f.carbs    = obj.carbs
      if (typeof obj.fat      === 'number') f.fat      = obj.fat
      if (typeof obj.date     === 'string') f.date     = obj.date
      if (f.calories === undefined && f.protein === undefined && f.carbs === undefined && f.fat === undefined) return null
      return f
    }
    case 'log_manual_health': {
      const h: LogManualHealthAction = { type: 'log_manual_health', confidence: conf }
      if (typeof obj.steps            === 'number') h.steps            = obj.steps
      if (typeof obj.distanceMiles    === 'number') h.distanceMiles    = obj.distanceMiles
      if (typeof obj.activeEnergyKcal === 'number') h.activeEnergyKcal = obj.activeEnergyKcal
      if (typeof obj.sleepHours       === 'number') h.sleepHours       = obj.sleepHours
      if (typeof obj.weightLb         === 'number') h.weightLb         = obj.weightLb
      if (typeof obj.date             === 'string') h.date             = obj.date
      return h
    }
    case 'create_workout_log': {
      const w: CreateWorkoutLogAction = { type: 'create_workout_log', confidence: conf }
      if (typeof obj.activityType    === 'string') w.activityType    = obj.activityType
      if (typeof obj.title           === 'string') w.title           = obj.title
      if (typeof obj.durationMinutes === 'number') w.durationMinutes = obj.durationMinutes
      if (typeof obj.date            === 'string') w.date            = obj.date
      if (typeof obj.notes           === 'string') w.notes           = obj.notes
      if (Array.isArray(obj.exercises)) {
        w.exercises = obj.exercises
          .filter(e => typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).name === 'string')
          .map(e => {
            const ex = e as Record<string, unknown>
            return {
              name:   ex.name as string,
              sets:   typeof ex.sets   === 'number' ? ex.sets   : undefined,
              reps:   typeof ex.reps   === 'number' ? ex.reps   : undefined,
              weight: typeof ex.weight === 'number' ? ex.weight : undefined,
              notes:  typeof ex.notes  === 'string' ? ex.notes  : undefined,
            }
          })
      }
      return w
    }
    case 'create_project_update':
      if (typeof obj.update !== 'string') return null
      return {
        type:         'create_project_update',
        projectName:  typeof obj.projectName === 'string' ? obj.projectName : undefined,
        update:       obj.update,
        nextAction:   typeof obj.nextAction  === 'string' ? obj.nextAction  : undefined,
        confidence:   conf,
      }
    case 'create_memory_candidate':
      if (typeof obj.title !== 'string' || typeof obj.summary !== 'string' || typeof obj.category !== 'string') return null
      return {
        type:       'create_memory_candidate',
        title:      obj.title,
        category:   obj.category as CreateMemoryCandidateAction['category'],
        summary:    obj.summary,
        status:     obj.status === 'current' || obj.status === 'historical' || obj.status === 'needs_confirmation' ? obj.status : 'needs_confirmation',
        confidence: conf,
      }
    case 'training_recommendation':
      if (typeof obj.summary !== 'string') return null
      return {
        type:       'training_recommendation',
        summary:    obj.summary,
        intensity:  obj.intensity === 'low' || obj.intensity === 'moderate' || obj.intensity === 'high' ? obj.intensity : undefined,
        confidence: conf,
      }
    case 'add_open_loop':
      if (typeof obj.title !== 'string') return null
      return {
        type:       'add_open_loop',
        title:      obj.title,
        body:       typeof obj.body     === 'string' ? obj.body     : undefined,
        category:   typeof obj.category === 'string' ? obj.category : undefined,
        confidence: conf,
      }
    case 'save_pending_review':
      if (typeof obj.reason !== 'string') return null
      return { type: 'save_pending_review', reason: obj.reason, payload: obj.payload, confidence: conf }
    case 'no_op':
      return { type: 'no_op', reason: typeof obj.reason === 'string' ? obj.reason : 'no_op' }
  }
  return null
}

// ─── Action splitter ──────────────────────────────────────────────────────────

function splitActions(actions: XodusAction[]): { auto: XodusAction[]; review: XodusAction[] } {
  const auto: XodusAction[] = []
  const review: XodusAction[] = []
  for (const a of actions) {
    if (isAutoApplyable(a)) auto.push(a)
    else                    review.push(a)
  }
  return { auto, review }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function routeXodusInput(input: XodusRouteInput): Promise<XodusAgentResult> {
  const { text, context, media } = input

  // Media without an extraction path → pending review.
  // (We still let the AI generate a reply, but ensure the media isn't silently dropped.)
  const mediaPending: SavePendingReviewAction[] = []
  if (media && media.length > 0) {
    mediaPending.push({
      type:    'save_pending_review',
      reason:  `Received ${media.length} attachment(s) — image/document/audio extraction is not connected yet.`,
      payload: { media: media.map(m => ({ kind: m.kind, fileName: m.fileName, caption: m.caption })) },
      confidence: 0.4,
    })
  }

  let aiResult: { reply: string; actions: XodusAction[]; confidence: number; warnings: string[] } | null = null

  try {
    const aiResponse = await callAI({
      systemPrompt:   SYSTEM_PROMPT,
      userMessage:    `${summarizeContext(context)}\n\nUser (${input.source}): ${text}`,
      responseFormat: 'json',
      maxTokens:      700,
      temperature:    0.25,
    })
    aiResult = parseAIResponse(aiResponse.text)
  } catch {
    aiResult = null
  }

  if (aiResult) {
    const allActions = [...aiResult.actions, ...mediaPending]
    const { auto, review } = splitActions(allActions)
    return {
      reply:              aiResult.reply,
      intent:             classifyIntent(allActions),
      actions:            allActions,
      autoApplyActions:   auto,
      needsReviewActions: review,
      confidence:         aiResult.confidence,
      source:             'ai',
      missingDataSignals: context.missingDataSignals,
      warnings:           aiResult.warnings.length > 0 ? aiResult.warnings : undefined,
    }
  }

  // Fallback path — rule-based router.
  const rb = fallbackRoute(text, context)
  if (mediaPending.length > 0) {
    rb.actions.push(...mediaPending)
    rb.needsReviewActions.push(...mediaPending)
  }
  return rb
}

// Re-export so consumers don't need two imports.
export { computeReadiness }

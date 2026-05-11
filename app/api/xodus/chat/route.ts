// POST /api/xodus/chat
//
// Conversational XODUS endpoint.
// Body:   { message: string, context: XodusChatContext }
// Reply:  XodusChatResponse  (see lib/xodus/chat-types.ts)
//
// Falls back to rule-based response when AI is unavailable or returns invalid JSON.

import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai/provider'
import { buildFallbackResponse } from '@/lib/xodus/chat-fallback'
import { computeReadiness } from '@/lib/xodus/readiness'
import type {
  XodusChatContext,
  XodusChatResponse,
  XodusChatAction,
  CreateGoalAction,
  CreateNoteAction,
  UpdateNutritionAction,
  LogFoodAction,
} from '@/lib/xodus/chat-types'
import type { GoalCategory } from '@/lib/daily-goals'
import type { XodusNoteCategory } from '@/lib/xodus/notes'

// ─── Compact context → string ─────────────────────────────────────────────────

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
    lines.push(`Goals: ${done}/${ctx.todayGoals.length} done — ${ctx.todayGoals.slice(0, 5).map(g => g.text).join('; ')}`)
  }

  if (ctx.recentActivities.length > 0) {
    lines.push(`Recent training: ${ctx.recentActivities.map(a => `${a.date} ${a.label ?? a.type}`).join('; ')}`)
  } else {
    lines.push('No recent training logged.')
  }

  lines.push(`This week sessions: ${ctx.weekActivityCount}`)

  if (ctx.recentNotes.length > 0) {
    lines.push(`Recent notes: ${ctx.recentNotes.map(n => `[${n.category}] ${n.body}`).join(' | ')}`)
  }

  return lines.join('\n')
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are XODUS, the embedded AI for Picard OS — a personal operating system for one user (Jpicky).

Voice: direct, confident, minimal. Like a chief of staff. 1–3 sentences max. No filler. Never "as an AI..."

NEVER diagnose mental health. NEVER use medical language. Avoid fake certainty. If you don't have data, say so.

You parse the user's message and return JSON ONLY (no markdown fences):
{
  "message": "your 1–3 sentence conversational reply",
  "actions": [ ...zero or more action objects... ],
  "confidence": 0.0
}

Action shapes (omit fields you don't have):
{ "type": "create_goal", "title": "...", "date": "YYYY-MM-DD", "category": "fitness|nutrition|project|school|errand|personal|other" }
{ "type": "create_note", "title": "optional", "body": "...", "category": "grocery|fitness|school|project|personal|car|money|other" }
{ "type": "update_nutrition", "updates": { "proteinTarget": 210, "calorieTarget": 2200, "phase": "cutting|maintenance|bulking" } }
{ "type": "log_food", "calories": 900, "protein": 80, "carbs": 0, "fat": 0 }
{ "type": "training_recommendation", "summary": "...", "intensity": "low|moderate|high" }

Rules:
- Goal phrasing: "I need to...", "set a goal", task lists separated by commas → create_goal per item, split on commas.
- Note phrasing: "log that", "note that", "just log it", reflections, frustrations → create_note (category personal unless clearly fitness/school/etc).
- Grocery: "add eggs/chicken/etc to groceries", "buy X" with food items → create_note with category "grocery".
- update_nutrition: ONLY when user sets a new target ("set protein to 220", "switching to maintenance"). NEVER for logging what was eaten.
- log_food: "I ate", "had Xg protein", "Y cal so far" → log_food. NOT update_nutrition.
- training_recommendation: when user asks training advice OR asks how to train today. Use the recovery/sleep/strain context. If recovery green & sleep good → moderate to high. If recovery <50 → low. If unknown → moderate, mention missing data.
- Temporal: "tomorrow" → next day. Weekday name → next instance. No mention → today.
- Return actions: [] if nothing actionable.
- confidence: 0.9 clear intent, 0.6 ambiguous, 0.3 mostly chat.

Reply tone examples:
- "Captured 4 goals for tomorrow. Chest day pairs well with your current cut — keep load between RPE 7–9."
- "Added eggs, chicken, Greek yogurt, rice to your grocery note."
- "Logged. Recovery's at 58 today — a moderate session is the right call."
- "No daily log yet. Want to log recovery and sleep first, or just talk it out?"`

// ─── Parse + validate AI JSON ─────────────────────────────────────────────────

function parseAIResponse(text: string, today: string): XodusChatResponse | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim()
    const json = JSON.parse(cleaned) as Record<string, unknown>

    if (typeof json.message !== 'string' || json.message.length === 0) return null

    const rawActions = Array.isArray(json.actions) ? json.actions : []
    const actions: XodusChatAction[] = []

    for (const a of rawActions) {
      if (typeof a !== 'object' || a === null) continue
      const obj = a as Record<string, unknown>
      const t = obj.type
      if (t === 'create_goal' && typeof obj.title === 'string') {
        const date = typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : today
        const goal: CreateGoalAction = {
          type:     'create_goal',
          title:    obj.title,
          date,
          category: typeof obj.category === 'string' ? (obj.category as GoalCategory) : undefined,
        }
        actions.push(goal)
      } else if (t === 'create_note' && typeof obj.body === 'string') {
        const note: CreateNoteAction = {
          type:     'create_note',
          title:    typeof obj.title === 'string' ? obj.title : undefined,
          body:     obj.body,
          category: typeof obj.category === 'string' ? (obj.category as XodusNoteCategory) : undefined,
        }
        actions.push(note)
      } else if (t === 'update_nutrition' && typeof obj.updates === 'object' && obj.updates !== null) {
        const nut: UpdateNutritionAction = {
          type:    'update_nutrition',
          updates: obj.updates as UpdateNutritionAction['updates'],
        }
        actions.push(nut)
      } else if (t === 'log_food') {
        const food: LogFoodAction = { type: 'log_food' }
        if (typeof obj.calories === 'number') food.calories = obj.calories
        if (typeof obj.protein  === 'number') food.protein  = obj.protein
        if (typeof obj.carbs    === 'number') food.carbs    = obj.carbs
        if (typeof obj.fat      === 'number') food.fat      = obj.fat
        if (food.calories || food.protein || food.carbs || food.fat) actions.push(food)
      } else if (t === 'training_recommendation' && typeof obj.summary === 'string') {
        const intensity = obj.intensity === 'low' || obj.intensity === 'moderate' || obj.intensity === 'high'
          ? obj.intensity
          : undefined
        actions.push({ type: 'training_recommendation', summary: obj.summary, intensity })
      }
    }

    return {
      message:    json.message,
      actions:    actions.length > 0 ? actions : undefined,
      source:     'ai',
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.75,
    }
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let message: string
  let context: XodusChatContext

  try {
    const body = (await request.json()) as { message?: unknown; context?: unknown }
    message = typeof body.message === 'string' ? body.message.trim() : ''
    context = body.context as XodusChatContext
    if (!context || typeof context !== 'object' || typeof context.todayDate !== 'string') {
      return NextResponse.json({ ok: false, error: 'context is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 })
  }

  // Try AI provider
  let result: XodusChatResponse | null = null
  try {
    const aiResponse = await callAI({
      systemPrompt:   SYSTEM_PROMPT,
      userMessage:    `${summarizeContext(context)}\n\nUser: ${message}`,
      responseFormat: 'json',
      maxTokens:      500,
      temperature:    0.3,
    })
    result = parseAIResponse(aiResponse.text, context.todayDate)
  } catch {
    // fall through to rule-based
  }

  if (result) {
    // Attach readiness signal alongside the AI response (cheap, transparent)
    result.readiness = computeReadiness(context)
    return NextResponse.json({ ok: true, result })
  }

  const fallback = buildFallbackResponse(message, context)
  return NextResponse.json({ ok: true, result: fallback })
}

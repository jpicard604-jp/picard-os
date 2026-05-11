// XODUS Agent Pipeline — POST /api/agent
//
// Accepts natural language input and returns structured XodusAction[] for the
// client to apply to localStorage. This route never writes to localStorage or
// Supabase directly — all writes happen client-side after the user confirms.
//
// Example inputs:
//   "I benched 275 for 3 sets of 5"
//     → activity_log.create { type: 'strength', exercises: [{ exercise: 'Bench Press', sets: 3, reps: 5, weight: 275 }] }
//
//   "I slept 5 hours and feel cooked"
//     → daily_log.update { sleepHours: 5, mood: 1 or 2, notes: 'feel cooked' }
//
//   "Add a task to finish the WHOOP integration"
//     → project_task.create { projectId: 'picard-os', taskText: 'Finish the WHOOP integration' }
//
//   "I ate 180g protein and 2500 calories"
//     → nutrition_log.update { protein: 180, calories: 2500 }

import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai/provider'
import type { AgentContext, AgentResponse, XodusAction } from '@/lib/xodus/actions'

// ─── System prompt ────────────────────────────────────────────────────────────
// Kept stable across calls so it is eligible for prompt caching (Anthropic).
// Variable parts (today's date, project list, current log) go in the user message.

function buildSystemPrompt(): string {
  return `You are XODUS, the background agent layer for Picard OS — a personal AI life OS for one user (Jackson / Jpicky).

Your job is to parse natural language input and return structured JSON actions. You extract data precisely; you never invent data not present in the input.

Return ONLY a valid JSON object with this exact shape — no markdown, no explanation, no extra fields:
{
  "actions": [ ...action objects... ],
  "summary": "one sentence describing all changes"
}

Each action object must have ALL of these fields:
- "type": one of the action types listed below
- "confidence": number 0.0 to 1.0 (how certain you are the extraction is correct)
- "source": the input source ("text" or "voice")
- "summary": one sentence describing THIS specific action
- "requiresConfirmation": boolean — true when confidence < 0.7 or a value seems physiologically unusual
- "warnings": array of strings — note any missing or ambiguous fields
- "timestamp": ISO 8601 string — when the event happened (default to current UTC if not mentioned)
- "payload": action-specific data object (see schemas below)

ACTION TYPES AND PAYLOAD SCHEMAS:

1. "daily_log.update" — general daily metrics
   payload: { date?, calories?, calorieTarget?, protein?, proteinTarget?, weight?, water?, sleepHours?, sleepQuality?, steps?, screenTime?, instagramTime?, smokedToday?, drankToday?, confidenceScore?, mood?, notes?, recoveryScore?, hrv?, restingHR?, strain? }
   notes: weight in lb, sleepHours in decimal hours, mood 1–5, confidenceScore 1–10, recoveryScore 0–100

2. "activity_log.create" — workout or physical activity
   payload: { date?, type (strength|run|row|walk|swim|bike|recovery|mobility|hiit|custom), label?, duration?, distance?, distanceUnit?, steps?, calories?, rpe?, notes?, exercises?: [{exercise, sets?, reps?, weight?, weightUnit?}] }
   notes: duration in minutes, weight defaults to lb, rpe 1–10

3. "nutrition_log.update" — food/macro entry (maps to daily log nutrition fields)
   payload: { date?, calories?, calorieTarget?, protein?, proteinTarget?, water?, mealDescription? }

4. "project.update" — progress note on an existing project
   payload: { projectId (from context), projectTitle?, updateText, progressBump? (0–20 percent), status? }
   notes: only use projectIds from the active projects list in context

5. "project_task.create" — add a task to an existing project
   payload: { projectId (from context), projectTitle?, taskText }
   notes: only use projectIds from the active projects list in context

6. "voice_log.create" — save the input as a voice/text log
   payload: { transcript, duration? }
   notes: use when no other structured action applies but the input is worth saving

7. "brain_note.create" — save a notable insight or reflection
   payload: { content, tags: string[], linkedProjectId?, linkedDate? }

8. "no_op" — nothing to extract
   payload: { reason, suggestions?: string[] }
   notes: use for greetings, questions, unclear input, or when user just wants a conversation

9. "clarification_needed" — need more info before acting
   payload: { question, partialActions?: [] }

EXTRACTION RULES:
- A single input can produce multiple actions (e.g., workout + nutrition in the same message → activity_log.create + nutrition_log.update)
- Set requiresConfirmation: true when: confidence < 0.7, weight > 350lb, calories > 7000, reps > 50, or any value seems physiologically implausible
- Match project names to the active projects list from context — if no match, use warnings to note this and skip the project action
- Weights in lb unless "kg" is explicitly mentioned
- Duration in minutes unless "hour" is mentioned (then convert to minutes)
- Do not invent numbers not present in the input
- For "I feel" statements without numbers, map to mood: amazing/great=5, good=4, okay/alright=3, bad/meh=2, terrible/awful=1
- Recovery notes (strained, cooked, drained, tired) → mood 1–2 and optionally recoveryScore estimate
- If only one type of data is mentioned, return only that action (don't pad with no_op)`
}

// ─── User message ─────────────────────────────────────────────────────────────

function buildUserMessage(userInput: string, source: string, context: AgentContext): string {
  const projectList = context.activeProjects?.length
    ? context.activeProjects
        .map((p) => `  - id="${p.id}" title="${p.title}" progress=${p.progress}% priority=${p.priority}`)
        .join('\n')
    : '  (none provided)'

  const logSummary = context.currentDailyLog
    ? [
        `calories: ${context.currentDailyLog.calories ?? 'not logged'}`,
        `protein: ${context.currentDailyLog.protein ?? 'not logged'}`,
        `sleep: ${context.currentDailyLog.sleepHours ?? 'not logged'}h`,
        `recovery: ${context.currentDailyLog.recoveryScore ?? 'not logged'}`,
      ].join(', ')
    : 'no log today'

  const prefs = context.userPreferences
  const prefSummary = prefs
    ? `protein target ${prefs.proteinTarget}g, calorie target ${prefs.calorieTarget}, workout target ${prefs.weeklyWorkoutTarget}/week`
    : 'protein target 180g, calorie target 2500'

  return [
    `Today: ${context.todayDate}`,
    `User preferences: ${prefSummary}`,
    `Today's log so far: ${logSummary}`,
    `Active projects:\n${projectList}`,
    ``,
    `Input (${source}): "${userInput}"`,
  ].join('\n')
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseActions(text: string): XodusAction[] {
  try {
    // Strip markdown fences if model returned them despite instructions
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const json = JSON.parse(cleaned) as { actions?: unknown }
    if (!Array.isArray(json.actions)) return []

    return (json.actions as unknown[]).filter((a): a is XodusAction => {
      if (typeof a !== 'object' || a === null) return false
      const obj = a as Record<string, unknown>
      return (
        typeof obj.type === 'string' &&
        typeof obj.payload === 'object' && obj.payload !== null &&
        typeof obj.summary === 'string' &&
        typeof obj.confidence === 'number'
      )
    })
  } catch {
    return []
  }
}

function parseSummary(text: string): string {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const json = JSON.parse(cleaned) as { summary?: unknown }
    return typeof json.summary === 'string' ? json.summary : 'Processing complete.'
  } catch {
    return 'Processing complete.'
  }
}

function noOpFallback(reason: string): XodusAction {
  return {
    type: 'no_op' as const,
    confidence: 1.0,
    source: 'text' as const,
    summary: 'No actions extracted.',
    requiresConfirmation: false,
    warnings: [reason],
    timestamp: new Date().toISOString(),
    payload: { reason },
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let userInput: string
  let source: string
  let currentContext: Partial<AgentContext> | undefined

  try {
    const body = (await request.json()) as {
      userInput?: unknown
      source?: unknown
      currentContext?: unknown
    }
    userInput = typeof body.userInput === 'string' ? body.userInput.trim() : ''
    source = typeof body.source === 'string' ? body.source : 'text'
    currentContext = typeof body.currentContext === 'object' && body.currentContext !== null
      ? (body.currentContext as Partial<AgentContext>)
      : undefined
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!userInput) {
    return NextResponse.json({ ok: false, error: 'userInput is required and must be a non-empty string' }, { status: 400 })
  }

  const context: AgentContext = {
    todayDate: new Date().toISOString().slice(0, 10),
    ...currentContext,
  }

  const systemPrompt = buildSystemPrompt()
  const userMessage  = buildUserMessage(userInput, source, context)

  let aiResponse
  try {
    aiResponse = await callAI({
      systemPrompt,
      userMessage,
      responseFormat: 'json',
      maxTokens:  1200,
      temperature: 0.1,
    })
  } catch (err) {
    console.warn('[agent] AI provider error:', err)
    const response: AgentResponse = {
      ok:      false,
      actions: [noOpFallback(`AI provider error: ${String(err).slice(0, 120)}`)],
      summary: 'AI provider unavailable. Manual logging is still available.',
      provider: 'error',
      model:    'error',
      error:    String(err),
    }
    // 200 so the client can handle gracefully rather than treating it as a network error
    return NextResponse.json(response, { status: 200 })
  }

  const actions = parseActions(aiResponse.text)
  const summary = parseSummary(aiResponse.text)
  const finalActions = actions.length > 0
    ? actions
    : [noOpFallback('AI returned a response but no valid actions could be parsed. Raw response logged server-side.')]

  if (actions.length === 0) {
    console.warn('[agent] could not parse actions from response:', aiResponse.text.slice(0, 500))
  }

  const response: AgentResponse = {
    ok:           true,
    actions:      finalActions,
    summary,
    provider:     aiResponse.provider,
    model:        aiResponse.model,
    inputTokens:  aiResponse.inputTokens,
    outputTokens: aiResponse.outputTokens,
  }

  return NextResponse.json(response)
}

// POST /api/xodus/chat
//
// Wraps the central XODUS agent router (lib/xodus/brain-router.ts).
// Body:   { message: string, context: XodusChatContext, media?: XodusInputMedia[] }
// Reply:  { ok: true, result: XodusChatResponse }
//
// The response carries both:
//   - legacy `actions` (XodusChatAction[]) for chip-rendering backward compatibility
//   - new `agent` (XodusAgentResult) for the central applier + auto/review split
//
// Future channels (Telegram, voice, shortcut, upload) call routeXodusInput()
// directly with the appropriate `source` value.

import { NextResponse } from 'next/server'
import { generateXodusResponse } from '@/lib/xodus/server-chat'
import { computeReadiness } from '@/lib/xodus/readiness'
import type {
  XodusChatContext,
  XodusChatResponse,
  XodusChatAction,
  CreateGoalAction,
  CreateNoteAction,
  UpdateNutritionAction,
  LogFoodAction,
  TrainingRecommendationAction,
} from '@/lib/xodus/chat-types'
import type { XodusAction, XodusInputMedia } from '@/lib/xodus/action-types'

// ─── Map new central actions → legacy chip actions for the existing UI ────────

function toLegacyAction(a: XodusAction): XodusChatAction | null {
  switch (a.type) {
    case 'create_goal': {
      const g: CreateGoalAction = { type: 'create_goal', title: a.title, date: a.date, category: a.category }
      return g
    }
    case 'create_note': {
      const n: CreateNoteAction = {
        type:     'create_note',
        title:    a.title,
        body:     a.body,
        category: a.category,
      }
      return n
    }
    case 'create_grocery': {
      const n: CreateNoteAction = {
        type:     'create_note',
        title:    'Grocery list',
        body:     a.items.join(', '),
        category: 'grocery',
      }
      return n
    }
    case 'update_nutrition_profile': {
      const u: UpdateNutritionAction = { type: 'update_nutrition', updates: a.updates }
      return u
    }
    case 'log_food': {
      const f: LogFoodAction = { type: 'log_food', calories: a.calories, protein: a.protein, carbs: a.carbs, fat: a.fat }
      return f
    }
    case 'training_recommendation': {
      const t: TrainingRecommendationAction = { type: 'training_recommendation', summary: a.summary, intensity: a.intensity }
      return t
    }
    // New action types — no legacy chip equivalent; rendered by new agent chip path.
    default:
      return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let message: string
  let context: XodusChatContext
  let media: XodusInputMedia[] | undefined

  try {
    const body = (await request.json()) as { message?: unknown; context?: unknown; media?: unknown }
    message = typeof body.message === 'string' ? body.message.trim() : ''
    context = body.context as XodusChatContext
    media   = Array.isArray(body.media) ? body.media as XodusInputMedia[] : undefined
    if (!context || typeof context !== 'object' || typeof context.todayDate !== 'string') {
      return NextResponse.json({ ok: false, error: 'context is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 })
  }

  if (!message && !media?.length) {
    return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 })
  }

  const response = await generateXodusResponse({
    message,
    source:  'web_chat',
    context,
    media,
  })
  const agent = response.agent

  // Build legacy actions list for the existing chip renderer.
  const legacyActions: XodusChatAction[] = []
  for (const a of agent.actions) {
    const legacy = toLegacyAction(a)
    if (legacy) legacyActions.push(legacy)
  }

  const result: XodusChatResponse = {
    message:     agent.reply,
    actions:     legacyActions.length > 0 ? legacyActions : undefined,
    source:      agent.source,
    confidence:  agent.confidence,
    missingData: agent.missingDataSignals,
    readiness:   computeReadiness(context),
    agent,
  }

  return NextResponse.json({ ok: true, result })
}

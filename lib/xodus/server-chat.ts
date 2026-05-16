// SERVER-ONLY shared XODUS chat function. Both the web app (/api/xodus/chat)
// and Telegram (/api/telegram/webhook) call this so the AI brain stays in one
// place. Future surfaces (mobile app, voice, SMS, screenshots) can plug in here
// without forking the prompt or context layer.
//
// Important: this runs on the server. It cannot read browser localStorage.
// The web route passes a client-built XodusChatContext through the request body
// (the canonical path). Telegram has no browser context, so when called
// without a provided context we build a conservative server fallback. A future
// pass should mirror localStorage state into Supabase and load it here for
// cross-device parity.

import { routeXodusInput } from './brain-router'
import type { XodusChatContext } from './chat-types'
import type { XodusAgentResult, XodusInputMedia, XodusInputSource } from './action-types'

// ─── Public types ─────────────────────────────────────────────────────────────

export type XodusIntent =
  | 'chat'
  | 'note'
  | 'task'
  | 'goal'
  | 'reminder'
  | 'daily_log'
  | 'project_update'
  | 'fitness_log'
  | 'unknown'

export interface GenerateXodusResponseInput {
  message:         string
  source:          XodusInputSource              // 'web_chat' | 'telegram' | …
  context?:        XodusChatContext              // web client passes a real one; server fallback otherwise
  media?:          XodusInputMedia[]
  /** Optional metadata for downstream routing / persistence — not used by the AI prompt. */
  userId?:         string | null
  telegramChatId?: string | number | null
  conversationId?: string | null
}

export interface GenerateXodusResponseOutput {
  reply:        string
  intent:       XodusIntent
  /** Pass-through of the underlying agent result for callers that want the full envelope. */
  agent:        XodusAgentResult
  /** What this pass actually persisted, vs. recognised-only. Today: nothing is auto-persisted server-side. */
  saved: {
    note:     boolean
    task:     boolean
    goal:     boolean
    reminder: boolean
    dailyLog: boolean
  }
  /** Surfaces relevant counts without leaking secrets. Used by webhooks for status JSON. */
  debug: {
    autoActions:   number
    reviewActions: number
    contextSource: 'client' | 'server_fallback'
    provider:      string
  }
}

// ─── Lightweight intent classifier ────────────────────────────────────────────
// Heuristic only. Runs before the AI call and is also reconciled against the
// router's classifyIntent() if the underlying router produced one. Never used
// to mutate persistence — only to surface intent on the response and to shape
// the Telegram reply tail.

const INTENT_PATTERNS: Array<{ intent: XodusIntent; pattern: RegExp }> = [
  { intent: 'reminder',       pattern: /\bremind me\b|\bremind\s+(me|jackson)\b|\bset a reminder\b/i },
  { intent: 'goal',           pattern: /\b(add|set)\s+(this\s+)?(as\s+)?(a\s+)?goal\b|\bnew goal\b|\bmake.*a goal\b/i },
  { intent: 'task',           pattern: /\b(add|create)\s+(a\s+)?task\b|\btodo\b|\bto-do\b|\bi need to\b(?!\s+remember)/i },
  { intent: 'note',           pattern: /\b(note|remember)\b|\badd this to\b|\bsave this\b/i },
  { intent: 'daily_log',      pattern: /\b(mental|mood)\s*(at|is|:)?\s*\d/i },
  { intent: 'daily_log',      pattern: /\benergy\s*(at|is|:)?\s*\d/i },
  { intent: 'fitness_log',    pattern: /\b(benched|squatted|deadlift(ed)?|ran|rowed|pulled up|workout|reps?\b)/i },
  { intent: 'project_update', pattern: /\b(project|porsche|picard|play|graton|flying elephants|neurobuild)\b/i },
]

export function classifyXodusIntent(message: string): XodusIntent {
  const m = message.trim()
  if (!m) return 'unknown'
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(m)) return intent
  }
  return 'chat'
}

// ─── Server-side fallback context ─────────────────────────────────────────────
// Telegram has no browser context. Until Supabase mirroring lands, we serve a
// conservative profile-only context so XODUS still sounds like itself.
// TODO(server-context): Replace this with Supabase-backed reads of
//   - daily_logs (today)
//   - daily_goals
//   - active projects
//   - recent activity_logs
//   - recent notes
//   - imported memory snapshot (from picard_xodus_memory_imports_v1, mirrored)
// so Telegram has cross-device parity with the web client.

export function buildServerFallbackContext(todayDate: string): XodusChatContext {
  return {
    todayDate,
    dailyLog: null,
    nutritionProfile: {
      phase:         'cutting',
      proteinTarget: 210,
      calorieTarget: 2200,
      carbTarget:    210,
      fatTarget:     58,
    },
    todayGoals:         [],
    recentActivities:   [],
    recentNotes:        [],
    weekActivityCount:  0,
    missingDataSignals: ['server_side_no_localstorage'],
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateXodusResponse(
  input: GenerateXodusResponseInput,
): Promise<GenerateXodusResponseOutput> {
  const todayDate = new Date().toISOString().slice(0, 10)
  const heuristicIntent = classifyXodusIntent(input.message)

  const ctx = input.context ?? buildServerFallbackContext(todayDate)
  const contextSource: 'client' | 'server_fallback' = input.context ? 'client' : 'server_fallback'

  const agent = await routeXodusInput({
    text:    input.message,
    source:  input.source,
    context: ctx,
    media:   input.media,
  })

  // Reconcile intent. The router's XodusIntent uses a different vocabulary
  // (daily_planning / workout_log / nutrition / …). Map it where it overlaps;
  // otherwise fall back to the chat-surface heuristic.
  const routerStr = String(agent.intent ?? '').toLowerCase()
  const routerMap: Record<string, XodusIntent> = {
    note:            'note',
    workout_log:     'fitness_log',
    nutrition:       'daily_log',
    manual_health:   'daily_log',
    project_update:  'project_update',
    memory:          'note',
    daily_planning:  'chat',
    grocery:         'note',
    training:        'fitness_log',
    mixed:           'chat',
    unknown:         'unknown',
  }
  const mapped = routerMap[routerStr]
  const intent: XodusIntent = mapped && mapped !== 'chat' && mapped !== 'unknown'
    ? mapped
    : heuristicIntent

  // Today, the server pipeline does not write to user-state stores. Auto-apply
  // actions land in xodus_inbox via the Telegram webhook; review actions stay
  // pending for /xodus. So nothing is "saved" in the user-facing sense yet.
  // TODO(persistence): Once Supabase task/goal/note/reminder tables are wired,
  // flip the relevant `saved.*` flags after the action-applier confirms a write.
  const saved = {
    note:     false,
    task:     false,
    goal:     false,
    reminder: false,
    dailyLog: false,
  }

  return {
    reply:  agent.reply,
    intent,
    agent,
    saved,
    debug: {
      autoActions:   agent.autoApplyActions.length,
      reviewActions: agent.needsReviewActions.length,
      contextSource,
      provider:      agent.source,
    },
  }
}

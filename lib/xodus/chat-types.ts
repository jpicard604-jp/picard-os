// XODUS Chat — shared types between client + server.
// No imports of server-only or client-only modules here.

import type { GoalCategory } from '../daily-goals'
import type { NutritionProfile } from '../nutrition-profile'
import type { XodusNoteCategory } from './notes'
import type { XodusAgentResult } from './action-types'

// ─── Actions returned by the AI ───────────────────────────────────────────────

export interface CreateGoalAction {
  type:      'create_goal'
  title:     string
  date:      string                            // YYYY-MM-DD
  category?: GoalCategory
}

export interface CreateNoteAction {
  type:      'create_note'
  title?:    string
  body:      string
  category?: XodusNoteCategory
}

export interface UpdateNutritionAction {
  type:    'update_nutrition'
  updates: Partial<NutritionProfile>
}

export interface LogFoodAction {
  type:      'log_food'
  calories?: number
  protein?:  number
  carbs?:    number
  fat?:      number
}

export interface TrainingRecommendationAction {
  type:       'training_recommendation'
  summary:    string
  intensity?: 'low' | 'moderate' | 'high'
}

export type XodusChatAction =
  | CreateGoalAction
  | CreateNoteAction
  | UpdateNutritionAction
  | LogFoodAction
  | TrainingRecommendationAction

// ─── Context the client ships to the chat route ───────────────────────────────
// Keep this compact — every field below gets serialized into the prompt.

export interface ChatActivitySummary {
  date:      string
  type:      string
  label?:    string
  duration?: number
}

export interface ChatRecentNote {
  category: string
  body:     string                              // truncated by builder
  date:     string
}

export interface XodusChatContext {
  todayDate:    string
  dailyLog: {
    recoveryScore: number | null
    hrv:           number | null
    restingHR:     number | null
    strain:        number | null
    sleepHours:    number | null
    sleepQuality:  number | null
    protein:       number | null
    calories:      number | null
    weight:        number | null
    mood:          number | null
    steps:         number | null
  } | null
  nutritionProfile: {
    phase:         string
    proteinTarget: number | null
    calorieTarget: number | null
    carbTarget:    number | null
    fatTarget:     number | null
  }
  todayGoals:        Array<{ text: string; category: string; done: boolean }>
  recentActivities:  ChatActivitySummary[]
  recentNotes:       ChatRecentNote[]
  weekActivityCount: number
  // Honest signals about integrations Picard OS hasn't connected yet.
  // Values are stable string codes — chat route and readiness consume them.
  missingDataSignals?: string[]
  // Active memory imported from AI chat exports (ChatGPT first). Only
  // `status: 'current'` records are surfaced as active truth. needs_review,
  // paused, and outdated records contribute only an "avoid overemphasizing"
  // summary so XODUS knows what to back off from.
  importedMemory?: {
    current:       Array<{ category: string; title: string; content: string }>
    inactiveCount: number
    avoidSummary?: string
  }
}

// ─── Readiness / wellness signal (transparent, no diagnosis) ──────────────────

export type ReadinessSignal = 'green' | 'amber' | 'red' | 'unknown'

export interface ReadinessAssessment {
  signal: ReadinessSignal
  inputs: string[]                              // ["recovery 72", "sleep 7.1h", "mood 3/5"]
  note:   string                                // "Based mostly on recovery and sleep today."
}

// ─── Response from /api/xodus/chat ────────────────────────────────────────────

export interface XodusChatResponse {
  message:      string
  actions?:     XodusChatAction[]               // legacy chip-rendering subset
  source:       'ai' | 'rule_based'
  confidence:   number                          // 0.0–1.0
  missingData?: string[]
  readiness?:   ReadinessAssessment
  // New central agent envelope — populated by routeXodusInput().
  // Client uses this to apply auto/needs-review actions and surface counts.
  agent?:       XodusAgentResult
}

// ─── Local chat message (client state) ────────────────────────────────────────

export interface ChatMessage {
  id:        string
  role:      'user' | 'assistant' | 'system'
  text:      string
  createdAt: string
  actions?:  XodusChatAction[]
  source?:   'ai' | 'rule_based'
  readiness?: ReadinessAssessment
  agent?:    XodusAgentResult
  appliedCount?: number
  pendingCount?: number
}

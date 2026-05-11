// XODUS Action Types — central schema for the in-app AI agent.
//
// Every input channel (web_chat, telegram, voice, shortcut, upload, screenshot, manual)
// produces a XodusAction[] that downstream appliers can execute. This file is the
// single source of truth for the action contract.
//
// Safety boundary: XODUS can update Picard OS user data and memory candidates.
// XODUS CANNOT edit source code, run shell commands, change env vars, or delete data
// arbitrarily. Risky/ambiguous actions land in needsReview instead of auto-apply.

import type { GoalCategory } from '../daily-goals'
import type { NutritionProfile } from '../nutrition-profile'
import type { XodusNoteCategory } from './notes'
import type { XodusMemoryCategory } from './memory'

// ─── Discriminated union ──────────────────────────────────────────────────────

export interface CreateNoteAction {
  type:        'create_note'
  title?:      string
  body:        string
  category?:   XodusNoteCategory
  date?:       string         // YYYY-MM-DD — defaults to today
  confidence?: number
}

export interface UpdateNoteAction {
  type:        'update_note'
  noteQuery:   string         // fuzzy search across title/body
  updates: {
    title?:    string
    body?:     string
    category?: XodusNoteCategory
    status?:   'open' | 'done'
  }
  confidence?: number
}

export interface CreateGoalAction {
  type:        'create_goal'
  title:       string
  date:        string         // YYYY-MM-DD
  category?:   GoalCategory
  confidence?: number
}

export interface CompleteGoalAction {
  type:        'complete_goal'
  goalQuery:   string         // fuzzy match — "dunk" matches "Dunk a basketball"
  date?:       string         // defaults to today
  confidence?: number
}

export interface UpdateGoalAction {
  type:        'update_goal'
  goalQuery:   string
  updates: {
    title?:    string
    category?: GoalCategory
    date?:     string
    status?:   'open' | 'done'
  }
  confidence?: number
}

export interface CreateGroceryAction {
  type:        'create_grocery'
  items:       string[]
  date?:       string
  confidence?: number
}

export interface UpdateNutritionProfileAction {
  type:        'update_nutrition_profile'
  updates:     Partial<NutritionProfile>
  confidence?: number
}

export interface LogFoodAction {
  type:        'log_food'
  calories?:   number
  protein?:    number
  carbs?:      number
  fat?:        number
  date?:       string
  confidence?: number
}

export interface LogManualHealthAction {
  type:               'log_manual_health'
  steps?:             number
  distanceMiles?:     number
  activeEnergyKcal?:  number
  sleepHours?:        number
  weightLb?:          number
  date?:              string
  confidence?:        number
}

export interface WorkoutExerciseInput {
  name:     string
  sets?:    number
  reps?:    number
  weight?:  number
  notes?:   string
}

export interface CreateWorkoutLogAction {
  type:             'create_workout_log'
  activityType?:    string                    // 'strength' | 'run' | etc.
  title?:           string
  exercises?:       WorkoutExerciseInput[]
  durationMinutes?: number
  date?:            string
  notes?:           string
  confidence?:      number
}

export interface CreateProjectUpdateAction {
  type:         'create_project_update'
  projectName?: string                        // fuzzy match against existing projects
  update:       string
  nextAction?:  string
  confidence?:  number
}

export interface CreateMemoryCandidateAction {
  type:        'create_memory_candidate'
  title:       string
  category:    XodusMemoryCategory | string
  summary:     string
  status?:     'current' | 'historical' | 'needs_confirmation'
  confidence?: number
}

export interface TrainingRecommendationAction {
  type:        'training_recommendation'
  summary:     string
  intensity?:  'low' | 'moderate' | 'high'
  confidence?: number
}

export interface AddOpenLoopAction {
  type:        'add_open_loop'
  title:       string
  body?:       string
  category?:   string
  confidence?: number
}

export interface SavePendingReviewAction {
  type:        'save_pending_review'
  reason:      string
  payload?:    unknown
  confidence?: number
}

export interface NoOpAction {
  type:   'no_op'
  reason: string
}

export type XodusAction =
  | CreateNoteAction
  | UpdateNoteAction
  | CreateGoalAction
  | CompleteGoalAction
  | UpdateGoalAction
  | CreateGroceryAction
  | UpdateNutritionProfileAction
  | LogFoodAction
  | LogManualHealthAction
  | CreateWorkoutLogAction
  | CreateProjectUpdateAction
  | CreateMemoryCandidateAction
  | TrainingRecommendationAction
  | AddOpenLoopAction
  | SavePendingReviewAction
  | NoOpAction

// ─── Auto-apply policy ────────────────────────────────────────────────────────
//
// AUTO-APPLY:  low-risk, additive, easy to undo.
// NEEDS-REVIEW: ambiguous match, high-impact, or unsupported on this channel.

const AUTO_APPLY_THRESHOLD = 0.6

export function isAutoApplyable(action: XodusAction): boolean {
  const conf = 'confidence' in action ? (action.confidence ?? 1.0) : 1.0

  switch (action.type) {
    case 'create_note':
    case 'create_grocery':
    case 'create_goal':
    case 'log_food':
    case 'log_manual_health':
    case 'create_workout_log':
    case 'add_open_loop':
      return conf >= AUTO_APPLY_THRESHOLD

    case 'complete_goal':
    case 'update_goal':
    case 'update_note':
      // Applier will further verify the fuzzy match exists; without a hit it
      // becomes a pending action client-side.
      return conf >= AUTO_APPLY_THRESHOLD

    case 'update_nutrition_profile':
      // High-impact profile change — only auto-apply at very high confidence.
      return conf >= 0.85

    case 'training_recommendation':
      // Informational — surfaced in the reply, no mutation.
      return true

    case 'create_project_update':
    case 'create_memory_candidate':
    case 'save_pending_review':
      // Always needs review until the user confirms.
      return false

    case 'no_op':
      return true
  }
}

// ─── Intent classification (used by reply formatter) ──────────────────────────

export type XodusIntent =
  | 'daily_planning'
  | 'note'
  | 'grocery'
  | 'nutrition'
  | 'manual_health'
  | 'workout_log'
  | 'project_update'
  | 'memory'
  | 'training'
  | 'mixed'
  | 'unknown'

export function classifyIntent(actions: XodusAction[]): XodusIntent {
  if (actions.length === 0) return 'unknown'

  const types = new Set(actions.map(a => a.type))
  if (types.size === 1) {
    const t = actions[0].type
    if (t === 'create_goal' || t === 'update_goal' || t === 'complete_goal') return 'daily_planning'
    if (t === 'create_note')                          return 'note'
    if (t === 'create_grocery')                       return 'grocery'
    if (t === 'log_food' || t === 'update_nutrition_profile') return 'nutrition'
    if (t === 'log_manual_health')                    return 'manual_health'
    if (t === 'create_workout_log')                   return 'workout_log'
    if (t === 'create_project_update')                return 'project_update'
    if (t === 'create_memory_candidate')              return 'memory'
    if (t === 'training_recommendation')              return 'training'
    return 'unknown'
  }
  return 'mixed'
}

// ─── Agent input + result envelopes ───────────────────────────────────────────

export type XodusInputSource =
  | 'web_chat'
  | 'telegram'
  | 'voice'
  | 'shortcut'
  | 'upload'
  | 'screenshot'
  | 'manual'

export interface XodusInputMedia {
  kind:      'image' | 'document' | 'audio'
  fileName?: string
  mimeType?: string
  url?:      string
  caption?:  string
}

export interface XodusAgentResult {
  reply:               string
  intent:              XodusIntent
  actions:             XodusAction[]
  autoApplyActions:    XodusAction[]
  needsReviewActions:  XodusAction[]
  confidence:          number
  source:              'ai' | 'rule_based'
  missingDataSignals?: string[]
  warnings?:           string[]
}

// ─── Server-side inbox item (future Telegram/upload queue) ────────────────────

export interface XodusInboxItem {
  id:         string
  source:     XodusInputSource
  text?:      string
  media?:     XodusInputMedia[]
  brainResult?: XodusAgentResult
  actions:    XodusAction[]
  status:     'pending' | 'applied' | 'ignored' | 'failed'
  createdAt:  string
}

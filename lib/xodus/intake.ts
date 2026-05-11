// XODUS Intake — shared types and rule-based fallback for DailyGoals parsing.
// No server-only imports here — safe for both client and server.

import { parseXodusInput } from '../daily-goals'
import type { GoalCategory } from '../daily-goals'
import type { NutritionProfile } from '../nutrition-profile'

export type XodusIntentType =
  | 'daily_planning'
  | 'nutrition_update'
  | 'project_update'
  | 'note'
  | 'task'
  | 'mixed'
  | 'unknown'

export type NoteCategory =
  | 'fitness' | 'school' | 'project' | 'car' | 'money' | 'personal' | 'other'

export interface DailyGoalDraft {
  text: string
  category: GoalCategory
}

export interface NoteEntry {
  title?: string
  body: string
  category?: NoteCategory
}

export interface ProjectUpdateEntry {
  projectName?: string
  update: string
  nextAction?: string
}

export interface XodusIntakeResult {
  summary: string
  intent: XodusIntentType
  targetDate: string                      // YYYY-MM-DD
  goals: DailyGoalDraft[]
  nutritionUpdates?: Partial<NutritionProfile>
  notes?: NoteEntry[]
  projectUpdates?: ProjectUpdateEntry[]
  confidence: number
  source: 'rule_based' | 'ai'
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────
// Wraps parseXodusInput() into XodusIntakeResult. Called when AI is unavailable.

export function intakeFromRuleParser(text: string): XodusIntakeResult {
  const parsed = parseXodusInput(text)

  const hasGoals     = parsed.goals.length > 0
  const hasNutrition = parsed.nutritionUpdate !== null

  const intent: XodusIntentType =
    hasGoals && hasNutrition ? 'mixed'
    : hasGoals               ? 'daily_planning'
    : hasNutrition           ? 'nutrition_update'
    : 'unknown'

  return {
    summary: hasGoals
      ? `${parsed.goals.length} goal${parsed.goals.length !== 1 ? 's' : ''} extracted`
      : 'No structured content detected',
    intent,
    targetDate: parsed.targetDate,
    goals: parsed.goals.map(g => ({ text: g.text, category: g.category })),
    nutritionUpdates: parsed.nutritionUpdate ?? undefined,
    confidence: 0.75,
    source: 'rule_based',
  }
}

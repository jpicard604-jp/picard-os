// ─── XODUS Action Type System ─────────────────────────────────────────────────
// All actions are returned by /api/agent and applied client-side.
// The server never directly mutates localStorage or Supabase from this pipeline.
// Client receives XodusAction[], applies them, dispatches STORAGE_EVENTS, then syncs.

export type XodusActionType =
  | 'daily_log.update'
  | 'activity_log.create'
  | 'nutrition_log.update'
  | 'project.update'
  | 'project_task.create'
  | 'voice_log.create'
  | 'brain_note.create'
  | 'no_op'
  | 'clarification_needed'

export type XodusInputSource = 'voice' | 'text' | 'upload' | 'api_data'

// Shared base fields on every action
interface XodusActionBase {
  type: XodusActionType
  confidence: number              // 0.0–1.0
  source: XodusInputSource
  summary: string                 // "Logged 220g protein and 2400 calories for today"
  requiresConfirmation: boolean   // true when confidence < 0.7 or values seem unusual
  warnings: string[]              // ["rpe not mentioned", "project id not found"]
  timestamp: string               // ISO 8601 — when the event occurred, default to now
}

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface DailyLogUpdatePayload {
  date?: string                    // YYYY-MM-DD — defaults to today
  calories?: number
  calorieTarget?: number
  protein?: number
  proteinTarget?: number
  weight?: number                  // lb
  water?: number                   // glasses
  sleepHours?: number
  sleepQuality?: number            // 0–100
  steps?: number
  screenTime?: number              // hours
  instagramTime?: number           // hours
  smokedToday?: boolean
  drankToday?: boolean
  confidenceScore?: number         // 1–10
  mood?: number                    // 1–5
  notes?: string
  recoveryScore?: number           // 0–100
  hrv?: number                     // ms
  restingHR?: number               // bpm
  strain?: number                  // 0–21
}

export interface ExerciseSetPayload {
  exercise: string
  sets?: number
  reps?: number
  weight?: number
  weightUnit?: 'lb' | 'kg' | 'bw'
  rpe?: number
  notes?: string
}

export interface ActivityLogCreatePayload {
  date?: string                    // YYYY-MM-DD — defaults to today
  type: 'strength' | 'run' | 'row' | 'walk' | 'swim' | 'bike' | 'recovery' | 'mobility' | 'hiit' | 'custom'
  label?: string
  duration?: number                // minutes
  distance?: number                // default miles
  distanceUnit?: 'miles' | 'km' | 'meters'
  steps?: number
  calories?: number
  rpe?: number                     // 1–10
  notes?: string
  exercises?: ExerciseSetPayload[]
}

// Nutrition-specific subset of daily log — used when only food/macros are mentioned
export interface NutritionUpdatePayload {
  date?: string                    // YYYY-MM-DD — defaults to today
  calories?: number
  calorieTarget?: number
  protein?: number
  proteinTarget?: number
  water?: number
  mealDescription?: string         // free-form, stored in notes field
}

export interface ProjectUpdatePayload {
  projectId: string                // must match an existing project id
  projectTitle?: string
  updateText: string               // free-form progress note
  progressBump?: number            // percentage points to add (0–20)
  status?: 'active' | 'paused' | 'complete'
}

export interface ProjectTaskCreatePayload {
  projectId: string                // must match an existing project id
  projectTitle?: string
  taskText: string
}

export interface VoiceLogCreatePayload {
  transcript: string
  duration?: number                // seconds
}

export interface BrainNotePayload {
  content: string
  tags: string[]                   // ['fitness', 'nutrition', 'project:play-productions']
  linkedProjectId?: string
  linkedDate?: string              // YYYY-MM-DD
}

export interface NoOpPayload {
  reason: string
  suggestions?: string[]
}

export interface ClarificationPayload {
  question: string
  partialActions?: XodusAction[]
}

// ─── Discriminated union ──────────────────────────────────────────────────────

export type XodusAction =
  | (XodusActionBase & { type: 'daily_log.update';     payload: DailyLogUpdatePayload })
  | (XodusActionBase & { type: 'activity_log.create';  payload: ActivityLogCreatePayload })
  | (XodusActionBase & { type: 'nutrition_log.update'; payload: NutritionUpdatePayload })
  | (XodusActionBase & { type: 'project.update';       payload: ProjectUpdatePayload })
  | (XodusActionBase & { type: 'project_task.create';  payload: ProjectTaskCreatePayload })
  | (XodusActionBase & { type: 'voice_log.create';     payload: VoiceLogCreatePayload })
  | (XodusActionBase & { type: 'brain_note.create';    payload: BrainNotePayload })
  | (XodusActionBase & { type: 'no_op';                payload: NoOpPayload })
  | (XodusActionBase & { type: 'clarification_needed'; payload: ClarificationPayload })

// ─── Agent I/O ────────────────────────────────────────────────────────────────

// Context snapshot injected into the agent prompt server-side.
// Assembled from Supabase or localStorage state before calling /api/agent.
export interface AgentContext {
  todayDate: string
  activeProjects?: Array<{
    id: string
    title: string
    progress: number
    priority: number
  }>
  currentDailyLog?: {
    calories: number | null
    protein: number | null
    sleepHours: number | null
    recoveryScore: number | null
  }
  userPreferences?: {
    proteinTarget: number
    calorieTarget: number
    weeklyWorkoutTarget: number
  }
}

// Response shape returned by POST /api/agent
export interface AgentResponse {
  ok: boolean
  actions: XodusAction[]
  summary: string
  provider: string
  model: string
  inputTokens?: number
  outputTokens?: number
  error?: string
}

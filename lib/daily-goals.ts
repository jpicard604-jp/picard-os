import type { NutritionProfile, NutritionPhase } from './nutrition-profile'

export type GoalCategory = 'fitness' | 'nutrition' | 'project' | 'school' | 'errand' | 'personal' | 'other'

export interface DailyGoal {
  id: string
  text: string
  category: GoalCategory
  done: boolean
  createdAt: string
}

export interface XodusParseResult {
  goals: Omit<DailyGoal, 'id' | 'done' | 'createdAt'>[]
  targetDate: string
  nutritionUpdate: Partial<NutritionProfile> | null
  rawNote: string
}

const KEY = 'picard_daily_goals_v1'

function loadAll(): Record<string, DailyGoal[]> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, DailyGoal[]>) : {}
  } catch { return {} }
}

function saveAll(all: Record<string, DailyGoal[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
    window.dispatchEvent(new CustomEvent('picard:goals-updated'))
  } catch {}
}

export function getGoalsForDate(date: string): DailyGoal[] {
  if (typeof window === 'undefined') return []
  return loadAll()[date] ?? []
}

export function getTodayGoals(): DailyGoal[] {
  return getGoalsForDate(new Date().toISOString().slice(0, 10))
}

export function addGoals(date: string, goals: Omit<DailyGoal, 'id' | 'done' | 'createdAt'>[]): DailyGoal[] {
  if (typeof window === 'undefined') return []
  const all = loadAll()
  const existing = all[date] ?? []
  const newGoals: DailyGoal[] = goals.map(g => ({
    ...g,
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    done: false,
    createdAt: new Date().toISOString(),
  }))
  all[date] = [...existing, ...newGoals]
  saveAll(all)
  return newGoals
}

export function toggleGoal(date: string, id: string): void {
  if (typeof window === 'undefined') return
  const all = loadAll()
  all[date] = (all[date] ?? []).map(g => g.id === id ? { ...g, done: !g.done } : g)
  saveAll(all)
}

export function deleteGoal(date: string, id: string): void {
  if (typeof window === 'undefined') return
  const all = loadAll()
  all[date] = (all[date] ?? []).filter(g => g.id !== id)
  saveAll(all)
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const FITNESS_WORDS = ['train', 'workout', 'gym', 'run', 'lift', 'cardio', 'yoga', 'swim', 'bike', 'hike', 'walk', 'chest', 'back', 'legs', 'shoulders', 'arms', 'push', 'pull', 'squat', 'deadlift', 'bench']
const PROJECT_WORDS = ['build', 'finish', 'launch', 'ship', 'deploy', 'code', 'write', 'design', 'picard', 'xodus', 'feature', 'fix', 'bug', 'pr', 'commit']
const SCHOOL_WORDS = ['study', 'homework', 'assignment', 'class', 'lecture', 'exam', 'quiz', 'review', 'notes']
const ERRAND_WORDS = ['buy', 'pick up', 'drop off', 'call', 'schedule', 'book', 'email', 'pay', 'order', 'grocery', 'groceries', 'errands']
const NUTRITION_WORDS = ['eat', 'calories', 'protein', 'carbs', 'fat', 'meal', 'food', 'diet', 'macro', 'macros', 'log nutrition']

const DAY_OFFSETS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function resolveTargetDate(text: string): string {
  const lower = text.toLowerCase()
  const today = new Date()

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  for (const [name, targetDay] of Object.entries(DAY_OFFSETS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      const todayDay = today.getDay()
      let diff = targetDay - todayDay
      if (diff <= 0) diff += 7
      const d = new Date(today)
      d.setDate(d.getDate() + diff)
      return d.toISOString().slice(0, 10)
    }
  }

  return today.toISOString().slice(0, 10)
}

function detectCategory(text: string): GoalCategory {
  const lower = text.toLowerCase()
  if (FITNESS_WORDS.some(w => lower.includes(w))) return 'fitness'
  if (PROJECT_WORDS.some(w => lower.includes(w))) return 'project'
  if (SCHOOL_WORDS.some(w => lower.includes(w))) return 'school'
  if (ERRAND_WORDS.some(w => lower.includes(w))) return 'errand'
  if (NUTRITION_WORDS.some(w => lower.includes(w))) return 'nutrition'
  return 'personal'
}

function detectNutritionUpdate(text: string): Partial<NutritionProfile> | null {
  const lower = text.toLowerCase()
  const update: Partial<NutritionProfile> = {}
  let found = false

  const calMatch = lower.match(/(\d{3,4})\s*(?:cal(?:ories?)?|kcal)/)
  if (calMatch) { update.calorieTarget = parseInt(calMatch[1]); found = true }

  const proteinMatch = lower.match(/(\d{2,3})\s*g?\s*protein|protein\s*:?\s*(\d{2,3})\s*g?/)
  if (proteinMatch) { update.proteinTarget = parseInt(proteinMatch[1] ?? proteinMatch[2]); found = true }

  const carbMatch = lower.match(/(\d{2,3})\s*g?\s*carbs?|carbs?\s*:?\s*(\d{2,3})\s*g?/)
  if (carbMatch) { update.carbTarget = parseInt(carbMatch[1] ?? carbMatch[2]); found = true }

  const fatMatch = lower.match(/(\d{2,3})\s*g?\s*fat\b|fat\s*:?\s*(\d{2,3})\s*g?/)
  if (fatMatch) { update.fatTarget = parseInt(fatMatch[1] ?? fatMatch[2]); found = true }

  if (/\bcutting\b|\bcut\b/.test(lower)) { update.phase = 'cutting' as NutritionPhase; found = true }
  else if (/\bbulking\b|\bbulk\b/.test(lower)) { update.phase = 'bulking' as NutritionPhase; found = true }
  else if (/\bmaintenance\b|\bmaintain\b/.test(lower)) { update.phase = 'maintenance' as NutritionPhase; found = true }

  return found ? update : null
}

export function parseXodusInput(input: string): XodusParseResult {
  const rawNote = input.trim()
  const targetDate = resolveTargetDate(rawNote)

  const stripped = rawNote
    .replace(/\btomorrow\b/gi, '')
    .replace(/\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .trim()

  const parts = stripped
    .split(/,\s*/)
    .map(p => p.trim())
    .filter(p => p.length > 2)

  const nutritionUpdate = detectNutritionUpdate(rawNote)

  const goals: Omit<DailyGoal, 'id' | 'done' | 'createdAt'>[] = parts.map(part => ({
    text: part.charAt(0).toUpperCase() + part.slice(1),
    category: detectCategory(part),
  }))

  return { goals, targetDate, nutritionUpdate, rawNote }
}

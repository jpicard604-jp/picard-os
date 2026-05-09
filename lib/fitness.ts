import { getStorage, setStorage, STORAGE_KEYS, STORAGE_EVENTS } from './storage'

export type ActivityType =
  | 'strength' | 'run' | 'row' | 'walk' | 'swim'
  | 'bike' | 'recovery' | 'mobility' | 'hiit' | 'custom'

export type ActivitySource = 'manual' | 'voice' | 'whoop' | 'strava' | 'apple_health' | 'imported'

export type WeightUnit = 'lb' | 'kg' | 'bw'

export interface ExerciseSet {
  exercise: string
  sets?: number
  reps?: number | string
  weight?: number
  weightUnit?: WeightUnit
  rpe?: number
  notes?: string
}

export interface ActivityLog {
  id: string
  date: string              // YYYY-MM-DD
  type: ActivityType
  label?: string
  duration?: number         // minutes
  distance?: number         // miles default
  distanceUnit?: 'miles' | 'km' | 'meters'
  steps?: number
  calories?: number
  exercises?: ExerciseSet[]
  rpe?: number
  notes?: string
  source: ActivitySource
  createdAt: string
  externalId?: string
  heartRateAvg?: number
  heartRateMax?: number
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  strength: 'Strength', run: 'Run', row: 'Row', walk: 'Walk', swim: 'Swim',
  bike: 'Bike', recovery: 'Recovery', mobility: 'Mobility', hiit: 'HIIT', custom: 'Custom',
}

export const ACTIVITY_TYPE_COLORS: Record<ActivityType, { text: string; bg: string; border: string }> = {
  strength: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  run:      { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  row:      { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  walk:     { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
  swim:     { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  bike:     { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  recovery: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  mobility: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  hiit:     { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  custom:   { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
}

// Seed data — realistic but not treated as fixed program
export const SEED_ACTIVITIES: ActivityLog[] = [
  {
    id: 'act-may7',
    date: '2026-05-07',
    type: 'strength',
    label: 'Upper — Chest & Back',
    duration: 62,
    exercises: [
      { exercise: 'Flat Bench Press', sets: 4, reps: 5, weight: 225, weightUnit: 'lb' },
      { exercise: 'Incline DB Press', sets: 3, reps: 10, weight: 80, weightUnit: 'lb' },
      { exercise: 'Weighted Pull-Up', sets: 4, reps: 6, weight: 45, weightUnit: 'lb', notes: 'PR' },
      { exercise: 'Cable Row', sets: 3, reps: 12, weight: 160, weightUnit: 'lb' },
    ],
    rpe: 8,
    source: 'manual',
    createdAt: '2026-05-07T11:30:00.000Z',
  },
  {
    id: 'act-may6',
    date: '2026-05-06',
    type: 'strength',
    label: 'Lower — Squat Focus',
    duration: 55,
    exercises: [
      { exercise: 'Back Squat', sets: 4, reps: 5, weight: 275, weightUnit: 'lb' },
      { exercise: 'Romanian Deadlift', sets: 3, reps: 10, weight: 185, weightUnit: 'lb' },
      { exercise: 'Leg Press', sets: 3, reps: 12, weight: 360, weightUnit: 'lb' },
    ],
    rpe: 7,
    source: 'manual',
    createdAt: '2026-05-06T10:00:00.000Z',
  },
  {
    id: 'act-may5',
    date: '2026-05-05',
    type: 'run',
    label: 'Morning Run',
    duration: 28,
    distance: 3.1,
    distanceUnit: 'miles',
    steps: 6200,
    rpe: 6,
    source: 'manual',
    createdAt: '2026-05-05T07:15:00.000Z',
  },
  {
    id: 'act-may4',
    date: '2026-05-04',
    type: 'strength',
    label: 'Upper — Shoulders & Arms',
    duration: 48,
    exercises: [
      { exercise: 'Overhead Press', sets: 4, reps: 8, weight: 135, weightUnit: 'lb' },
      { exercise: 'Lateral Raise', sets: 3, reps: 15, weight: 25, weightUnit: 'lb' },
      { exercise: 'Bicep Curl', sets: 3, reps: 12, weight: 50, weightUnit: 'lb' },
      { exercise: 'Tricep Pushdown', sets: 3, reps: 15, weight: 70, weightUnit: 'lb' },
    ],
    rpe: 7,
    source: 'manual',
    createdAt: '2026-05-04T10:30:00.000Z',
  },
  {
    id: 'act-may3',
    date: '2026-05-03',
    type: 'row',
    label: 'Row + Walk',
    duration: 20,
    steps: 8500,
    rpe: 5,
    notes: 'Light recovery row, then walked outside',
    source: 'manual',
    createdAt: '2026-05-03T08:00:00.000Z',
  },
  {
    id: 'act-may2',
    date: '2026-05-02',
    type: 'strength',
    label: 'Upper — Chest & Back',
    duration: 60,
    exercises: [
      { exercise: 'Flat Bench Press', sets: 4, reps: 5, weight: 220, weightUnit: 'lb' },
      { exercise: 'Incline DB Press', sets: 3, reps: 10, weight: 75, weightUnit: 'lb' },
      { exercise: 'Weighted Pull-Up', sets: 4, reps: 5, weight: 45, weightUnit: 'lb' },
      { exercise: 'Cable Row', sets: 3, reps: 12, weight: 155, weightUnit: 'lb' },
    ],
    rpe: 8,
    source: 'manual',
    createdAt: '2026-05-02T11:00:00.000Z',
  },
]

export function getActivityLogs(): ActivityLog[] {
  const saved = getStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, [])
  return saved.length > 0 ? saved : SEED_ACTIVITIES
}

export function addActivityLog(entry: ActivityLog): void {
  const existing = getStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, [])
  const base = existing.length > 0 ? existing : []
  setStorage(STORAGE_KEYS.ACTIVITY_LOGS, [entry, ...base])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED))
  }
}

export function getThisWeekLogs(): ActivityLog[] {
  const logs = getActivityLogs()
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const mondayStr = monday.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  return logs.filter((l) => l.date >= mondayStr && l.date <= todayStr)
}

export function getExerciseHistory(
  logs: ActivityLog[],
  exerciseName: string
): Array<{ date: string; sets?: number; reps?: number | string; weight?: number; weightUnit?: WeightUnit }> {
  const norm = exerciseName.toLowerCase()
  const results: Array<{ date: string; sets?: number; reps?: number | string; weight?: number; weightUnit?: WeightUnit }> = []
  for (const log of logs) {
    if (log.type !== 'strength' || !log.exercises) continue
    const match = log.exercises.find(
      (e) => e.exercise.toLowerCase() === norm ||
             e.exercise.toLowerCase().includes(norm) ||
             norm.includes(e.exercise.toLowerCase().split(' ')[0])
    )
    if (match) results.push({ date: log.date, sets: match.sets, reps: match.reps, weight: match.weight, weightUnit: match.weightUnit })
  }
  return results.sort((a, b) => b.date.localeCompare(a.date))
}

export function getUniqueExercises(logs: ActivityLog[]): string[] {
  const seen = new Set<string>()
  for (const log of logs) {
    if (log.type !== 'strength' || !log.exercises) continue
    for (const ex of log.exercises) seen.add(ex.exercise)
  }
  return Array.from(seen)
}

export function getTodayActivitySteps(): number {
  const today = new Date().toISOString().slice(0, 10)
  return getActivityLogs()
    .filter((l) => l.date === today && l.steps !== undefined)
    .reduce((sum, l) => sum + (l.steps ?? 0), 0)
}

export function getTodayActivity(): ActivityLog | null {
  const today = new Date().toISOString().slice(0, 10)
  const logs = getActivityLogs()
  return logs.find((l) => l.date === today) ?? null
}

// Returns a suggested next-session weight for an exercise.
// Uses a simple linear progression: +5lb for large compounds, +2.5lb otherwise.
// Returns null when there's no weight history.
export function suggestNextWeight(
  history: Array<{ weight?: number; reps?: number | string; weightUnit?: WeightUnit }>,
  exerciseName: string
): { weight: number; increment: number } | null {
  const withWeight = history.filter((h) => h.weight !== undefined)
  if (withWeight.length === 0) return null
  const latestWeight = withWeight[0].weight!
  const isLargeCompound = /bench|squat|deadlift|press|row|pull/i.test(exerciseName)
  const increment = isLargeCompound ? 5 : 2.5
  return { weight: latestWeight + increment, increment }
}

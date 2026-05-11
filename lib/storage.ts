export const STORAGE_KEYS = {
  STACK_STATE: 'picard_stack_v1',
  VOICE_LOGS: 'picard_voice_logs_v1',
  UPLOAD_HISTORY: 'picard_uploads_v1',
  DAILY_LOGS: 'picard_daily_logs_v1',
  PROJECTS: 'picard_projects_v1',
  ACTIVITY_LOGS: 'picard_activity_logs_v1',
} as const

export const STORAGE_EVENTS = {
  DAILY_LOG_UPDATED: 'picard:daily-log-updated',
  VOICE_LOG_SAVED: 'picard:voice-log-saved',
  PROJECTS_UPDATED: 'picard:projects-updated',
  STACK_UPDATED: 'picard:stack-updated',
  ACTIVITY_LOG_UPDATED: 'picard:activity-log-updated',
} as const

export interface DailyLog {
  date: string
  calories: number | null
  calorieTarget: number | null
  protein: number | null
  proteinTarget: number | null
  weight: number | null
  water: number | null
  sleepHours: number | null
  sleepQuality: number | null  // 0-100
  steps: number | null
  screenTime: number | null
  instagramTime: number | null
  smokedToday: boolean
  drankToday: boolean
  confidenceScore: number | null
  mood: number | null
  notes: string
  // Recovery / WHOOP fields (manual entry until real API connects)
  recoveryScore: number | null   // 0-100
  hrv: number | null             // ms
  restingHR: number | null       // bpm
  strain: number | null          // 0-21
  savedAt: string
}

export interface VoiceLog {
  id: string
  timestamp: string
  transcript: string
  duration: number
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function emptyLog(date: string): DailyLog {
  return {
    date,
    calories: null,
    calorieTarget: null,
    protein: null,
    proteinTarget: null,
    weight: null,
    water: null,
    sleepHours: null,
    sleepQuality: null,
    steps: null,
    screenTime: null,
    instagramTime: null,
    smokedToday: false,
    drankToday: false,
    confidenceScore: null,
    mood: null,
    notes: '',
    recoveryScore: null,
    hrv: null,
    restingHR: null,
    strain: null,
    savedAt: '',
  }
}

// Count consecutive past days (not including today) where drankToday === false.
// Returns 0 when no history. Returns the actual streak count from stored logs.
export function getAlcoholStreak(): number {
  if (typeof window === 'undefined') return 0
  const all = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  let streak = 0
  const today = new Date()
  for (let i = 1; i <= 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const log = all[key]
    if (!log) break
    if (log.drankToday) break
    streak++
  }
  // Also check today's log if it exists and says no drink
  const todayKey = getTodayKey()
  const todayLog = all[todayKey]
  if (todayLog && !todayLog.drankToday) streak++
  return streak
}

export function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function getTodayLog(): DailyLog | null {
  const all = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  return all[getTodayKey()] ?? null
}

export function saveTodayLog(log: DailyLog): void {
  const all = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  setStorage(STORAGE_KEYS.DAILY_LOGS, { ...all, [log.date]: log })
  window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.DAILY_LOG_UPDATED))
  import('@/lib/supabase/sync').then(({ syncDailyLog }) => syncDailyLog(log))
}

export function getTodayDateLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getVoiceLogsToday(): VoiceLog[] {
  const today = getTodayKey()
  return getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, []).filter((l) => l.timestamp.startsWith(today))
}

export function getUploadsToday<T extends { uploadedAt: string }>(): T[] {
  const label = getTodayDateLabel()
  return getStorage<T[]>(STORAGE_KEYS.UPLOAD_HISTORY, []).filter((f) => f.uploadedAt === label)
}

export function saveVoiceLog(log: VoiceLog): void {
  const all = getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, [])
  setStorage(STORAGE_KEYS.VOICE_LOGS, [...all, log])
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.VOICE_LOG_SAVED))
  }
  import('@/lib/supabase/sync').then(({ syncVoiceLog }) => syncVoiceLog(log))
}

export function resetStorageKey(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.DAILY_LOG_UPDATED))
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.PROJECTS_UPDATED))
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.STACK_UPDATED))
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED))
  }
}

export function validateStorageKey(key: string): { ok: boolean; bytes: number; error?: string } {
  if (typeof window === 'undefined') return { ok: false, bytes: 0, error: 'SSR' }
  const raw = localStorage.getItem(key)
  if (!raw) return { ok: true, bytes: 0 }
  try {
    JSON.parse(raw)
    return { ok: true, bytes: new Blob([raw]).size }
  } catch (e) {
    return { ok: false, bytes: new Blob([raw]).size, error: String(e) }
  }
}

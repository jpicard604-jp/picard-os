import { getStorage, STORAGE_KEYS } from './storage'
import type { DailyLog } from './storage'
import { getActivityLogs } from './fitness'

export type TrendWindow = '7d' | '30d' | 'monthly' | 'yearly'

export interface DailyTrendPoint {
  date: string
  label: string
  recovery: number | null
  hrv: number | null
  restingHR: number | null
  strain: number | null
  sleep: number | null
  steps: number | null
  weight: number | null
  workouts: number
  avg7Recovery: number | null
  avg7Hrv: number | null
  avg7RestingHR: number | null
  avg7Strain: number | null
  avg7Sleep: number | null
}

export interface MonthlyTrendPoint {
  month: string
  label: string
  recovery: number | null
  hrv: number | null
  restingHR: number | null
  strain: number | null
  sleep: number | null
  steps: number | null
  weight: number | null
  workouts: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function rollingAvg(values: (number | null)[], index: number, windowSize: number): number | null {
  const start = Math.max(0, index - windowSize + 1)
  const slice = values.slice(start, index + 1)
  const nums = slice.filter((v): v is number => v !== null)
  if (nums.length < 2) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function avgNonNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function roundWeight(w: number | null | undefined): number | null {
  if (w === null || w === undefined) return null
  return Math.round(w * 10) / 10
}

// Build all 365 daily points (oldest → newest) with 7-day rolling averages.
// Data is keyed by YYYY-MM-DD so one entry per calendar day — no duplication.
// Returns empty array during SSR.
export function buildAllDailyPoints(): DailyTrendPoint[] {
  if (typeof window === 'undefined') return []

  const allLogs = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  const activityLogs = getActivityLogs()

  const workoutsByDate: Record<string, number> = {}
  for (const al of activityLogs) {
    workoutsByDate[al.date] = (workoutsByDate[al.date] ?? 0) + 1
  }

  const today = new Date()
  const raw: DailyTrendPoint[] = []

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const log = allLogs[dateStr] ?? null
    raw.push({
      date: dateStr,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
      recovery: log?.recoveryScore ?? null,
      hrv: log?.hrv ?? null,
      restingHR: log?.restingHR ?? null,
      strain: log?.strain !== null && log?.strain !== undefined ? Math.round(log.strain * 10) / 10 : null,
      sleep: log?.sleepHours ?? null,
      steps: log?.steps ?? null,
      weight: roundWeight(log?.weight),
      workouts: workoutsByDate[dateStr] ?? 0,
      avg7Recovery: null,
      avg7Hrv: null,
      avg7RestingHR: null,
      avg7Strain: null,
      avg7Sleep: null,
    })
  }

  const recoveryVals = raw.map(p => p.recovery)
  const hrvVals = raw.map(p => p.hrv)
  const restingHRVals = raw.map(p => p.restingHR)
  const strainVals = raw.map(p => p.strain)
  const sleepVals = raw.map(p => p.sleep)

  return raw.map((p, i) => ({
    ...p,
    avg7Recovery: rollingAvg(recoveryVals, i, 7),
    avg7Hrv: rollingAvg(hrvVals, i, 7),
    avg7RestingHR: rollingAvg(restingHRVals, i, 7),
    avg7Strain: rollingAvg(strainVals, i, 7),
    avg7Sleep: rollingAvg(sleepVals, i, 7),
  }))
}

// Build N monthly aggregated points (oldest → newest).
// Returns empty array during SSR.
export function buildMonthlyPoints(monthCount: number): MonthlyTrendPoint[] {
  if (typeof window === 'undefined') return []

  const allLogs = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  const activityLogs = getActivityLogs()

  const workoutsByMonth: Record<string, number> = {}
  for (const al of activityLogs) {
    const m = al.date.slice(0, 7)
    workoutsByMonth[m] = (workoutsByMonth[m] ?? 0) + 1
  }

  const today = new Date()
  const months: MonthlyTrendPoint[] = []

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const yr = d.getFullYear()
    const mo = d.getMonth()
    const monthStr = `${yr}-${String(mo + 1).padStart(2, '0')}`

    const monthLogs = Object.entries(allLogs)
      .filter(([date]) => date.startsWith(monthStr))
      .map(([, log]) => log)

    months.push({
      month: monthStr,
      label: `${MONTH_NAMES[mo]} '${String(yr).slice(2)}`,
      recovery: avgNonNull(monthLogs.map(l => l.recoveryScore)),
      hrv: avgNonNull(monthLogs.map(l => l.hrv)),
      restingHR: avgNonNull(monthLogs.map(l => l.restingHR)),
      strain: avgNonNull(monthLogs.map(l => l.strain !== null && l.strain !== undefined ? Math.round(l.strain * 10) / 10 : null)),
      sleep: avgNonNull(monthLogs.map(l => l.sleepHours)),
      steps: avgNonNull(monthLogs.map(l => l.steps)),
      weight: avgNonNull(monthLogs.map(l => roundWeight(l.weight))),
      workouts: workoutsByMonth[monthStr] ?? 0,
    })
  }

  return months
}

// Slice the last N daily points from a full 365-day array.
export function sliceDays(all: DailyTrendPoint[], days: number): DailyTrendPoint[] {
  return all.slice(-days)
}

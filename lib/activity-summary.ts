import { getTodayLog } from './storage'
import { getActivityLogs, getThisWeekLogs } from './fitness'

export type BalanceStatus = 'PUSH' | 'OPTIMAL' | 'MONITOR' | 'OVERREACHING' | 'REST'

export interface DailyActivitySummary {
  // Today
  stepsToday: number
  stepSource: 'log' | 'activity' | 'none'
  activeMinutesToday: number
  activityTypeToday: string | null
  activityLabelToday: string | null
  hasActivityToday: boolean

  // This week
  weeklyWorkouts: number
  weeklyStrengthSessions: number
  weeklyRunDistance: number    // miles
  weeklyRowMinutes: number
  weeklyActiveMinutes: number
  weeklySteps: number
  weekDays: boolean[]          // Mon–Sun, true = has at least one activity

  // Recovery/activity balance
  balanceStatus: BalanceStatus
  balanceLabel: string
}

function getWeekDayDates(): string[] {
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function getDailyActivitySummary(): DailyActivitySummary {
  const todayStr = new Date().toISOString().slice(0, 10)
  const log = getTodayLog()
  const allLogs = getActivityLogs()
  const weekLogs = getThisWeekLogs()
  const recoveryScore = log?.recoveryScore ?? null

  // Today's activities
  const todayLogs = allLogs.filter((l) => l.date === todayStr)
  const activityStepsToday = todayLogs.reduce((s, l) => s + (l.steps ?? 0), 0)
  const activeMinutesToday = todayLogs.reduce((s, l) => s + (l.duration ?? 0), 0)
  const firstActivity = todayLogs[0] ?? null
  const hasActivityToday = todayLogs.length > 0

  // Steps: DailyLog.steps is the user's declared total for the day (authoritative).
  // ActivityLog.steps are workout-specific (fallback when no daily log steps entry).
  const logSteps = log?.steps ?? null
  const stepsToday = logSteps !== null ? logSteps : activityStepsToday
  const stepSource: DailyActivitySummary['stepSource'] =
    logSteps !== null ? 'log' : activityStepsToday > 0 ? 'activity' : 'none'

  // Weekly stats
  const weeklyWorkouts = weekLogs.length
  const weeklyStrengthSessions = weekLogs.filter((l) => l.type === 'strength').length
  const weeklyRunDistance = weekLogs
    .filter((l) => l.type === 'run')
    .reduce((s, l) => s + (l.distance ?? 0), 0)
  const weeklyRowMinutes = weekLogs
    .filter((l) => l.type === 'row')
    .reduce((s, l) => s + (l.duration ?? 0), 0)
  const weeklyActiveMinutes = weekLogs.reduce((s, l) => s + (l.duration ?? 0), 0)
  const weeklySteps = weekLogs.reduce((s, l) => s + (l.steps ?? 0), 0)

  // Week day presence
  const weekDayDates = getWeekDayDates()
  const weekDays = weekDayDates.map((d) => weekLogs.some((l) => l.date === d))

  // Recovery / activity balance
  let balanceStatus: BalanceStatus
  let balanceLabel: string

  if (recoveryScore === null) {
    balanceStatus = hasActivityToday ? 'OPTIMAL' : 'PUSH'
    balanceLabel = hasActivityToday ? 'Activity logged — log recovery score for full picture' : 'Log recovery score to calibrate load'
  } else if (recoveryScore >= 70 && !hasActivityToday) {
    balanceStatus = 'PUSH'
    balanceLabel = 'Green light — ready to train'
  } else if (recoveryScore >= 70 && hasActivityToday) {
    balanceStatus = 'OPTIMAL'
    balanceLabel = 'Optimal — load absorbed'
  } else if (recoveryScore >= 50 && hasActivityToday) {
    balanceStatus = 'MONITOR'
    balanceLabel = 'Monitor — moderate load on partial recovery'
  } else if (recoveryScore < 50 && hasActivityToday) {
    balanceStatus = 'OVERREACHING'
    balanceLabel = 'Overreaching — back off intensity'
  } else {
    balanceStatus = 'REST'
    balanceLabel = 'Low recovery — rest or light mobility only'
  }

  return {
    stepsToday,
    stepSource,
    activeMinutesToday,
    activityTypeToday: firstActivity?.type ?? null,
    activityLabelToday: firstActivity ? (firstActivity.label ?? firstActivity.type) : null,
    hasActivityToday,
    weeklyWorkouts,
    weeklyStrengthSessions,
    weeklyRunDistance,
    weeklyRowMinutes,
    weeklyActiveMinutes,
    weeklySteps,
    weekDays,
    balanceStatus,
    balanceLabel,
  }
}

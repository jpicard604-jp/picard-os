import { JACKSON } from './mock-data'
import type { DailyLog } from './storage'

export type RecoveryLevel = 'ADAPTED' | 'RECOVERING' | 'STRAINED'
export type DisciplineLevel = 'LOCKED_IN' | 'CONSISTENT' | 'SLIPPING' | 'OFF'
export type UrgencyLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
export type ConsistencyLevel = 'STREAK' | 'BUILDING' | 'INCONSISTENT' | 'BROKEN'

export interface ScoreBreakdown {
  recovery: number   // 0-20
  nutrition: number  // 0-25
  discipline: number // 0-20
  mental: number     // 0-15
  habits: number     // 0-10
  logging: number    // 0-10
}

export interface StatusAlert {
  level: 'critical' | 'warning' | 'info'
  message: string
  category: 'nutrition' | 'recovery' | 'discipline' | 'mental' | 'logging' | 'projects'
}

export interface DailyStatusExtras {
  voiceLogsToday?: number
  uploadsToday?: number
  stackTaken?: number
  stackTotal?: number
  activeProjects?: number
  overdueProjects?: number
  weeklyWorkouts?: number
  activityMinutesToday?: number
  todayActivityLabel?: string  // e.g. "Upper — Chest & Back" or "Run"
  todayActivityType?: string   // ActivityType value
}

export interface DailyStatus {
  executionScore: number
  recoveryLevel: RecoveryLevel
  disciplineLevel: DisciplineLevel
  urgencyLevel: UrgencyLevel
  consistencyLevel: ConsistencyLevel
  scores: ScoreBreakdown
  alerts: StatusAlert[]
  strengths: string[]
  focuses: string[]
  stackCompletion: number
  loggedToday: boolean
  missingInputs: string[]
}

export function generateDailyStatus(
  log: DailyLog | null,
  extras: DailyStatusExtras = {}
): DailyStatus {
  const rec = JACKSON.today.recovery
  const nutr = JACKSON.today.nutrition
  const screen = JACKSON.today.screenTime
  const streaks = JACKSON.today.streaks

  const pTarget = log?.proteinTarget ?? nutr.protein.target
  const cTarget = log?.calorieTarget ?? nutr.calories.target
  const screenTarget = screen.target
  const noDrinkStreak = streaks.noDrinking

  const protein = log?.protein ?? null
  const calories = log?.calories ?? null
  const water = log?.water ?? null
  const sleepHours = log?.sleepHours ?? null
  const screenTime = log?.screenTime ?? null
  const instagramTime = log?.instagramTime ?? null
  const smoked = log?.smokedToday ?? false
  const drank = log?.drankToday ?? false
  const confidence = log?.confidenceScore ?? null
  const mood = log?.mood ?? null
  const notes = log?.notes ?? ''

  const voiceLogsToday = extras.voiceLogsToday ?? 0
  const stackTaken = extras.stackTaken ?? 0
  const stackTotal = extras.stackTotal ?? 0
  const overdueProjects = extras.overdueProjects ?? 0
  const weeklyWorkouts = extras.weeklyWorkouts ?? 0
  const activityMinutesToday = extras.activityMinutesToday ?? 0
  const stepsToday = log?.steps ?? null
  const stackPct = stackTotal > 0 ? stackTaken / stackTotal : 0

  // Recovery score (0-20)
  let recoveryScore = rec.score >= 70 ? 20 : rec.score >= 50 ? 12 : 5
  if (sleepHours !== null) {
    if (sleepHours >= 8) recoveryScore = Math.min(20, recoveryScore + 3)
    else if (sleepHours < 6) recoveryScore = Math.max(0, recoveryScore - 5)
  }

  // Nutrition score (0-25)
  let nutritionScore = 0
  if (protein !== null) {
    const pct = protein / pTarget
    if (pct >= 0.9) nutritionScore += 15
    else if (pct >= 0.7) nutritionScore += 8
    else if (pct >= 0.5) nutritionScore += 3
  }
  if (calories !== null) {
    const diff = Math.abs(calories - cTarget)
    if (diff <= 150) nutritionScore += 10
    else if (diff <= 350) nutritionScore += 5
  }
  if (water !== null && water >= 8) nutritionScore += 5

  // Discipline score (0-20)
  let disciplineScore = 0
  if (!drank) { disciplineScore += 10; if (noDrinkStreak >= 14) disciplineScore += 2 }
  if (!smoked) disciplineScore += 5
  if (screenTime !== null) {
    if (screenTime <= screenTarget) disciplineScore += 5
    else if (screenTime <= screenTarget + 1) disciplineScore += 2
  }

  // Mental score (0-15)
  let mentalScore = 0
  if (confidence !== null) {
    if (confidence >= 8) mentalScore += 10
    else if (confidence >= 6) mentalScore += 6
    else if (confidence >= 4) mentalScore += 3
  }
  if (mood !== null) {
    if (mood >= 4) mentalScore += 5
    else if (mood >= 3) mentalScore += 2
  }

  // Habits score (0-10)
  let habitsScore = 0
  if (stackPct >= 0.8) habitsScore += 3
  else if (stackPct >= 0.5) habitsScore += 1
  if (voiceLogsToday > 0) habitsScore += 1
  // Activity minutes: any movement earns score
  if (activityMinutesToday >= 30) habitsScore += 4
  else if (activityMinutesToday >= 20) habitsScore += 2
  else if (activityMinutesToday > 0) habitsScore += 1
  // Steps as supplemental signal when activity minutes not available
  if (activityMinutesToday === 0 && stepsToday !== null) {
    if (stepsToday >= 10000) habitsScore += 4
    else if (stepsToday >= 7500) habitsScore += 3
    else if (stepsToday >= 5000) habitsScore += 1
  }
  if (weeklyWorkouts >= 4) habitsScore = Math.min(10, habitsScore + 2)

  // Logging score (0-10)
  let loggingScore = 0
  if (log !== null) loggingScore += 7
  if (notes.trim().length > 20) loggingScore += 3

  const scores: ScoreBreakdown = {
    recovery: recoveryScore,
    nutrition: nutritionScore,
    discipline: disciplineScore,
    mental: mentalScore,
    habits: habitsScore,
    logging: loggingScore,
  }

  const executionScore = Math.min(100,
    recoveryScore + nutritionScore + disciplineScore + mentalScore + habitsScore + loggingScore
  )

  const urgencyLevel: UrgencyLevel =
    executionScore >= 75 ? 'LOW' : executionScore >= 55 ? 'MODERATE' : executionScore >= 35 ? 'HIGH' : 'CRITICAL'

  const recoveryLevel: RecoveryLevel =
    rec.score >= 70 ? 'ADAPTED' : rec.score >= 50 ? 'RECOVERING' : 'STRAINED'

  const disciplineLevel: DisciplineLevel =
    disciplineScore >= 18 ? 'LOCKED_IN' :
    disciplineScore >= 13 ? 'CONSISTENT' :
    disciplineScore >= 7 ? 'SLIPPING' : 'OFF'

  const consistencyLevel: ConsistencyLevel =
    noDrinkStreak >= 14 && !smoked ? 'STREAK' :
    noDrinkStreak >= 7 ? 'BUILDING' :
    drank || smoked ? 'INCONSISTENT' : 'BUILDING'

  // Alerts
  const alerts: StatusAlert[] = []

  if (!log) {
    alerts.push({ level: 'critical', message: 'No daily log today — metrics are estimated', category: 'logging' })
  }
  if (protein !== null && protein < pTarget * 0.7) {
    alerts.push({ level: 'warning', message: `Protein ${Math.round(pTarget - protein)}g behind target`, category: 'nutrition' })
  }
  if (screenTime !== null && screenTime > screenTarget) {
    alerts.push({ level: 'warning', message: `Screen ${(screenTime - screenTarget).toFixed(1)}h over ${screenTarget}h limit`, category: 'discipline' })
    if (instagramTime !== null && instagramTime > 0.5) {
      alerts.push({ level: 'info', message: `Instagram: ${instagramTime}h of that`, category: 'discipline' })
    }
  }
  if (drank) {
    alerts.push({ level: 'warning', message: 'Alcohol today — streak resets tomorrow', category: 'discipline' })
  }
  if (smoked) {
    alerts.push({ level: 'warning', message: 'Smoking noted today', category: 'discipline' })
  }
  if (stackTotal > 0 && stackPct < 0.5 && log) {
    alerts.push({ level: 'info', message: `Stack ${stackTaken}/${stackTotal} — ${stackTotal - stackTaken} compounds remaining`, category: 'logging' })
  }
  if (confidence !== null && confidence <= 4) {
    alerts.push({ level: 'info', message: `Confidence at ${confidence}/10 — identify the drag`, category: 'mental' })
  }
  if (stepsToday !== null && stepsToday < 4000 && log && activityMinutesToday === 0) {
    alerts.push({ level: 'info', message: `Steps low at ${stepsToday.toLocaleString()} — get moving`, category: 'logging' })
  }
  if (log && activityMinutesToday === 0 && rec.score >= 70) {
    alerts.push({ level: 'info', message: 'Recovery is green — no activity logged yet', category: 'logging' })
  }
  if (sleepHours !== null && sleepHours < 6.5) {
    alerts.push({ level: 'warning', message: `Sleep at ${sleepHours}h — recovery is compromised`, category: 'recovery' })
  }
  if (overdueProjects > 0) {
    alerts.push({ level: 'warning', message: `${overdueProjects} project${overdueProjects > 1 ? 's' : ''} past target date`, category: 'projects' })
  }

  // Strengths
  const strengths: string[] = []
  if (rec.score >= 70) strengths.push(`Recovery ${rec.score} — system adapted`)
  if (noDrinkStreak >= 14) strengths.push(`${noDrinkStreak}d no alcohol`)
  if (protein !== null && protein >= pTarget * 0.9) strengths.push(`Protein locked — ${protein}g`)
  if (!smoked && !drank) strengths.push('Clean day')
  if (screenTime !== null && screenTime <= screenTarget) strengths.push(`Screen time under control`)
  if (confidence !== null && confidence >= 8) strengths.push(`Confidence ${confidence}/10`)
  if (voiceLogsToday > 0) strengths.push(`${voiceLogsToday} voice log${voiceLogsToday > 1 ? 's' : ''} captured`)
  if (stackPct >= 0.8) strengths.push(`Stack ${Math.round(stackPct * 100)}% done`)
  if (stepsToday !== null && stepsToday >= 10000 && activityMinutesToday === 0) strengths.push(`${stepsToday.toLocaleString()} steps — active day`)
  if (activityMinutesToday >= 30) strengths.push(`${activityMinutesToday}min active today`)
  if (weeklyWorkouts >= 4) strengths.push(`${weeklyWorkouts} workouts this week`)

  // Focuses
  const focuses: string[] = []
  if (!log) {
    focuses.push('log today\'s metrics')
  } else {
    if (protein !== null && protein < pTarget * 0.8) focuses.push(`close protein gap (${Math.round(pTarget - protein)}g)`)
    if (screenTime !== null && screenTime > screenTarget) focuses.push(`cap screen at ${screenTarget}h`)
    if (stackTotal > 0 && stackTaken < stackTotal) focuses.push(`finish stack (${stackTotal - stackTaken} left)`)
    if (!drank && noDrinkStreak > 0) focuses.push('protect the streak')
    if (calories !== null && Math.abs(calories - cTarget) > 300) focuses.push('hit calorie target')
  }
  if (focuses.length === 0) focuses.push('maintain execution')

  // Missing inputs
  const missingInputs: string[] = []
  if (!log) {
    missingInputs.push('daily log')
  } else {
    if (protein === null) missingInputs.push('protein')
    if (calories === null) missingInputs.push('calories')
    if (sleepHours === null) missingInputs.push('sleep')
    if (screenTime === null) missingInputs.push('screen time')
    if (confidence === null) missingInputs.push('confidence')
    if (mood === null) missingInputs.push('mood')
  }

  return {
    executionScore,
    recoveryLevel,
    disciplineLevel,
    urgencyLevel,
    consistencyLevel,
    scores,
    alerts,
    strengths,
    focuses,
    stackCompletion: stackPct,
    loggedToday: log !== null,
    missingInputs,
  }
}

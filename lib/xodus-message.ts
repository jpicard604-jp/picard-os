import { generateDailyStatus } from './daily-status'
import { getAlcoholStreak } from './storage'
import type { DailyLog } from './storage'
import type { DailyStatusExtras, DailyStatus } from './daily-status'
import type { UrgencyLevel } from './mock-data'

export interface XodusOutput {
  paragraphs: string[]
  executionScore: number
  urgency: UrgencyLevel
  focusRecommendation: string
  recoveryState: string
  loggedToday: boolean
  disciplineLevel: string
  alerts: DailyStatus['alerts']
  strengths: string[]
}

export type { DailyStatusExtras as XodusExtras }

export function generateXodusOutput(log: DailyLog | null, extras?: DailyStatusExtras): XodusOutput {
  const status = generateDailyStatus(log, extras ?? {})
  const paragraphs = buildParagraphs(status, log, extras)

  return {
    paragraphs,
    executionScore: status.executionScore,
    urgency: status.urgencyLevel as UrgencyLevel,
    focusRecommendation: status.focuses.slice(0, 3).join(' → '),
    recoveryState: status.recoveryLevel,
    loggedToday: status.loggedToday,
    disciplineLevel: status.disciplineLevel,
    alerts: status.alerts,
    strengths: status.strengths,
  }
}

function buildParagraphs(
  status: DailyStatus,
  log: DailyLog | null,
  extras?: DailyStatusExtras
): string[] {
  const pTarget = log?.proteinTarget ?? 180
  const cTarget = log?.calorieTarget ?? 2500
  const screenTarget = 2
  const protein = log?.protein ?? null
  const calories = log?.calories ?? null
  const screenTime = log?.screenTime ?? null
  const instagram = log?.instagramTime ?? null
  const smoked = log?.smokedToday ?? false
  const drank = log?.drankToday ?? false
  const confidence = log?.confidenceScore ?? null
  const mood = log?.mood ?? null
  const sleepHours = log?.sleepHours ?? null
  const recScore = extras?.recoveryScoreOverride ?? log?.recoveryScore ?? null
  const recHrv = log?.hrv ?? null
  const recRestingHR = log?.restingHR ?? null
  const noDrinkStreak = extras?.noDrinkStreakOverride ?? getAlcoholStreak()

  const voiceLogsToday = extras?.voiceLogsToday ?? 0
  const stackTaken = extras?.stackTaken ?? 0
  const stackTotal = extras?.stackTotal ?? 0
  const overdueProjects = extras?.overdueProjects ?? 0
  const weeklyWorkouts = extras?.weeklyWorkouts ?? 0
  const stepsToday = log?.steps ?? null

  const paras: string[] = []

  // Recovery paragraph
  const sleepNote = sleepHours !== null
    ? ` Sleep at ${sleepHours}h — ${sleepHours >= 7.5 ? 'solid.' : sleepHours >= 6 ? 'short of optimal.' : 'recovery is compromised.'}`
    : ''
  if (recScore !== null) {
    const hrvNote = recHrv !== null ? `, HRV ${recHrv}ms` : ''
    const hrNote = recRestingHR !== null ? `, resting HR ${recRestingHR}bpm` : ''
    paras.push(
      `Recovery at ${recScore}${hrvNote}${hrNote}. System is ${status.recoveryLevel.toLowerCase()}.${sleepNote}` +
      (recScore >= 70 ? ' Body absorbed the load. Ready to push.' : recScore >= 50 ? ' Moderate recovery — manage intensity.' : ' Low recovery — back off and restore.')
    )
  } else {
    const sleepBase = sleepHours !== null
      ? `Sleep at ${sleepHours}h — ${sleepHours >= 7.5 ? 'good base for the day.' : sleepHours >= 6 ? 'manageable.' : 'recovery is compromised.'}`
      : 'No recovery data logged yet.'
    paras.push(`${sleepBase} Log your recovery score for a full picture.`)
  }

  // Nutrition paragraph
  if (protein !== null && calories !== null) {
    const gap = pTarget - protein
    const calDiff = calories - cTarget
    const calNote = calDiff > 0 ? `${calDiff} cal over` : `${Math.abs(calDiff)} cal remaining`
    paras.push(
      gap > 10
        ? `Protein at ${protein}g — ${gap}g short of your ${pTarget}g target. One meal closes it. Calories: ${calNote}.`
        : gap > 0
        ? `Protein at ${protein}g — almost there. ${gap}g to close. Calories: ${calNote}.`
        : `Protein locked at ${protein}g — target hit. Calories: ${calNote}.`
    )
  } else if (log) {
    const missing = [protein === null && 'protein', calories === null && 'calories'].filter(Boolean).join(' and ')
    paras.push(`${missing.charAt(0).toUpperCase() + missing.slice(1)} not logged. Target is ${pTarget}g protein / ${cTarget.toLocaleString()} cal.`)
  } else {
    paras.push(`Nutrition not logged. Target is ${pTarget}g protein and ${cTarget.toLocaleString()} cal. Log it.`)
  }

  // Screen time + discipline paragraph
  if (screenTime !== null) {
    const over = screenTime - screenTarget
    const igPart = instagram !== null ? ` Instagram: ${instagram}h of that.` : ''
    paras.push(
      over > 0
        ? `Screen time at ${screenTime}h — ${over.toFixed(1)}h over your ${screenTarget}h cap.${igPart} That bandwidth belongs to your work.`
        : `Screen time at ${screenTime}h — under your ${screenTarget}h cap.${igPart} Protect that window.`
    )
  }

  // Habits + streaks paragraph
  const habitLines: string[] = []
  if (drank) habitLines.push('You drank today. Streak resets tomorrow.')
  else if (noDrinkStreak > 0) habitLines.push(`${noDrinkStreak} days no alcohol — compounding silently.`)
  if (smoked) habitLines.push('Smoking noted.')
  if (stackTotal > 0) {
    habitLines.push(
      stackTaken >= stackTotal
        ? `Stack complete — ${stackTaken}/${stackTotal}.`
        : `Stack ${stackTaken}/${stackTotal} — ${stackTotal - stackTaken} remaining.`
    )
  }
  if (habitLines.length > 0) paras.push(habitLines.join(' '))

  // Mental/confidence paragraph
  if (mood !== null || confidence !== null) {
    const moodStr = mood !== null ? `Mood ${mood}/5` : ''
    const confStr = confidence !== null
      ? `confidence ${confidence}/10 — ${confidence >= 8 ? 'locked in' : confidence >= 6 ? 'steady' : 'off — move anyway'}`
      : ''
    paras.push([moodStr, confStr].filter(Boolean).join(', ') + '.')
  }

  // Activity / steps coaching paragraph
  const todayActivityLabel = extras?.todayActivityLabel
  const todayActivityType = extras?.todayActivityType

  const activityLines: string[] = []

  if (todayActivityLabel) {
    const isStrength = todayActivityType === 'strength'
    activityLines.push(
      isStrength
        ? `Training logged — ${todayActivityLabel}.`
        : `Activity logged — ${todayActivityLabel}.`
    )
  }

  if (stepsToday !== null) {
    if (stepsToday >= 10000) {
      activityLines.push(`${stepsToday.toLocaleString()} steps — solid activity today`)
    } else if (stepsToday >= 7500) {
      activityLines.push(`${stepsToday.toLocaleString()} steps — good movement`)
    } else if (stepsToday < 4000) {
      activityLines.push(`Steps at ${stepsToday.toLocaleString()} — low. Get moving after this`)
    }
  }

  if (weeklyWorkouts >= 4) {
    activityLines.push(`${weeklyWorkouts} sessions this week — consistency is there`)
  } else if (weeklyWorkouts > 0 && !todayActivityLabel) {
    activityLines.push(`${weeklyWorkouts} session${weeklyWorkouts > 1 ? 's' : ''} this week`)
  }

  // Context-aware coaching: high activity + low recovery
  if (stepsToday !== null && stepsToday >= 8000 && recScore !== null && recScore < 60) {
    paras.push(`You hit ${stepsToday.toLocaleString()} steps, so activity isn't the problem — recovery is. Keep the lift controlled, hit protein, and don't let today become an ego session.`)
  } else if (activityLines.length > 0) {
    paras.push(activityLines.join(' ') + (activityLines[activityLines.length - 1].endsWith('.') ? '' : '.'))
  }

  // Projects / uploads / voice logs
  const logLines: string[] = []
  if (voiceLogsToday > 0) logLines.push(`${voiceLogsToday} voice log${voiceLogsToday > 1 ? 's' : ''} captured`)
  if ((extras?.uploadsToday ?? 0) > 0) logLines.push(`${extras!.uploadsToday} file${extras!.uploadsToday! > 1 ? 's' : ''} uploaded`)
  if (overdueProjects > 0) logLines.push(`${overdueProjects} project${overdueProjects > 1 ? 's' : ''} past target date`)
  if (logLines.length > 0) paras.push(logLines.join('. ') + '.')

  // Closing / execution directive
  paras.push(
    status.executionScore >= 75
      ? 'You\'re executing at a high level. Stay sharp — don\'t break what\'s working.'
      : status.executionScore >= 55
      ? 'The gap between where you are and where you\'ll be is closing. One decision at a time.'
      : log
      ? 'Numbers are clear. The fix is simple. Choose one thing and execute now.'
      : 'Log your metrics. XODUS cannot coach from incomplete data. 60 seconds.'
  )

  return paras
}

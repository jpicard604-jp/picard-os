import type { DailyLog } from '../storage'
import {
  getStorage,
  STORAGE_KEYS,
  getTodayLog,
  getVoiceLogsToday,
  getUploadsToday,
  getAlcoholStreak,
} from '../storage'
import { getNutritionProfile, CONFIRMED_NUTRITION_PROFILE } from '../nutrition-profile'
import type { NutritionProfile } from '../nutrition-profile'
import type { ActivityLog } from '../fitness'
import { getThisWeekLogs, getActivityLogs } from '../fitness'
import type { Project } from '../projects'
import { getProjects, daysUntil, getOverdueCount } from '../projects'
import type { StackItem, UploadedFile } from '../mock-data'
import { JACKSON } from '../mock-data'
import { generateDailyStatus } from '../daily-status'
import type { DailyStatusExtras } from '../daily-status'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightLevel = 'critical' | 'warning' | 'info' | 'positive'
export type InsightDomain =
  | 'recovery' | 'nutrition' | 'fitness' | 'projects'
  | 'stack' | 'mental' | 'habits' | 'logging'

export interface BrainInsight {
  id: string
  domain: InsightDomain
  level: InsightLevel
  headline: string    // specific, ≤70 chars, no filler verbs
  detail: string      // 1 sentence with real numbers
  action?: string     // what to do next (imperative)
  href: string
}

export interface RecoveryBrief {
  state: 'ADAPTED' | 'RECOVERING' | 'STRAINED' | 'UNKNOWN'
  score: number | null
  hrv: number | null
  restingHR: number | null
  sleepHours: number | null
  recommendation: string
}

export interface NutritionBrief {
  proteinConsumed: number | null
  proteinTarget: number
  proteinGap: number | null
  caloriesConsumed: number | null
  calorieTarget: number
  calorieDelta: number | null
  calorieStatus: 'under' | 'on_track' | 'over' | 'unknown'
  recommendation: string
}

export interface FitnessBrief {
  weeklySessionCount: number
  weeklyTarget: number
  hasActivityToday: boolean
  todayActivityLabel: string | null
  todayActivityType: string | null
  recommendation: string
}

export interface ProjectBrief {
  activeCount: number
  overdueCount: number
  overdueNames: string[]
  stalledProjects: string[]
  nextMilestone: { project: string; task: string } | null
  recommendation: string
}

export interface StackBrief {
  takenCount: number
  totalCount: number
  completionPct: number
  missingItems: string[]
  recommendation: string
}

export interface StreakBrief {
  alcoholDays: number
  smokeFreeToday: boolean
}

export interface XodusBrainOutput {
  executionScore: number
  urgency: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  loggedToday: boolean

  brief: string[]                          // 2-4 focused sentences
  nextAction: { text: string; href: string }

  insights: BrainInsight[]                 // sorted critical → warning → info → positive

  recovery: RecoveryBrief
  nutrition: NutritionBrief
  fitness: FitnessBrief
  projects: ProjectBrief
  stack: StackBrief
  streaks: StreakBrief

  missingData: string[]
  positives: string[]
}

export interface XodusBrainInput {
  dailyLog: DailyLog | null
  weekLogs: ActivityLog[]
  todayLogs: ActivityLog[]
  stackItems: StackItem[]
  projects: Project[]
  voiceLogsToday: number
  uploadsToday: number
  alcoholStreak: number
  nutritionProfile: NutritionProfile
}

// ─── Data gathering (client-only) ─────────────────────────────────────────────

export function gatherBrainInput(): XodusBrainInput {
  if (typeof window === 'undefined') {
    return {
      dailyLog: null, weekLogs: [], todayLogs: [],
      stackItems: [], projects: [], voiceLogsToday: 0,
      uploadsToday: 0, alcoholStreak: 0,
      nutritionProfile: CONFIRMED_NUTRITION_PROFILE,
    }
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const allLogs = getActivityLogs()
  return {
    dailyLog: getTodayLog(),
    weekLogs: getThisWeekLogs(),
    todayLogs: allLogs.filter((l) => l.date === todayStr),
    stackItems: getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack),
    projects: getProjects(),
    voiceLogsToday: getVoiceLogsToday().length,
    uploadsToday: getUploadsToday<UploadedFile>().length,
    alcoholStreak: getAlcoholStreak(),
    nutritionProfile: getNutritionProfile(),
  }
}

// ─── Brain engine (pure function) ─────────────────────────────────────────────

export function runXodusBrain(input: XodusBrainInput): XodusBrainOutput {
  const {
    dailyLog: log, weekLogs, todayLogs, stackItems,
    projects, voiceLogsToday, uploadsToday, alcoholStreak, nutritionProfile,
  } = input

  const todayStr = new Date().toISOString().slice(0, 10)
  const insights: BrainInsight[] = []
  const missingData: string[] = []
  const positives: string[] = []

  // ── Shared derived values ─────────────────────────────────────────────
  const loggedToday = log !== null
  const pTarget = log?.proteinTarget ?? nutritionProfile.proteinTarget ?? 210
  const cTarget = log?.calorieTarget ?? nutritionProfile.calorieTarget ?? 2200
  const screenTarget = 2

  const stackTaken = stackItems.filter((i) => i.takenToday).length
  const stackTotal = stackItems.length
  const overdueProjects = getOverdueCount(projects)
  const activeMinutesToday = todayLogs.reduce((s, l) => s + (l.duration ?? 0), 0)
  const todayActivity = todayLogs[0] ?? null

  // ── Reuse existing scoring engine for executionScore ──────────────────
  const extras: DailyStatusExtras = {
    voiceLogsToday,
    uploadsToday,
    stackTaken,
    stackTotal,
    overdueProjects,
    weeklyWorkouts: weekLogs.length,
    activityMinutesToday: activeMinutesToday,
    todayActivityLabel: todayActivity?.label ?? todayActivity?.type,
    todayActivityType: todayActivity?.type,
    proteinTargetOverride: nutritionProfile.proteinTarget,
    calorieTargetOverride: nutritionProfile.calorieTarget,
  }
  const status = generateDailyStatus(log, extras)
  const executionScore = status.executionScore
  const urgency = status.urgencyLevel

  // ── Recovery domain ───────────────────────────────────────────────────
  const recScore = log?.recoveryScore ?? null
  const hrv = log?.hrv ?? null
  const restingHR = log?.restingHR ?? null
  const sleepHours = log?.sleepHours ?? null
  const strain = log?.strain ?? null
  void strain // used by callers via recovery object

  let recoveryState: RecoveryBrief['state'] = 'UNKNOWN'
  if (recScore !== null) {
    recoveryState = recScore >= 70 ? 'ADAPTED' : recScore >= 50 ? 'RECOVERING' : 'STRAINED'
  }

  const hasWorkoutToday = todayLogs.length > 0
  const workoutLabel = todayActivity?.label ?? todayActivity?.type ?? null

  let recoveryRec: string
  if (recoveryState === 'ADAPTED') {
    if (hasWorkoutToday) {
      recoveryRec = `Recovery ${recScore}${hrv ? `, HRV ${hrv}ms` : ''} — training logged${workoutLabel ? ` (${workoutLabel})` : ''}. Load absorbed.`
    } else {
      recoveryRec = `Recovery ${recScore}${hrv ? `, HRV ${hrv}ms` : ''} — green light. Body adapted and ready to train.`
    }
    positives.push(`Recovery ${recScore} — system adapted`)
  } else if (recoveryState === 'RECOVERING') {
    recoveryRec = `Recovery ${recScore}${hrv ? `, HRV ${hrv}ms` : ''} — partial. Keep intensity moderate today.`
    insights.push({
      id: 'recovery-moderate',
      domain: 'recovery',
      level: 'info',
      headline: `Recovery ${recScore} — moderate, manage load`,
      detail: `HRV ${hrv ?? '—'}ms, resting HR ${restingHR ?? '—'}bpm. Submaximal work only.`,
      href: '/daily',
    })
  } else if (recoveryState === 'STRAINED') {
    recoveryRec = `Recovery ${recScore}${hrv ? `, HRV ${hrv}ms` : ''} — strained. Rest day: no high-intensity work.`
    insights.push({
      id: 'recovery-strained',
      domain: 'recovery',
      level: 'warning',
      headline: `Recovery ${recScore} — strained, rest today`,
      detail: `HRV ${hrv ?? '—'}ms. Skip high-intensity. Prioritize sleep and hydration tonight.`,
      action: 'Protect tonight\'s sleep window',
      href: '/daily',
    })
  } else {
    // UNKNOWN — no recovery score
    if (sleepHours !== null) {
      const sleepLabel = sleepHours >= 7.5 ? 'adequate' : sleepHours >= 6 ? 'slightly short' : 'compromised'
      recoveryRec = `No recovery score logged. Sleep at ${sleepHours}h — ${sleepLabel}.`
    } else {
      recoveryRec = 'No recovery data. Enter WHOOP or Apple Health values in Daily Log → Recovery.'
    }
    if (loggedToday) {
      missingData.push('recovery score')
    }
  }

  const recoveryBrief: RecoveryBrief = {
    state: recoveryState, score: recScore, hrv, restingHR, sleepHours,
    recommendation: recoveryRec,
  }

  // ── Nutrition domain ──────────────────────────────────────────────────
  const proteinConsumed = log?.protein ?? null
  const caloriesConsumed = log?.calories ?? null
  const proteinGap = proteinConsumed !== null ? Math.max(0, pTarget - proteinConsumed) : null
  const calorieDelta = caloriesConsumed !== null ? caloriesConsumed - cTarget : null

  let calorieStatus: NutritionBrief['calorieStatus'] = 'unknown'
  if (calorieDelta !== null) {
    if (calorieDelta > 300) calorieStatus = 'over'
    else if (calorieDelta < -400) calorieStatus = 'under'
    else calorieStatus = 'on_track'
  }

  let nutritionRec: string
  if (proteinConsumed !== null && caloriesConsumed !== null) {
    const gapNote = proteinGap! > 0
      ? `${proteinConsumed}g protein — ${proteinGap}g short of ${pTarget}g.`
      : `Protein at ${proteinConsumed}g — target hit.`
    const calNote = calorieDelta! > 300
      ? ` Calories ${caloriesConsumed.toLocaleString()} — ${calorieDelta} over target.`
      : calorieDelta! < -400
      ? ` Calories ${caloriesConsumed.toLocaleString()} — ${Math.abs(calorieDelta!)} under. Undereating impairs recovery.`
      : ` Calories ${caloriesConsumed.toLocaleString()} — on track.`
    nutritionRec = gapNote + calNote
  } else if (proteinConsumed !== null) {
    nutritionRec = `Protein at ${proteinConsumed}g${proteinGap! > 0 ? ` — ${proteinGap}g to ${pTarget}g target` : ' — target hit'}. Log calories.`
  } else if (caloriesConsumed !== null) {
    nutritionRec = `Calories at ${caloriesConsumed.toLocaleString()}. Log protein — target is ${pTarget}g.`
  } else if (!loggedToday) {
    nutritionRec = `Nutrition not logged. Target: ${pTarget}g protein, ${cTarget.toLocaleString()} cal.`
  } else {
    nutritionRec = `Protein and calories not entered. Target: ${pTarget}g / ${cTarget.toLocaleString()} cal.`
    missingData.push('protein', 'calories')
  }

  if (proteinGap !== null && proteinGap > 30) {
    insights.push({
      id: 'nutrition-protein-gap',
      domain: 'nutrition',
      level: proteinGap > 60 ? 'warning' : 'info',
      headline: `${proteinGap}g protein behind ${pTarget}g target`,
      detail: `At ${proteinConsumed}g. One meal with 30–50g closes it.`,
      action: 'Log nutrition after next meal',
      href: '/daily',
    })
  } else if (proteinConsumed !== null && proteinGap! <= 0) {
    positives.push(`Protein target hit — ${proteinConsumed}g`)
  }

  if (calorieStatus === 'over') {
    insights.push({
      id: 'nutrition-over',
      domain: 'nutrition',
      level: 'info',
      headline: `Calories ${calorieDelta} over ${cTarget.toLocaleString()} target`,
      detail: `At ${caloriesConsumed!.toLocaleString()} kcal. Stay conservative at the next meal.`,
      href: '/daily',
    })
  } else if (calorieStatus === 'under') {
    insights.push({
      id: 'nutrition-under',
      domain: 'nutrition',
      level: 'warning',
      headline: `Calories ${Math.abs(calorieDelta!)} under target — eat`,
      detail: `At ${caloriesConsumed!.toLocaleString()} of ${cTarget.toLocaleString()} cal. Undereating impairs recovery and training.`,
      action: 'Eat a meal',
      href: '/daily',
    })
  } else if (calorieStatus === 'on_track' && proteinGap !== null && proteinGap <= 0) {
    positives.push(`Nutrition on track — ${caloriesConsumed!.toLocaleString()} cal`)
  }

  const nutritionBrief: NutritionBrief = {
    proteinConsumed, proteinTarget: pTarget, proteinGap,
    caloriesConsumed, calorieTarget: cTarget, calorieDelta,
    calorieStatus, recommendation: nutritionRec,
  }

  // ── Fitness domain ────────────────────────────────────────────────────
  const weeklySessionCount = weekLogs.length
  const weeklyTarget = 5 // matches Personal Training project target
  const lastActivityLog = weekLogs.length > 0 ? weekLogs[weekLogs.length - 1] : null
  const lastActivityLabel = lastActivityLog
    ? (lastActivityLog.label ?? lastActivityLog.type)
    : null

  let fitnessRec: string
  if (hasWorkoutToday && todayActivity) {
    const rpeNote = todayActivity.rpe ? ` at RPE ${todayActivity.rpe}` : ''
    const durationNote = todayActivity.duration ? ` (${todayActivity.duration}min)` : ''
    fitnessRec = `${todayActivity.label ?? todayActivity.type} logged${durationNote}${rpeNote}. ${weeklySessionCount}/${weeklyTarget} sessions this week.`
    positives.push(`${todayActivity.label ?? todayActivity.type} logged today`)
  } else if (recoveryState === 'ADAPTED') {
    fitnessRec = `Recovery green — no session logged yet. ${weeklySessionCount}/${weeklyTarget} sessions this week. Strong day to train.`
    if (!hasWorkoutToday) {
      insights.push({
        id: 'fitness-push-day',
        domain: 'fitness',
        level: 'info',
        headline: `Recovery green — good day to train hard`,
        detail: `${weeklySessionCount} of ${weeklyTarget} sessions this week. No activity logged yet.`,
        action: 'Log a session',
        href: '/fitness',
      })
    }
  } else if (recoveryState === 'STRAINED') {
    fitnessRec = `Recovery strained — rest day. ${weeklySessionCount} sessions this week.`
  } else if (weeklySessionCount === 0) {
    fitnessRec = `No sessions logged this week. Target is ${weeklyTarget}.`
    insights.push({
      id: 'fitness-no-sessions',
      domain: 'fitness',
      level: 'warning',
      headline: 'No training logged this week',
      detail: `Weekly target is ${weeklyTarget} sessions. One session starts the week.`,
      action: 'Log a session',
      href: '/fitness',
    })
  } else {
    fitnessRec = `${weeklySessionCount}/${weeklyTarget} sessions this week.${lastActivityLabel ? ` Last: ${lastActivityLabel}.` : ''}`
  }

  if (weeklySessionCount >= weeklyTarget) {
    positives.push(`${weeklySessionCount} sessions this week — target reached`)
  }

  const fitnessBrief: FitnessBrief = {
    weeklySessionCount, weeklyTarget, hasActivityToday: hasWorkoutToday,
    todayActivityLabel: workoutLabel,
    todayActivityType: todayActivity?.type ?? null,
    recommendation: fitnessRec,
  }

  // ── Projects domain ───────────────────────────────────────────────────
  const activeProjects = projects.filter((p) => p.status === 'active')
  const overdueList = projects.filter(
    (p) => p.status === 'active' && p.targetDate && p.targetDate < todayStr
  )
  const overdueNames = overdueList.map((p) => p.title)

  const stalledList = activeProjects.filter((p) => {
    if (p.priority > 2) return false
    const daysSince = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    return daysSince >= 3
  })
  const stalledNames = stalledList.map((p) => p.title)

  const sortedActive = [...activeProjects].sort((a, b) => a.priority - b.priority)
  let nextMilestone: ProjectBrief['nextMilestone'] = null
  for (const p of sortedActive) {
    const next = p.tasks.find((t) => !t.done)
    if (next) { nextMilestone = { project: p.title, task: next.text }; break }
  }

  let projectsRec: string
  if (overdueList.length > 0) {
    const names = overdueNames.slice(0, 2).join(', ')
    const extra = overdueNames.length > 2 ? ` +${overdueNames.length - 2} more` : ''
    projectsRec = `${overdueList.length} project${overdueList.length > 1 ? 's' : ''} past target: ${names}${extra}.`
    overdueList.forEach((p) => {
      const daysLate = Math.abs(daysUntil(p.targetDate!))
      const openTasks = p.tasks.filter((t) => !t.done).length
      const daysSinceUpdate = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      insights.push({
        id: `project-overdue-${p.id}`,
        domain: 'projects',
        level: 'warning',
        headline: `${p.title} — ${daysLate}d past target date`,
        detail: `${openTasks} open task${openTasks !== 1 ? 's' : ''}. Last updated ${daysSinceUpdate}d ago.`,
        action: 'Open project and log a update',
        href: '/projects',
      })
    })
  } else if (stalledList.length > 0) {
    const p = stalledList[0]
    const daysSince = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
    projectsRec = `${p.title} (P${p.priority}) hasn't been updated in ${daysSince}d.`
    stalledList.forEach((proj) => {
      const days = Math.floor((Date.now() - new Date(proj.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      const open = proj.tasks.filter((t) => !t.done).length
      insights.push({
        id: `project-stalled-${proj.id}`,
        domain: 'projects',
        level: 'info',
        headline: `${proj.title} — no update in ${days}d`,
        detail: `Priority ${proj.priority}. ${open} open task${open !== 1 ? 's' : ''}. Use XODUS to log progress.`,
        action: 'Log a project update via XODUS',
        href: '/xodus',
      })
    })
  } else if (nextMilestone) {
    projectsRec = `${activeProjects.length} active projects on track. Next: "${nextMilestone.task}" (${nextMilestone.project}).`
  } else {
    projectsRec = `${activeProjects.length} active projects, all tasks complete.`
  }

  const projectsBrief: ProjectBrief = {
    activeCount: activeProjects.length,
    overdueCount: overdueList.length,
    overdueNames,
    stalledProjects: stalledNames,
    nextMilestone,
    recommendation: projectsRec,
  }

  // ── Stack domain ──────────────────────────────────────────────────────
  const stackCompletionPct = stackTotal > 0 ? Math.round((stackTaken / stackTotal) * 100) : 0
  const missingStackItems = stackItems.filter((i) => !i.takenToday).map((i) => i.name)

  let stackRec: string
  if (stackTotal === 0) {
    stackRec = 'No stack configured.'
  } else if (stackTaken === stackTotal) {
    stackRec = `Stack complete — all ${stackTotal} compounds taken.`
    positives.push(`Stack 100% — all ${stackTotal} compounds`)
  } else if (stackTaken === 0) {
    const preview = missingStackItems.slice(0, 3).join(', ')
    const more = missingStackItems.length > 3 ? ` +${missingStackItems.length - 3}` : ''
    stackRec = `Stack not started — ${stackTotal} compounds pending: ${preview}${more}.`
    insights.push({
      id: 'stack-not-started',
      domain: 'stack',
      level: 'info',
      headline: `Stack 0/${stackTotal} — none taken yet`,
      detail: preview + more + '.',
      action: 'Open Stack',
      href: '/stack',
    })
  } else {
    const remaining = stackTotal - stackTaken
    const preview = missingStackItems.slice(0, 3).join(', ')
    const more = missingStackItems.length > 3 ? ` +${missingStackItems.length - 3}` : ''
    stackRec = `Stack ${stackTaken}/${stackTotal} — ${remaining} remaining: ${preview}${more}.`
    insights.push({
      id: 'stack-partial',
      domain: 'stack',
      level: 'info',
      headline: `Stack ${stackTaken}/${stackTotal} — ${remaining} left`,
      detail: preview + (more || '') + '.',
      action: 'Complete stack',
      href: '/stack',
    })
  }

  const stackBrief: StackBrief = {
    takenCount: stackTaken, totalCount: stackTotal,
    completionPct: stackCompletionPct, missingItems: missingStackItems,
    recommendation: stackRec,
  }

  // ── Habits & streaks ──────────────────────────────────────────────────
  const smokedToday = log?.smokedToday ?? false
  const drankToday = log?.drankToday ?? false
  const screenTime = log?.screenTime ?? null
  const instagramTime = log?.instagramTime ?? null

  if (drankToday) {
    insights.push({
      id: 'habits-drank',
      domain: 'habits',
      level: 'warning',
      headline: 'Alcohol today — streak resets tomorrow',
      detail: alcoholStreak > 0
        ? `Had a ${alcoholStreak}-day run. Streak resets from tomorrow.`
        : 'Alcohol logged today.',
      href: '/daily',
    })
  } else if (alcoholStreak >= 14) {
    positives.push(`${alcoholStreak}-day alcohol-free streak`)
  } else if (alcoholStreak >= 7) {
    positives.push(`${alcoholStreak}-day alcohol-free — building`)
  }

  if (smokedToday) {
    insights.push({
      id: 'habits-smoked',
      domain: 'habits',
      level: 'warning',
      headline: 'Smoking noted today',
      detail: 'Logged as smoked. This affects recovery and discipline score.',
      href: '/daily',
    })
  }

  if (screenTime !== null && screenTime > screenTarget) {
    const over = (screenTime - screenTarget).toFixed(1)
    insights.push({
      id: 'habits-screen',
      domain: 'habits',
      level: 'info',
      headline: `Screen time ${screenTime}h — ${over}h over ${screenTarget}h limit`,
      detail: instagramTime ? `Instagram ${instagramTime}h of that total.` : `Target is ${screenTarget}h.`,
      href: '/daily',
    })
  } else if (screenTime !== null && screenTime <= screenTarget) {
    positives.push(`Screen time ${screenTime}h — under ${screenTarget}h limit`)
  }

  // ── Mental domain ─────────────────────────────────────────────────────
  const confidence = log?.confidenceScore ?? null
  const mood = log?.mood ?? null

  if (confidence !== null && confidence <= 4) {
    insights.push({
      id: 'mental-low-confidence',
      domain: 'mental',
      level: 'info',
      headline: `Confidence at ${confidence}/10 — identify the drag`,
      detail: "Name what's pulling it down, then move anyway. Waiting for confidence doesn't work.",
      href: '/daily',
    })
  } else if (confidence !== null && confidence >= 8) {
    positives.push(`Confidence ${confidence}/10 — locked in`)
  }

  if (mood !== null && mood <= 2) {
    insights.push({
      id: 'mental-low-mood',
      domain: 'mental',
      level: 'info',
      headline: `Mood ${mood}/5 — low energy day`,
      detail: 'Focus on high-ROI tasks only. Protect recovery tonight.',
      href: '/daily',
    })
  }

  // ── Logging completeness ──────────────────────────────────────────────
  if (!loggedToday) {
    missingData.push('daily log (60 seconds)')
    insights.push({
      id: 'logging-no-log',
      domain: 'logging',
      level: 'critical',
      headline: 'No daily log — XODUS operating blind',
      detail: 'All metrics are estimated. Log takes 60 seconds to unlock full coaching.',
      action: 'Log today',
      href: '/daily',
    })
  } else {
    if (log?.protein === null) missingData.push('protein')
    if (log?.calories === null) missingData.push('calories')
    if (log?.sleepHours === null) missingData.push('sleep')
    if (log?.recoveryScore === null) missingData.push('recovery score')
    if (log?.screenTime === null) missingData.push('screen time')
  }

  // ── Brief (2-4 targeted sentences) ───────────────────────────────────
  const brief: string[] = []

  if (recoveryState !== 'UNKNOWN') {
    brief.push(recoveryRec)
  } else if (sleepHours !== null) {
    brief.push(`Sleep at ${sleepHours}h — no recovery score. Enter WHOOP data for full coaching.`)
  } else {
    brief.push('No recovery data logged today. Daily Log → Recovery section takes 30 seconds.')
  }

  if (proteinConsumed !== null || caloriesConsumed !== null) {
    brief.push(nutritionRec)
  } else if (!loggedToday) {
    brief.push(`Log nutrition: target ${pTarget}g protein, ${cTarget.toLocaleString()} cal.`)
  }

  if (overdueList.length > 0) {
    brief.push(projectsRec)
  } else if (alcoholStreak >= 14) {
    brief.push(`${alcoholStreak} days alcohol-free — compounding.`)
  } else if (nextMilestone && !overdueList.length) {
    brief.push(`Projects on track. Next: "${nextMilestone.task}" (${nextMilestone.project}).`)
  }

  if (recoveryState !== 'UNKNOWN' && !hasWorkoutToday && weeklySessionCount < weeklyTarget) {
    brief.push(fitnessRec)
  }

  // ── Next action ───────────────────────────────────────────────────────
  let nextAction: { text: string; href: string }

  if (!loggedToday) {
    nextAction = { text: "Log today's metrics — 60 seconds", href: '/daily' }
  } else if (overdueList.length > 0 && overdueList[0].priority <= 2) {
    const daysLate = Math.abs(daysUntil(overdueList[0].targetDate!))
    nextAction = {
      text: `Address ${overdueList[0].title} — ${daysLate}d past target`,
      href: '/projects',
    }
  } else if (proteinGap !== null && proteinGap > 50) {
    nextAction = { text: `Close protein gap — ${proteinGap}g to ${pTarget}g`, href: '/daily' }
  } else if (recoveryState === 'ADAPTED' && !hasWorkoutToday) {
    nextAction = { text: 'Recovery is green — train today', href: '/fitness' }
  } else if (calorieStatus === 'under') {
    nextAction = { text: `Eat — ${Math.abs(calorieDelta!)} cal under target`, href: '/daily' }
  } else if (stackTaken < stackTotal * 0.5 && stackTotal > 0) {
    nextAction = { text: `Complete stack — ${stackTotal - stackTaken} compounds pending`, href: '/stack' }
  } else if (recScore === null && loggedToday) {
    nextAction = { text: 'Log recovery score in Daily Log', href: '/daily' }
  } else if (nextMilestone) {
    nextAction = { text: `${nextMilestone.task} — ${nextMilestone.project}`, href: '/projects' }
  } else {
    nextAction = { text: 'Execution is solid. Maintain.', href: '/xodus' }
  }

  // ── Sort: critical → warning → info → positive ────────────────────────
  const levelOrder: Record<InsightLevel, number> = { critical: 0, warning: 1, info: 2, positive: 3 }
  insights.sort((a, b) => levelOrder[a.level] - levelOrder[b.level])

  return {
    executionScore, urgency, loggedToday,
    brief, nextAction, insights,
    recovery: recoveryBrief,
    nutrition: nutritionBrief,
    fitness: fitnessBrief,
    projects: projectsBrief,
    stack: stackBrief,
    streaks: { alcoholDays: alcoholStreak, smokeFreeToday: !smokedToday },
    missingData,
    positives,
  }
}

import { getStorage, STORAGE_KEYS, getTodayKey, getTodayDateLabel } from '../storage'
import type { DailyLog, VoiceLog } from '../storage'
import type { ActivityLog } from '../fitness'
import { getActivityLogs, getThisWeekLogs } from '../fitness'
import type { Project, Task } from '../projects'
import { getProjects } from '../projects'
import type { StackItem, UploadedFile } from '../mock-data'
import { JACKSON } from '../mock-data'
import { gatherBrainInput, runXodusBrain } from './brain'
import type { XodusBrainOutput } from './brain'
import { getAlcoholStreak, getTodayLog } from '../storage'

// ─── Raw data snapshots ────────────────────────────────────────────────────────

export interface RawHealthData {
  today: DailyLog | null
  last7Days: Record<string, DailyLog>
}

export interface RawFitnessData {
  thisWeekLogs: ActivityLog[]
  allLogs: ActivityLog[]
}

export interface RawProjectData {
  projects: Project[]
}

export interface RawStackData {
  items: StackItem[]
}

export interface RawVoiceData {
  recentLogs: VoiceLog[]      // last 10 voice logs
  todayLogs: VoiceLog[]
  totalCount: number
}

export interface RawUploadData {
  recent: UploadedFile[]      // last 10 uploads
  todayCount: number
  totalCount: number
}

// ─── Summarized / AI-ready data ───────────────────────────────────────────────

export interface HealthSummary {
  date: string
  loggedToday: boolean
  // Recovery
  recoveryScore: number | null
  recoveryState: 'ADAPTED' | 'RECOVERING' | 'STRAINED' | 'UNKNOWN'
  hrv: number | null
  restingHR: number | null
  strain: number | null
  // Sleep
  sleepHours: number | null
  sleepQuality: number | null
  // Body
  weight: number | null
  steps: number | null
  // Nutrition
  calories: number | null
  calorieTarget: number
  calorieDelta: number | null          // positive = over, negative = deficit
  protein: number | null
  proteinTarget: number
  proteinGap: number | null            // negative = hit target
  water: number | null
  // Habits
  alcoholStreak: number
  smokedToday: boolean
  // Mental
  mood: number | null                  // 1-5
  confidenceScore: number | null       // 1-10
  // Screen
  screenTime: number | null
  // Weekly trends
  avgRecovery7d: number | null
  avgSleep7d: number | null
}

export interface FitnessSummary {
  weeklySessionCount: number
  weeklyTarget: number
  weeklySessionNames: string[]
  hasActivityToday: boolean
  todayActivityLabel: string | null
  todayActivityType: string | null
  todayDuration: number | null         // minutes
}

export interface ProjectSummary {
  total: number
  active: number
  paused: number
  complete: number
  overdueCount: number
  overdueNames: string[]
  stalledNames: string[]               // active P1/P2, no update ≥3 days
  priorityProjects: ProjectContext[]   // top 3 active by priority
}

export interface ProjectContext {
  id: string
  title: string
  priority: number
  progress: number
  targetDate: string | undefined
  urgency: string
  openTasks: TaskContext[]
  isOverdue: boolean
  daysSinceUpdate: number | null
}

export interface TaskContext {
  id: string
  text: string
  done: boolean
}

export interface StackSummary {
  totalItems: number
  takenCount: number
  completionPct: number
  missingItems: string[]
}

export interface VoiceSummary {
  todayCount: number
  recentTranscripts: { timestamp: string; excerpt: string }[]  // last 5, first 120 chars
}

export interface UploadSummary {
  todayCount: number
  totalCount: number
  recentFiles: { name: string; category: string; uploadedAt: string }[]  // last 5
}

// ─── Master context object ─────────────────────────────────────────────────────

export interface XodusAIContext {
  generatedAt: string          // ISO timestamp
  dateLabel: string            // "May 9, 2026"
  todayKey: string             // "2026-05-09"

  // Brain engine output (already computed insights, score, urgency, etc.)
  brain: XodusBrainOutput

  // Summarized data (AI-digestible, no raw blobs)
  health: HealthSummary
  fitness: FitnessSummary
  projects: ProjectSummary
  stack: StackSummary
  voice: VoiceSummary
  uploads: UploadSummary

  // Raw data for deep inspection (kept separate from summarized)
  raw: {
    health: RawHealthData
    fitness: RawFitnessData
    projects: RawProjectData
    stack: RawStackData
    voice: RawVoiceData
    uploads: RawUploadData
  }

  // What's missing — guides AI to ask the right follow-up questions
  missingData: string[]

  // Short prose summary suitable for AI system prompt injection
  systemContextSummary: string
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function getLast7DayLogs(): Record<string, DailyLog> {
  const all = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  const result: Record<string, DailyLog> = {}
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (all[key]) result[key] = all[key]
  }
  return result
}

function avgOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function daysSinceUpdate(project: Project): number | null {
  if (!project.updates || project.updates.length === 0) return null
  const latest = project.updates
    .map((u) => new Date(u.timestamp).getTime())
    .sort((a, b) => b - a)[0]
  return Math.floor((Date.now() - latest) / 86_400_000)
}

function isOverdue(project: Project): boolean {
  if (!project.targetDate) return false
  return new Date(project.targetDate) < new Date() && project.status !== 'complete'
}

// ─── Build summarized health ───────────────────────────────────────────────────

function buildHealthSummary(log: DailyLog | null, last7: Record<string, DailyLog>): HealthSummary {
  const pTarget = log?.proteinTarget ?? 180
  const cTarget = log?.calorieTarget ?? 2500
  const protein = log?.protein ?? null
  const calories = log?.calories ?? null

  const recoveryScore = log?.recoveryScore ?? null
  const recoveryState =
    recoveryScore === null ? 'UNKNOWN'
    : recoveryScore >= 70 ? 'ADAPTED'
    : recoveryScore >= 50 ? 'RECOVERING'
    : 'STRAINED'

  const logs7 = Object.values(last7)
  const avgRecovery7d = avgOrNull(logs7.map((l) => l.recoveryScore ?? null))
  const avgSleep7d = avgOrNull(logs7.map((l) => l.sleepHours ?? null))

  return {
    date: getTodayKey(),
    loggedToday: log !== null,
    recoveryScore,
    recoveryState: recoveryState as HealthSummary['recoveryState'],
    hrv: log?.hrv ?? null,
    restingHR: log?.restingHR ?? null,
    strain: log?.strain ?? null,
    sleepHours: log?.sleepHours ?? null,
    sleepQuality: log?.sleepQuality ?? null,
    weight: log?.weight ?? null,
    steps: log?.steps ?? null,
    calories,
    calorieTarget: cTarget,
    calorieDelta: calories !== null ? calories - cTarget : null,
    protein,
    proteinTarget: pTarget,
    proteinGap: protein !== null ? protein - pTarget : null,
    water: log?.water ?? null,
    alcoholStreak: getAlcoholStreak(),
    smokedToday: log?.smokedToday ?? false,
    mood: log?.mood ?? null,
    confidenceScore: log?.confidenceScore ?? null,
    screenTime: log?.screenTime ?? null,
    avgRecovery7d,
    avgSleep7d,
  }
}

// ─── Build summarized fitness ──────────────────────────────────────────────────

function buildFitnessSummary(weekLogs: ActivityLog[], todayLogs: ActivityLog[]): FitnessSummary {
  const todayActivity = todayLogs[0] ?? null
  return {
    weeklySessionCount: weekLogs.length,
    weeklyTarget: 5,
    weeklySessionNames: weekLogs.map((l) => l.label ?? l.type ?? 'Session'),
    hasActivityToday: todayLogs.length > 0,
    todayActivityLabel: todayActivity?.label ?? null,
    todayActivityType: todayActivity?.type ?? null,
    todayDuration: todayActivity?.duration ?? null,
  }
}

// ─── Build summarized projects ─────────────────────────────────────────────────

function buildProjectSummary(projects: Project[]): ProjectSummary {
  const active = projects.filter((p) => p.status === 'active')
  const overdueNames = active.filter(isOverdue).map((p) => p.title)
  const stalledNames = active
    .filter((p) => (p.priority === 1 || p.priority === 2))
    .filter((p) => {
      const d = daysSinceUpdate(p)
      return d !== null && d >= 3
    })
    .map((p) => p.title)

  const priorityProjects: ProjectContext[] = active
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      priority: p.priority,
      progress: p.progress,
      targetDate: p.targetDate,
      urgency: p.urgency,
      openTasks: p.tasks
        .filter((t) => !t.done)
        .slice(0, 5)
        .map((t) => ({ id: t.id, text: t.text, done: t.done })),
      isOverdue: isOverdue(p),
      daysSinceUpdate: daysSinceUpdate(p),
    }))

  return {
    total: projects.length,
    active: active.length,
    paused: projects.filter((p) => p.status === 'paused').length,
    complete: projects.filter((p) => p.status === 'complete').length,
    overdueCount: overdueNames.length,
    overdueNames,
    stalledNames,
    priorityProjects,
  }
}

// ─── Build stack summary ───────────────────────────────────────────────────────

function buildStackSummary(items: StackItem[]): StackSummary {
  const takenCount = items.filter((i) => i.takenToday).length
  const missing = items.filter((i) => !i.takenToday).map((i) => i.name)
  return {
    totalItems: items.length,
    takenCount,
    completionPct: items.length > 0 ? Math.round((takenCount / items.length) * 100) : 0,
    missingItems: missing,
  }
}

// ─── Build voice summary ───────────────────────────────────────────────────────

function buildVoiceSummary(todayVoiceLogs: VoiceLog[], allLogs: VoiceLog[]): VoiceSummary {
  const recent = allLogs.slice(-5).reverse()
  return {
    todayCount: todayVoiceLogs.length,
    recentTranscripts: recent.map((l) => ({
      timestamp: l.timestamp,
      excerpt: l.transcript.slice(0, 120),
    })),
  }
}

// ─── Build upload summary ──────────────────────────────────────────────────────

function buildUploadSummary(allUploads: UploadedFile[], todayDateLabel: string): UploadSummary {
  const todayUploads = allUploads.filter((f) => f.uploadedAt === todayDateLabel)
  const recent = allUploads.slice(-5).reverse()
  return {
    todayCount: todayUploads.length,
    totalCount: allUploads.length,
    recentFiles: recent.map((f) => ({
      name: f.name,
      category: f.category,
      uploadedAt: f.uploadedAt,
    })),
  }
}

// ─── Generate system context summary string ────────────────────────────────────

function buildSystemContextSummary(
  health: HealthSummary,
  fitness: FitnessSummary,
  projects: ProjectSummary,
  stack: StackSummary,
  brain: XodusBrainOutput,
): string {
  const lines: string[] = []

  lines.push(`Date: ${health.date}. Execution score: ${brain.executionScore}/100 (${brain.urgency}).`)

  // Recovery
  if (health.loggedToday) {
    const rec = health.recoveryScore !== null
      ? `Recovery ${health.recoveryScore}/100 (${health.recoveryState})`
      : `Recovery not logged`
    const sleep = health.sleepHours !== null
      ? `, sleep ${health.sleepHours}h`
      : ''
    const hrv = health.hrv !== null ? `, HRV ${health.hrv}ms` : ''
    lines.push(`${rec}${sleep}${hrv}.`)
  } else {
    lines.push('No daily log recorded today — all health metrics are estimated.')
  }

  // Nutrition
  const pct = health.proteinTarget > 0 && health.protein !== null
    ? Math.round((health.protein / health.proteinTarget) * 100)
    : null
  if (pct !== null) {
    const gap = health.proteinGap !== null && health.proteinGap < 0
      ? ` (${Math.abs(health.proteinGap)}g short)`
      : health.proteinGap !== null && health.proteinGap >= 0
      ? ' (target hit)'
      : ''
    lines.push(`Protein: ${health.protein}g / ${health.proteinTarget}g${gap}. Calories: ${health.calories ?? '?'} / ${health.calorieTarget}.`)
  } else {
    lines.push('Nutrition not logged today.')
  }

  // Fitness
  lines.push(
    `Fitness: ${fitness.weeklySessionCount}/${fitness.weeklyTarget} sessions this week.` +
    (fitness.hasActivityToday ? ` Trained today: ${fitness.todayActivityLabel ?? fitness.todayActivityType}.` : ' No workout today.')
  )

  // Projects
  if (projects.overdueCount > 0) {
    lines.push(`Projects: ${projects.overdueCount} overdue — ${projects.overdueNames.join(', ')}.`)
  } else if (projects.stalledNames.length > 0) {
    lines.push(`Projects: ${projects.stalledNames.join(', ')} stalled (P1/P2, no update ≥3 days).`)
  } else {
    lines.push(`Projects: ${projects.active} active, on track.`)
  }

  // Stack
  if (stack.totalItems > 0) {
    lines.push(`Stack: ${stack.takenCount}/${stack.totalItems} taken (${stack.completionPct}%).`)
  }

  // Habits
  if (health.alcoholStreak > 0) {
    lines.push(`Alcohol-free streak: ${health.alcoholStreak} days.`)
  }
  if (health.smokedToday) {
    lines.push('Smoked today.')
  }

  // Missing data
  if (brain.missingData.length > 0) {
    lines.push(`Missing data: ${brain.missingData.join(', ')}.`)
  }

  return lines.join(' ')
}

// ─── Public: build full context ────────────────────────────────────────────────

export function buildXodusAIContext(): XodusAIContext {
  if (typeof window === 'undefined') {
    throw new Error('buildXodusAIContext() must run on the client')
  }

  const todayKey = getTodayKey()
  const todayDateLabel = getTodayDateLabel()

  // Raw reads
  const dailyLog = getTodayLog()
  const last7Days = getLast7DayLogs()
  const weekLogs = getThisWeekLogs()
  const allActivityLogs = getActivityLogs()
  const todayActivityLogs = allActivityLogs.filter((l) => l.date === todayKey)
  const projects = getProjects()
  const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
  const allVoiceLogs = getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, [])
  const todayVoiceLogs = allVoiceLogs.filter((l) => l.timestamp.startsWith(todayKey))
  const allUploads = getStorage<UploadedFile[]>(STORAGE_KEYS.UPLOAD_HISTORY, [])

  // Brain output
  const brainInput = gatherBrainInput()
  const brain = runXodusBrain(brainInput)

  // Summarized
  const health = buildHealthSummary(dailyLog, last7Days)
  const fitness = buildFitnessSummary(weekLogs, todayActivityLogs)
  const projectsSummary = buildProjectSummary(projects)
  const stack = buildStackSummary(stackItems)
  const voice = buildVoiceSummary(todayVoiceLogs, allVoiceLogs)
  const uploads = buildUploadSummary(allUploads, todayDateLabel)

  const systemContextSummary = buildSystemContextSummary(health, fitness, projectsSummary, stack, brain)

  return {
    generatedAt: new Date().toISOString(),
    dateLabel: todayDateLabel,
    todayKey,
    brain,
    health,
    fitness,
    projects: projectsSummary,
    stack,
    voice,
    uploads,
    raw: {
      health: { today: dailyLog, last7Days },
      fitness: { thisWeekLogs: weekLogs, allLogs: allActivityLogs },
      projects: { projects },
      stack: { items: stackItems },
      voice: {
        recentLogs: allVoiceLogs.slice(-10).reverse(),
        todayLogs: todayVoiceLogs,
        totalCount: allVoiceLogs.length,
      },
      uploads: {
        recent: allUploads.slice(-10).reverse(),
        todayCount: allUploads.filter((f) => f.uploadedAt === todayDateLabel).length,
        totalCount: allUploads.length,
      },
    },
    missingData: brain.missingData,
    systemContextSummary,
  }
}

// ─── Public: formatted prompt context block ────────────────────────────────────

export function createXodusPromptContext(ctx?: XodosAIContext): string {
  const c = ctx ?? buildXodusAIContext()
  return [
    '## XODUS System Context',
    `Date: ${c.dateLabel}`,
    '',
    c.systemContextSummary,
    '',
    '## Priority Projects',
    ...c.projects.priorityProjects.map((p) => {
      const tasks = p.openTasks.length > 0
        ? p.openTasks.map((t) => `  - [ ] ${t.text}`).join('\n')
        : '  (no open tasks)'
      return `### ${p.title} (P${p.priority}, ${p.progress}%)\n${tasks}`
    }),
    '',
    '## Recent Voice Logs',
    c.voice.recentTranscripts.length > 0
      ? c.voice.recentTranscripts
          .map((v) => `[${v.timestamp.slice(0, 16)}] ${v.excerpt}`)
          .join('\n')
      : '(none)',
  ].join('\n')
}

// Fix typo in exported function name — keep both so callers aren't broken
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XodosAIContext = XodusAIContext

// ─── Public: short summary string only ────────────────────────────────────────

export function summarizeContextForAI(ctx?: XodusAIContext): string {
  const c = ctx ?? buildXodusAIContext()
  return c.systemContextSummary
}

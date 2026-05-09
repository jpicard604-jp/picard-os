import { parseTrainingFromVoiceLog, parseDailyFromVoiceLog } from './voice-parser'
import { parseProjectsFromVoiceLog } from './project-parser'
import type { ParsedTraining, DailyParseResult } from './voice-parser'
import type { ProjectParseResult } from './project-parser'

export type ImageCategory =
  | 'myFitnessPal'
  | 'screenTime'
  | 'progressPhoto'
  | 'scalePhoto'
  | 'workoutScreenshot'
  | 'stack'
  | 'other'

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  myFitnessPal:       'MyFitnessPal',
  screenTime:         'Screen Time',
  progressPhoto:      'Progress Photo',
  scalePhoto:         'Scale Photo',
  workoutScreenshot:  'Workout Screenshot',
  stack:              'Stack / Supplements',
  other:              'Other',
}

export interface AttachedImage {
  id: string
  dataUrl: string
  name: string
  size: number
  category: ImageCategory
  needsAiReview: boolean
}

export interface ParsedCommand {
  rawInput: string
  dailyUpdate: DailyParseResult
  activityUpdate: ParsedTraining
  projectUpdate: ProjectParseResult
  images: AttachedImage[]
  confidence: 'high' | 'medium' | 'low' | 'none'
  summary: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  preview: string
  summary: string
  savedCount: number
}

export const COMMAND_HISTORY_KEY = 'picard_command_history_v1'

// ─── AI placeholder stubs ─────────────────────────────────────────────────────

export async function analyzeImageAttachment(
  _image: AttachedImage,
): Promise<Partial<AttachedImage>> {
  // Future: send to Claude vision API
  return {}
}

export async function generateXodusPlan(_command: ParsedCommand): Promise<string> {
  // Future: send parsed command to Claude, receive action plan
  return ''
}

export function applyCommandUpdates(_command: ParsedCommand): void {
  // Future: batch-apply all approved updates in one transaction
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function overallConfidence(
  daily: DailyParseResult,
  activity: ParsedTraining,
  projects: ProjectParseResult,
): ParsedCommand['confidence'] {
  const signals: number[] = []
  if (daily.detected) signals.push(Object.keys(daily.fields).length >= 3 ? 2 : 1)
  if (activity.detected) {
    signals.push(activity.confidence === 'high' ? 2 : activity.confidence === 'medium' ? 1 : 0)
  }
  if (projects.detected) {
    const top = projects.matches.find((m) => m.confidence === 'high') ? 2
              : projects.matches.find((m) => m.confidence === 'medium') ? 1 : 0
    signals.push(top)
  }
  if (signals.length === 0) return 'none'
  const avg = signals.reduce((a, b) => a + b, 0) / signals.length
  if (avg >= 1.5) return 'high'
  if (avg >= 0.8) return 'medium'
  return 'low'
}

function buildSummary(
  daily: DailyParseResult,
  activity: ParsedTraining,
  projects: ProjectParseResult,
  images: AttachedImage[],
): string {
  const parts: string[] = []
  const fc = Object.keys(daily.fields).length
  if (fc > 0) parts.push(`${fc} daily field${fc !== 1 ? 's' : ''}`)
  if (activity.detected) parts.push(`${activity.type} workout`)
  if (projects.detected) {
    const names = projects.matches.map((m) => m.projectTitle).join(', ')
    parts.push(`${projects.matches.length} project update${projects.matches.length !== 1 ? 's' : ''} (${names})`)
  }
  if (images.length > 0) parts.push(`${images.length} image${images.length !== 1 ? 's' : ''}`)
  return parts.length === 0 ? 'No structured updates detected' : parts.join(' · ')
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCommandInput(
  input: string,
  images: AttachedImage[] = [],
): ParsedCommand {
  const daily = parseDailyFromVoiceLog(input)
  const activity = parseTrainingFromVoiceLog(input)
  const projects = parseProjectsFromVoiceLog(input)

  return {
    rawInput: input,
    dailyUpdate: daily,
    activityUpdate: activity,
    projectUpdate: projects,
    images,
    confidence: overallConfidence(daily, activity, projects),
    summary: buildSummary(daily, activity, projects, images),
  }
}

import { getStorage, STORAGE_KEYS } from './storage'
import { getProjects } from './projects'
import type { DailyLog, VoiceLog } from './storage'
import type { ActivityLog } from './fitness'
import type { HistoryEntry } from './command-parser'

function fmtDateLong(isoOrDate: string): string {
  return new Date(isoOrDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function pushSection(lines: string[], title: string) {
  lines.push('---', '', `## ${title}`, '')
}

export function generateObsidianExport(): string {
  const lines: string[] = []
  const now = new Date()

  lines.push('# Picard OS Export', '')
  lines.push(
    `*Exported ${now.toLocaleDateString('en-US', { dateStyle: 'full' })} at ${now.toLocaleTimeString('en-US', { timeStyle: 'short' })}*`,
    '',
  )

  // ── Daily Logs ──────────────────────────────────────────────────────────────
  pushSection(lines, 'Daily Logs')
  const allLogs = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  const logDates = Object.keys(allLogs).sort().reverse()

  if (logDates.length === 0) {
    lines.push('*No daily logs recorded.*', '')
  } else {
    for (const date of logDates) {
      const log = allLogs[date]
      lines.push(`### ${fmtDateLong(date + 'T12:00:00')}`, '')
      if (log.calories   !== null) lines.push(`- **Calories:** ${log.calories} kcal${log.calorieTarget ? ` / ${log.calorieTarget} target` : ''}`)
      if (log.protein    !== null) lines.push(`- **Protein:** ${log.protein}g`)
      if (log.water      !== null) lines.push(`- **Water:** ${log.water} glasses`)
      if (log.weight     !== null) lines.push(`- **Weight:** ${log.weight} lb`)
      if (log.sleepHours !== null) lines.push(`- **Sleep:** ${log.sleepHours} hrs`)
      if (log.steps      !== null) lines.push(`- **Steps:** ${log.steps.toLocaleString()}`)
      if (log.screenTime !== null) lines.push(`- **Screen Time:** ${log.screenTime} hrs`)
      if (log.instagramTime !== null) lines.push(`- **Instagram:** ${log.instagramTime} hrs`)
      if (log.smokedToday)         lines.push(`- **Smoked:** Yes`)
      if (log.drankToday)          lines.push(`- **Drank:** Yes`)
      if (log.mood       !== null) lines.push(`- **Mood:** ${log.mood}/5`)
      if (log.confidenceScore !== null) lines.push(`- **Confidence:** ${log.confidenceScore}/10`)
      if (log.notes)               lines.push(`- **Notes:** ${log.notes}`)
      lines.push('')
    }
  }

  // ── Activity Logs ───────────────────────────────────────────────────────────
  pushSection(lines, 'Activity Logs')
  const activities = getStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, [])
  const sortedActivities = [...activities].sort((a, b) => b.date.localeCompare(a.date))

  if (sortedActivities.length === 0) {
    lines.push('*No activities recorded.*', '')
  } else {
    for (const act of sortedActivities) {
      const label = act.label || act.type.charAt(0).toUpperCase() + act.type.slice(1)
      lines.push(`### ${fmtDateLong(act.date + 'T12:00:00')} — ${label}`, '')
      if (act.duration) lines.push(`- **Duration:** ${act.duration} min`)
      if (act.distance) lines.push(`- **Distance:** ${act.distance} mi`)
      if (act.steps)    lines.push(`- **Steps:** ${act.steps.toLocaleString()}`)
      if (act.exercises && act.exercises.length > 0) {
        lines.push('- **Exercises:**')
        for (const ex of act.exercises) {
          const detail = [
            ex.weight ? `${ex.weight}lb` : '',
            ex.reps   ? `×${ex.reps}`   : '',
          ].filter(Boolean).join(' ')
          lines.push(`  - ${ex.exercise}${detail ? ` (${detail})` : ''}`)
        }
      }
      if (act.notes) lines.push(`- **Notes:** ${act.notes}`)
      lines.push('')
    }
  }

  // ── Project Updates ─────────────────────────────────────────────────────────
  pushSection(lines, 'Project Updates')
  const projects = getProjects()

  for (const project of projects) {
    lines.push(`### ${project.title}`, '')
    lines.push(
      `**Status:** ${project.status} · **Progress:** ${project.progress}% · **Priority:** P${project.priority}`,
      '',
    )
    if (project.description) lines.push(`> ${project.description}`, '')

    if (project.tasks.length > 0) {
      lines.push('**Tasks:**')
      for (const task of project.tasks) {
        lines.push(`- [${task.done ? 'x' : ' '}] ${task.text}`)
      }
      lines.push('')
    }

    if (project.updates && project.updates.length > 0) {
      lines.push('**Update History:**')
      for (const update of [...project.updates].reverse()) {
        lines.push(`- ${fmtDateLong(update.timestamp)} — ${update.text} *(${update.source})*`)
      }
      lines.push('')
    }
  }

  // ── Voice Logs ──────────────────────────────────────────────────────────────
  pushSection(lines, 'Voice Logs')
  const voiceLogs = getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, [])
  const sortedVoice = [...voiceLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  if (sortedVoice.length === 0) {
    lines.push('*No voice logs recorded.*', '')
  } else {
    for (const log of sortedVoice) {
      lines.push(
        `### ${fmtDateLong(log.timestamp.slice(0, 10) + 'T12:00:00')} at ${fmtTime(log.timestamp)}`,
        '',
        log.transcript,
        '',
      )
    }
  }

  // ── XODUS Command History ───────────────────────────────────────────────────
  pushSection(lines, 'XODUS Command History')
  const cmdHistory = getStorage<HistoryEntry[]>('picard_command_history_v1', [])

  if (cmdHistory.length === 0) {
    lines.push('*No XODUS commands recorded.*', '')
  } else {
    for (const cmd of cmdHistory) {
      lines.push(
        `### ${fmtDateLong(cmd.timestamp.slice(0, 10) + 'T12:00:00')} at ${fmtTime(cmd.timestamp)}`,
        '',
        `> ${cmd.preview}`,
        '',
        `*${cmd.summary} · ${cmd.savedCount} saved*`,
        '',
      )
    }
  }

  return lines.join('\n')
}

export function downloadObsidianExport(): void {
  const md = generateObsidianExport()
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `picard-os-obsidian-${date}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

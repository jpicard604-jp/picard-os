import { getStorage, STORAGE_KEYS } from './storage'
import { getProjects } from './projects'
import { getAllNotes } from './xodus/notes'
import { getTodayGoals } from './daily-goals'
import { getNutritionProfile } from './nutrition-profile'
import { getXodusMemoryRecords } from './xodus/memory'
import type { DailyLog, VoiceLog } from './storage'
import type { ActivityLog } from './fitness'
import type { HistoryEntry } from './command-parser'
import type { DailyGoal } from './daily-goals'
import type { VaultInput } from './obsidian-vault'

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

// ── XODUS Memory + Notes Obsidian Export ──────────────────────────────────────
//
// Generates a single Obsidian-ready markdown file combining:
//   XODUS/Memory/*   — curated memory records (identity, goals, fitness, etc.)
//   XODUS/Notes/*    — general XODUS notes by date
//   XODUS/Groceries/ — grocery checklist notes by date
//   XODUS/Daily/     — today's goals and nutrition profile
//
// Folder paths are shown as H2 headings; each document as H3.
// Wiki-links reference Obsidian notes by their canonical names.
//
// TODO (future):
//   - ZIP export: one file per document in the proper folder structure
//   - Supabase memory records: pull from db instead of static module
//   - Two-way vault sync: watch vault folder, merge changes back to localStorage
//   - AI chat import distillation: convert ChatGPT/Claude/Gemini history → memory
//   - Review/approve queue: XODUS flags unvetted memory nodes for confirmation

// Maps brain-graph hub IDs → Obsidian wiki-link page names
const HUB_TO_WIKILINK: Record<string, string> = {
  'picard-os':       '[[Picard OS]]',
  'hub-xodus':       '[[XODUS]]',
  'hub-fitness':     '[[Fitness]]',
  'hub-whoop':       '[[WHOOP]]',
  'hub-nutrition':   '[[Nutrition]]',
  'hub-projects':    '[[Projects]]',
  'hub-daily-goals': '[[Daily Goals]]',
  'hub-daily':       '[[Daily Log]]',
  'hub-obsidian':    '[[Obsidian Brain]]',
}

const NOTE_CAT_TO_WIKILINKS: Record<string, string[]> = {
  grocery:  ['[[Nutrition]]', '[[Groceries]]'],
  fitness:  ['[[Fitness]]', '[[XODUS]]'],
  project:  ['[[Projects]]', '[[XODUS]]'],
  school:   ['[[Daily Goals]]', '[[XODUS]]'],
  personal: ['[[XODUS]]'],
  car:      ['[[Porsche 981]]', '[[XODUS]]'],
  money:    ['[[XODUS]]'],
  other:    ['[[XODUS]]'],
}

function fmtDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function generateXodusObsidianExport(): string {
  const lines: string[] = []
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  lines.push(
    '# XODUS Memory & Notes',
    '',
    `*Exported ${now.toLocaleDateString('en-US', { dateStyle: 'full' })} at ${now.toLocaleTimeString('en-US', { timeStyle: 'short' })}*`,
    '',
    '> Part of [[Picard OS]] · [[XODUS]] · [[Obsidian Brain]]',
    '',
    '---',
    '',
  )

  // ── XODUS/Memory ────────────────────────────────────────────────────────────
  lines.push('## XODUS/Memory', '')

  const memoryRecords = getXodusMemoryRecords()
  for (const rec of memoryRecords) {
    const wikiLinks = (rec.graphLinks ?? [])
      .map(id => HUB_TO_WIKILINK[id])
      .filter(Boolean)
    const relStr = [
      ...(rec.relatedProjects ?? []).map(p => `[[${p}]]`),
      ...(rec.relatedGoals ?? []),
      ...(rec.relatedPeople ?? []),
    ]

    lines.push(
      `### ${rec.title}`,
      '',
      '```yaml',
      `category:   ${rec.category.replace(/_/g, ' ')}`,
      `status:     ${rec.status.replace(/_/g, ' ')}`,
      `confidence: ${rec.confidence}`,
      `source:     ${rec.source.replace(/_/g, ' ')}`,
      `updated:    ${rec.updatedAt ?? today}`,
      ...(rec.filePath ? [`file:       ${rec.filePath}`] : []),
      '```',
      '',
      rec.summary,
      '',
    )

    if (relStr.length > 0) {
      lines.push(`**Related:** ${relStr.join(' · ')}`, '')
    }
    if (wikiLinks.length > 0) {
      lines.push(`**Links:** ${wikiLinks.join(' · ')}`, '')
    }
    lines.push('---', '')
  }

  // ── XODUS/Notes ─────────────────────────────────────────────────────────────
  const allNotes = getAllNotes()
  const generalNotes = allNotes.filter(n => n.category !== 'grocery')
  const groceryNotes = allNotes.filter(n => n.category === 'grocery')

  if (generalNotes.length > 0) {
    lines.push('## XODUS/Notes', '')

    // Group by date
    const byDate: Record<string, typeof generalNotes> = {}
    for (const n of generalNotes) {
      byDate[n.date] = byDate[n.date] ?? []
      byDate[n.date].push(n)
    }

    for (const date of Object.keys(byDate).sort().reverse()) {
      lines.push(`### XODUS/Notes/${date}.md`, '', `> ${fmtDate(date)}`, '')
      for (const n of byDate[date]) {
        const wikiLinks = NOTE_CAT_TO_WIKILINKS[n.category] ?? ['[[XODUS]]']
        lines.push(
          `#### ${n.title ?? n.category.charAt(0).toUpperCase() + n.category.slice(1)}`,
          '',
          '```yaml',
          `category:  ${n.category}`,
          `source:    ${n.source}`,
          `created:   ${n.createdAt}`,
          ...(n.status ? [`status:    ${n.status}`] : []),
          '```',
          '',
          n.body,
          '',
          `*Links: ${wikiLinks.join(' · ')}*`,
          '',
        )
      }
      lines.push('---', '')
    }
  }

  // ── XODUS/Groceries ──────────────────────────────────────────────────────────
  if (groceryNotes.length > 0) {
    lines.push('## XODUS/Groceries', '')

    const byDate: Record<string, typeof groceryNotes> = {}
    for (const n of groceryNotes) {
      byDate[n.date] = byDate[n.date] ?? []
      byDate[n.date].push(n)
    }

    for (const date of Object.keys(byDate).sort().reverse()) {
      lines.push(`### XODUS/Groceries/${date}.md`, '', `> ${fmtDate(date)}`, '')
      for (const n of byDate[date]) {
        const checked = n.status === 'done' ? '[x]' : '[ ]'
        lines.push(`- ${checked} ${n.body}`)
      }
      lines.push(
        '',
        '*Links: [[Nutrition]] · [[Groceries]] · [[XODUS]]*',
        '',
        '---',
        '',
      )
    }
  }

  // ── XODUS/Daily ──────────────────────────────────────────────────────────────
  lines.push('## XODUS/Daily', '', `### XODUS/Daily/${today}.md`, '', `> ${fmtDate(today)}`, '')

  const goals = getTodayGoals()
  if (goals.length > 0) {
    lines.push('#### Daily Goals', '')
    for (const g of goals) {
      lines.push(`- [${g.done ? 'x' : ' '}] ${g.text} *(${g.category})*`)
    }
    lines.push('')
  }

  const profile = getNutritionProfile()
  if (profile.proteinTarget || profile.calorieTarget) {
    lines.push(
      '#### Nutrition Profile',
      '',
      '```yaml',
      `phase:    ${profile.phase ?? 'cut'}`,
      `calories: ${profile.calorieTarget ?? '?'} kcal`,
      `protein:  ${profile.proteinTarget ?? '?'} g`,
      `carbs:    ${profile.carbTarget ?? '?'} g`,
      `fat:      ${profile.fatTarget ?? '?'} g`,
      '```',
      '',
      '*Links: [[Nutrition]] · [[Fitness]] · [[WHOOP]] · [[XODUS]]*',
      '',
    )
  }

  if (goals.length === 0 && !profile.proteinTarget && !profile.calorieTarget) {
    lines.push('*No goals or nutrition data for today.*', '')
  }

  return lines.join('\n')
}

export function downloadXodusObsidianExport(): void {
  const md = generateXodusObsidianExport()
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xodus-memory-notes-${date}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Vault ZIP (multi-file staging export) ─────────────────────────────────────
//
// Gathers all relevant data from localStorage, POSTs to /api/obsidian/export-zip,
// receives the ZIP blob, triggers download. Existing flat exports remain intact.
// One-way only — does not write into the user's real Obsidian vault.

function gatherVaultInput(): VaultInput {
  return {
    dailyLogs:        getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {}),
    activityLogs:     getStorage<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []),
    voiceLogs:        getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, []),
    projects:         getProjects(),
    xodusNotes:       getAllNotes(),
    xodusMemory:      getXodusMemoryRecords(),
    dailyGoals:       getStorage<Record<string, DailyGoal[]>>('picard_daily_goals_v1', {}),
    nutritionProfile: getNutritionProfile(),
    commandHistory:   getStorage<HistoryEntry[]>('picard_command_history_v1', []),
  }
}

export async function downloadVaultZip(): Promise<void> {
  const input = gatherVaultInput()
  const res = await fetch('/api/obsidian/export-zip', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(`Vault ZIP export failed (${res.status})`)
  }
  const blob = await res.blob()
  const date = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `picard-vault-${date}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

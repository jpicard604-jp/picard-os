// Pure Obsidian vault builder — transforms Picard OS / XODUS records into
// { path, content } pairs following docs/obsidian-brain-guide.md folder logic.
//
// One-way export only. Does NOT read localStorage, does NOT write files.
// The caller (client or server) supplies a VaultInput payload; this module
// returns a flat list of VaultFile entries to be zipped or written elsewhere.

import type { DailyLog, VoiceLog } from './storage'
import type { ActivityLog } from './fitness'
import type { Project } from './projects'
import type { XodusNote } from './xodus/notes'
import type { XodusMemoryRecord } from './xodus/memory'
import type { DailyGoal } from './daily-goals'
import type { NutritionProfile } from './nutrition-profile'
import type { HistoryEntry } from './command-parser'

export const VAULT_ROOT = 'picard-vault-staging'

export interface VaultFile {
  path:    string
  content: string
}

export interface VaultManifestEntry {
  path:   string
  bytes:  number
  hash:   string
}

export interface VaultManifest {
  generatedAt: string
  source:      'picard-os'
  fileCount:   number
  files:       VaultManifestEntry[]
}

export interface VaultInput {
  dailyLogs?:        Record<string, DailyLog>
  activityLogs?:     ActivityLog[]
  voiceLogs?:        VoiceLog[]
  projects?:         Project[]
  xodusNotes?:       XodusNote[]
  xodusMemory?:      XodusMemoryRecord[]
  dailyGoals?:       Record<string, DailyGoal[]>
  nutritionProfile?: NutritionProfile | null
  commandHistory?:   HistoryEntry[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDateLong(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function safeFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
    || 'untitled'
}

function timeSlug(iso: string): string {
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  return `${date}-${pad(d.getHours())}-${pad(d.getMinutes())}`
}

function yamlValue(v: unknown): string {
  if (v == null) return '""'
  if (Array.isArray(v)) return `[${v.map(x => yamlValue(x)).join(', ')}]`
  if (typeof v === 'string') {
    if (/^[\w./:\- ]+$/.test(v) && !v.includes('  ')) return v
    return JSON.stringify(v)
  }
  return String(v)
}

function frontmatter(fields: Record<string, unknown>): string {
  const lines = ['---']
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue
    lines.push(`${k}: ${yamlValue(v)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

// Stable, dependency-free 32-bit content hash (hex). Not cryptographic.
function fnv1aHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function byteLen(s: string): number {
  // approximate byte length without Buffer/TextEncoder dependency assumptions
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length
  return s.length
}

// ── builders ─────────────────────────────────────────────────────────────────

function buildIndex(input: VaultInput, generatedAt: string): VaultFile {
  const dailyCount    = Object.keys(input.dailyLogs ?? {}).length
  const activityCount = (input.activityLogs ?? []).length
  const voiceCount    = (input.voiceLogs ?? []).length
  const projectCount  = (input.projects ?? []).length
  const noteCount     = (input.xodusNotes ?? []).length
  const memoryCount   = (input.xodusMemory ?? []).length
  const commandCount  = (input.commandHistory ?? []).length

  const body = [
    frontmatter({
      title:  'Picard OS Vault Staging — Index',
      type:   'index',
      source: 'picard-os',
      date:   generatedAt.slice(0, 10),
      tags:   ['picard-os', 'xodus', 'staging'],
    }),
    '# Picard OS — Vault Staging Index',
    '',
    `*Generated ${new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}*`,
    '',
    '> **This is a staging export.** Files are intended to be reviewed before merging into your permanent Obsidian vault. Nothing here was written into your real vault.',
    '',
    '## Included',
    `- Daily logs: **${dailyCount}**`,
    `- Activity / workout logs: **${activityCount}**`,
    `- Voice logs: **${voiceCount}**`,
    `- Projects: **${projectCount}**`,
    `- XODUS memory records: **${memoryCount}**`,
    `- XODUS notes + groceries: **${noteCount}**`,
    `- XODUS command history: **${commandCount}**`,
    '',
    '## Layout',
    '```',
    'picard-vault-staging/',
    '  _index.md',
    '  _manifest.json',
    '  profile/        — Jackson identity, fitness baselines, goals, preferences',
    '  daily/          — one file per YYYY-MM-DD daily log',
    '  workouts/       — one file per activity log',
    '  projects/       — one file per project',
    '  voice/          — one file per voice log',
    '  xodus/          — memory records, notes, groceries, command history',
    '  nutrition/      — current nutrition profile',
    '  inbox/          — raw export notes (anything unstructured)',
    '```',
    '',
    '## How to use',
    '1. Unzip into a **temporary folder** inside your Obsidian vault (or anywhere else).',
    '2. Browse the files. Edit, rename, delete freely — this is a staging copy.',
    '3. When happy, move into the permanent vault structure of your choice.',
    '',
    'Related: [[Picard OS]] · [[XODUS]] · [[Jackson Profile]] · [[Current Goals]] · [[Fitness Baselines]]',
    '',
  ].join('\n')

  return { path: `${VAULT_ROOT}/_index.md`, content: body }
}

function buildProfile(input: VaultInput): VaultFile[] {
  const memory = input.xodusMemory ?? []
  const find = (id: string) => memory.find(m => m.id === id)

  const identity = find('mem-identity')
  const goals    = find('mem-goals')
  const fitness  = find('mem-fitness')
  const workflow = find('mem-workflow')

  const profile: VaultFile = {
    path: `${VAULT_ROOT}/profile/Jackson_Profile.md`,
    content: [
      frontmatter({
        title:  'Jackson Profile',
        type:   'profile',
        source: 'picard-os',
        status: identity?.status ?? 'current',
        tags:   ['profile', 'identity', 'jackson'],
      }),
      '# Jackson Profile',
      '',
      identity?.summary ?? 'No identity record found in export.',
      '',
      '## Related',
      '[[Picard OS]] · [[XODUS]] · [[Current Goals]] · [[Fitness Baselines]] · [[Preferences]]',
      '',
    ].join('\n'),
  }

  const goalsFile: VaultFile = {
    path: `${VAULT_ROOT}/profile/Current_Goals.md`,
    content: [
      frontmatter({
        title:  'Current Goals',
        type:   'goals',
        source: 'picard-os',
        status: goals?.status ?? 'current',
        tags:   ['goals', 'jackson'],
      }),
      '# Current Goals',
      '',
      goals?.summary ?? 'No goals record found in export.',
      '',
      '## Related',
      '[[Jackson Profile]] · [[XODUS]] · [[Picard OS]]',
      '',
    ].join('\n'),
  }

  const fitnessFile: VaultFile = {
    path: `${VAULT_ROOT}/profile/Fitness_Baselines.md`,
    content: [
      frontmatter({
        title:  'Fitness Baselines',
        type:   'fitness-profile',
        source: 'picard-os',
        status: fitness?.status ?? 'current',
        tags:   ['fitness', 'nutrition', 'baselines'],
      }),
      '# Fitness Baselines',
      '',
      fitness?.summary ?? 'No fitness record found in export.',
      '',
      '## Related',
      '[[Jackson Profile]] · [[Current Goals]] · [[Nutrition Profile]] · [[XODUS]]',
      '',
    ].join('\n'),
  }

  const prefSummary = workflow?.summary ?? 'No workflow/preferences record found in export.'
  const prefFile: VaultFile = {
    path: `${VAULT_ROOT}/profile/Preferences.md`,
    content: [
      frontmatter({
        title:  'Preferences',
        type:   'preferences',
        source: 'picard-os',
        status: workflow?.status ?? 'current',
        tags:   ['preferences', 'design', 'workflow'],
      }),
      '# Preferences — Design & Dev Workflow',
      '',
      prefSummary,
      '',
      '## Related',
      '[[Jackson Profile]] · [[Picard OS]] · [[XODUS]]',
      '',
    ].join('\n'),
  }

  return [profile, goalsFile, fitnessFile, prefFile]
}

function buildDaily(input: VaultInput): VaultFile[] {
  const logs = input.dailyLogs ?? {}
  const goalsByDate = input.dailyGoals ?? {}
  const files: VaultFile[] = []

  for (const date of Object.keys(logs).sort().reverse()) {
    const log = logs[date]
    const goals = goalsByDate[date] ?? []
    const tags = ['daily', 'picard-os']
    if (log.smokedToday) tags.push('smoked')
    if (log.drankToday)  tags.push('drank')

    const lines: string[] = [
      frontmatter({
        title:  `Daily — ${date}`,
        type:   'daily',
        date,
        source: 'picard-os',
        status: 'logged',
        tags,
      }),
      `# ${fmtDateLong(date)}`,
      '',
      '## Metrics',
    ]

    if (log.calories       !== null) lines.push(`- **Calories:** ${log.calories} kcal${log.calorieTarget ? ` / ${log.calorieTarget} target` : ''}`)
    if (log.protein        !== null) lines.push(`- **Protein:** ${log.protein}g${log.proteinTarget ? ` / ${log.proteinTarget}g target` : ''}`)
    if (log.weight         !== null) lines.push(`- **Weight:** ${log.weight} lb`)
    if (log.water          !== null) lines.push(`- **Water:** ${log.water} glasses`)
    if (log.sleepHours     !== null) lines.push(`- **Sleep:** ${log.sleepHours} hrs${log.sleepQuality != null ? ` (${log.sleepQuality}% quality)` : ''}`)
    if (log.steps          !== null) lines.push(`- **Steps:** ${log.steps.toLocaleString()}`)
    if (log.screenTime     !== null) lines.push(`- **Screen Time:** ${log.screenTime} hrs`)
    if (log.instagramTime  !== null) lines.push(`- **Instagram:** ${log.instagramTime} hrs`)
    if (log.recoveryScore  !== null) lines.push(`- **Recovery:** ${log.recoveryScore}`)
    if (log.hrv            !== null) lines.push(`- **HRV:** ${log.hrv} ms`)
    if (log.restingHR      !== null) lines.push(`- **Resting HR:** ${log.restingHR} bpm`)
    if (log.strain         !== null) lines.push(`- **Strain:** ${log.strain}`)
    if (log.mood           !== null) lines.push(`- **Mood:** ${log.mood}/5`)
    if (log.confidenceScore !== null) lines.push(`- **Confidence:** ${log.confidenceScore}/10`)
    if (log.smokedToday)             lines.push(`- **Smoked:** Yes`)
    if (log.drankToday)              lines.push(`- **Drank:** Yes`)

    if (goals.length > 0) {
      lines.push('', '## Goals')
      for (const g of goals) {
        lines.push(`- [${g.done ? 'x' : ' '}] ${g.text} *(${g.category})*`)
      }
    }

    if (log.notes) {
      lines.push('', '## Notes', '', log.notes)
    }

    lines.push('', '## Related', '[[Picard OS]] · [[XODUS]] · [[Jackson Profile]] · [[Fitness Baselines]]', '')

    files.push({ path: `${VAULT_ROOT}/daily/${date}.md`, content: lines.join('\n') })
  }

  return files
}

function buildWorkouts(input: VaultInput): VaultFile[] {
  const acts = input.activityLogs ?? []
  const files: VaultFile[] = []
  const seenSlugs = new Set<string>()

  for (const act of [...acts].sort((a, b) => b.date.localeCompare(a.date))) {
    const label = act.label || act.type
    let slug = `${act.date}-${safeFilename(label).toLowerCase()}`
    let counter = 2
    while (seenSlugs.has(slug)) {
      slug = `${act.date}-${safeFilename(label).toLowerCase()}-${counter++}`
    }
    seenSlugs.add(slug)

    const lines: string[] = [
      frontmatter({
        title:  `${label} — ${act.date}`,
        type:   'workout',
        date:   act.date,
        source: 'picard-os',
        status: 'logged',
        tags:   ['workout', act.type, act.source],
      }),
      `# ${label} — ${fmtDateLong(act.date)}`,
      '',
    ]

    const meta: string[] = []
    if (act.duration) meta.push(`**Duration:** ${act.duration} min`)
    if (act.distance) meta.push(`**Distance:** ${act.distance}${act.distanceUnit ? ' ' + act.distanceUnit : ' mi'}`)
    if (act.steps)    meta.push(`**Steps:** ${act.steps.toLocaleString()}`)
    if (act.calories) meta.push(`**Calories:** ${act.calories}`)
    if (act.rpe)      meta.push(`**RPE:** ${act.rpe}`)
    if (meta.length)  lines.push(meta.join(' · '), '')

    if (act.exercises && act.exercises.length > 0) {
      lines.push('## Exercises')
      for (const ex of act.exercises) {
        const detail = [
          ex.sets   ? `${ex.sets}×` : '',
          ex.reps   ? `${ex.reps}`  : '',
          ex.weight ? `@ ${ex.weight}${ex.weightUnit ?? 'lb'}` : '',
          ex.rpe    ? `RPE ${ex.rpe}` : '',
        ].filter(Boolean).join(' ')
        lines.push(`- ${ex.exercise}${detail ? ` — ${detail}` : ''}${ex.notes ? ` *(${ex.notes})*` : ''}`)
      }
      lines.push('')
    }

    if (act.notes) lines.push('## Notes', '', act.notes, '')

    lines.push('## Related', '[[Fitness Baselines]] · [[Picard OS]] · [[XODUS]]', '')

    files.push({ path: `${VAULT_ROOT}/workouts/${slug}.md`, content: lines.join('\n') })
  }

  return files
}

function buildProjects(input: VaultInput): VaultFile[] {
  const projects = input.projects ?? []
  const files: VaultFile[] = []

  for (const p of projects) {
    const lines: string[] = [
      frontmatter({
        title:    p.title,
        type:     'project',
        source:   'picard-os',
        status:   p.status,
        priority: p.priority,
        progress: p.progress,
        urgency:  p.urgency,
        target:   p.targetDate,
        tags:     ['project', p.status],
      }),
      `# ${p.title}`,
      '',
      `**Status:** ${p.status} · **Progress:** ${p.progress}% · **Priority:** P${p.priority} · **Urgency:** ${p.urgency}`,
      '',
    ]

    if (p.description) lines.push(`> ${p.description}`, '')
    if (p.targetDate)  lines.push(`**Target:** ${p.targetDate}`, '')

    if (p.tasks.length > 0) {
      lines.push('## Tasks')
      for (const t of p.tasks) lines.push(`- [${t.done ? 'x' : ' '}] ${t.text}`)
      lines.push('')
    }

    if (p.updates && p.updates.length > 0) {
      lines.push('## Update History')
      for (const u of [...p.updates].reverse()) {
        lines.push(`- ${fmtDateLong(u.timestamp)} — ${u.text} *(${u.source}, ${u.progressBefore}% → ${u.progressAfter}%)*`)
      }
      lines.push('')
    }

    if (p.notes) lines.push('## Notes', '', p.notes, '')

    lines.push('## Related', '[[Picard OS]] · [[XODUS]] · [[Current Goals]]', '')

    files.push({
      path:    `${VAULT_ROOT}/projects/${safeFilename(p.title)}.md`,
      content: lines.join('\n'),
    })
  }

  return files
}

function buildVoice(input: VaultInput): VaultFile[] {
  const voice = input.voiceLogs ?? []
  const files: VaultFile[] = []
  const seenSlugs = new Set<string>()

  for (const v of [...voice].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    let slug = `${timeSlug(v.timestamp)}-voice`
    let counter = 2
    while (seenSlugs.has(slug)) {
      slug = `${timeSlug(v.timestamp)}-voice-${counter++}`
    }
    seenSlugs.add(slug)

    const date = v.timestamp.slice(0, 10)
    const content = [
      frontmatter({
        title:    `Voice — ${slug}`,
        type:     'voice',
        date,
        source:   'picard-os',
        status:   'logged',
        duration: v.duration,
        tags:     ['voice', 'log'],
      }),
      `# Voice Log — ${fmtDateLong(date)}`,
      '',
      `*${new Date(v.timestamp).toLocaleTimeString('en-US', { timeStyle: 'short' })} · ${v.duration}s*`,
      '',
      v.transcript || '*(empty transcript)*',
      '',
      '## Related',
      '[[Picard OS]] · [[XODUS]]',
      '',
    ].join('\n')

    files.push({ path: `${VAULT_ROOT}/voice/${slug}.md`, content })
  }

  return files
}

function buildXodus(input: VaultInput): VaultFile[] {
  const memory  = input.xodusMemory ?? []
  const notes   = input.xodusNotes ?? []
  const history = input.commandHistory ?? []

  const grocery = notes.filter(n => n.category === 'grocery')
  const general = notes.filter(n => n.category !== 'grocery')

  // ── Memory_Records.md ──
  const memLines: string[] = [
    frontmatter({
      title:  'XODUS Memory Records',
      type:   'xodus-memory',
      source: 'picard-os',
      tags:   ['xodus', 'memory'],
    }),
    '# XODUS Memory Records',
    '',
    '> Curated long-term memory used by XODUS to maintain context between sessions.',
    '',
  ]
  for (const rec of memory) {
    memLines.push(
      `## ${rec.title}`,
      '',
      '```yaml',
      `category:   ${rec.category.replace(/_/g, ' ')}`,
      `status:     ${rec.status.replace(/_/g, ' ')}`,
      `confidence: ${rec.confidence}`,
      `source:     ${rec.source.replace(/_/g, ' ')}`,
      `updated:    ${rec.updatedAt ?? ''}`,
      ...(rec.filePath ? [`file:       ${rec.filePath}`] : []),
      '```',
      '',
      rec.summary,
      '',
    )
    const related = [
      ...(rec.relatedProjects ?? []).map(p => `[[${p}]]`),
      ...(rec.relatedPeople ?? []).map(p => `[[${p}]]`),
      ...(rec.relatedGoals ?? []),
    ]
    if (related.length > 0) memLines.push(`**Related:** ${related.join(' · ')}`, '')
    memLines.push('---', '')
  }
  memLines.push('## Vault Links', '[[Picard OS]] · [[XODUS]] · [[Jackson Profile]] · [[Current Goals]]', '')

  // ── Notes.md ──
  const notesLines: string[] = [
    frontmatter({
      title:  'XODUS Notes',
      type:   'xodus-notes',
      source: 'picard-os',
      tags:   ['xodus', 'notes'],
    }),
    '# XODUS Notes',
    '',
  ]
  if (general.length === 0) {
    notesLines.push('*No notes recorded.*', '')
  } else {
    const byDate: Record<string, XodusNote[]> = {}
    for (const n of general) {
      (byDate[n.date] ??= []).push(n)
    }
    for (const date of Object.keys(byDate).sort().reverse()) {
      notesLines.push(`## ${fmtDateLong(date)}`, '')
      for (const n of byDate[date]) {
        notesLines.push(`### ${n.title ?? n.category}`, '')
        notesLines.push('```yaml')
        notesLines.push(`category: ${n.category}`)
        notesLines.push(`source:   ${n.source}`)
        notesLines.push(`created:  ${n.createdAt}`)
        if (n.status) notesLines.push(`status:   ${n.status}`)
        notesLines.push('```', '', n.body, '')
      }
      notesLines.push('---', '')
    }
  }

  // ── Groceries.md ──
  const groceryLines: string[] = [
    frontmatter({
      title:  'XODUS Groceries',
      type:   'xodus-groceries',
      source: 'picard-os',
      tags:   ['xodus', 'groceries', 'nutrition'],
    }),
    '# Groceries',
    '',
  ]
  if (grocery.length === 0) {
    groceryLines.push('*No grocery items.*', '')
  } else {
    const byDate: Record<string, XodusNote[]> = {}
    for (const n of grocery) {
      (byDate[n.date] ??= []).push(n)
    }
    for (const date of Object.keys(byDate).sort().reverse()) {
      groceryLines.push(`## ${fmtDateLong(date)}`, '')
      for (const n of byDate[date]) {
        groceryLines.push(`- [${n.status === 'done' ? 'x' : ' '}] ${n.body}`)
      }
      groceryLines.push('')
    }
  }
  groceryLines.push('## Related', '[[Nutrition Profile]] · [[Fitness Baselines]] · [[XODUS]]', '')

  // ── Command_History.md ──
  const cmdLines: string[] = [
    frontmatter({
      title:  'XODUS Command History',
      type:   'xodus-history',
      source: 'picard-os',
      tags:   ['xodus', 'history'],
    }),
    '# XODUS Command History',
    '',
  ]
  if (history.length === 0) {
    cmdLines.push('*No XODUS commands recorded.*', '')
  } else {
    for (const cmd of [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
      const time = new Date(cmd.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      cmdLines.push(`## ${time}`, '', `> ${cmd.preview}`, '', `*${cmd.summary} · ${cmd.savedCount} saved*`, '', '---', '')
    }
  }

  return [
    { path: `${VAULT_ROOT}/xodus/Memory_Records.md`, content: memLines.join('\n') },
    { path: `${VAULT_ROOT}/xodus/Notes.md`,          content: notesLines.join('\n') },
    { path: `${VAULT_ROOT}/xodus/Groceries.md`,      content: groceryLines.join('\n') },
    { path: `${VAULT_ROOT}/xodus/Command_History.md`, content: cmdLines.join('\n') },
  ]
}

function buildNutrition(input: VaultInput): VaultFile[] {
  const p = input.nutritionProfile
  if (!p) return []
  const lines = [
    frontmatter({
      title:  'Nutrition Profile',
      type:   'nutrition-profile',
      source: 'picard-os',
      status: p.source ?? 'unknown',
      phase:  p.phase,
      tags:   ['nutrition', 'profile', p.phase],
    }),
    '# Nutrition Profile',
    '',
    '```yaml',
    `phase:    ${p.phase}`,
    `calories: ${p.calorieTarget ?? '?'} kcal`,
    `protein:  ${p.proteinTarget ?? '?'} g`,
    `carbs:    ${p.carbTarget ?? '?'} g`,
    `fat:      ${p.fatTarget ?? '?'} g`,
    `weight:   ${p.currentWeightLb ?? '?'} lb`,
    `source:   ${p.source ?? 'unknown'}`,
    `updated:  ${p.updatedAt ?? ''}`,
    '```',
    '',
    '## Related',
    '[[Fitness Baselines]] · [[Jackson Profile]] · [[XODUS]] · [[Groceries]]',
    '',
  ].join('\n')

  return [{ path: `${VAULT_ROOT}/nutrition/Nutrition_Profile.md`, content: lines }]
}

function buildInbox(input: VaultInput, generatedAt: string): VaultFile {
  const lines = [
    frontmatter({
      title:  'Raw Export Notes',
      type:   'inbox',
      source: 'picard-os',
      date:   generatedAt.slice(0, 10),
      tags:   ['inbox', 'staging', 'review'],
    }),
    '# Raw Export Notes',
    '',
    '> Unstructured catch-all from this staging export. Move anything useful into the right folder, delete the rest.',
    '',
    `- Generated: ${new Date(generatedAt).toISOString()}`,
    `- Daily logs exported: ${Object.keys(input.dailyLogs ?? {}).length}`,
    `- Activity logs exported: ${(input.activityLogs ?? []).length}`,
    `- Voice logs exported: ${(input.voiceLogs ?? []).length}`,
    `- Projects exported: ${(input.projects ?? []).length}`,
    `- XODUS memory records: ${(input.xodusMemory ?? []).length}`,
    `- XODUS notes (incl. groceries): ${(input.xodusNotes ?? []).length}`,
    `- XODUS command history: ${(input.commandHistory ?? []).length}`,
    '',
    '## Review Checklist',
    '- [ ] Profile files match current reality',
    '- [ ] Daily logs land in vault-daily folder structure',
    '- [ ] Workouts deduped against existing notes',
    '- [ ] Projects reconciled with permanent project pages',
    '- [ ] Voice logs reviewed and pruned',
    '- [ ] Memory records vs. Claude project memory files reconciled',
    '',
    '## Related',
    '[[Picard OS]] · [[XODUS]]',
    '',
  ].join('\n')

  return { path: `${VAULT_ROOT}/inbox/Raw_Export_Notes.md`, content: lines }
}

// ── public API ───────────────────────────────────────────────────────────────

export function buildVaultFiles(
  input: VaultInput,
  generatedAt: string = new Date().toISOString(),
): VaultFile[] {
  const files: VaultFile[] = []
  files.push(buildIndex(input, generatedAt))
  files.push(...buildProfile(input))
  files.push(...buildDaily(input))
  files.push(...buildWorkouts(input))
  files.push(...buildProjects(input))
  files.push(...buildVoice(input))
  files.push(...buildXodus(input))
  files.push(...buildNutrition(input))
  files.push(buildInbox(input, generatedAt))
  return files
}

export function buildManifest(
  files: VaultFile[],
  generatedAt: string = new Date().toISOString(),
): VaultManifest {
  const entries: VaultManifestEntry[] = files.map(f => ({
    path:  f.path,
    bytes: byteLen(f.content),
    hash:  fnv1aHash(f.content),
  }))
  return {
    generatedAt,
    source:    'picard-os',
    fileCount: entries.length,
    files:     entries,
  }
}

export function buildVaultBundle(input: VaultInput): {
  files:    VaultFile[]
  manifest: VaultManifest
  generatedAt: string
} {
  const generatedAt = new Date().toISOString()
  const files = buildVaultFiles(input, generatedAt)
  const manifest = buildManifest(files, generatedAt)
  // Manifest is itself a file in the zip
  files.push({
    path:    `${VAULT_ROOT}/_manifest.json`,
    content: JSON.stringify(manifest, null, 2),
  })
  return { files, manifest, generatedAt }
}

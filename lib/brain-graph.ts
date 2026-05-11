// XODUS Brain Graph — data builder for the Obsidian Neural Link /brain page.
// Aggregates Picard OS localStorage sources into a node-edge graph.
//
// FUTURE extension points (do not implement yet):
//   - ingestObsidianVault(vaultPath): parse [[wiki-links]] + frontmatter tags
//   - ingestAIChats(history): distill Claude/GPT/Gemini conversations into notes
//   - streamLiveUpdates(): subscribe to STORAGE_EVENTS and patch graph incrementally
//   - addFrontmatterEdges(file): connect tags, aliases, and backlinks

import type { DailyLog, VoiceLog } from './storage'
import { getStorage, STORAGE_KEYS } from './storage'
import { getProjects } from './projects'
import { getActivityLogs } from './fitness'
import { getTodayGoals } from './daily-goals'
import { getNutritionProfile } from './nutrition-profile'
import { getRecentNotes } from './xodus/notes'
import { getXodusMemoryRecords } from './xodus/memory'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrainNodeType =
  | 'project' | 'daily'    | 'fitness'  | 'nutrition'
  | 'school'  | 'car'      | 'money'    | 'contact'
  | 'task'    | 'upload'   | 'xodus'    | 'obsidian'
  | 'note'    | 'system'   | 'memory'

export interface BrainGraphNode {
  id:       string
  label:    string
  type:     BrainNodeType
  size?:    number
  color?:   string
  summary?: string
  date?:    string
  source?:  string     // 'system' | 'localStorage' | 'obsidian' | 'ai' | 'memory'
  // Memory node metadata — only set on type:'memory' nodes
  memoryCategory?:  string
  memoryStatus?:    'current' | 'historical' | 'needs_confirmation'
  memoryConfidence?: 'high' | 'medium' | 'low'
  memoryFilePath?:  string
}

export interface BrainGraphEdge {
  source:    string
  target:    string
  type?:     string    // 'core' | 'data' | 'semantic' | 'member' | 'date'
  strength?: number    // 0.0–1.0
}

export interface BrainGraphData {
  nodes: BrainGraphNode[]
  edges: BrainGraphEdge[]
}

export interface PositionedNode extends BrainGraphNode {
  x: number
  y: number
}

// ─── Color palette ────────────────────────────────────────────────────────────

export const NODE_COLORS: Record<BrainNodeType, string> = {
  system:    '#71717a',  // zinc
  xodus:     '#22d3ee',  // cyan
  fitness:   '#4ade80',  // green
  nutrition: '#fbbf24',  // amber
  project:   '#60a5fa',  // blue
  daily:     '#c084fc',  // purple
  note:      '#f472b6',  // pink
  upload:    '#fb923c',  // orange
  task:      '#38bdf8',  // sky
  obsidian:  '#a78bfa',  // violet
  school:    '#818cf8',  // indigo
  car:       '#94a3b8',  // slate
  money:     '#34d399',  // emerald
  contact:   '#e879f9',  // fuchsia
  memory:    '#a5b4fc',  // indigo-300 — meta/AI memory layer
}

// ─── Domain node IDs ──────────────────────────────────────────────────────────

export const HUB_ID = 'picard-os'

export const DOMAIN_IDS = new Set([
  'hub-xodus', 'hub-fitness', 'hub-nutrition', 'hub-projects',
  'hub-daily', 'hub-whoop', 'hub-daily-goals', 'hub-obsidian',
])

// Domain node → type mapping (for positioning data nodes near their domain)
const TYPE_TO_DOMAIN: Record<BrainNodeType, string> = {
  xodus:     'hub-xodus',
  fitness:   'hub-fitness',
  nutrition: 'hub-nutrition',
  project:   'hub-projects',
  task:      'hub-daily-goals',
  daily:     'hub-daily',
  note:      'hub-xodus',
  upload:    'hub-obsidian',
  obsidian:  'hub-obsidian',
  system:    HUB_ID,
  school:    'hub-daily-goals',
  car:       'hub-daily',
  money:     'hub-daily',
  contact:   'hub-xodus',
  memory:    HUB_ID,
}

// ─── Layout computation ───────────────────────────────────────────────────────

export function computeLayout(data: BrainGraphData, w: number, h: number): PositionedNode[] {
  const cx = w / 2
  const cy = h / 2

  const positioned = new Map<string, { x: number; y: number }>()

  const domainNodes = data.nodes.filter(n => DOMAIN_IDS.has(n.id))
  const dataNodes   = data.nodes.filter(n => n.id !== HUB_ID && !DOMAIN_IDS.has(n.id))

  // Hub at center
  positioned.set(HUB_ID, { x: cx, y: cy })

  // Domain nodes evenly around a ring at r=135
  const domainR = 135
  domainNodes.forEach((node, i) => {
    const angle = (i / domainNodes.length) * 2 * Math.PI - Math.PI / 2
    positioned.set(node.id, {
      x: cx + Math.cos(angle) * domainR,
      y: cy + Math.sin(angle) * domainR,
    })
  })

  // Data nodes clustered near their domain
  const byDomain = new Map<string, BrainGraphNode[]>()
  for (const n of dataNodes) {
    const domainId = TYPE_TO_DOMAIN[n.type] ?? HUB_ID
    const list = byDomain.get(domainId) ?? []
    list.push(n)
    byDomain.set(domainId, list)
  }

  const dataR = 235
  for (const [domainId, nodes] of byDomain) {
    const domainPos = positioned.get(domainId) ?? { x: cx, y: cy }
    const baseAngle = Math.atan2(domainPos.y - cy, domainPos.x - cx)
    // Arc spread: smaller when more domain nodes exist (so clusters don't overlap)
    const arcSpread = (Math.PI * 1.4) / Math.max(domainNodes.length, 1)

    nodes.forEach((node, i) => {
      const t = nodes.length === 1 ? 0 : (i / (nodes.length - 1)) - 0.5
      const angle = baseAngle + t * arcSpread
      const r = dataR + (i % 2 === 0 ? 0 : 26)
      positioned.set(node.id, {
        x: Math.max(20, Math.min(w - 20, cx + Math.cos(angle) * r)),
        y: Math.max(20, Math.min(h - 20, cy + Math.sin(angle) * r)),
      })
    })
  }

  // Fallback: place unpositioned nodes near center
  return data.nodes.map((n, i) => {
    const pos = positioned.get(n.id) ?? {
      x: cx + Math.cos((i / data.nodes.length) * 2 * Math.PI) * 60,
      y: cy + Math.sin((i / data.nodes.length) * 2 * Math.PI) * 60,
    }
    return { ...n, ...pos }
  })
}

// ─── System nodes + edges (always present) ────────────────────────────────────

function makeNode(n: BrainGraphNode): BrainGraphNode {
  return { ...n, color: n.color ?? NODE_COLORS[n.type] }
}

function edge(source: string, target: string, type?: string, strength = 0.5): BrainGraphEdge {
  return { source, target, type, strength }
}

const SYSTEM_NODES: BrainGraphNode[] = [
  makeNode({ id: HUB_ID,            label: 'Picard OS',   type: 'system',    size: 22, source: 'system', summary: 'Personal operating system hub' }),
  makeNode({ id: 'hub-xodus',       label: 'XODUS',       type: 'xodus',     size: 16, source: 'system', summary: 'AI intelligence and intake layer' }),
  makeNode({ id: 'hub-fitness',     label: 'Fitness',     type: 'fitness',   size: 14, source: 'system', summary: 'Workouts, recovery, and body metrics' }),
  makeNode({ id: 'hub-nutrition',   label: 'Nutrition',   type: 'nutrition', size: 14, source: 'system', summary: 'Macros, calorie targets, and diet phase' }),
  makeNode({ id: 'hub-projects',    label: 'Projects',    type: 'project',   size: 14, source: 'system', summary: 'Active projects and tasks' }),
  makeNode({ id: 'hub-daily',       label: 'Daily',       type: 'daily',     size: 14, source: 'system', summary: 'Daily logs and metrics timeline' }),
  makeNode({ id: 'hub-whoop',       label: 'WHOOP',       type: 'system',    size: 12, source: 'system', summary: 'Wearable recovery and strain data' }),
  makeNode({ id: 'hub-daily-goals', label: 'Goals',       type: 'task',      size: 12, source: 'system', summary: 'Daily goal planning and intent capture' }),
  makeNode({ id: 'hub-obsidian',    label: 'Neural Vault',type: 'obsidian',  size: 12, source: 'system', summary: 'Obsidian-style knowledge vault (coming soon)' }),
]

const SYSTEM_EDGES: BrainGraphEdge[] = [
  edge(HUB_ID, 'hub-xodus',       'core', 1.0),
  edge(HUB_ID, 'hub-fitness',     'core', 0.9),
  edge(HUB_ID, 'hub-nutrition',   'core', 0.9),
  edge(HUB_ID, 'hub-projects',    'core', 0.9),
  edge(HUB_ID, 'hub-daily',       'core', 0.9),
  edge(HUB_ID, 'hub-whoop',       'core', 0.8),
  edge(HUB_ID, 'hub-daily-goals', 'core', 0.8),
  edge(HUB_ID, 'hub-obsidian',    'core', 0.7),
  // Cross-domain
  edge('hub-xodus',     'hub-daily-goals', 'semantic', 0.6),
  edge('hub-xodus',     'hub-projects',    'semantic', 0.5),
  edge('hub-xodus',     'hub-obsidian',    'semantic', 0.5),
  edge('hub-whoop',     'hub-daily',       'data',     0.7),
  edge('hub-whoop',     'hub-fitness',     'data',     0.8),
  edge('hub-nutrition', 'hub-daily',       'data',     0.6),
  edge('hub-fitness',   'hub-daily',       'data',     0.4),
]

// ─── Data builder ─────────────────────────────────────────────────────────────

export function buildBrainGraph(): BrainGraphData {
  const nodes: BrainGraphNode[] = [...SYSTEM_NODES]
  const edges: BrainGraphEdge[] = [...SYSTEM_EDGES]
  const seenIds = new Set(nodes.map(n => n.id))

  function addNode(n: BrainGraphNode) {
    if (seenIds.has(n.id)) return
    seenIds.add(n.id)
    nodes.push(makeNode(n))
  }
  function addEdge(e: BrainGraphEdge) {
    edges.push(e)
  }

  // localStorage is only available client-side
  if (typeof window === 'undefined') return { nodes, edges }

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = getProjects().filter(p => p.status === 'active').slice(0, 6)
  for (const p of projects) {
    const id = `project-${p.id}`
    addNode({ id, label: p.title, type: 'project', size: 10, summary: p.description || p.title, source: 'localStorage' })
    addEdge(edge('hub-projects', id, 'member', 0.8))
    // Add open tasks as child nodes (max 3 per project to avoid clutter)
    for (const t of p.tasks.filter(t => !t.done).slice(0, 3)) {
      const tid = `task-${t.id}`
      addNode({
        id: tid,
        label: t.text.length > 28 ? t.text.slice(0, 28) + '…' : t.text,
        type: 'task',
        size: 7,
        summary: t.text,
        source: 'localStorage',
      })
      addEdge(edge(id, tid, 'task', 0.6))
    }
  }

  // ── Daily logs (last 7 days) ───────────────────────────────────────────────
  const allLogs = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
  const logDates = Object.keys(allLogs).sort().reverse().slice(0, 7)
  for (const date of logDates) {
    const log = allLogs[date]
    const id  = `daily-${date}`
    const parts: string[] = []
    if (log.recoveryScore !== null) parts.push(`Recovery ${log.recoveryScore}`)
    if (log.protein !== null)       parts.push(`${log.protein}g protein`)
    if (log.calories !== null)      parts.push(`${log.calories} cal`)
    addNode({ id, label: date.slice(5), type: 'daily', size: 9, summary: parts.join(' · ') || 'Daily log', date, source: 'localStorage' })
    addEdge(edge('hub-daily', id, 'log', 0.7))
    if (log.recoveryScore !== null) addEdge(edge('hub-whoop',     id, 'data', 0.45))
    if (log.protein !== null)       addEdge(edge('hub-nutrition', id, 'data', 0.4))
    if (log.strain !== null)        addEdge(edge('hub-fitness',   id, 'data', 0.35))
  }

  // ── Activity logs (last 5) ────────────────────────────────────────────────
  const activities = getActivityLogs().slice(0, 5)
  for (const a of activities) {
    const id = `activity-${a.id}`
    const summary = [a.label || a.type, a.duration ? `${a.duration}min` : null].filter(Boolean).join(' · ')
    addNode({ id, label: a.label || a.type, type: 'fitness', size: 9, summary, date: a.date, source: 'localStorage' })
    addEdge(edge('hub-fitness', id, 'workout', 0.8))
    const dailyId = `daily-${a.date}`
    if (seenIds.has(dailyId)) addEdge(edge(id, dailyId, 'date', 0.35))
  }

  // ── Today's goals ─────────────────────────────────────────────────────────
  const goals = getTodayGoals().slice(0, 6)
  for (const g of goals) {
    const id    = `goal-${g.id}`
    const label = g.text.length > 26 ? g.text.slice(0, 26) + '…' : g.text
    const type: BrainNodeType =
      g.category === 'fitness'   ? 'fitness'
      : g.category === 'project' ? 'project'
      : g.category === 'school'  ? 'school'
      : 'task'
    addNode({ id, label, type, size: 7, summary: g.text + (g.done ? ' ✓' : ''), source: 'localStorage' })
    addEdge(edge('hub-daily-goals', id, 'goal', 0.7))
    if (g.category === 'fitness') addEdge(edge('hub-fitness', id, 'semantic', 0.35))
    if (g.category === 'project') addEdge(edge('hub-projects', id, 'semantic', 0.35))
  }

  // ── Voice logs (last 4) ───────────────────────────────────────────────────
  const voiceLogs = getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, []).slice(0, 4)
  for (const v of voiceLogs) {
    const id = `voice-${v.id}`
    const snippet = v.transcript.slice(0, 60) + (v.transcript.length > 60 ? '…' : '')
    addNode({ id, label: 'Voice Log', type: 'note', size: 8, summary: snippet, date: v.timestamp.slice(0, 10), source: 'localStorage' })
    addEdge(edge('hub-xodus', id, 'note', 0.6))
  }

  // ── XODUS notes (last 6) ─────────────────────────────────────────────────
  const xodusNotes = getRecentNotes(6)
  for (const n of xodusNotes) {
    const id = `xnote-${n.id}`
    const nodeType: BrainNodeType =
      n.category === 'grocery'  ? 'nutrition'
      : n.category === 'fitness' ? 'fitness'
      : n.category === 'school'  ? 'school'
      : n.category === 'project' ? 'project'
      : 'note'
    const label =
      n.category === 'grocery' ? 'Grocery note'
      : n.title ? n.title
      : 'XODUS note'
    const summary = n.body.length > 60 ? n.body.slice(0, 60) + '…' : n.body
    addNode({ id, label, type: nodeType, size: 8, summary, date: n.date, source: 'localStorage' })
    addEdge(edge('hub-xodus', id, 'note', 0.6))
    const dailyId = `daily-${n.date}`
    if (seenIds.has(dailyId)) addEdge(edge(id, dailyId, 'date', 0.3))
    const domainId = TYPE_TO_DOMAIN[nodeType]
    if (domainId && domainId !== 'hub-xodus') {
      addEdge(edge(domainId, id, 'semantic', 0.3))
    }
  }

  // ── Nutrition profile ──────────────────────────────────────────────────────
  const profile = getNutritionProfile()
  if (profile.proteinTarget || profile.calorieTarget) {
    addNode({
      id:      'nutrition-profile',
      label:   'Cut Profile',
      type:    'nutrition',
      size:    10,
      summary: `${profile.phase} · ${profile.proteinTarget ?? '?'}g protein · ${profile.calorieTarget ?? '?'} cal`,
      source:  'localStorage',
    })
    addEdge(edge('hub-nutrition', 'nutrition-profile', 'profile', 0.9))
    addEdge(edge('hub-xodus',     'nutrition-profile', 'context', 0.3))
  }

  // ── XODUS memory nodes (curated static records from memory/ files) ─────────
  const memoryRecords = getXodusMemoryRecords()
  for (const rec of memoryRecords) {
    addNode({
      id:               rec.id,
      label:            rec.title,
      type:             'memory',
      size:             11,
      summary:          rec.summary,
      source:           'memory',
      memoryCategory:   rec.category,
      memoryStatus:     rec.status,
      memoryConfidence: rec.confidence,
      memoryFilePath:   rec.filePath,
    })
    // Primary connections from graphLinks
    const links = rec.graphLinks ?? [HUB_ID]
    for (let i = 0; i < links.length; i++) {
      const targetId = links[i]
      const strength = i === 0 ? 0.8 : 0.45
      addEdge(edge(targetId, rec.id, 'memory', strength))
    }
  }

  return { nodes, edges }
}

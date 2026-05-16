// Staged XODUS memory imports — from external AI exports (ChatGPT, Claude, Gemini, …).
// These records live alongside the curated `lib/xodus/memory.ts` records but are
// kept in localStorage so the user can review/promote/clear without touching code.
//
// Storage key: picard_xodus_memory_imports_v1
// Source of first batch: exports/chatgpt-memory-import/xodus-memory-seed.json

export type XodusImportCategory =
  | 'identity'
  | 'fitness'
  | 'project'
  | 'preference'
  | 'workflow'
  | 'goal'
  | 'person'
  | 'backlog'
  | 'outdated'

export type XodusImportStatus = 'current' | 'needs_review' | 'paused' | 'outdated'
export type XodusImportConfidence = 'high' | 'medium' | 'low'

export interface XodusMemoryImport {
  id:         string
  category:   XodusImportCategory
  title:      string
  content:    string
  status:     XodusImportStatus
  confidence: XodusImportConfidence
  source:     string
  tags:       string[]
  links:      string[]
  importedAt?: string // ISO timestamp when this record entered local storage
}

export const XODUS_MEMORY_IMPORTS_KEY = 'picard_xodus_memory_imports_v1'

const VALID_CATEGORIES: ReadonlySet<XodusImportCategory> = new Set([
  'identity','fitness','project','preference','workflow','goal','person','backlog','outdated',
])
const VALID_STATUS: ReadonlySet<XodusImportStatus> = new Set(['current','needs_review','paused','outdated'])
const VALID_CONFIDENCE: ReadonlySet<XodusImportConfidence> = new Set(['high','medium','low'])

function isValidRecord(x: unknown): x is XodusMemoryImport {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.title === 'string' &&
    typeof r.content === 'string' &&
    typeof r.source === 'string' &&
    typeof r.category === 'string' && VALID_CATEGORIES.has(r.category as XodusImportCategory) &&
    typeof r.status === 'string' && VALID_STATUS.has(r.status as XodusImportStatus) &&
    typeof r.confidence === 'string' && VALID_CONFIDENCE.has(r.confidence as XodusImportConfidence) &&
    Array.isArray(r.tags) && r.tags.every(t => typeof t === 'string') &&
    Array.isArray(r.links) && r.links.every(t => typeof t === 'string')
  )
}

export interface ParseResult {
  ok: boolean
  records: XodusMemoryImport[]
  skipped: number
  error?: string
}

export function parseSeedJson(text: string): ParseResult {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch (e) {
    return { ok: false, records: [], skipped: 0, error: `Invalid JSON: ${(e as Error).message}` }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, records: [], skipped: 0, error: 'Seed file must be a JSON array of memory records.' }
  }
  const valid: XodusMemoryImport[] = []
  let skipped = 0
  for (const r of parsed) {
    if (isValidRecord(r)) valid.push(r)
    else skipped++
  }
  return { ok: valid.length > 0, records: valid, skipped }
}

export function getImportedRecords(): XodusMemoryImport[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(XODUS_MEMORY_IMPORTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidRecord)
  } catch {
    return []
  }
}

export function setImportedRecords(records: XodusMemoryImport[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(XODUS_MEMORY_IMPORTS_KEY, JSON.stringify(records))
  } catch {}
}

export function clearImportedRecords(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(XODUS_MEMORY_IMPORTS_KEY) } catch {}
}

export interface StatusBreakdown {
  total: number
  current: number
  needs_review: number
  paused: number
  outdated: number
}

export function statusBreakdown(records: readonly XodusMemoryImport[]): StatusBreakdown {
  const out: StatusBreakdown = { total: records.length, current: 0, needs_review: 0, paused: 0, outdated: 0 }
  for (const r of records) out[r.status]++
  return out
}

export interface MergeResult {
  added: number
  skipped: number // already imported by id
  ignoredByStatus: number // not 'current'
  total: number
  merged: XodusMemoryImport[]
}

/**
 * Merge incoming seed records into the existing import set, keeping only
 * `status === 'current'` for activation. needs_review / paused / outdated
 * records are also persisted so the user can see them, but they are not
 * eligible for "import current only" activation.
 */
export function importCurrentOnly(
  incoming: readonly XodusMemoryImport[],
  existing: readonly XodusMemoryImport[],
): MergeResult {
  const existingById = new Map(existing.map(r => [r.id, r]))
  const now = new Date().toISOString()
  let added = 0
  let skipped = 0
  let ignoredByStatus = 0
  for (const r of incoming) {
    if (r.status !== 'current') { ignoredByStatus++; continue }
    if (existingById.has(r.id)) { skipped++; continue }
    existingById.set(r.id, { ...r, importedAt: now })
    added++
  }
  return {
    added, skipped, ignoredByStatus,
    total: existingById.size,
    merged: [...existingById.values()],
  }
}

/**
 * Merge incoming non-current records (needs_review/paused/outdated) into the
 * existing set so they are visible in the UI. Never activates them.
 * De-duped by id; existing entries are left untouched.
 */
export function persistNonCurrentForVisibility(
  incoming: readonly XodusMemoryImport[],
  existing: readonly XodusMemoryImport[],
): XodusMemoryImport[] {
  const existingById = new Map(existing.map(r => [r.id, r]))
  for (const r of incoming) {
    if (r.status === 'current') continue
    if (!existingById.has(r.id)) existingById.set(r.id, r)
  }
  return [...existingById.values()]
}

/** Active (current-only) imports — the only subset XODUS should treat as live memory. */
export function getActiveCurrentImports(): XodusMemoryImport[] {
  return getImportedRecords().filter(r => r.status === 'current')
}

// ── Chat-context snapshot ───────────────────────────────────────────────────
// Compact, prompt-ready view used by the XODUS chat context gatherer.
// Only `status==='current'` records are surfaced as active truth. Non-current
// records contribute only a single "avoid overemphasizing" line (titles only).

export interface ImportedMemorySnapshotItem {
  category: string
  title:    string
  content:  string
}

export interface ImportedMemorySnapshot {
  current:        ImportedMemorySnapshotItem[]
  inactiveCount:  number
  avoidSummary?:  string
}

const SNAPSHOT_MAX_CURRENT = 30 // soft cap — the active seed is ≤30 today
const SNAPSHOT_CONTENT_CAP = 140

function compact(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/**
 * Build a prompt-ready snapshot of imported memory. Returns `null` when no
 * records are imported — callers can omit the section entirely in that case.
 */
export function buildImportedMemorySnapshot(): ImportedMemorySnapshot | null {
  if (typeof window === 'undefined') return null
  const all = getImportedRecords()
  if (all.length === 0) return null

  const current = all
    .filter(r => r.status === 'current')
    .slice(0, SNAPSHOT_MAX_CURRENT)
    .map(r => ({
      category: r.category,
      title:    compact(r.title, 80),
      content:  compact(r.content, SNAPSHOT_CONTENT_CAP),
    }))

  const inactive = all.filter(r => r.status !== 'current')
  const inactiveCount = inactive.length

  let avoidSummary: string | undefined
  if (inactive.length > 0) {
    const labels = inactive
      .slice(0, 8)
      .map(r => `${r.title} (${r.status})`)
    avoidSummary = compact(labels.join('; '), 240)
  }

  return { current, inactiveCount, avoidSummary }
}


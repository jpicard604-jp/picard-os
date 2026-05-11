// Phase 1: client-side fire-and-forget sync to Supabase via /api/sync.
// localStorage remains the primary source of truth. Errors are logged, never thrown.
import type { DailyLog, VoiceLog } from '@/lib/storage'
import type { ActivityLog } from '@/lib/fitness'
import type { Project } from '@/lib/projects'

function isSyncEnabled(): boolean {
  return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_SUPABASE_URL
}

async function postSync(type: string, payload: unknown): Promise<void> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  })
  if (!res.ok) console.warn(`[sync] ${type} responded ${res.status}`)
}

export function syncDailyLog(log: DailyLog): void {
  if (!isSyncEnabled()) return
  postSync('daily_log', log).catch((e) => console.warn('[sync] daily_log:', e))
}

export function syncVoiceLog(log: VoiceLog): void {
  if (!isSyncEnabled()) return
  postSync('voice_log', log).catch((e) => console.warn('[sync] voice_log:', e))
}

export function syncActivityLog(entry: ActivityLog): void {
  if (!isSyncEnabled()) return
  postSync('activity_log', entry).catch((e) => console.warn('[sync] activity_log:', e))
}

export function syncProjects(projects: Project[]): void {
  if (!isSyncEnabled()) return
  postSync('projects', projects).catch((e) => console.warn('[sync] projects:', e))
}

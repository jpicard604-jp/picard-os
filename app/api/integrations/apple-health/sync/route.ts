// Apple Health sync endpoint.
//
// POST shapes accepted:
//   Shortcut MVP: { source: "apple_health_shortcut", raw: "5676 count Today, 7:17 AM" }
//   Full envelope: { schemaVersion: 1, daily: { date, source, syncedAt, steps?, ... } }
//
// Auth: X-AH-Secret header must match APPLE_HEALTH_SYNC_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateDailySync, mapAppleHealthToDailyPatch, mapAppleHealthWorkoutToActivity } from '@/lib/apple-health/map'
import { saveXodusInboxItem } from '@/lib/xodus/inbox-server'
import type { AppleHealthSyncEnvelope } from '@/lib/apple-health/types'

const USER_ID = process.env.PICARD_USER_ID ?? '00000000-0000-0000-0000-000000000001'
const META_KEY = 'apple_health_last_sync'

function authorized(req: NextRequest): boolean {
  const expected = process.env.APPLE_HEALTH_SYNC_SECRET
  if (!expected) return false
  return req.headers.get('x-ah-secret') === expected
}

// ─── GET — connection status ──────────────────────────────────────────────────

export async function GET() {
  if (!process.env.APPLE_HEALTH_SYNC_SECRET) {
    return NextResponse.json({ connected: false, reason: 'not_configured' })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ connected: false, reason: 'no_supabase' })
  }
  try {
    const { data, error } = await createAdminClient()
      .from('integration_meta')
      .select('value, updated_at')
      .eq('user_id', USER_ID)
      .eq('key', META_KEY)
      .maybeSingle()
    if (error?.code === '42P01') return NextResponse.json({ connected: false, reason: 'table_missing', lastSync: null })
    const row = data as { value: string; updated_at: string } | null
    return NextResponse.json({ connected: !!row, lastSync: row?.updated_at ?? null, reason: row ? 'ok' : 'not_synced_yet' })
  } catch {
    return NextResponse.json({ connected: false, reason: 'error', lastSync: null })
  }
}

// ─── POST — ingest ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  if (!authorized(req)) {
    return NextResponse.json(
      { synced: false, reason: 'unauthorized', note: 'Send X-AH-Secret header matching APPLE_HEALTH_SYNC_SECRET.' },
      { status: 401 },
    )
  }

  // 2. Parse body — never throw
  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ synced: false, reason: 'invalid_json' }, { status: 400 })
  }
  if (typeof raw !== 'object' || raw === null) {
    return NextResponse.json({ synced: false, reason: 'missing_body' }, { status: 400 })
  }
  const body = raw as Record<string, unknown>

  // 3. Shortcut path — runs BEFORE any schema validation, no daily required.
  //    Detect by source string OR by presence of raw without daily.
  const srcStr = typeof body.source === 'string' ? body.source.trim().toLowerCase() : ''
  const rawStr = typeof body.raw === 'string' ? body.raw.trim() : ''
  const isShortcut = srcStr === 'apple_health_shortcut' || (rawStr.length > 0 && !body.daily)

  if (isShortcut) {
    return handleShortcut(body, rawStr)
  }

  // 4. Full HealthKit envelope path
  // Normalize schemaVersion: Shortcuts may send "1" (string) — coerce before validating.
  if ('schemaVersion' in body) body.schemaVersion = Number(body.schemaVersion)

  const err = validateDailySync(body)
  if (err) {
    return NextResponse.json(
      { synced: false, reason: 'validation_failed', error: err, note: 'For Shortcut, send { source: "apple_health_shortcut", raw: "5676 count Today, 7:17 AM" }' },
      { status: 400 },
    )
  }

  return handleFullEnvelope(body as unknown as AppleHealthSyncEnvelope)
}

// ─── Shortcut handler ─────────────────────────────────────────────────────────

async function handleShortcut(body: Record<string, unknown>, rawStr: string): Promise<NextResponse> {
  // Extract steps: try daily.steps first, then parse first integer from raw.
  let steps: number | null = null

  const dailyObj = body.daily
  if (dailyObj !== null && typeof dailyObj === 'object') {
    const n = Number((dailyObj as Record<string, unknown>).steps)
    if (Number.isFinite(n) && n > 0) steps = Math.round(n)
  }

  if (!steps && rawStr) {
    const m = rawStr.match(/\d+/)
    if (m) steps = parseInt(m[0], 10)
  }

  if (!steps || steps <= 0 || steps > 150_000) {
    return NextResponse.json(
      { synced: false, reason: 'no_steps', note: 'Provide raw with a step count or daily.steps.', received: { raw: body.raw ?? null, daily: body.daily ?? null } },
      { status: 400 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  console.log(`[apple-health/shortcut] steps:${steps} date:${today}`)

  // Queue in xodus_inbox so /signals can apply to localStorage (non-fatal).
  await saveXodusInboxItem({
    source:        'shortcut',
    text:          `Apple Health: ${steps.toLocaleString()} steps`,
    parsedSummary: `Logged ${steps.toLocaleString()} steps from Apple Health Shortcut.`,
    actions:       [{ type: 'log_manual_health', steps, date: today, confidence: 0.95 }],
  }).catch(() => undefined)

  // Best-effort Supabase upsert.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const db = createAdminClient()
      const { data: row, error: selErr } = await db
        .from('daily_logs').select('id').eq('user_id', USER_ID).eq('date', today).maybeSingle()
      if (!selErr) {
        if (row) {
          await db.from('daily_logs').update({ steps }).eq('user_id', USER_ID).eq('date', today)
        } else {
          await db.from('daily_logs').insert({ user_id: USER_ID, date: today, steps, smoked_today: false, drank_today: false, notes: '', saved_at: new Date().toISOString() })
        }
      }
      await db.from('integration_meta').upsert(
        { user_id: USER_ID, key: META_KEY, value: JSON.stringify({ date: today, steps, source: 'apple_health_shortcut' }), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      )
    } catch (e) {
      console.error('[apple-health/shortcut] supabase write failed (non-fatal):', e)
    }
  }

  return NextResponse.json({ synced: true, steps })
}

// ─── Full envelope handler ────────────────────────────────────────────────────

async function handleFullEnvelope(env: AppleHealthSyncEnvelope): Promise<NextResponse> {
  const daily    = env.daily
  const supabase = createAdminClient()
  const { date, patch } = mapAppleHealthToDailyPatch(daily)

  try {
    const { data: existing, error: selErr } = await supabase
      .from('daily_logs').select('id').eq('user_id', USER_ID).eq('date', date).maybeSingle()

    if (selErr?.code === '42P01') {
      return NextResponse.json({ synced: false, reason: 'table_missing', sql: 'Run docs/supabase-phase1-schema.sql' }, { status: 503 })
    }

    if (existing) {
      if (Object.keys(patch).length > 0) {
        await supabase.from('daily_logs').update(patch).eq('user_id', USER_ID).eq('date', date)
      }
    } else {
      await supabase.from('daily_logs').insert({ user_id: USER_ID, date, ...patch, smoked_today: false, drank_today: false, notes: '', saved_at: new Date().toISOString() })
    }
  } catch (e) {
    console.error('[apple-health/sync] daily_logs upsert failed:', e)
    return NextResponse.json({ synced: false, reason: 'daily_logs_failed' }, { status: 500 })
  }

  let workoutsAdded = 0
  for (const w of daily.workouts ?? []) {
    try {
      const { data: existing } = await supabase
        .from('activity_logs').select('id').eq('user_id', USER_ID).eq('external_id', w.externalId).maybeSingle()
      if (!existing) {
        const row = mapAppleHealthWorkoutToActivity(w)
        await supabase.from('activity_logs').insert({ id: crypto.randomUUID(), user_id: USER_ID, ...row, created_at: new Date().toISOString() })
        workoutsAdded++
      }
    } catch (e) {
      console.error('[apple-health/sync] workout insert failed:', w.externalId, e)
    }
  }

  try {
    await supabase.from('integration_meta').upsert(
      { user_id: USER_ID, key: META_KEY, value: JSON.stringify({ date, fields: Object.keys(patch), workoutsAdded }), updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    )
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ synced: true, date, fieldsPatched: Object.keys(patch), workoutsAdded })
}

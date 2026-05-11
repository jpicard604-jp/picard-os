// Apple Health ingestion endpoint.
//
// Two accepted POST formats:
//
//   1. iOS Shortcut (MVP):
//      { "source": "apple_health_shortcut", "raw": "5676 count Today, 7:17 AM" }
//      Steps are parsed from the first integer in `raw`. Result is queued in
//      xodus_inbox so the /signals UI can apply them to localStorage.
//
//   2. Full HealthKit envelope (future companion app):
//      { "schemaVersion": 1, "daily": { ... } }
//      See lib/apple-health/types.ts for the full schema.
//
// Auth: requires X-AH-Secret header matching APPLE_HEALTH_SYNC_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  validateDailySync,
  mapAppleHealthToDailyPatch,
  mapAppleHealthWorkoutToActivity,
} from '@/lib/apple-health/map'
import { saveXodusInboxItem } from '@/lib/xodus/inbox-server'
import type { AppleHealthSyncEnvelope } from '@/lib/apple-health/types'

const USER_ID    = process.env.PICARD_USER_ID || '00000000-0000-0000-0000-000000000001'
const META_KEY   = 'apple_health_last_sync'

function authorized(req: NextRequest): boolean {
  const expected = process.env.APPLE_HEALTH_SYNC_SECRET
  if (!expected) return false
  const got = req.headers.get('x-ah-secret')
  return !!got && got === expected
}

// ─── GET — connection / last-sync status ─────────────────────────────────────

export async function GET() {
  const configured = !!process.env.APPLE_HEALTH_SYNC_SECRET
  if (!configured) {
    return NextResponse.json({
      connected: false,
      reason:    'not_configured',
      note:      'Set APPLE_HEALTH_SYNC_SECRET in env and send X-AH-Secret header from Shortcut.',
    })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({
      connected: false,
      reason:    'no_supabase',
      note:      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to enable status tracking.',
    })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('integration_meta')
      .select('value, updated_at')
      .eq('user_id', USER_ID)
      .eq('key', META_KEY)
      .maybeSingle()

    if (error?.code === '42P01') {
      return NextResponse.json({ connected: false, reason: 'table_missing', lastSync: null })
    }
    const row = data as { value: string; updated_at: string } | null
    return NextResponse.json({
      connected: !!row,
      lastSync:  row?.updated_at ?? null,
      reason:    row ? 'ok' : 'not_synced_yet',
    })
  } catch (err) {
    console.error('[apple-health/sync:GET]', err)
    return NextResponse.json({ connected: false, reason: 'error', lastSync: null })
  }
}

// ─── Shortcut branch ──────────────────────────────────────────────────────────
//
// Accepts all three iOS Shortcut payload shapes:
//   A: { source, raw: "5676 count Today, 7:17 AM" }
//   B: { source, daily: { steps: 5676 } }
//   C: { source, daily: { steps: "5676" } }   ← Shortcuts stringify numbers
//
// Precedence: daily.steps → raw (first integer).
// Queues a log_manual_health action in xodus_inbox (apply from /signals).
// Best-effort Supabase write for the future data-layer migration.

async function handleShortcut(body: Record<string, unknown>): Promise<NextResponse> {
  // Try daily.steps (shape B / C) first; fall back to raw (shape A).
  let steps: number | null = null

  const daily = body.daily
  if (daily !== null && typeof daily === 'object') {
    const rawSteps = (daily as Record<string, unknown>).steps
    const n = Number(rawSteps)
    if (Number.isFinite(n) && n > 0) steps = Math.round(n)
  }

  if (!steps) {
    const raw   = typeof body.raw === 'string' ? body.raw.trim() : ''
    const match = raw.match(/\d+/)
    if (match) steps = parseInt(match[0], 10)
  }

  if (!steps || steps <= 0 || steps > 150_000) {
    return NextResponse.json(
      {
        synced: false,
        reason: 'no_steps',
        note:   'Send daily.steps (number or string) or raw starting with a step count.',
        received: { daily: body.daily ?? null, raw: body.raw ?? null },
      },
      { status: 400 },
    )
  }

  const todayDate = new Date().toISOString().slice(0, 10)
  console.log(`[apple-health/shortcut] steps:${steps} date:${todayDate}`)

  // Queue in xodus_inbox → user applies from /signals (writes localStorage).
  await saveXodusInboxItem({
    source:        'shortcut',
    text:          `Apple Health: ${steps.toLocaleString()} steps`,
    parsedSummary: `Logged ${steps.toLocaleString()} steps from Apple Health Shortcut.`,
    actions:       [{ type: 'log_manual_health', steps, date: todayDate, confidence: 0.95 }],
  }).catch(() => { /* non-fatal — inbox may not be configured */ })

  // Best-effort Supabase write (for future Supabase data layer migration).
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const supabase = createAdminClient()
      const { data: existing, error: selectErr } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('date',    todayDate)
        .maybeSingle()

      if (!selectErr) {
        if (existing) {
          await supabase.from('daily_logs').update({ steps }).eq('user_id', USER_ID).eq('date', todayDate)
        } else {
          await supabase.from('daily_logs').insert({
            user_id: USER_ID, date: todayDate, steps,
            smoked_today: false, drank_today: false, notes: '',
            saved_at: new Date().toISOString(),
          })
        }
      }

      // Record sync timestamp so GET shows connected: true.
      await supabase.from('integration_meta').upsert(
        {
          user_id:    USER_ID,
          key:        META_KEY,
          value:      JSON.stringify({ date: todayDate, steps, source: 'apple_health_shortcut' }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      )
    } catch (err) {
      console.error('[apple-health/shortcut] supabase write failed (non-fatal):', err)
    }
  }

  return NextResponse.json({ synced: true, steps, source: 'apple_health_shortcut' })
}

// ─── POST — ingest ────────────────────────────────────────────────────────────

function isShortcutPayload(b: Record<string, unknown>): boolean {
  // Trim + lowercase so no whitespace or case variation causes a miss.
  const src = typeof b.source === 'string' ? b.source.trim().toLowerCase() : ''
  if (src === 'apple_health_shortcut') return true
  // Also catch payload if raw is present but source is missing (belt+suspenders).
  if (typeof b.raw === 'string' && b.raw.trim().length > 0 && !b.daily) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        synced: false,
        reason: 'unauthorized',
        note:   'Send X-AH-Secret header matching APPLE_HEALTH_SYNC_SECRET env var.',
      },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { synced: false, reason: 'invalid_json', note: 'Body must be valid JSON.' },
      { status: 400 },
    )
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ synced: false, reason: 'missing_body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  // ── Shortcut path — checked FIRST, before any schema validation ──────────────
  // Handles: { source: "apple_health_shortcut", raw: "5676 count Today, 7:17 AM" }
  // daily is NOT required for shortcut payloads.
  if (isShortcutPayload(b)) {
    return handleShortcut(b)
  }

  // ── Full envelope: { schemaVersion: 1, daily: { ... } } ─────────────────────
  // Normalize schemaVersion string→number for any non-shortcut envelope payloads.
  if ('schemaVersion' in b) b.schemaVersion = Number(b.schemaVersion)

  const validationError = validateDailySync(body)
  if (validationError) {
    return NextResponse.json(
      {
        synced: false,
        reason: 'validation_failed',
        error:  validationError,
        note:   'For iOS Shortcut, send { "source": "apple_health_shortcut", "raw": "5676 count Today, 7:17 AM" }',
      },
      { status: 400 },
    )
  }

  const env      = body as AppleHealthSyncEnvelope
  const daily    = env.daily
  const supabase = createAdminClient()

  // ── Upsert daily_logs ────────────────────────────────────────────────────────
  const { date, patch } = mapAppleHealthToDailyPatch(daily)

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('date', date)
      .maybeSingle()

    if (selectErr?.code === '42P01') {
      return NextResponse.json(
        { synced: false, reason: 'table_missing', sql: 'Run docs/supabase-phase1-schema.sql' },
        { status: 503 },
      )
    }

    if (existing) {
      if (Object.keys(patch).length > 0) {
        await supabase.from('daily_logs').update(patch).eq('user_id', USER_ID).eq('date', date)
      }
    } else {
      await supabase.from('daily_logs').insert({
        user_id: USER_ID, date, ...patch,
        smoked_today: false, drank_today: false, notes: '',
        saved_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[apple-health/sync] daily_logs upsert failed:', err)
    return NextResponse.json({ synced: false, reason: 'daily_logs_failed' }, { status: 500 })
  }

  // ── Workouts — dedupe by external_id ────────────────────────────────────────
  let workoutsAdded = 0
  for (const w of daily.workouts ?? []) {
    try {
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('external_id', w.externalId)
        .maybeSingle()

      if (!existing) {
        const row = mapAppleHealthWorkoutToActivity(w)
        await supabase.from('activity_logs').insert({
          id: crypto.randomUUID(), user_id: USER_ID, ...row,
          created_at: new Date().toISOString(),
        })
        workoutsAdded++
      }
    } catch (err) {
      console.error('[apple-health/sync] workout insert failed:', w.externalId, err)
    }
  }

  // ── Record sync timestamp ────────────────────────────────────────────────────
  try {
    await supabase.from('integration_meta').upsert(
      {
        user_id:    USER_ID,
        key:        META_KEY,
        value:      JSON.stringify({ date, fields: Object.keys(patch), workoutsAdded }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    )
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ synced: true, date, fieldsPatched: Object.keys(patch), workoutsAdded })
}

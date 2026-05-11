// Apple Health ingestion endpoint.
//
// Receives normalized HealthKit daily data from:
//   - an iOS Shortcut (Phase 1 MVP) that POSTs JSON via the "Get contents of URL" action
//   - a future Capacitor/iOS companion app reading HealthKit and POSTing nightly
//
// Auth (Phase 1 — single-user, no Supabase Auth yet):
//   Requires `X-AH-Secret` header to match APPLE_HEALTH_SYNC_SECRET env var.
//   This is enforced server-side and is the only mutation guard until full auth lands.
//
// Source precedence: see lib/apple-health/map.ts — only fields with concrete values
// are written; manual entries and WHOOP-owned columns are never overwritten.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  validateDailySync,
  mapAppleHealthToDailyPatch,
  mapAppleHealthWorkoutToActivity,
} from '@/lib/apple-health/map'
import type { AppleHealthSyncEnvelope } from '@/lib/apple-health/types'

const USER_ID = process.env.PICARD_USER_ID || '00000000-0000-0000-0000-000000000001'
const META_KEY_NAME = 'apple_health_last_sync'

function authorized(req: NextRequest): boolean {
  const expected = process.env.APPLE_HEALTH_SYNC_SECRET
  if (!expected) return false
  const got = req.headers.get('x-ah-secret')
  return !!got && got === expected
}

/* ─── GET — connection status ───────────────────────────────────────────────── */
export async function GET() {
  // Phase 1: no token table. Report whether the env secret is configured and
  // when we last successfully ingested a payload.
  const configured = !!process.env.APPLE_HEALTH_SYNC_SECRET
  if (!configured) {
    return NextResponse.json({
      connected: false,
      reason: 'not_configured',
      note: 'Set APPLE_HEALTH_SYNC_SECRET in env to enable ingestion',
    })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('integration_meta')
      .select('value, updated_at')
      .eq('user_id', USER_ID)
      .eq('key', META_KEY_NAME)
      .maybeSingle()

    // Table-missing is expected until migration runs; treat as planned.
    if (error?.code === '42P01') {
      return NextResponse.json({
        connected: false,
        reason: 'table_missing',
        note: 'integration_meta table not created yet — see docs/apple-health-integration-plan.md § Supabase schema',
      })
    }

    const row = data as { value: string; updated_at: string } | null
    return NextResponse.json({
      connected: !!row,
      lastSync:  row?.updated_at ?? null,
      reason:    row ? 'ok' : 'not_synced_yet',
    })
  } catch (err) {
    console.error('[apple-health/sync:GET] threw', err)
    return NextResponse.json({ connected: false, reason: 'error' })
  }
}

/* ─── POST — ingest one day of HealthKit data ───────────────────────────────── */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ synced: false, reason: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ synced: false, reason: 'invalid_json' }, { status: 400 })
  }

  const validationError = validateDailySync(body)
  if (validationError) {
    return NextResponse.json({ synced: false, reason: 'validation_failed', error: validationError }, { status: 400 })
  }

  const env     = body as AppleHealthSyncEnvelope
  const daily   = env.daily
  const supabase = createAdminClient()

  // ── Upsert daily_logs (patch only fields with values) ─────────────────────
  const { date, patch } = mapAppleHealthToDailyPatch(daily)

  try {
    const { data: existingRow, error: existingErr } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('date', date)
      .maybeSingle()

    if (existingErr?.code === '42P01') {
      return NextResponse.json(
        { synced: false, reason: 'table_missing', sql: 'Run docs/supabase-phase1-schema.sql' },
        { status: 503 }
      )
    }

    if (existingRow) {
      if (Object.keys(patch).length > 0) {
        await supabase.from('daily_logs').update(patch).eq('user_id', USER_ID).eq('date', date)
      }
    } else {
      await supabase.from('daily_logs').insert({
        user_id:      USER_ID,
        date,
        ...patch,
        smoked_today: false,
        drank_today:  false,
        notes:        '',
        saved_at:     new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[apple-health/sync] daily_logs upsert failed:', err)
    return NextResponse.json({ synced: false, reason: 'daily_logs_failed' }, { status: 500 })
  }

  // ── Workouts — dedupe by (user_id, external_id) ───────────────────────────
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
          id:         crypto.randomUUID(),
          user_id:    USER_ID,
          ...row,
          created_at: new Date().toISOString(),
        })
        workoutsAdded++
      }
    } catch (err) {
      console.error('[apple-health/sync] workout upsert failed:', w.externalId, err)
    }
  }

  // ── Record sync timestamp in integration_meta (best-effort) ───────────────
  try {
    await supabase.from('integration_meta').upsert(
      {
        user_id:    USER_ID,
        key:        META_KEY_NAME,
        value:      JSON.stringify({ date, fields: Object.keys(patch), workoutsAdded }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    )
  } catch {
    // table may not exist yet — non-fatal, GET will report 'table_missing'
  }

  return NextResponse.json({
    synced: true,
    date,
    fieldsPatched: Object.keys(patch),
    workoutsAdded,
  })
}

// Apple Health sync — v5 2026-05-11
// Shortcut payload: { source: "apple_health_shortcut", raw: "5676 count Today, 7:17 AM" }
// Full envelope:    { schemaVersion: 1, daily: { date, source, syncedAt, steps?, ... } }
// Auth: X-AH-Secret header must match APPLE_HEALTH_SYNC_SECRET env var.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateDailySync, mapAppleHealthToDailyPatch, mapAppleHealthWorkoutToActivity } from '@/lib/apple-health/map'
import { saveXodusInboxItem } from '@/lib/xodus/inbox-server'
import type { AppleHealthSyncEnvelope } from '@/lib/apple-health/types'

const USER_ID = process.env.PICARD_USER_ID ?? '00000000-0000-0000-0000-000000000001'
const META_KEY = 'apple_health_last_sync'
const ROUTE_VERSION = 'v5'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  if (!process.env.APPLE_HEALTH_SYNC_SECRET) {
    return NextResponse.json({ connected: false, reason: 'not_configured', version: ROUTE_VERSION })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ connected: false, reason: 'no_supabase', version: ROUTE_VERSION })
  }
  try {
    const { data, error } = await createAdminClient()
      .from('integration_meta').select('value, updated_at')
      .eq('user_id', USER_ID).eq('key', META_KEY).maybeSingle()
    if (error?.code === '42P01') return NextResponse.json({ connected: false, reason: 'table_missing', lastSync: null, version: ROUTE_VERSION })
    const row = data as { value: string; updated_at: string } | null
    return NextResponse.json({ connected: !!row, lastSync: row?.updated_at ?? null, reason: row ? 'ok' : 'not_synced_yet', version: ROUTE_VERSION })
  } catch {
    return NextResponse.json({ connected: false, reason: 'error', lastSync: null, version: ROUTE_VERSION })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log(`[apple-health/${ROUTE_VERSION}] POST entered`)
  try {
    // Auth
    const expected = process.env.APPLE_HEALTH_SYNC_SECRET
    if (!expected || req.headers.get('x-ah-secret') !== expected) {
      console.log(`[apple-health/${ROUTE_VERSION}] unauthorized — header_present:${!!req.headers.get('x-ah-secret')} env_set:${!!expected}`)
      return NextResponse.json({ synced: false, reason: 'unauthorized', version: ROUTE_VERSION }, { status: 401 })
    }

    // Parse JSON
    let body: Record<string, unknown>
    try {
      const parsed = await req.json()
      if (typeof parsed !== 'object' || parsed === null) throw new Error('not object')
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ synced: false, reason: 'invalid_json', version: ROUTE_VERSION }, { status: 400 })
    }

    // ── SHORTCUT PATH ─────────────────────────────────────────────────────────
    // Triggered when source === "apple_health_shortcut" (any case, trimmed).
    // daily is NOT required. Steps extracted from raw string.
    const source = typeof body.source === 'string' ? body.source.trim().toLowerCase() : ''
    const rawField = typeof body.raw === 'string' ? body.raw.trim() : ''

    console.log(`[apple-health/${ROUTE_VERSION}] body parsed — source:"${source}" hasRaw:${!!rawField} hasDaily:${!!body.daily}`)

    if (source === 'apple_health_shortcut' || (rawField && !body.daily)) {
      console.log(`[apple-health/${ROUTE_VERSION}] shortcut branch — parsing raw`)
      // Extract steps from raw field
      const match = rawField.match(/\d+/)
      const steps = match ? parseInt(match[0], 10) : 0
      console.log(`[apple-health/${ROUTE_VERSION}] parsed steps:${steps} from raw`)

      if (!steps || steps <= 0 || steps > 150_000) {
        return NextResponse.json({
          synced: false, reason: 'no_steps', version: ROUTE_VERSION,
          note: 'raw must contain a step count, e.g. "5676 count Today, 7:17 AM"',
          received: { source: body.source, raw: body.raw },
        }, { status: 400 })
      }

      const today = new Date().toISOString().slice(0, 10)
      console.log(`[apple-health/${ROUTE_VERSION}] shortcut steps:${steps} date:${today}`)

      // Queue in xodus_inbox (non-fatal — inbox may not be configured yet)
      try {
        await saveXodusInboxItem({
          source: 'shortcut',
          text: `Apple Health: ${steps.toLocaleString()} steps`,
          parsedSummary: `${steps.toLocaleString()} steps logged from Apple Health Shortcut.`,
          actions: [{ type: 'log_manual_health', steps, date: today, confidence: 0.95 }],
        })
      } catch { /* non-fatal */ }

      // Supabase upsert (non-fatal — tables may not exist yet)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
        try {
          const db = createAdminClient()
          const { data: existing } = await db.from('daily_logs').select('id')
            .eq('user_id', USER_ID).eq('date', today).maybeSingle()
          if (existing) {
            await db.from('daily_logs').update({ steps }).eq('user_id', USER_ID).eq('date', today)
          } else {
            await db.from('daily_logs').insert({
              user_id: USER_ID, date: today, steps,
              smoked_today: false, drank_today: false, notes: '',
              saved_at: new Date().toISOString(),
            })
          }
          await db.from('integration_meta').upsert(
            { user_id: USER_ID, key: META_KEY, value: JSON.stringify({ date: today, steps, source: 'apple_health_shortcut' }), updated_at: new Date().toISOString() },
            { onConflict: 'user_id,key' },
          )
        } catch (e) {
          console.error(`[apple-health/${ROUTE_VERSION}] supabase non-fatal:`, e)
        }
      }

      console.log(`[apple-health/${ROUTE_VERSION}] shortcut success — returning synced:true`)
      return NextResponse.json({ synced: true, steps, source: 'apple_health_shortcut', version: ROUTE_VERSION })
    }

    // ── FULL ENVELOPE PATH ────────────────────────────────────────────────────
    console.log(`[apple-health/${ROUTE_VERSION}] full-envelope branch — running validateDailySync`)
    if ('schemaVersion' in body) body.schemaVersion = Number(body.schemaVersion)

    const validErr = validateDailySync(body)
    if (validErr) {
      return NextResponse.json({
        synced: false, reason: 'validation_failed', error: validErr, version: ROUTE_VERSION,
        note: 'For Shortcut: send { source: "apple_health_shortcut", raw: "5676 count Today, 7:17 AM" }',
      }, { status: 400 })
    }

    const env = body as unknown as AppleHealthSyncEnvelope
    const daily = env.daily
    const db = createAdminClient()
    const { date, patch } = mapAppleHealthToDailyPatch(daily)

    const { data: existing, error: selErr } = await db.from('daily_logs').select('id')
      .eq('user_id', USER_ID).eq('date', date).maybeSingle()
    if (selErr?.code === '42P01') {
      return NextResponse.json({ synced: false, reason: 'table_missing', version: ROUTE_VERSION }, { status: 503 })
    }
    if (existing) {
      if (Object.keys(patch).length > 0) await db.from('daily_logs').update(patch).eq('user_id', USER_ID).eq('date', date)
    } else {
      await db.from('daily_logs').insert({ user_id: USER_ID, date, ...patch, smoked_today: false, drank_today: false, notes: '', saved_at: new Date().toISOString() })
    }

    let workoutsAdded = 0
    for (const w of daily.workouts ?? []) {
      try {
        const { data: ew } = await db.from('activity_logs').select('id').eq('user_id', USER_ID).eq('external_id', w.externalId).maybeSingle()
        if (!ew) {
          const row = mapAppleHealthWorkoutToActivity(w)
          await db.from('activity_logs').insert({ id: crypto.randomUUID(), user_id: USER_ID, ...row, created_at: new Date().toISOString() })
          workoutsAdded++
        }
      } catch { /* skip bad workout */ }
    }

    try {
      await db.from('integration_meta').upsert(
        { user_id: USER_ID, key: META_KEY, value: JSON.stringify({ date, fields: Object.keys(patch), workoutsAdded }), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      )
    } catch { /* non-fatal */ }

    return NextResponse.json({ synced: true, date, fieldsPatched: Object.keys(patch), workoutsAdded, version: ROUTE_VERSION })

  } catch (e) {
    console.error(`[apple-health/${ROUTE_VERSION}] unhandled:`, e)
    return NextResponse.json({ synced: false, reason: 'internal_error', version: ROUTE_VERSION }, { status: 500 })
  }
}

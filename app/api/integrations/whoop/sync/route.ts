import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  refreshWhoopToken,
  fetchLatestRecovery,
  fetchLatestCycle,
  fetchLatestSleep,
  fetchTodayWorkouts,
  fetchBodyMeasurements,
} from '@/lib/whoop/client'
import { mapToWhoopDailySync, mapWorkoutToSync, whoopSportToActivityType } from '@/lib/whoop/map'

const USER_ID = process.env.PICARD_USER_ID || '00000000-0000-0000-0000-000000000001'

interface TokenRow {
  access_token: string
  refresh_token: string
  expires_at: string
  updated_at: string
}

/* ─── GET — connection status ───────────────────────────────────────────────── */
export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('whoop_tokens')
      .select('user_id, updated_at')
      .eq('user_id', USER_ID)
      .maybeSingle()

    if (error?.code === '42P01') {
      console.log('[whoop/sync:GET]', { connected: false, reason: 'table_missing' })
      return NextResponse.json({ connected: false, reason: 'table_missing' })
    }
    if (error) {
      console.log('[whoop/sync:GET]', { connected: false, reason: 'db_error', code: error.code })
      return NextResponse.json({ connected: false, reason: 'db_error' })
    }
    const row = data as unknown as { updated_at: string } | null
    const result = { connected: !!row, lastSync: row?.updated_at ?? null, reason: row ? 'ok' : 'not_connected' }
    console.log('[whoop/sync:GET]', { connected: result.connected, reason: result.reason })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[whoop/sync:GET] threw', { error: String(err) })
    return NextResponse.json({ connected: false, reason: 'error' })
  }
}

/* ─── POST — full sync ──────────────────────────────────────────────────────── */
export async function POST() {
  const supabase = createAdminClient()

  // Load tokens
  const { data: rawToken, error: tokenError } = await supabase
    .from('whoop_tokens')
    .select('access_token, refresh_token, expires_at, updated_at')
    .eq('user_id', USER_ID)
    .maybeSingle()

  if (tokenError?.code === '42P01') {
    return NextResponse.json(
      {
        synced: false,
        reason: 'table_missing',
        sql: 'Run the SQL from docs/whoop-integration-plan.md § 7',
      },
      { status: 503 }
    )
  }
  if (tokenError) {
    return NextResponse.json({ synced: false, reason: 'db_error' }, { status: 500 })
  }

  const tokenRow = rawToken as unknown as TokenRow | null
  if (!tokenRow) {
    return NextResponse.json({ synced: false, reason: 'not_connected' }, { status: 400 })
  }

  // Refresh token if expiring within 5 minutes
  let accessToken = tokenRow.access_token
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  if (expiresAt < Date.now() + 5 * 60 * 1000) {
    try {
      const refreshed = await refreshWhoopToken(tokenRow.refresh_token)
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await supabase
        .from('whoop_tokens')
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', USER_ID)
      accessToken = refreshed.access_token
    } catch (err) {
      console.error('[whoop/sync] token refresh failed:', err)
      return NextResponse.json({ synced: false, reason: 'refresh_failed' }, { status: 502 })
    }
  }

  // Parallel WHOOP fetch
  const [recovery, cycle, sleep, workouts, body] = await Promise.all([
    fetchLatestRecovery(accessToken),
    fetchLatestCycle(accessToken),
    fetchLatestSleep(accessToken),
    fetchTodayWorkouts(accessToken),
    fetchBodyMeasurements(accessToken),
  ])

  const dailySync = mapToWhoopDailySync(recovery, cycle, sleep, body)
  const today = dailySync.date

  // Upsert daily_logs — WHOOP fields only, never overwrite manual user entries
  try {
    const { data: existingRow } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('date', today)
      .maybeSingle()

    const weightLb = dailySync.weightKg !== null
      ? Math.round(dailySync.weightKg * 2.20462 * 10) / 10
      : null

    if (existingRow) {
      const patch: Record<string, number | null> = {}
      if (dailySync.recoveryScore !== null) patch.recovery_score = dailySync.recoveryScore
      if (dailySync.hrv !== null) patch.hrv = dailySync.hrv
      if (dailySync.restingHR !== null) patch.resting_hr = dailySync.restingHR
      if (dailySync.strain !== null) patch.strain = dailySync.strain
      if (dailySync.sleepHours !== null) patch.sleep_hours = dailySync.sleepHours
      if (weightLb !== null) patch.weight = weightLb
      if (Object.keys(patch).length > 0) {
        await supabase.from('daily_logs').update(patch).eq('user_id', USER_ID).eq('date', today)
      }
    } else {
      await supabase.from('daily_logs').insert({
        user_id: USER_ID,
        date: today,
        recovery_score: dailySync.recoveryScore,
        hrv: dailySync.hrv,
        resting_hr: dailySync.restingHR,
        strain: dailySync.strain,
        sleep_hours: dailySync.sleepHours,
        weight: weightLb,
        smoked_today: false,
        drank_today: false,
        notes: '',
        saved_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[whoop/sync] daily_logs upsert failed:', err)
  }

  // Upsert workouts — dedup by external_id
  let workoutsAdded = 0
  for (const workout of workouts) {
    try {
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('external_id', workout.id)
        .maybeSingle()

      if (!existing) {
        const sync = mapWorkoutToSync(workout)
        await supabase.from('activity_logs').insert({
          id: crypto.randomUUID(),
          user_id: USER_ID,
          date: sync.date,
          type: whoopSportToActivityType(sync.sportName),
          label: sync.sportName,
          duration: sync.durationMinutes,
          heart_rate_avg: sync.heartRateAvg,
          heart_rate_max: sync.heartRateMax,
          distance: sync.distanceMiles,
          distance_unit: 'miles',
          source: 'whoop',
          external_id: workout.id,
          created_at: new Date().toISOString(),
        })
        workoutsAdded++
      }
    } catch (err) {
      console.error('[whoop/sync] workout upsert failed:', workout.id, err)
    }
  }

  await supabase
    .from('whoop_tokens')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', USER_ID)

  return NextResponse.json({ synced: true, dailySync, workoutsAdded })
}

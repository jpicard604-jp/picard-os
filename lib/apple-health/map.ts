// Apple Health → Supabase row mappers.
//
// Source precedence rule:
//   Only patch daily_logs columns when the incoming value is present (not null/undefined).
//   This mirrors the WHOOP pattern in app/api/integrations/whoop/sync/route.ts and
//   guarantees Apple Health never overwrites manual entries or WHOOP-owned fields.

import type { AppleHealthDailySync, AppleHealthWorkoutSync } from './types'

// HealthKit activityType → activity_logs.type taxonomy
// activity_logs.type values: 'strength'|'run'|'row'|'walk'|'swim'|'bike'|'recovery'|'mobility'|'hiit'|'custom'
export function appleHealthActivityToType(activityType: string): string {
  const a = activityType.toLowerCase()
  if (a.includes('running')           ) return 'run'
  if (a.includes('walking')           ) return 'walk'
  if (a.includes('cycling') || a.includes('bik')) return 'bike'
  if (a.includes('swim')              ) return 'swim'
  if (a.includes('row')               ) return 'row'
  if (a.includes('strength') || a.includes('functional') || a.includes('lift')) return 'strength'
  if (a.includes('hiit') || a.includes('crossfit') || a.includes('mixed')) return 'hiit'
  if (a.includes('yoga') || a.includes('mobility') || a.includes('flex') || a.includes('cooldown')) return 'mobility'
  if (a.includes('mind') || a.includes('breath')) return 'recovery'
  return 'custom'
}

// Build the partial daily_logs PATCH from an Apple Health daily sync.
// Only includes fields with concrete values. Caller MUST upsert with these and
// avoid overwriting unrelated columns.
export function mapAppleHealthToDailyPatch(sync: AppleHealthDailySync): {
  date: string
  patch: Record<string, number | null>
} {
  const patch: Record<string, number | null> = {}

  if (typeof sync.steps                        === 'number') patch.steps           = sync.steps
  if (typeof sync.sleepHours                   === 'number') patch.sleep_hours     = sync.sleepHours
  if (typeof sync.restingHeartRate             === 'number') patch.resting_hr      = sync.restingHeartRate
  if (typeof sync.hrvMs                        === 'number') patch.hrv             = Math.round(sync.hrvMs)
  if (typeof sync.weightKg                     === 'number') {
    patch.weight = Math.round(sync.weightKg * 2.20462 * 10) / 10  // kg → lb
  }

  return { date: sync.date, patch }
}

// Build the activity_logs row for a single Apple Health workout.
// Caller MUST dedupe by (user_id, external_id) before insert — same pattern as WHOOP.
export function mapAppleHealthWorkoutToActivity(w: AppleHealthWorkoutSync): {
  date:            string
  type:            string
  label:           string
  duration:        number | null
  distance:        number | null
  distance_unit:   string
  heart_rate_avg:  number | null
  calories:        number | null
  source:          'apple_health'
  external_id:     string
} {
  const distanceMiles = typeof w.distanceMeters === 'number'
    ? Math.round((w.distanceMeters / 1609.344) * 100) / 100
    : null

  return {
    date:           w.date,
    type:           appleHealthActivityToType(w.activityType),
    label:          w.activityType,
    duration:       w.durationMinutes  ?? null,
    distance:       distanceMiles,
    distance_unit:  'miles',
    heart_rate_avg: w.averageHeartRate ?? null,
    calories:       w.activeEnergyKcal ?? null,
    source:         'apple_health',
    external_id:    w.externalId,
  }
}

// Minimal runtime validator — endpoint uses this to reject malformed payloads
// without pulling in a schema lib. Returns null on success or an error string.
export function validateDailySync(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'body must be an object'
  const env = body as { schemaVersion?: unknown; daily?: unknown }
  if (env.schemaVersion !== 1) return 'schemaVersion must be 1'
  if (!env.daily || typeof env.daily !== 'object') return 'daily must be an object'

  const d = env.daily as Record<string, unknown>
  if (typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'daily.date must be YYYY-MM-DD'
  if (d.source !== 'apple_health') return 'daily.source must be apple_health'
  if (typeof d.syncedAt !== 'string') return 'daily.syncedAt must be ISO string'

  // Numeric fields — if present, must be a finite non-negative number
  const numericFields = [
    'steps', 'walkingRunningDistanceMeters', 'activeEnergyKcal', 'restingEnergyKcal',
    'flightsClimbed', 'exerciseMinutes', 'standHours', 'sleepHours',
    'restingHeartRate', 'averageHeartRate', 'hrvMs', 'vo2Max', 'weightKg',
  ]
  for (const k of numericFields) {
    const v = d[k]
    if (v !== undefined && v !== null) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        return `daily.${k} must be a non-negative number when present`
      }
    }
  }

  if (d.workouts !== undefined && !Array.isArray(d.workouts)) return 'daily.workouts must be an array when present'
  return null
}

// WHOOP Developer API v2 — TypeScript interfaces
// Reference: https://developer.whoop.com/api/
// Server-only: never import this file in 'use client' components.

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

export interface WhoopRecoveryScore {
  user_calibrating: boolean
  recovery_score: number       // 0–100
  resting_heart_rate: number   // bpm
  hrv_rmssd_milli: number      // ms (RMSSD)
  spo2_percentage: number
  skin_temp_celsius: number
}

export interface WhoopRecoveryRecord {
  cycle_id: number
  sleep_id: string
  user_id: number
  created_at: string           // ISO 8601
  updated_at: string
  score_state: WhoopScoreState
  score: WhoopRecoveryScore
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export interface WhoopSleepStageSummary {
  total_in_bed_time_milli: number
  total_awake_time_milli: number
  total_no_data_time_milli: number
  total_light_sleep_time_milli: number
  total_slow_wave_sleep_time_milli: number
  total_rem_sleep_time_milli: number
  sleep_cycle_count: number
  disturbance_count: number
}

export interface WhoopSleepScore {
  stage_summary: WhoopSleepStageSummary
  sleep_needed: {
    baseline_milli: number
    need_from_sleep_debt_milli: number
    need_from_recent_strain_milli: number
    need_from_recent_nap_milli: number
  }
  respiratory_rate: number
  sleep_performance_percentage: number
  sleep_consistency_percentage: number
  sleep_efficiency_percentage: number
}

export interface WhoopSleepRecord {
  id: string
  cycle_id: number
  user_id: number
  created_at: string
  updated_at: string
  start: string                // ISO 8601
  end: string                  // ISO 8601
  timezone_offset: string
  nap: boolean                 // filter out naps when computing primary sleep
  score_state: WhoopScoreState
  score: WhoopSleepScore
}

// ---------------------------------------------------------------------------
// Cycle (physiological day — not a calendar day)
// ---------------------------------------------------------------------------

export interface WhoopCycleScore {
  strain: number               // 0–21 (day-level accumulation)
  kilojoule: number
  average_heart_rate: number   // bpm (over full cycle)
  max_heart_rate: number       // bpm
}

export interface WhoopCycleRecord {
  id: number
  user_id: number
  created_at: string
  updated_at: string
  start: string                // ISO 8601 — cycle starts when you wake up
  end: string | null           // null if cycle is still open (current day)
  timezone_offset: string
  score_state: WhoopScoreState
  score: WhoopCycleScore
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export interface WhoopWorkoutZoneDurations {
  zone_zero_milli: number
  zone_one_milli: number
  zone_two_milli: number
  zone_three_milli: number
  zone_four_milli: number
  zone_five_milli: number
}

export interface WhoopWorkoutScore {
  strain: number               // workout-level strain (0–21)
  average_heart_rate: number   // bpm
  max_heart_rate: number       // bpm
  kilojoule: number
  percent_recorded: number
  distance_meter: number
  altitude_gain_meter: number
  altitude_change_meter: number
  zone_durations: WhoopWorkoutZoneDurations
}

export interface WhoopWorkoutRecord {
  id: string                   // use as external_id in activity_logs for dedup
  user_id: number
  created_at: string
  updated_at: string
  start: string                // ISO 8601
  end: string                  // ISO 8601
  timezone_offset: string
  sport_id: number
  sport_name: string           // e.g. "Running", "Strength Training", "Rowing"
  score_state: WhoopScoreState
  score: WhoopWorkoutScore
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type WhoopScoreState = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE'

export interface WhoopCollection<T> {
  records: T[]
  next_token: string | null    // null when no more pages
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export interface WhoopTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number           // seconds (typically 3600)
  scope: string
  token_type: 'bearer'
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

// Webhook payload — notification only (no data payload).
// After receiving, call the relevant REST endpoint to fetch updated data.
export interface WhoopWebhookEvent {
  user_id: number
  id: string                   // resource ID (workout ID, sleep ID, etc.)
  type: WhoopWebhookEventType
  trace_id: string             // use for deduplication/idempotency
}

export type WhoopWebhookEventType =
  | 'recovery.updated'
  | 'recovery.deleted'
  | 'workout.updated'
  | 'workout.deleted'
  | 'sleep.updated'
  | 'sleep.deleted'

// ---------------------------------------------------------------------------
// Body measurements
// ---------------------------------------------------------------------------

export interface WhoopBodyMeasurement {
  height_meter: number
  weight_kilogram: number
  max_heart_rate: number
}

// ---------------------------------------------------------------------------
// Picard OS mapped output types
// These are what the sync route produces and writes to Supabase/localStorage.
// ---------------------------------------------------------------------------

export interface WhoopDailySync {
  date: string                 // YYYY-MM-DD (derived from cycle start)
  recoveryScore: number | null // score.recovery_score (0–100)
  hrv: number | null           // Math.round(score.hrv_rmssd_milli)
  restingHR: number | null     // score.resting_heart_rate
  strain: number | null        // cycle.score.strain (0–21), rounded to 2dp
  sleepHours: number | null    // (in_bed - awake) / 3_600_000, nap=false only
  weightKg: number | null      // from /user/measurement/body
  cycleId: number | null
  sleepId: string | null
}

export interface WhoopWorkoutSync {
  whoopId: string              // WhoopWorkoutRecord.id — store in activity_logs.external_id
  date: string                 // YYYY-MM-DD from workout.start
  sportName: string
  durationMinutes: number      // (end - start) / 60_000
  strain: number | null
  heartRateAvg: number | null
  heartRateMax: number | null
  distanceMiles: number | null // score.distance_meter * 0.000621371
  kilojoules: number | null
}

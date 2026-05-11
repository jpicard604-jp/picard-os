// SERVER-ONLY — never import from 'use client' components.
import type { ActivityType } from '@/lib/fitness'
import type {
  WhoopRecoveryRecord,
  WhoopCycleRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
  WhoopBodyMeasurement,
  WhoopDailySync,
  WhoopWorkoutSync,
} from './types'

const SPORT_MAP: Record<string, ActivityType> = {
  'Running': 'run',
  'Strength Training': 'strength',
  'Rowing': 'row',
  'Walking': 'walk',
  'Swimming': 'swim',
  'Cycling': 'bike',
  'HIIT': 'hiit',
  'Mobility': 'mobility',
  'Recovery': 'recovery',
}

export function whoopSportToActivityType(sportName: string): ActivityType {
  return SPORT_MAP[sportName] ?? 'custom'
}

export function mapToWhoopDailySync(
  recovery: WhoopRecoveryRecord | null,
  cycle: WhoopCycleRecord | null,
  sleep: WhoopSleepRecord | null,
  body: WhoopBodyMeasurement | null = null,
): WhoopDailySync {
  const today = new Date().toISOString().slice(0, 10)

  let recoveryScore: number | null = null
  let hrv: number | null = null
  let restingHR: number | null = null
  if (recovery?.score_state === 'SCORED' && !recovery.score.user_calibrating) {
    recoveryScore = recovery.score.recovery_score
    hrv = Math.round(recovery.score.hrv_rmssd_milli)
    restingHR = recovery.score.resting_heart_rate
  }

  let strain: number | null = null
  if (cycle?.score_state === 'SCORED') {
    strain = Math.round(cycle.score.strain * 100) / 100
  }

  let sleepHours: number | null = null
  if (sleep?.score_state === 'SCORED') {
    const { total_in_bed_time_milli, total_awake_time_milli } = sleep.score.stage_summary
    sleepHours =
      Math.round(((total_in_bed_time_milli - total_awake_time_milli) / 3_600_000) * 100) / 100
  }

  const date = cycle ? cycle.start.slice(0, 10) : today

  return {
    date,
    recoveryScore,
    hrv,
    restingHR,
    strain,
    sleepHours,
    weightKg: body?.weight_kilogram ?? null,
    cycleId: cycle?.id ?? null,
    sleepId: sleep?.id ?? null,
  }
}

export function mapWorkoutToSync(workout: WhoopWorkoutRecord): WhoopWorkoutSync {
  const startMs = new Date(workout.start).getTime()
  const endMs = new Date(workout.end).getTime()
  const durationMinutes = Math.round((endMs - startMs) / 60_000)
  const scored = workout.score_state === 'SCORED'

  return {
    whoopId: workout.id,
    date: workout.start.slice(0, 10),
    sportName: workout.sport_name,
    durationMinutes,
    strain: scored ? workout.score.strain : null,
    heartRateAvg: scored ? workout.score.average_heart_rate : null,
    heartRateMax: scored ? workout.score.max_heart_rate : null,
    distanceMiles:
      scored && workout.score.distance_meter > 0
        ? Math.round(workout.score.distance_meter * 0.000621371 * 100) / 100
        : null,
    kilojoules: scored ? workout.score.kilojoule : null,
  }
}

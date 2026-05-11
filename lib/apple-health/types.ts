// Apple Health — normalized data types for ingestion from an iPhone
// companion app (Capacitor/native) or an iOS Shortcut.
//
// IMPORTANT: A Next.js web app cannot read HealthKit directly. These types
// describe the JSON payload that a HealthKit-capable client (iOS Shortcut today,
// Capacitor app later) will POST to /api/integrations/apple-health/sync.

export interface AppleHealthWorkoutSync {
  externalId:        string   // HealthKit UUID — used for dedupe in activity_logs.external_id
  date:              string   // YYYY-MM-DD
  activityType:      string   // HKWorkoutActivityType name e.g. 'running', 'traditionalStrengthTraining'
  startTime:         string   // ISO 8601
  endTime:           string   // ISO 8601
  durationMinutes?:  number
  distanceMeters?:   number
  activeEnergyKcal?: number
  averageHeartRate?: number
  source:            'apple_health'
}

export interface AppleHealthDailySync {
  date:                          string   // YYYY-MM-DD (local date on iPhone)
  // Activity rings
  steps?:                        number
  walkingRunningDistanceMeters?: number
  activeEnergyKcal?:             number
  restingEnergyKcal?:            number
  flightsClimbed?:               number
  exerciseMinutes?:              number
  standHours?:                   number
  // Sleep
  sleepHours?:                   number
  // Cardio
  restingHeartRate?:             number
  averageHeartRate?:             number
  hrvMs?:                        number
  vo2Max?:                       number
  // Body
  weightKg?:                     number
  // Workouts for the day
  workouts?:                     AppleHealthWorkoutSync[]
  source:                        'apple_health'
  syncedAt:                      string   // ISO timestamp the client sent
}

// Phase 1 minimum-required field set — the endpoint validates these are present
// and well-typed. Everything else is optional.
export interface AppleHealthSyncEnvelope {
  schemaVersion: 1
  daily:         AppleHealthDailySync
}

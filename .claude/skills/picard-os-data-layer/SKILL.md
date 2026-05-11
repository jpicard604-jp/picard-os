# Skill: Picard OS Data Layer

**When to use:** Any task touching localStorage keys, storage events, the scoring pipeline, lib/ modules, or data flow between components.

## localStorage Keys (`lib/storage.ts` — `STORAGE_KEYS`)

| Key | Type | Purpose |
|-----|------|---------|
| `picard_daily_logs_v1` | `Record<string, DailyLog>` | Daily log entries keyed by YYYY-MM-DD |
| `picard_activity_logs_v1` | `ActivityLog[]` | Workout/activity entries (falls back to SEED_ACTIVITIES) |
| `picard_projects_v1` | `Project[]` | Projects + tasks (falls back to SEED_PROJECTS) |
| `picard_voice_logs_v1` | `VoiceLog[]` | Voice log transcripts |
| `picard_uploads_v1` | `UploadedFile[]` | Upload metadata |
| `picard_stack_v1` | `StackItem[]` | Supplement stack (falls back to JACKSON.stack) |
| `picard_nutrition_profile_v1` | `NutritionProfile` | Confirmed cut targets — 210g protein / 2200 cal |
| `picard_daily_goals_v1` | `Record<string, DailyGoal[]>` | Daily goals keyed by YYYY-MM-DD |

## Custom Event Bus (`STORAGE_EVENTS`)

| Event | Fired by | Consumers |
|-------|----------|-----------|
| `picard:daily-log-updated` | `saveTodayLog()` | XodusCard, QuickStats, dashboard cards |
| `picard:activity-log-updated` | `addActivityLog()` | FitnessWidget, ActivityOverview |
| `picard:voice-log-saved` | voice save handler | VoiceLog page |
| `picard:projects-updated` | `saveProjects()` | ProjectSummary |
| `picard:stack-updated` | stack state change | StackPreview |
| `picard:goals-updated` | `addGoals()` | DailyGoals |
| `picard:nutrition-profile-updated` | `saveNutritionProfile()` | QuickStats, XodusCard |

## lib/ Module Map

| Module | Key exports | Purpose |
|--------|-------------|---------|
| `storage.ts` | `STORAGE_KEYS`, `STORAGE_EVENTS`, `DailyLog`, `getTodayLog`, `saveTodayLog` | All localStorage primitives and types |
| `mock-data.ts` | `JACKSON` | Static mock until real APIs connect |
| `daily-status.ts` | `generateDailyStatus(log, extras)` | Scoring engine → executionScore, alerts, strengths |
| `xodus-message.ts` | `generateXodusOutput(log, extras)` | Builds prose paragraphs for XODUS |
| `fitness.ts` | `ActivityLog`, `getActivityLogs`, `addActivityLog`, `getTodayActivity` | Activity log CRUD |
| `activity-summary.ts` | `getDailyActivitySummary()` | Unified daily view: steps, active minutes, weekly stats |
| `voice-parser.ts` | `parseTrainingFromVoiceLog(transcript)` | Regex extraction of workout data |
| `projects.ts` | `Project`, `Task`, `getProjects`, `saveProjects`, `getOverdueCount` | Project + task CRUD |
| `nutrition-profile.ts` | `getNutritionProfile`, `saveNutritionProfile`, `CONFIRMED_NUTRITION_PROFILE` | Cut target storage |
| `daily-goals.ts` | `DailyGoal`, `getTodayGoals`, `addGoals`, `toggleGoal`, `parseXodusInput` | Goal CRUD + NL parser |
| `xodus/brain.ts` | `gatherBrainInput`, `runXodusBrain`, `XodusBrainInput` | Brain engine + context assembly |

## Scoring Pipeline

```
DailyLog + DailyStatusExtras (incl. nutritionProfile overrides)
    ↓
generateDailyStatus()   → executionScore (0–100), alerts[], strengths[], recoveryLevel, disciplineLevel
    ↓
generateXodusOutput()   → paragraphs[], urgency, focusRecommendation
    ↓
XodusCard / /xodus page → renders prose brief
```

`DailyStatusExtras` fields: `voiceLogsToday`, `uploadsToday`, `stackTaken`, `stackTotal`, `overdueProjects`, `weeklyWorkouts`, `activityMinutesToday`, `todayActivityLabel`, `todayActivityType`, `recoveryScoreOverride`, `noDrinkStreakOverride`, `proteinTargetOverride`, `calorieTargetOverride`.

## ActivityLog Merge Rule

`DailyLog.steps` is authoritative (user's explicit daily total). `ActivityLog.steps` are per-workout steps (fallback only). `getDailyActivitySummary()` enforces this — never sum both.

## Nutrition Fallback Chain

```
log?.proteinTarget ?? nutritionProfile.proteinTarget ?? 210
log?.calorieTarget ?? nutritionProfile.calorieTarget ?? 2200
```

## What NOT to do

- Never seed `useState` directly from `getTodayLog()` or any localStorage function — use `useState(EMPTY)` + `useEffect` to load.
- Never use `new Date()` in `useState()` initializer that feeds JSX — use `useState<Date | null>(null)`.
- Never access localStorage without `typeof window !== 'undefined'` guard outside `useEffect`.
- Never sum `DailyLog.steps` + `ActivityLog.steps` — use `getDailyActivitySummary()`.

## Files to inspect first

- `lib/storage.ts` — all types and keys
- `lib/daily-status.ts` — scoring logic
- `lib/xodus/brain.ts` — brain engine
- `components/dashboard/XodusCard.tsx` — canonical reactive pattern

## Verification

After data layer changes: `npx tsc --noEmit` + `npm run build`. Check hydration errors in browser console.

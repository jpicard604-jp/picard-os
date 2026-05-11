# Skill: Picard OS Integrations

**When to use:** Any task touching WHOOP, Apple Health, MyFitnessPal, Gmail/Calendar MCP, or any external API/OAuth flow.

## WHOOP

- **API:** WHOOP Developer API (OAuth 2.0)
- **Data pulled:** Recovery score, HRV, resting HR, sleep stages, strain, workouts
- **Sync cadence:** On app open + once per hour via background sync
- **Storage:** Cache latest values in Supabase. Never store raw WHOOP tokens in client code.
- **Fallback:** Show last-cached values with a staleness indicator if API unavailable
- **Recovery override path:** Pass `recoveryScoreOverride` in `DailyStatusExtras` when WHOOP data is live
- **Route handler:** `app/api/whoop/` (not yet built — localStorage mock via `JACKSON` for now)

## Apple Health

- **No web API exists.** iOS-only.
- **Primary path:** User exports Health XML → Upload Center parses it
- **Secondary path:** iOS Shortcut POSTs daily summary JSON to `app/api/health-shortcut/` endpoint
- **Data pulled:** Steps, active calories, workouts, weight, sleep
- **Do not** build a native iOS app for Health access
- **Shortcut JSON schema:** `{ date, steps, activeCalories, workoutMinutes, sleepHours, weight? }`

## MyFitnessPal

- **No official public API.** Do not scrape MFP.
- **Primary path:** User exports CSV → Upload Center ingests it
- **Secondary path:** User pastes daily export text → XODUS parses macros
- **Data pulled:** Daily calorie intake, macro breakdown (protein/carbs/fat)

## Gmail / Google Calendar (MCP)

- **MCP tools available** (deferred — load via ToolSearch):
  - `mcp__claude_ai_Gmail__search_threads`, `create_draft`, `list_labels`, `label_message`
  - `mcp__claude_ai_Google_Calendar__list_events`, `create_event`, `get_event`, `suggest_time`
- **Use for:** XODUS context injection (upcoming meetings, flagged emails), goal scheduling
- **Do not** read or send email without explicit user instruction in the current turn

## Supabase

- **Status:** Planned — not yet wired (all data is localStorage)
- **When migrating:** Use `createAdminClient` from server-only files only. Never expose `SUPABASE_SECRET_KEY` client-side.
- **Tables planned:** `daily_logs`, `activity_logs`, `projects`, `voice_logs`, `uploads`, `brain_notes`
- **Auth:** Supabase Auth, single user, no multi-tenancy

## What NOT to do

- Never call WHOOP API or any OAuth flow from `'use client'` components
- Never store tokens in localStorage or expose in client bundles
- Never re-transcribe already-cached audio — check storage first
- Do not add a paid API without flagging it to the user first

## Files to inspect first

- `lib/mock-data.ts` — `JACKSON` mock (current WHOOP stand-in)
- `lib/storage.ts` — `DailyLog` type (where integration data lands)
- `lib/xodus/brain.ts` — `gatherBrainInput()` (where extras like `recoveryScoreOverride` are passed)
- `app/api/` — existing route handlers

## Verification

TypeScript: `npx tsc --noEmit`. For OAuth flows, verify token is never logged or exposed in responses.

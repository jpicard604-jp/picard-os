# WHOOP Integration Plan
# Picard OS — WHOOP API v2 OAuth & Data Sync

*Last updated: 2026-05-10*

---

## 1. Overview

WHOOP is the highest-priority external integration for Picard OS. A single sync populates five `DailyLog` fields that are otherwise manual-entry only: recovery score, HRV, resting HR, strain, and sleep hours. Once connected, the dashboard recovery rings, trends charts, and XODUS context all become data-driven without any daily user action.

**What this integration does:**
- OAuth 2.0 authorization — user connects their WHOOP account once
- Stores tokens server-side (Supabase) — never exposed to the browser
- Syncs recovery + sleep + cycle data on app open
- Logs WHOOP workouts as `ActivityLog` entries with dedup
- Triggers sync from WHOOP webhooks (real-time) and daily cron (reconciliation)

**What this integration does NOT do yet:**
- Modify any existing localStorage/Supabase flow
- Auto-write to daily logs (Phase D implementation)
- Create any new Supabase tables (documented below, deferred)

---

## 2. Env Vars Required

All vars are server-only. Never prefix with `NEXT_PUBLIC_`. Never import in `'use client'` files.

Add to `.env.local` (already gitignored):

```
# WHOOP OAuth 2.0 credentials — register app at developer.whoop.com
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=http://localhost:3000/api/integrations/whoop/callback
```

For production, set these in Vercel: Settings → Environment Variables → Production.

`WHOOP_REDIRECT_URI` for production: `https://your-picard-os-domain.vercel.app/api/integrations/whoop/callback`

**Security rules:**
- `WHOOP_CLIENT_SECRET` is used only in server Route Handlers via `process.env`
- WHOOP access tokens and refresh tokens are stored in Supabase `whoop_tokens` table (see § 7)
- Tokens are NEVER included in API responses sent to the browser
- Tokens are NEVER stored in localStorage

---

## 3. OAuth 2.0 Authorization Code Flow

### Step-by-step

```
1. User clicks "Connect WHOOP" in Picard OS settings
2. Browser → GET /api/integrations/whoop/auth
3. Server builds WHOOP auth URL with scopes, state token (CSRF), client_id
4. Server → 302 redirect to:
     https://api.prod.whoop.com/oauth/oauth2/auth
       ?client_id=<WHOOP_CLIENT_ID>
       &redirect_uri=<WHOOP_REDIRECT_URI>
       &scope=read:recovery read:cycles read:workout read:sleep read:profile offline
       &response_type=code
       &state=<random-uuid-stored-in-Supabase>
5. User logs in at WHOOP, approves permissions
6. WHOOP → 302 redirect to:
     /api/integrations/whoop/callback?code=<auth_code>&state=<same-uuid>
7. Server validates state token (prevent CSRF)
8. Server exchanges code for tokens:
     POST https://api.prod.whoop.com/oauth/oauth2/token
     Content-Type: application/x-www-form-urlencoded
     Body:
       grant_type=authorization_code
       code=<auth_code>
       client_id=<WHOOP_CLIENT_ID>
       client_secret=<WHOOP_CLIENT_SECRET>          ← server-only
       redirect_uri=<WHOOP_REDIRECT_URI>
9. Server stores tokens in Supabase whoop_tokens table (admin client)
10. Server triggers initial sync: POST /api/integrations/whoop/sync
11. Server → redirect to /?whoop=connected
```

### Token response shape

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "scope": "read:recovery read:cycles ...",
  "token_type": "bearer"
}
```

### Token refresh

Access tokens expire in ~1 hour. Refresh before every sync call:

```
POST https://api.prod.whoop.com/oauth/oauth2/token
Content-Type: application/x-www-form-urlencoded
Body:
  grant_type=refresh_token
  refresh_token=<stored_refresh_token>
  client_id=<WHOOP_CLIENT_ID>
  client_secret=<WHOOP_CLIENT_SECRET>
  scope=offline
```

**Token rotation:** Each refresh returns a new `refresh_token`. The old one is invalidated immediately. Store both new tokens to Supabase before using the new access token. If two refreshes happen in parallel (race condition), implement a Supabase advisory lock.

### Scopes

| Scope | Data granted |
|-------|-------------|
| `read:recovery` | Recovery score, HRV, resting HR |
| `read:cycles` | Day strain, average HR |
| `read:workout` | Per-workout strain, HR, distance, calories |
| `read:sleep` | Sleep duration, stages, performance % |
| `read:profile` | Name, email |
| `offline` | Refresh token (required for long-term access) |

---

## 4. API Endpoints Used

**Base URL:** `https://api.prod.whoop.com/developer/v2`

All requests require `Authorization: Bearer <access_token>`.

### Recovery

```
GET /recovery
  Params: limit=1
  Returns: Most recent recovery record

GET /cycle/{cycleId}/recovery
  Returns: Recovery linked to a specific cycle
```

Key response fields:
```json
{
  "score_state": "SCORED",
  "score": {
    "user_calibrating": false,
    "recovery_score": 76,          → DailyLog.recoveryScore
    "resting_heart_rate": 52,      → DailyLog.restingHR
    "hrv_rmssd_milli": 75.3        → Math.round() → DailyLog.hrv
  }
}
```

Guards:
- `score_state === 'SCORED'` — skip `PENDING_SCORE` and `UNSCORABLE`
- `score.user_calibrating === false` — skip first 6 days of new WHOOP user

### Cycle (Day Strain)

```
GET /cycle
  Params: limit=1
  Returns: Most recent physiological cycle
```

Key response fields:
```json
{
  "score_state": "SCORED",
  "score": {
    "strain": 5.29                 → DailyLog.strain (float 0–21)
  }
}
```

Note: A cycle is not a calendar day. It starts when you wake up, ends when you sleep. On the current day, `end` is `null`.

### Sleep

```
GET /activity/sleep
  Params: limit=3
  Filter: nap: false (exclude naps from primary sleep calculation)
```

Key response fields:
```json
{
  "nap": false,
  "score_state": "SCORED",
  "score": {
    "stage_summary": {
      "total_in_bed_time_milli": 30600000,
      "total_awake_time_milli": 1800000
    }
  }
}
```

Sleep hours calculation:
```typescript
const netSleepMs = record.score.stage_summary.total_in_bed_time_milli
                 - record.score.stage_summary.total_awake_time_milli
const sleepHours = Math.round((netSleepMs / 3_600_000) * 100) / 100
```

Map to `DailyLog.sleepHours`.

### Workout

```
GET /activity/workout
  Params: start=<todayISO>, limit=10
  Returns: Today's workouts
```

Key response fields:
```json
{
  "id": "abc123",                  → activity_logs.external_id (dedup key)
  "start": "2026-05-10T13:00:00Z",
  "end": "2026-05-10T14:00:00Z",
  "sport_name": "Running",
  "score": {
    "strain": 12.4,
    "average_heart_rate": 145,     → activity_logs.heart_rate_avg
    "max_heart_rate": 178,         → activity_logs.heart_rate_max
    "kilojoule": 2100.5,           → convert: * 0.239006 = kcal
    "distance_meter": 8046.7       → convert: * 0.000621371 = miles
  }
}
```

Map to `ActivityLog` with `source: 'whoop'`.

---

## 5. Complete Data Mapping

### DailyLog fields from WHOOP

| `DailyLog` field | WHOOP endpoint | WHOOP field path | Transform |
|----------------|----------------|-----------------|-----------|
| `recoveryScore` | `GET /recovery` | `score.recovery_score` | integer (0–100) |
| `hrv` | `GET /recovery` | `score.hrv_rmssd_milli` | `Math.round(value)` |
| `restingHR` | `GET /recovery` | `score.resting_heart_rate` | integer (bpm) |
| `strain` | `GET /cycle` | `score.strain` | `Math.round(value * 100) / 100` (2dp display, 1dp in UI) |
| `sleepHours` | `GET /activity/sleep` | stage_summary calculation | `(in_bed - awake) / 3_600_000`, nap=false only |
| `weight` | `GET /user/measurement/body` | `weight_kilogram` | `* 2.20462`, rounded to 1dp (lbs) |

Supabase `daily_logs` column names (existing schema, no new columns needed):
- `recovery_score` ← `recoveryScore`
- `hrv` ← `hrv` (already integer column, WHOOP value rounded)
- `resting_hr` ← `restingHR`
- `strain` ← `strain` (numeric(4,2))
- `sleep_hours` ← `sleepHours` (numeric(4,2))
- `weight` ← `weightKg * 2.20462` (lbs, 1dp) from `GET /user/measurement/body`

### ActivityLog fields from WHOOP workouts

| `ActivityLog` field | WHOOP field | Transform |
|--------------------|-------------|-----------|
| `id` | (generate UUID) | `crypto.randomUUID()` |
| `date` | `workout.start` | Extract YYYY-MM-DD |
| `type` | `workout.sport_name` | See sport mapping table |
| `label` | `workout.sport_name` | Use as-is |
| `duration` | `workout.end - workout.start` | `/ 60_000` → minutes |
| `heartRateAvg` | `score.average_heart_rate` | integer |
| `heartRateMax` | `score.max_heart_rate` | integer |
| `calories` | `score.kilojoule` | `* 0.239006` → kcal, rounded |
| `distance` | `score.distance_meter` | `* 0.000621371` → miles |
| `externalId` | `workout.id` | Store for dedup |
| `source` | (constant) | `'whoop'` |

### WHOOP sport_name → Picard OS ActivityType mapping

| WHOOP sport_name | Picard OS `ActivityType` |
|-----------------|--------------------------|
| "Running" | `'run'` |
| "Strength Training" | `'strength'` |
| "Rowing" | `'row'` |
| "Walking" | `'walk'` |
| "Swimming" | `'swim'` |
| "Cycling" | `'bike'` |
| "HIIT" | `'hiit'` |
| "Mobility" | `'mobility'` |
| "Recovery" | `'recovery'` |
| (all others) | `'custom'` |

### Sleep score display (duration-based fallback)

When `DailyLog.sleepQuality` is absent, `CommandCenter` derives a score from `sleepHours`:

```typescript
Math.min(100, Math.round((sleepHours / 9) * 100))
```

9 hours = 100%. This is a continuous linear formula. The WHOOP `sleep_performance_percentage` field is not currently mapped (it would be a better source if added later).

### Strain display rounding policy

Strain is stored with 2dp precision (`Math.round(strain * 100) / 100`). UI elements display 1dp:
- `FitnessWidget` ring: `Math.round(strain * 10) / 10`
- `RecoveryCard` in `/fitness`: `strain.toFixed(1)`
- Trends chart raw data points: `Math.round(strain * 10) / 10`

### Trends page impact

All existing trend charts automatically update when WHOOP sync writes to `daily_logs`:
- Recovery chart: reads `DailyLog.recoveryScore`
- Strain chart: reads `DailyLog.strain`
- Sleep chart: reads `DailyLog.sleepHours`
- Workouts: synced WHOOP workouts appear in `ActivityLog` and show in workout count chart

**TODO — Steps not available from WHOOP API v2:**
Steps are not currently available through the implemented WHOOP API endpoints; use Apple Health/HealthKit or another provider for steps. The `/cycle`, `/recovery`, `/activity/sleep`, `/activity/workout`, and `/user/measurement/body` endpoints do not return a step count. Steps remain manual entry only (`DailyLog.steps`).

### XODUS context impact

After WHOOP sync, `gatherBrainInput()` in `lib/xodus/brain.ts` picks up the updated daily log fields automatically. The existing 6 domain briefs (fitness, nutrition, discipline, projects, mental, body) will populate more completely. No XODUS code changes needed.

---

## 6. Sync Strategy

### On app open (Phase D)

```typescript
// In app layout or dashboard component (client)
useEffect(() => {
  if (whoopConnected) {
    void fetch('/api/integrations/whoop/sync', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.synced) {
          // Apply DailyLog updates to localStorage
          // Dispatch STORAGE_EVENTS.DAILY_LOG_UPDATED
        }
      })
  }
}, [whoopConnected])
```

### Hourly background sync (Phase D)

Use Vercel cron (or webhook events) rather than polling from the client. Add to `vercel.json` or `vercel.ts`:

```json
{ "crons": [{ "path": "/api/integrations/whoop/sync", "schedule": "0 * * * *" }] }
```

Note: Vercel cron free tier allows 2 scheduled jobs. Use this slot carefully.

### Webhook-triggered sync (Phase D)

```
WHOOP → POST /api/webhooks/whoop (new route — not in this stub set)
  1. Validate X-WHOOP-Signature header
  2. Parse event type (recovery.updated, sleep.updated, workout.updated)
  3. Call targeted fetch for the updated resource (not full sync)
  4. Upsert into Supabase
  5. Respond 200 within 1 second (WHOOP times out at ~1s)
```

Webhook signature validation:
```typescript
import { createHmac } from 'crypto'

function validateWhoopSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const computed = createHmac('sha256', secret)
    .update(timestamp + body)
    .digest('base64')
  return computed === signature
}
```

WHOOP retries failed deliveries 5 times over ~1 hour. Respond `200` quickly. Use `trace_id` in webhook payload for deduplication.

---

## 7. Token Storage — Supabase Table

**⚠️ REQUIRED BEFORE CONNECTING.** Create this table in the Supabase SQL editor BEFORE clicking Connect WHOOP. If the table is missing, the callback will redirect to `/settings?whoop=table_missing` and no token will be stored.

```sql
-- whoop_tokens (create in Phase D — WHOOP OAuth implementation)
create table if not exists whoop_tokens (
  user_id       uuid         primary key references profiles(id) on delete cascade,
  access_token  text         not null,
  refresh_token text         not null,
  expires_at    timestamptz  not null,    -- store as: NOW() + interval '1 hour'
  scope         text         not null,
  whoop_user_id integer,
  connected_at  timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

alter table whoop_tokens enable row level security;

create policy "whoop_tokens: owner only"
  on whoop_tokens for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());
```

**Security:** Only the server admin client (`lib/supabase/server.ts`) reads and writes this table. The admin client uses `SUPABASE_SECRET_KEY` (service role) which bypasses RLS — so the RLS policy above only applies to direct client-side queries (which are never made). FK constraint still applies: `PICARD_USER_ID` must exist in the `profiles` table before inserting into `whoop_tokens`.

**RLS note:** The `auth.uid()` policy is correct for production Supabase Auth. Since this app uses a hardcoded `PICARD_USER_ID` and the admin client, the policy is effectively bypassed by the server but prevents any accidental client-side access.

**FK requirement:** `PICARD_USER_ID` must be a real row in `profiles`. The bootstrap route created this row in a prior session (id: `217995d1-e59e-453e-8799-d2ec4d970095`). If you see a FK violation error in callback logs, verify this row exists.

---

## 8. Rate Limits

| Limit | Value |
|-------|-------|
| Per minute | 100 requests |
| Per day | 10,000 requests |
| Over-limit response | HTTP 429 |

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

For a single-user app: on-open sync = 4 requests (cycle, recovery, sleep, workout). Hourly sync = 4 × 24 = 96/day. Well within limits.

---

## 9. Implementation Order

| Phase | Task | Dependencies |
|-------|------|-------------|
| D-1 | Create `whoop_tokens` Supabase table | profiles table exists ✓ |
| D-2 | Implement `/api/integrations/whoop/auth` — full redirect | WHOOP_CLIENT_ID set |
| D-3 | Implement `/api/integrations/whoop/callback` — token exchange + store | D-1, D-2 |
| D-4 | Implement `/api/integrations/whoop/sync` — full fetch + upsert | D-3 |
| D-5 | Add "Connect WHOOP" button to `/settings` page | D-2 |
| D-6 | Add on-open sync trigger to dashboard layout | D-4 |
| D-7 | Implement `/api/webhooks/whoop` — signature validation + targeted sync | D-4 |
| D-8 | Vercel cron: hourly `/api/integrations/whoop/sync` call | D-4 |

---

## 10. What Is Built vs Deferred

| Item | Status |
|------|--------|
| TypeScript types: `lib/whoop/types.ts` | ✅ Built |
| WHOOP API client: `lib/whoop/client.ts` | ✅ Built |
| Data mappers: `lib/whoop/map.ts` | ✅ Built |
| Body measurements fetch (`fetchBodyMeasurements`) | ✅ Built |
| Weight sync: kg → lbs → `daily_logs.weight` + localStorage | ✅ Built |
| Strain rounding: 2dp stored, 1dp displayed | ✅ Built |
| Sleep score formula: continuous `(h / 9) * 100` | ✅ Built |
| Fitness page WHOOP live connection status | ✅ Built |
| Data mapping documented | ✅ This document |
| `/api/integrations/whoop/auth` — full OAuth redirect + CSRF cookie | ✅ Built |
| `/api/integrations/whoop/callback` — token exchange + Supabase storage | ✅ Built |
| `/api/integrations/whoop/sync` GET — connection status | ✅ Built |
| `/api/integrations/whoop/sync` POST — parallel fetch + upsert | ✅ Built |
| Settings UI "Connect WHOOP" + "Sync Now" | ✅ Built |
| Steps from WHOOP | ❌ Not available in WHOOP API v2 — use Apple Health |
| WHOOP OAuth env vars | ⏳ Add to `.env.local` manually |
| `whoop_tokens` Supabase table | ⏳ Create in Supabase SQL editor (SQL in § 7) |
| Webhook handler `/api/webhooks/whoop` | ⏳ Deferred to Phase D-7 |
| Vercel cron for hourly sync | ⏳ Deferred to Phase D-8 |

## 11. Activation Checklist

Before the Connect button will work end-to-end:

1. Register app at [developer.whoop.com](https://developer.whoop.com)
   - Set redirect URI: `http://localhost:3000/api/integrations/whoop/callback` (dev)
   - Set redirect URI: `https://<your-domain>/api/integrations/whoop/callback` (prod)

2. Add env vars to `.env.local`:
   ```
   WHOOP_CLIENT_ID=<from WHOOP developer dashboard>
   WHOOP_CLIENT_SECRET=<from WHOOP developer dashboard>
   WHOOP_REDIRECT_URI=http://localhost:3000/api/integrations/whoop/callback
   ```

3. Create `whoop_tokens` table in Supabase SQL editor (SQL in § 7 above).

4. Restart dev server (`npm run dev`) to pick up env changes.

5. Go to `/settings` → Integrations → Connect.

After connecting, "Sync Now" will populate today's recovery score, HRV, resting HR, strain, and sleep hours in both Supabase and localStorage. Dashboard and trends charts update automatically via storage events.

# Apple Health iOS Shortcut — Setup Guide

> **Status:** Phase 1 MVP · Backend endpoint is built and deployed. Complete the steps below to start syncing.

This is the actionable checklist to get Apple Health data flowing into Picard OS today — no native code required.

---

## 1. Required env vars

Add these to `.env.local` (dev) and to Vercel project settings → Environment Variables (prod).

| Variable | Where to set | Notes |
|---|---|---|
| `APPLE_HEALTH_SYNC_SECRET` | `.env.local` + Vercel | Any random string, 32+ chars. This is the shared secret the iOS Shortcut sends in the `X-AH-Secret` header. Rotate by changing both the env var and the Shortcut header. |
| `SUPABASE_URL` | Already set | Must be set for the endpoint to write to Supabase. |
| `SUPABASE_SECRET_KEY` | Already set | Service role key — server-only. |

Generate a secret:
```powershell
# PowerShell — generates a 40-char hex secret
-join (1..20 | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

---

## 2. Supabase — run `integration_meta` migration

Open your Supabase project → SQL Editor → New query. Paste and run:

```sql
create table if not exists integration_meta (
  user_id     uuid          not null references profiles(id) on delete cascade,
  key         text          not null,
  value       text,
  updated_at  timestamptz   not null default now(),
  primary key (user_id, key)
);

alter table integration_meta enable row level security;

create policy "integration_meta: owner only"
  on integration_meta for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());
```

> The endpoint handles `table_missing` gracefully (returns a JSON error, not a crash), so this is non-blocking for testing — but run it before going live.

---

## 3. Sample test payload

The full `AppleHealthSyncEnvelope` shape. Omit any field you don't have — the server only patches what's present.

```json
{
  "schemaVersion": 1,
  "daily": {
    "date": "2026-05-10",
    "steps": 8421,
    "walkingRunningDistanceMeters": 6800,
    "activeEnergyKcal": 520,
    "restingEnergyKcal": 1850,
    "flightsClimbed": 12,
    "exerciseMinutes": 45,
    "standHours": 10,
    "sleepHours": 7.5,
    "restingHeartRate": 52,
    "averageHeartRate": 68,
    "hrvMs": 71,
    "weightKg": 83.5,
    "workouts": [
      {
        "externalId": "AHK-UUID-abc123",
        "date": "2026-05-10",
        "activityType": "HKWorkoutActivityTypeRunning",
        "startTime": "2026-05-10T07:00:00Z",
        "endTime": "2026-05-10T07:45:00Z",
        "durationMinutes": 45,
        "distanceMeters": 7200,
        "activeEnergyKcal": 410,
        "averageHeartRate": 158,
        "source": "apple_health"
      }
    ],
    "source": "apple_health",
    "syncedAt": "2026-05-10T23:55:00Z"
  }
}
```

**Minimal payload** (steps only — safe for smoke testing):

```json
{
  "schemaVersion": 1,
  "daily": {
    "date": "2026-05-10",
    "steps": 8421,
    "source": "apple_health",
    "syncedAt": "2026-05-10T23:55:00Z"
  }
}
```

---

## 4. PowerShell test commands

Replace `YOUR_SECRET` with the value you set in `APPLE_HEALTH_SYNC_SECRET`.

### 4a. Test local dev server (`npm run dev` must be running)

```powershell
# Smoke test — minimal steps payload
$secret = "YOUR_SECRET"
$body = '{"schemaVersion":1,"daily":{"date":"2026-05-10","steps":8421,"source":"apple_health","syncedAt":"2026-05-10T23:55:00Z"}}'

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integrations/apple-health/sync" `
  -Method POST `
  -Headers @{ "X-AH-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body

# Expect: { ok: true, date: "2026-05-10", stepsSynced: 8421, workoutsAdded: 0, ... }
```

```powershell
# Auth failure test — expect 401
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integrations/apple-health/sync" `
  -Method POST `
  -Headers @{ "X-AH-Secret" = "wrong"; "Content-Type" = "application/json" } `
  -Body $body
```

```powershell
# GET status check
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integrations/apple-health/sync" `
  -Method GET `
  -Headers @{ "X-AH-Secret" = $secret }
```

### 4b. Test production (Vercel)

```powershell
$secret = "YOUR_SECRET"
$prodUrl = "https://your-app.vercel.app"   # replace with your Vercel URL
$body = '{"schemaVersion":1,"daily":{"date":"2026-05-10","steps":8421,"source":"apple_health","syncedAt":"2026-05-10T23:55:00Z"}}'

Invoke-RestMethod `
  -Uri "$prodUrl/api/integrations/apple-health/sync" `
  -Method POST `
  -Headers @{ "X-AH-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body
```

### 4c. Idempotency check (post same payload twice → workoutsAdded: 0 on second call)

```powershell
$secret = "YOUR_SECRET"
$fullBody = @'
{"schemaVersion":1,"daily":{"date":"2026-05-10","steps":8421,"workouts":[{"externalId":"AHK-test-001","date":"2026-05-10","activityType":"HKWorkoutActivityTypeRunning","startTime":"2026-05-10T07:00:00Z","endTime":"2026-05-10T07:45:00Z","durationMinutes":45,"source":"apple_health"}],"source":"apple_health","syncedAt":"2026-05-10T23:55:00Z"}}
'@

# First call — workoutsAdded: 1
Invoke-RestMethod -Uri "http://localhost:3000/api/integrations/apple-health/sync" -Method POST -Headers @{ "X-AH-Secret" = $secret; "Content-Type" = "application/json" } -Body $fullBody

# Second call — workoutsAdded: 0 (dedupe worked)
Invoke-RestMethod -Uri "http://localhost:3000/api/integrations/apple-health/sync" -Method POST -Headers @{ "X-AH-Secret" = $secret; "Content-Type" = "application/json" } -Body $fullBody
```

---

## 5. iOS Shortcut — exact step-by-step

Build this on your iPhone. Takes about 10 minutes.

### 5.1 Create the Shortcut

1. Open **Shortcuts** app on iPhone
2. Tap **+** (top right) to create a new shortcut
3. Tap the title field → rename to **"Picard Health Sync"**

### 5.2 Add actions (in order)

**Action 1 — Get today's date**
- Search "Format Date" → tap to add
- Date: **Current Date**
- Format: **Custom** → type `yyyy-MM-dd`
- Set variable: tap "Set Variable" → name it `todayDate`

**Action 2 — Read Steps**
- Search "Find Health Samples" → add
- Health Category: **Steps**
- Sort by Date: **Most Recent First**
- Include: **All** (or "Today")
- Aggregation: **Sum**
- Set variable: `stepsTotal`

**Action 3 — Read Walking + Running Distance**
- Add another "Find Health Samples"
- Health Category: **Walking + Running Distance**
- Aggregation: **Sum**
- Set variable: `walkingDistance`
  *(distance will be in the unit you have set in Health app — meters if metric)*

**Action 4 — Read Active Energy**
- Add "Find Health Samples"
- Health Category: **Active Energy Burned**
- Aggregation: **Sum**
- Set variable: `activeEnergy`

**Action 5 — Read Resting Heart Rate**
- Add "Find Health Samples"
- Health Category: **Resting Heart Rate**
- Sort by Date: Most Recent First
- Limit: 1
- Set variable: `restingHR`

**Action 6 — Read HRV (optional — skip if WHOOP is your main HRV source)**
- Add "Find Health Samples"
- Health Category: **Heart Rate Variability**
- Sort by Date: Most Recent First
- Limit: 1
- Set variable: `hrv`

**Action 7 — Build the JSON dictionary**
- Search "Dictionary" → add
- Add these key-value pairs (tap + to add each):
  | Key | Type | Value |
  |-----|------|-------|
  | `schemaVersion` | Number | `1` |

- Then build the `daily` sub-dictionary:
  - Add a second **Dictionary** action
  - Keys:
    | Key | Type | Value |
    |-----|------|-------|
    | `date` | Text | Variable: `todayDate` |
    | `steps` | Number | Variable: `stepsTotal` |
    | `walkingRunningDistanceMeters` | Number | Variable: `walkingDistance` |
    | `activeEnergyKcal` | Number | Variable: `activeEnergy` |
    | `restingHeartRate` | Number | Variable: `restingHR` |
    | `source` | Text | `apple_health` |
    | `syncedAt` | Text | Variable: **Current Date** → Format as ISO 8601 |

  - Set variable: `dailyPayload`

- Back in the first dictionary, add:
  | Key | Type | Value |
  |-----|------|-------|
  | `daily` | Dictionary | Variable: `dailyPayload` |

- Set variable: `syncBody`

**Action 8 — POST to Picard OS**
- Search "Get Contents of URL" → add
- **URL:** `https://your-app.vercel.app/api/integrations/apple-health/sync`
  *(replace `your-app` with your actual Vercel domain)*
- **Method:** POST
- **Headers:** tap Add
  - `Content-Type` → `application/json`
  - `X-AH-Secret` → paste your `APPLE_HEALTH_SYNC_SECRET` value
- **Request Body:** JSON
  - Set the body to Variable: `syncBody`
- Set variable: `apiResponse`

**Action 9 — (Optional) Notify on success**
- Search "Show Notification" → add
- Title: `Health synced`
- Body: `Steps logged. Picard OS updated.`
- Show: only if you want the confirmation banner

### 5.3 Set up automatic daily trigger

1. Open Shortcuts → **Automation** tab (bottom bar)
2. Tap **+** → **Personal Automation**
3. Choose **Time of Day**
4. Set time: **11:55 PM**
5. Repeat: **Daily**
6. Tap **Next** → search and add your "Picard Health Sync" shortcut
7. **Turn off "Ask Before Running"** so it fires silently overnight

### 5.4 Grant Health permissions

When you first run the shortcut, iOS will ask for permission to read each Health category. Tap **Allow** for all.

If permissions are missing later: Settings → Privacy & Security → Health → Shortcuts → grant read access to each category.

---

## 6. Verify it worked

After running the shortcut manually (or waiting for 11:55 PM):

1. Check Picard OS **Trends** page → Steps chart should show today's count
2. Check **Fitness** page → Apple Health card should show "Receiving"
3. Check **Settings** → Apple Health row should show "Last sync X minutes ago"
4. Ask XODUS: *"How many steps today?"* → should respond with the actual count (not the "not connected" message)

---

## 7. XODUS step-comparison behavior (Phase 4 TODOs)

Once Apple Health is connected and syncing, these XODUS enhancements become unlocked:

- [ ] Compare today's steps vs 7-day average in readiness note (`computeReadiness`)
- [ ] Add `steps` signal to readiness score: +1 if steps > 8,000, -1 if < 3,000 after 8pm
- [ ] Daily brief (`generateXodusOutput`) includes step count when non-null
- [ ] XODUS chat context: replace `'steps_apple_health_planned'` with actual step count
- [ ] Trends page: unlock the Apple Health sparkline rows (currently showing "—")
- [ ] Add "Apple Health connected" event to Brain graph (new edge from health hub)
- [ ] XODUS message when steps > personal best: "New step PR today — {count} steps"

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 from endpoint | Wrong secret in Shortcut header | Check `X-AH-Secret` value matches `APPLE_HEALTH_SYNC_SECRET` exactly |
| 400 "missing date" | Shortcut date variable not formatted correctly | Must be `yyyy-MM-dd` (e.g. `2026-05-10`) |
| 500 with "table_missing" | `integration_meta` SQL not run | Run the SQL in § 2 above |
| Shortcut runs but steps = 0 | Health permission not granted | Settings → Privacy → Health → Shortcuts → re-grant read |
| Old data in app | Supabase write succeeds but localStorage overrides it | App reads Supabase `daily_logs` after Supabase migration (Phase 2); currently localStorage-first |
| Shortcut hangs | No network / HTTPS error | Confirm Vercel URL is correct and the app is deployed |

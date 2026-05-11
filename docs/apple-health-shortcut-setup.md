# Apple Health iOS Shortcut — Setup Guide

> **Time to set up:** ~10 minutes · No native code required · Free

---

## How this works

Apple Health has no public web API. A web app cannot read HealthKit. Here is the bridge that works today:

```
iPhone HealthKit
      │
      ▼
iOS Shortcut  ← you build this once (§ 4 below)
 · reads today's step count from Health
 · builds a small JSON payload
 · POSTs to Picard OS via HTTP
      │
      ▼
/api/integrations/apple-health/sync
 · validates the secret header
 · patches daily_logs.steps (only what's present)
 · records last-sync timestamp
      │
      ▼
Picard OS — Trends · Fitness · XODUS
```

This is the free local-first bridge until a native iOS companion app is built.

---

## 1. Set the shared secret

The endpoint requires an `X-AH-Secret` header. You pick the secret; set it in two places.

**`.env.local`** (already loaded by `npm run dev`):
```
APPLE_HEALTH_SYNC_SECRET=your_secret_here
```

**Vercel** (for production): Project → Settings → Environment Variables → add `APPLE_HEALTH_SYNC_SECRET`.

Generate a random secret with PowerShell:
```powershell
-join (1..20 | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

---

## 2. Run the Supabase migration (one-time)

Open Supabase → SQL Editor → New query. Paste and run:

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

> The endpoint handles a missing table gracefully (returns `table_missing` JSON, not a crash). Skip this for initial testing if needed.

---

## 3. Pick your endpoint

### Option A — Local (same Wi-Fi, dev server running)

`localhost` does not work from iPhone. Use your Windows PC's LAN IP instead.

**Find your LAN IP:**
```powershell
ipconfig
# Look for: IPv4 Address . . . . . : 192.168.x.x
```

**Endpoint:**
```
http://192.168.x.x:3000/api/integrations/apple-health/sync
```

**Requirements before the Shortcut will reach it:**
- iPhone and PC on the same Wi-Fi network
- `npm run dev` running on the PC
- Windows Firewall must allow inbound connections on port 3000
  - If blocked: Windows Security → Firewall → Allow an app → add `node.exe` or add a port rule for 3000
- `APPLE_HEALTH_SYNC_SECRET` set in `.env.local`

**Quick test:** open `http://192.168.x.x:3000` in iPhone Safari. If you see Picard OS, the connection works.

---

### Option B — Production (Vercel, works anywhere)

```
https://picard-os.vercel.app/api/integrations/apple-health/sync
```

Use this when:
- On campus Wi-Fi (most college networks isolate devices — phone cannot reach PC)
- You want the Shortcut to work even when your PC is off
- `APPLE_HEALTH_SYNC_SECRET` is set in Vercel environment variables

---

## 4. Build the iOS Shortcut (Steps-only MVP)

Open **Shortcuts** on iPhone → **+** → rename to **"Picard Health Sync"**.

### Action 1 — Set BASE_URL (change this to switch local ↔ production)

- Add **Text** action
- Type your endpoint base URL. Pick one:
  - Local: `http://192.168.x.x:3000`
  - Production: `https://picard-os.vercel.app`
- Tap the result bubble → **Set Variable** → name it `BASE_URL`

*To switch between local and production later, only this one action needs to change.*

---

### Action 2 — Get today's date

- Add **Format Date** action
- Date: **Current Date**
- Format: **Custom** → type exactly: `yyyy-MM-dd`
- Tap result → **Set Variable** → name it `todayDate`

---

### Action 3 — Read step count from Health

- Add **Find Health Samples** action
- Type: **Steps**
- Sort: **Most Recent First**
- All samples (today)
- Aggregation: **Sum**
- Tap result → **Set Variable** → name it `stepCount`

---

### Action 4 — Build the JSON payload

- Add **Dictionary** action
- Add these keys:

| Key | Type | Value |
|-----|------|-------|
| `schemaVersion` | Number | `1` |

- Add another **Dictionary** action for the inner `daily` object:

| Key | Type | Value |
|-----|------|-------|
| `date` | Text | Variable: `todayDate` |
| `steps` | Number | Variable: `stepCount` |
| `source` | Text | `apple_health` |
| `syncedAt` | Text | Variable: **Current Date** → Format as **ISO 8601** |

- Tap this second dictionary result → **Set Variable** → name it `dailyPayload`

- Go back to the first dictionary and add:

| Key | Type | Value |
|-----|------|-------|
| `daily` | Dictionary | Variable: `dailyPayload` |

- Tap the first dictionary result → **Set Variable** → name it `syncBody`

---

### Action 5 — POST to Picard OS

- Add **Get Contents of URL** action
- **URL:** tap the field → insert Variable `BASE_URL` → then type `/api/integrations/apple-health/sync`
  *(the field should read: `[BASE_URL]/api/integrations/apple-health/sync`)*
- **Method:** POST
- **Headers:** tap Add New Header twice:
  - `Content-Type` → `application/json`
  - `X-AH-Secret` → paste your secret value (same as `APPLE_HEALTH_SYNC_SECRET`)
- **Request Body:** JSON
  - Body: Variable: `syncBody`

---

### Action 6 — (Optional) Notify on success

- Add **Show Notification**
- Title: `Health synced`
- Body: `Steps sent to Picard OS`

---

### Run it

Tap **▶ Run** in the top right. iOS will ask for Health permission the first time — allow **Steps**. If the Shortcut completes without error, the sync worked.

---

### Set up daily automation

1. Shortcuts → **Automation** tab → **+** → **Personal Automation**
2. **Time of Day** → 11:55 PM → Daily
3. Add action: **Run Shortcut** → choose "Picard Health Sync"
4. **Turn off "Ask Before Running"** → runs silently overnight

---

## 5. Verify it worked

**PowerShell smoke test** (run on PC while `npm run dev` is running):

```powershell
$secret = "your_secret_here"
$today  = (Get-Date -Format "yyyy-MM-dd")
$body   = "{`"schemaVersion`":1,`"daily`":{`"date`":`"$today`",`"steps`":8500,`"source`":`"apple_health`",`"syncedAt`":`"$(Get-Date -Format o)`"}}"

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integrations/apple-health/sync" `
  -Method POST `
  -Headers @{ "X-AH-Secret" = $secret; "Content-Type" = "application/json" } `
  -Body $body

# Success: { synced: true, date: "...", fieldsPatched: ["steps"], workoutsAdded: 0 }
```

**In the app:**
- Trends → steps chart shows today's count
- Fitness → Apple Health card shows "Receiving"
- Settings → Apple Health row shows "Last sync X minutes ago"
- Ask XODUS: *"How many steps today?"* → answers with the real number

---

## 6. Add more data later (after steps work)

Once steps sync is confirmed working, expand the Shortcut by adding these fields to the `daily` dictionary:

| Field | Health sample to read | Notes |
|---|---|---|
| `walkingRunningDistanceMeters` | Walking + Running Distance | Aggregation: Sum |
| `activeEnergyKcal` | Active Energy Burned | Aggregation: Sum |
| `restingHeartRate` | Resting Heart Rate | Most Recent, Limit 1 |
| `sleepHours` | Sleep Analysis | Sum in hours — WHOOP wins if both present |
| `weightKg` | Body Mass | Most Recent, Limit 1 — kg, server converts to lb |

Do not add these until the steps-only Shortcut is confirmed working. Add one at a time.

Workout sync is a separate flow — each workout needs `externalId`, `startTime`, `endTime`, and `activityType` (HKWorkoutActivityType string). Document separately once needed.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 Unauthorized | `X-AH-Secret` in Shortcut doesn't match env var | Copy-paste the secret — no typos, no trailing space |
| 404 Not Found | Wrong URL | Check `BASE_URL` + `/api/integrations/apple-health/sync` exactly |
| 400 "schemaVersion must be 1" | Missing or wrong schemaVersion | Outer dictionary must have key `schemaVersion` = Number `1` |
| 400 "daily.source must be apple_health" | Wrong value | `source` key must be the exact text `apple_health` |
| 500 / `table_missing` | `integration_meta` SQL not run | Run the SQL in § 2 — or ignore for now, steps still sync |
| iPhone can't reach PC | Firewall, wrong IP, or campus device isolation | Try production endpoint (Option B) — works on any network |
| Shortcut runs but steps = 0 | Health permission not granted | Settings → Privacy & Security → Health → Shortcuts → allow Steps |
| Steps appear in Shortcut but don't reach app | Request body not set to JSON | `Get Contents of URL` → Request Body → must be **JSON**, not Form |

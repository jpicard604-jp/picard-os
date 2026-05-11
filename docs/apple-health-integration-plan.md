# Apple Health Integration Plan

> **Owner:** Jackson · **Status:** Phase 0 complete (data model + endpoint scaffold) · **Last updated:** 2026-05-10

This document is the source of truth for how Picard OS / XODUS will pull Apple Health data from Jackson's iPhone. Read this before adding any Apple Health code.

---

## 1. Why the ZIP export is not the main path

Apple's `Export All Health Data` produces a ~50–500 MB XML file inside a ZIP. Working with it has three structural problems for this app:

1. **Manual cadence.** Jackson has to remember to export, AirDrop, and upload — daily or weekly. He has explicitly said he will not do this repeatedly.
2. **Stale data.** By the time it's exported, the data is already hours-to-days old. XODUS daily guidance and Trends need fresh-enough numbers for "today" to be useful.
3. **Heavy parsing.** The XML schema is verbose; client-side parsing of a 200 MB file blows the browser tab. Even with streamed parsing, the cost-per-byte is enormous compared to a daily summary.

ZIP export is kept as a **last-resort fallback** (Phase 5) but is explicitly not the architecture.

---

## 2. Platform reality check

Picard OS is a **Next.js 16 web app + PWA**. A web app *cannot* read HealthKit. There is no JavaScript HealthKit API. iOS Safari does not expose it. A service worker cannot reach it.

Three viable paths exist to get HealthKit data into the app:

| Path | What it is | When usable | Effort |
|------|------------|------------|--------|
| **A. iOS Shortcut → HTTP POST** | Shortcuts can read HealthKit values via `Find Health Sample`, build JSON, and POST to a URL. Can be scheduled to run automatically (Automation → Time of Day) without opening the app. | **Today** — no native code | Low |
| **B. Capacitor wrapper + HealthKit plugin** | Wrap the Next.js app with Capacitor, install `@perfood/capacitor-healthkit` (or similar), bridge to a JS API, run background fetch. Distributed via TestFlight to Jackson's phone. | Phase 2 | Medium |
| **C. Native SwiftUI companion app** | Tiny native app that does HealthKit only and POSTs to the same endpoint. The Picard OS web app stays untouched. | Phase 2/3 | Medium-high |

The endpoint is the same in all three cases. Path A unlocks data today with zero native code. Paths B/C are the long-term answer.

---

## 3. Target architecture

```
┌──────────────────────────┐
│  iPhone (Jackson)        │
│  ┌────────────────────┐  │
│  │  HealthKit         │  │
│  └─────────┬──────────┘  │
│            │             │
│  ┌─────────┴──────────┐  │
│  │ iOS Shortcut       │  │  ← Phase 1 MVP
│  │  · pulls daily     │  │
│  │  · POSTs JSON      │  │
│  └─────────┬──────────┘  │
│        OR                │
│  ┌─────────┴──────────┐  │
│  │ Capacitor app      │  │  ← Phase 2+
│  │  · background fetch│  │
│  │  · richer HKQuery  │  │
│  └─────────┬──────────┘  │
└────────────┼─────────────┘
             │ HTTPS POST + X-AH-Secret header
             ▼
┌─────────────────────────────────────────────────┐
│  /api/integrations/apple-health/sync            │  ← this repo (built)
│   · validates schema + secret                    │
│   · patches daily_logs (only non-null fields)    │
│   · dedupes workouts via external_id             │
│   · writes integration_meta heartbeat            │
└────────────┬────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────┐
│  Supabase (daily_logs · activity_logs)           │
└────────────┬────────────────────────────────────┘
             ▼
┌─────────────────────────────────────────────────┐
│  Picard OS web app — Trends · Fitness · XODUS    │
│                       · /brain                   │
└─────────────────────────────────────────────────┘
```

---

## 4. Data types

Defined in `lib/apple-health/types.ts`. The on-the-wire JSON envelope:

```ts
interface AppleHealthSyncEnvelope {
  schemaVersion: 1
  daily: AppleHealthDailySync
}

interface AppleHealthDailySync {
  date:                          string   // YYYY-MM-DD (iPhone local)
  steps?:                        number
  walkingRunningDistanceMeters?: number
  activeEnergyKcal?:             number
  restingEnergyKcal?:            number
  flightsClimbed?:               number
  exerciseMinutes?:              number
  standHours?:                   number
  sleepHours?:                   number
  restingHeartRate?:             number
  averageHeartRate?:             number
  hrvMs?:                        number
  vo2Max?:                       number
  weightKg?:                     number
  workouts?:                     AppleHealthWorkoutSync[]
  source:                        'apple_health'
  syncedAt:                      string   // ISO
}
```

---

## 5. Data mapping table

| Apple Health field            | Storage destination          | Unit conversion          | Notes |
|-------------------------------|------------------------------|--------------------------|-------|
| `steps`                       | `daily_logs.steps`           | —                        | **Primary source of steps** (WHOOP does not expose) |
| `walkingRunningDistanceMeters`| (TBD column or workout-only) | meters → miles in workout| Phase 2: add `daily_logs.distance_miles` if useful |
| `activeEnergyKcal`            | (TBD column)                 | —                        | Phase 2: add `daily_logs.active_energy` |
| `sleepHours`                  | `daily_logs.sleep_hours`     | —                        | Only patched if WHOOP didn't already write it |
| `restingHeartRate`            | `daily_logs.resting_hr`      | —                        | WHOOP wins if both present (see § 6) |
| `hrvMs`                       | `daily_logs.hrv`             | rounded to int           | WHOOP wins if both present |
| `weightKg`                    | `daily_logs.weight`          | kg × 2.20462 → lb        | Most-recent-wins; flag conflicts |
| `vo2Max`                      | (TBD column)                 | —                        | Phase 2 |
| `workouts[]`                  | `activity_logs`              | meters → miles           | Dedupe by `(user_id, external_id=HK UUID)` |

Fields listed as TBD are accepted by the endpoint today but not yet persisted — see `mapAppleHealthToDailyPatch` in `lib/apple-health/map.ts`.

---

## 6. Source precedence rules (Apple Health × WHOOP)

When both sources push to the same column, the rule is:

| Field             | Winner                 | Why |
|-------------------|------------------------|-----|
| `steps`           | **Apple Health**       | WHOOP does not provide steps |
| `recovery_score`  | **WHOOP only**         | Apple Health has no equivalent |
| `strain`          | **WHOOP only**         | Apple Health has no equivalent |
| `hrv`             | **WHOOP** (fresher)    | WHOOP measures sleep HRV; AH HRV is less consistent |
| `resting_hr`      | **WHOOP** (sleep RHR)  | More accurate than AH passive RHR |
| `sleep_hours`     | **WHOOP**              | Stage-aware, more accurate than AH |
| `weight`          | most-recent            | Either source is fine; record timestamp |
| workouts          | both, deduped          | Same workout never duplicated thanks to `external_id` |

**Implementation:** the endpoint only PATCHes fields that have a value in the incoming payload. The WHOOP route already does the same. Whichever ran most recently wins for shared fields — and the iOS Shortcut for Apple Health should *not* include fields that WHOOP owns better (a Shortcut-side filter; documented in the Shortcut setup section).

---

## 7. Supabase schema plan

### 7.1 No new tables required for Phase 1

`daily_logs.steps` already exists in `docs/supabase-phase1-schema.sql`. `activity_logs` already has `source` and `external_id` for dedupe. The endpoint targets these existing tables.

### 7.2 New `integration_meta` table (Phase 1 helper)

Lightweight per-integration heartbeat / last-sync record. Used by GET endpoints to report "last sync at" without needing a tokens table.

```sql
create table if not exists integration_meta (
  user_id     uuid          not null references profiles(id) on delete cascade,
  key         text          not null,    -- e.g. 'apple_health_last_sync'
  value       text,                       -- JSON blob payload
  updated_at  timestamptz   not null default now(),
  primary key (user_id, key)
);

alter table integration_meta enable row level security;

create policy "integration_meta: owner only"
  on integration_meta for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());
```

### 7.3 Future extension columns (Phase 2)

When richer Apple Health data is needed in daily_logs:

```sql
alter table daily_logs add column if not exists active_energy_kcal integer;
alter table daily_logs add column if not exists distance_meters    integer;
alter table daily_logs add column if not exists exercise_minutes   integer;
alter table daily_logs add column if not exists vo2_max            numeric(4,1);
```

Add a `health_sources` JSONB column (or a separate `health_sources` table) when conflict tracking becomes important.

---

## 8. Privacy & security

- **Minimum data, by design.** Phase 1 requests only daily summaries — no raw heart-rate sample streams, no mindfulness data, no menstrual cycle data, no clinical records.
- **No inferred mental health.** XODUS does not infer mood from biometric data. Mood is self-reported via `daily_logs.mood`.
- **Shared-secret auth.** The endpoint requires `X-AH-Secret` header. The secret lives in `APPLE_HEALTH_SYNC_SECRET` env var only. Rotate by changing the env var + Shortcut header.
- **No raw HealthKit identifiers leak to the client.** External IDs are stored server-side in `activity_logs.external_id`.
- **User can disconnect.** Disconnect = rotate secret + delete the Shortcut. Data already synced stays in Supabase; the user can delete via Settings → Clear All Data.
- **HTTPS only.** Vercel deployment enforces HTTPS — the Shortcut MUST POST to the `https://` URL.

---

## 9. MVP phases

| Phase | Scope | Status |
|-------|-------|--------|
| **0. Data model + honest UI** | Types, mapper, endpoint scaffold with shared-secret auth, Settings row labeled "Planned" | ✅ Done |
| **1. iOS Shortcut MVP** | Author Shortcut that POSTs daily JSON; document in this file; test against deployed endpoint | TODO |
| **2. integration_meta + extra columns** | Run § 7.2 SQL; optionally add § 7.3 columns | TODO |
| **3. Capacitor companion** | Wrap app with Capacitor, install HealthKit plugin, background sync at 6am local | TODO |
| **4. XODUS guidance using Apple Health** | Steps-vs-usual signal, activity-minutes signal, distance signal feeding daily brief | TODO |
| **5. ZIP fallback (optional)** | Upload Center accepts `export.zip`, parses minimal XML, backfills historical days | TODO (low priority) |

---

## 10. iOS Shortcut authoring notes (Phase 1)

A working Shortcut should:

1. **Trigger.** Personal Automation → Time of Day → 11:55 PM local. (Or run manually.)
2. **Read.** `Find Health Samples` actions for: Step Count (sum today), Walking + Running Distance (sum today), Active Energy (sum today), Heart Rate (avg today), Resting Heart Rate (latest), Sleep Analysis (last night, hours).
3. **Build dictionary.** Compose a Dictionary matching `AppleHealthSyncEnvelope` shape.
4. **Get Contents of URL.**
   - URL: `https://<your-vercel-domain>/api/integrations/apple-health/sync`
   - Method: POST
   - Headers: `Content-Type: application/json`, `X-AH-Secret: <APPLE_HEALTH_SYNC_SECRET>`
   - Request Body: JSON, set to the dictionary built in step 3.
5. **(Optional) Notify.** Show a notification on success.

The Shortcut should only include fields it actually has — missing fields stay undefined and the server PATCHes only what's present.

---

## 11. Test plan

- **Smoke test endpoint.** `curl -X POST https://localhost:3000/api/integrations/apple-health/sync -H 'X-AH-Secret: $SECRET' -H 'Content-Type: application/json' -d '{"schemaVersion":1,"daily":{"date":"2026-05-10","steps":8421,"source":"apple_health","syncedAt":"2026-05-10T23:55:00Z"}}'`
- **Unauthorized:** same call without the header → 401.
- **Invalid:** missing `date` → 400 with the validator error.
- **Idempotent workouts:** POST same payload twice → workoutsAdded goes to 0 on second call.
- **Patch-only:** POST with only `steps` → recovery_score / strain unchanged.
- **WHOOP coexistence:** run WHOOP sync first, then Apple Health sync — recovery/HRV preserved, steps added.

---

## 12. Remaining TODOs

- [ ] Run `integration_meta` migration in Supabase (§ 7.2)
- [ ] Author and install iOS Shortcut on Jackson's iPhone (§ 10)
- [ ] Add `APPLE_HEALTH_SYNC_SECRET` to Vercel env vars and `.env.local`
- [ ] Update `FitnessWidget` / `QuickStats` copy to say "Apple Health planned" when `steps` is null
- [ ] Update `lib/xodus/brain.ts` readiness signal to flag missing steps until AH connects
- [ ] Add Apple Health domain hub to `lib/brain-graph.ts` once data is flowing (Phase 4)
- [ ] Decide whether to add `active_energy_kcal`, `distance_meters`, `exercise_minutes` columns now (Phase 2)
- [ ] Capacitor evaluation: spike a TestFlight build to confirm HealthKit plugin works (Phase 3)
- [ ] Document Shortcut JSON template inside this file once authored
- [ ] Long-term: support conflict UI in Settings when WHOOP and Apple Health disagree on weight

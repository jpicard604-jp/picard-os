# Picard OS — Supabase Schema Plan

> Status: **Planning only** — no tables created, no data migrated.
> Last updated: 2026-05-10
> Author: Claude Code (schema review pass)

---

## Context

Picard OS currently uses `localStorage` as the primary data store. All six storage keys hold real user-generated data with seed/fallback data used only when a key is empty. This schema maps directly to the existing TypeScript types so the localStorage → Supabase migration path requires a camelCase → snake_case transform layer only — no structural redesign.

Single-user app (Jpicky / Jean-Paul Picard). No multi-tenancy. Supabase Auth will eventually gate all access; until then, the admin client handles writes server-side.

---

## localStorage Keys → Supabase Table Mapping

| localStorage Key | TypeScript Type | Supabase Table(s) |
|---|---|---|
| `picard_daily_logs_v1` | `Record<string, DailyLog>` | `daily_logs` |
| `picard_activity_logs_v1` | `ActivityLog[]` | `activity_logs` + `activity_exercises` |
| `picard_projects_v1` | `Project[]` | `projects` + `project_tasks` + `project_updates` |
| `picard_voice_logs_v1` | `VoiceLog[]` | `voice_logs` |
| `picard_uploads_v1` | `UploadedFile[]` | `uploads` |
| `picard_stack_v1` | `StackItem[]` | `stack_items` |
| `picard_stack_reset_v1` | `string` (date) | handled via `stack_logs.date` — no direct table needed |
| *(derived)* | XODUS brain output | `xodus_messages` (optional cache) |

---

## Proposed Schema

### `profiles`

One row per user. Single-user app — this table will have exactly one row.

```sql
create table profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  handle      text        not null default 'Jpicky',
  display_name text       not null default 'Jackson',
  body_weight_default numeric(5,1),
  protein_target  integer not null default 180,
  calorie_target  integer not null default 2500,
  screen_time_target numeric(3,1) not null default 2.0,
  weekly_workout_target integer not null default 5,
  timezone    text        not null default 'America/Los_Angeles',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;
create policy "owner only" on profiles for all using (id = auth.uid());
```

---

### `daily_logs`

One row per user per calendar day. Maps exactly to `DailyLog` in `lib/storage.ts`.

```sql
create table daily_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  date            date        not null,
  -- Nutrition
  calories        integer,
  calorie_target  integer,
  protein         integer,
  protein_target  integer,
  water           numeric(4,1),              -- litres or oz, whichever the UI records
  -- Body
  weight          numeric(5,1),              -- lbs
  -- Sleep
  sleep_hours     numeric(4,2),
  sleep_quality   integer,                   -- 0–100
  -- Activity
  steps           integer,
  -- Screen
  screen_time     numeric(4,2),              -- hours
  instagram_time  numeric(4,2),              -- hours
  -- Habits
  smoked_today    boolean     not null default false,
  drank_today     boolean     not null default false,
  -- Mental
  confidence_score integer,                  -- 1–10
  mood            integer,                   -- 1–5
  notes           text        not null default '',
  -- Recovery (manual / WHOOP)
  recovery_score  integer,                   -- 0–100
  hrv             integer,                   -- ms
  resting_hr      integer,                   -- bpm
  strain          numeric(4,2),              -- 0–21
  -- Metadata
  saved_at        timestamptz,               -- client-side save timestamp from DailyLog.savedAt
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, date)
);

create index on daily_logs (user_id, date desc);

-- RLS
alter table daily_logs enable row level security;
create policy "owner only" on daily_logs for all using (user_id = auth.uid());
```

**Notes:**
- `unique(user_id, date)` enables safe upserts from localStorage migration.
- `saved_at` preserves the client-originated save timestamp for audit purposes.
- The `date` column is `date` (not `timestamptz`) because each log represents one calendar day.

---

### `activity_logs`

One row per workout/activity session. Maps to `ActivityLog` in `lib/fitness.ts`.

```sql
create table activity_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  date            date        not null,
  type            text        not null,      -- 'strength' | 'run' | 'row' | 'walk' | 'swim' | 'bike' | 'recovery' | 'mobility' | 'hiit' | 'custom'
  label           text,
  duration        integer,                   -- minutes
  distance        numeric(6,2),              -- miles
  distance_unit   text        not null default 'miles',
  steps           integer,
  calories        integer,
  rpe             integer,                   -- 1–10
  notes           text,
  source          text        not null default 'manual', -- 'manual' | 'voice' | 'whoop' | 'strava' | 'apple_health' | 'imported'
  external_id     text,                      -- for WHOOP/Strava dedup
  heart_rate_avg  integer,
  heart_rate_max  integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on activity_logs (user_id, date desc);
create index on activity_logs (user_id, type);

-- RLS
alter table activity_logs enable row level security;
create policy "owner only" on activity_logs for all using (user_id = auth.uid());
```

---

### `activity_exercises`

Normalised from `ActivityLog.exercises[]` (`ExerciseSet[]` in `lib/fitness.ts`). One row per exercise set within an activity.

```sql
create table activity_exercises (
  id          uuid        primary key default gen_random_uuid(),
  activity_id uuid        not null references activity_logs(id) on delete cascade,
  exercise    text        not null,
  sets        integer,
  reps        integer,
  weight      numeric(6,2),
  weight_unit text        not null default 'lb',   -- 'lb' | 'kg' | 'bw'
  rpe         integer,
  notes       text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index on activity_exercises (activity_id);
create index on activity_exercises (exercise);  -- supports progressive overload queries

-- RLS: inherit through parent activity_log
alter table activity_exercises enable row level security;
create policy "owner only via parent" on activity_exercises for all
  using (
    exists (
      select 1 from activity_logs al
      where al.id = activity_exercises.activity_id
        and al.user_id = auth.uid()
    )
  );
```

**Notes:**
- The `exercise` index enables `getExerciseHistory()` queries without a full scan.
- `sort_order` preserves the order exercises were logged.

---

### `voice_logs`

Maps to `VoiceLog` in `lib/storage.ts`.

```sql
create table voice_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  timestamp   timestamptz not null,
  transcript  text        not null,
  duration    integer,                       -- seconds (VoiceLog.duration is a number)
  created_at  timestamptz not null default now()
);

create index on voice_logs (user_id, timestamp desc);

-- RLS
alter table voice_logs enable row level security;
create policy "owner only" on voice_logs for all using (user_id = auth.uid());
```

---

### `projects`

Maps to `Project` in `lib/projects.ts` (excluding embedded arrays, which get their own tables).

```sql
create table projects (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  title       text        not null,
  description text,
  status      text        not null default 'active',   -- 'active' | 'paused' | 'complete'
  priority    integer     not null default 3,          -- 1–5
  progress    integer     not null default 0,          -- 0–100
  target_date date,
  notes       text,
  urgency     text,                                    -- 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on projects (user_id, status);
create index on projects (user_id, priority);

-- RLS
alter table projects enable row level security;
create policy "owner only" on projects for all using (user_id = auth.uid());
```

---

### `project_tasks`

Normalised from `Project.tasks[]` (`Task[]` in `lib/projects.ts`).

```sql
create table project_tasks (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references projects(id) on delete cascade,
  text        text        not null,
  done        boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on project_tasks (project_id);

-- RLS: inherit through parent project
alter table project_tasks enable row level security;
create policy "owner only via parent" on project_tasks for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_tasks.project_id
        and p.user_id = auth.uid()
    )
  );
```

---

### `project_updates`

Normalised from `Project.updates[]` (`ProjectUpdate[]` in `lib/projects.ts`).

```sql
create table project_updates (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references projects(id) on delete cascade,
  timestamp       timestamptz not null,
  text            text        not null,
  source          text        not null default 'manual',  -- 'voice' | 'manual'
  progress_before integer,
  progress_after  integer,
  created_at      timestamptz not null default now()
);

create index on project_updates (project_id, timestamp desc);

-- RLS: inherit through parent project
alter table project_updates enable row level security;
create policy "owner only via parent" on project_updates for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_updates.project_id
        and p.user_id = auth.uid()
    )
  );
```

---

### `stack_items`

Supplement/compound definitions. Maps to `StackItem` in `lib/mock-data.ts`. The `takenToday` boolean is NOT stored here — it lives in `stack_logs`.

```sql
create table stack_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  name        text        not null,
  category    text        not null,   -- 'Performance' | 'Recovery' | 'Health' | 'Stimulant' | 'Peptide'
  dose        text        not null,
  timing      text        not null,   -- 'AM' | 'PM' | 'Pre-workout' | 'With meals' | 'As needed'
  notes       text,
  active      boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on stack_items (user_id, timing);

-- RLS
alter table stack_items enable row level security;
create policy "owner only" on stack_items for all using (user_id = auth.uid());
```

---

### `stack_logs`

Daily taken/not-taken log per compound. Replaces the `takenToday` field and the `picard_stack_reset_v1` client-side reset key.

```sql
create table stack_logs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  stack_item_id   uuid        not null references stack_items(id) on delete cascade,
  date            date        not null,
  taken           boolean     not null default false,
  taken_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique(stack_item_id, date)
);

create index on stack_logs (user_id, date desc);

-- RLS
alter table stack_logs enable row level security;
create policy "owner only" on stack_logs for all using (user_id = auth.uid());
```

**Notes:**
- The `unique(stack_item_id, date)` constraint enables safe daily upserts and eliminates the need for the `picard_stack_reset_v1` client-side reset key.
- Query for "today's stack state": `select si.*, coalesce(sl.taken, false) as taken_today from stack_items si left join stack_logs sl on sl.stack_item_id = si.id and sl.date = current_date where si.user_id = auth.uid()`.

---

### `uploads`

Maps to `UploadedFile` in `lib/mock-data.ts`. Does **not** store `previewDataUrl` — base64 blobs must go to Supabase Storage, not the database.

```sql
create table uploads (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  name            text        not null,
  file_type       text        not null,   -- 'pdf' | 'image' | 'audio' | 'csv' | 'text'
  size_bytes      integer,
  uploaded_at     timestamptz not null default now(),
  category        text,                   -- 'nutrition_screenshot' | 'progress_photo' | etc.
  storage_path    text,                   -- Supabase Storage bucket path
  extracted_text  text,                   -- OCR / Whisper transcript output
  created_at      timestamptz not null default now()
);

create index on uploads (user_id, uploaded_at desc);
create index on uploads (user_id, category);

-- RLS
alter table uploads enable row level security;
create policy "owner only" on uploads for all using (user_id = auth.uid());
```

**Key difference from localStorage:** `UploadedFile.previewDataUrl` (base64 image) is dropped from the DB. Files go to Supabase Storage; `storage_path` holds the bucket object key.

---

### `xodus_messages` (optional)

Cache for XODUS daily briefs. Avoids re-running the brain engine on every page load once Supabase is the data source.

```sql
create table xodus_messages (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  date            date        not null,
  execution_score integer,
  urgency         text,
  brief           jsonb       not null default '[]',  -- string[]
  next_action     jsonb,                               -- { text, href }
  insights        jsonb,                               -- BrainInsight[]
  logged_today    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, date)
);

-- RLS
alter table xodus_messages enable row level security;
create policy "owner only" on xodus_messages for all using (user_id = auth.uid());
```

**Notes:**
- This table is optional for Phase 1. XODUS currently runs entirely client-side from localStorage. This becomes useful in Phase 3 when generating briefs server-side.
- Stale on any data update — invalidate and regenerate when `daily_logs`, `activity_logs`, or `projects` are updated for today.

---

## Row Level Security Summary

| Table | Policy | Enforcement |
|---|---|---|
| `profiles` | `id = auth.uid()` | Direct |
| `daily_logs` | `user_id = auth.uid()` | Direct |
| `activity_logs` | `user_id = auth.uid()` | Direct |
| `activity_exercises` | via parent `activity_logs` | `exists` subquery |
| `voice_logs` | `user_id = auth.uid()` | Direct |
| `projects` | `user_id = auth.uid()` | Direct |
| `project_tasks` | via parent `projects` | `exists` subquery |
| `project_updates` | via parent `projects` | `exists` subquery |
| `stack_items` | `user_id = auth.uid()` | Direct |
| `stack_logs` | `user_id = auth.uid()` | Direct |
| `uploads` | `user_id = auth.uid()` | Direct |
| `xodus_messages` | `user_id = auth.uid()` | Direct |

All tables have RLS enabled. Until Supabase Auth is wired up, server-side writes use the admin client (bypasses RLS safely). Client-side reads will use the browser client after auth is implemented.

---

## Phased Sync / Migration Plan

### Phase 1 — localStorage primary, Supabase backup (current target)

**Goal:** No user-visible changes. Supabase is write-only from the app's perspective.

- Implement `lib/supabase/sync.ts` with functions:
  - `syncDailyLog(log: DailyLog)` — upserts one row to `daily_logs`
  - `syncActivityLog(entry: ActivityLog)` — inserts/upserts `activity_logs` + `activity_exercises`
  - `syncProjects(projects: Project[])` — upserts `projects`, `project_tasks`, `project_updates`
  - `syncVoiceLog(log: VoiceLog)` — inserts to `voice_logs`
  - `syncStackState(items: StackItem[], date: string)` — upserts `stack_logs` for today
  - `exportAllToSupabase()` — one-shot migration of all existing localStorage data
- All sync functions call after the localStorage write succeeds (fire-and-forget, non-blocking).
- Use the browser Supabase client (`lib/supabase/client.ts`) — no server round-trip.
- Data transforms: camelCase → snake_case, `date: string` → `date: Date`.
- Dedup strategy: use unique constraints (`(user_id, date)` for daily_logs; `external_id` for activity_logs from integrations).

**Risk:** No auth yet. Browser client anonymous writes will fail with RLS. Mitigation: temporarily disable RLS policies during Phase 1 or use a server action to proxy writes.

---

### Phase 2 — Supabase as primary read, localStorage as fallback

**Goal:** App prefers Supabase data on load; localStorage is kept in sync as offline cache.

- On app load: fetch today's data from Supabase. If successful and more recent than localStorage, update localStorage with fetched data.
- On save: write to localStorage first (instant feedback), then sync to Supabase.
- Conflict resolution: last-write-wins using `updated_at` timestamp. Client timestamp wins if within 30 seconds of server.
- Implement `lib/supabase/fetch.ts` with functions mirroring the localStorage read functions (`getTodayLogFromSupabase`, `getActivityLogsFromSupabase`, etc.).
- The XODUS brain engine continues to read from localStorage (no change to brain.ts or daily-status.ts).
- Auth (Supabase Auth with magic link or Google) must be implemented before or alongside Phase 2.

---

### Phase 3 — Supabase primary, localStorage as offline cache

**Goal:** localStorage is a read-through cache only. All writes go to Supabase; localStorage is populated from Supabase on load.

- Implement a write queue in localStorage for offline mutations.
- Service worker intercepts writes when offline, queues them, syncs on reconnect.
- XODUS brief generation can optionally move server-side (Server Component or Route Handler) using `xodus_messages` table as cache.
- localStorage is treated as stale after 5 minutes; always re-fetch from Supabase on mount.
- Supabase Realtime optional for cross-device sync (e.g., desktop logs a workout, phone dashboard updates).

---

## Risk Register

| Risk | Severity | Phase | Mitigation |
|---|---|---|---|
| **Duplicate records** during localStorage migration | Medium | Phase 1 | `unique(user_id, date)` + `on conflict do update` (upsert) for daily_logs; `external_id` for activity_logs |
| **No auth / user_id** | High | Phase 1 | Use admin client server-side until Supabase Auth is wired. Never bypass RLS with anon client without auth. |
| **Offline edits** lose sync | Medium | Phase 2–3 | Write queue in localStorage; sync on reconnect. Timestamp comparison for conflict resolution. |
| **localStorage legacy data** lacks user_id | Medium | Phase 1 | `exportAllToSupabase()` runs once, associates all data with the known single user UUID. |
| **camelCase → snake_case mismatch** | Low | Phase 1 | Implement a transform layer in `lib/supabase/sync.ts`. Never write raw TS objects to SQL. |
| **`UploadedFile.previewDataUrl` too large for DB** | High | Phase 1 | Drop previewDataUrl from uploads table. Store files in Supabase Storage bucket; save `storage_path` only. |
| **Secret key misuse** | Critical | Always | `SUPABASE_SECRET_KEY` only in `lib/supabase/server.ts`. Never import server.ts in 'use client' files. Never prefix with NEXT_PUBLIC_. |
| **Hydration mismatch from Supabase data** | Medium | Phase 2 | Fetch Supabase data in `useEffect` only — never in `useState` initializers. See lessons.md. |
| **`picard_stack_reset_v1` not in STORAGE_KEYS** | Low | Phase 1 | Document it. In Phase 2, daily reset is handled by `stack_logs` date column — reset key becomes obsolete. |
| **RLS blocks anon browser client** | High | Phase 1 | Until auth lands, either: (a) proxy all writes through a Route Handler using admin client, or (b) add a temporary anon-access policy scoped to the single known user UUID. |

---

## XODUS Data Flow (Current)

```
localStorage (all 5 keys)
    ↓ gatherBrainInput()
    ↓ runXodusBrain()
    ↓ generateDailyStatus()
    ↓ generateXodusOutput()
    ↓ XodusCard / /xodus page renders
```

XODUS reads everything from localStorage. No changes needed to the brain engine until Phase 2 when Supabase becomes the data source. In Phase 2, replace `gatherBrainInput()`'s localStorage calls with Supabase fetch calls (or keep localStorage as cache and let Phase 1 sync keep them equivalent).

---

## Recommended Next Step

Implement Phase 1: create `lib/supabase/sync.ts` with upsert functions for each table. Wire them as fire-and-forget calls after each existing localStorage save (`saveTodayLog`, `addActivityLog`, `saveProjects`, `saveVoiceLog`). This adds Supabase backup without touching the UI or breaking any existing functionality.

**Do not create tables until this plan is reviewed and the schema is confirmed.**

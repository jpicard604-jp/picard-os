-- =============================================================================
-- Picard OS — Phase 1 Supabase Schema
-- =============================================================================
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- Tables are created in dependency order (profiles first, child tables last).
-- Run as the postgres role (default in the Supabase SQL Editor).
--
-- PHASE 1 SYNC NOTE:
--   app/api/sync/route.ts uses PICARD_USER_ID (a server-only env var) as user_id
--   for all writes until Supabase Auth is configured. The placeholder value is
--   '00000000-0000-0000-0000-000000000001'. All writes will fail FK constraints
--   until you:
--     1. Sign in via Supabase Auth to get your real user UUID.
--     2. Set PICARD_USER_ID=<your-uuid> in .env.local and Vercel env vars.
--     3. Insert a profile row (see bootstrap block at the bottom of this file).
--   Until then, all sync writes fail silently with console.warn — localStorage
--   remains the source of truth and no data is lost.
--
-- TABLES INCLUDED (targeted by current Phase 1 sync route):
--   profiles, daily_logs, voice_logs, activity_logs, activity_exercises,
--   projects, project_tasks
--
-- TABLES DEFERRED (not targeted by Phase 1 sync route — add in Phase 1b/2):
--   project_updates  — sync route does not call mapProjectUpdate or upsert this table
--   stack_items      — stack saves are inline setStorage calls, not centralized yet
--   stack_logs       — same; stack sync deferred to Phase 1b
--   uploads          — upload saves are inline setStorage calls, not centralized yet
--   xodus_messages   — XODUS runs entirely client-side; server cache not needed until Phase 3
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- pgcrypto provides gen_random_uuid() for server-generated UUID primary keys.
-- Safe to run even if already enabled — the IF NOT EXISTS guard is idempotent.
-- In PostgreSQL 13+ gen_random_uuid() is also a built-in, but the extension
-- ensures compatibility with all Supabase tiers.

create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per user. Single-user app — this table will have exactly one row.
-- id must match an existing auth.users(id) — create your Supabase Auth user
-- before inserting a profile (see bootstrap block below).

create table if not exists profiles (
  id                    uuid          primary key references auth.users(id) on delete cascade,
  handle                text          not null default 'Jpicky',
  display_name          text          not null default 'Jackson',
  body_weight_default   numeric(5,1),
  protein_target        integer       not null default 180,
  calorie_target        integer       not null default 2500,
  screen_time_target    numeric(3,1)  not null default 2.0,
  weekly_workout_target integer       not null default 5,
  timezone              text          not null default 'America/Los_Angeles',
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

alter table profiles enable row level security;

-- USING: controls which rows can be read, updated, or deleted.
-- WITH CHECK: controls which rows can be inserted or updated INTO.
-- Service role (Phase 1 admin client) bypasses both clauses entirely.
create policy "profiles: owner only"
  on profiles for all
  using     (id = auth.uid())
  with check (id = auth.uid());


-- ---------------------------------------------------------------------------
-- daily_logs
-- ---------------------------------------------------------------------------
-- One row per user per calendar day.
-- Column names match mapDailyLog() in app/api/sync/route.ts exactly.
-- Upserted on conflict (user_id, date).

create table if not exists daily_logs (
  id               uuid          primary key default gen_random_uuid(),
  user_id          uuid          not null references profiles(id) on delete cascade,
  date             date          not null,
  -- Nutrition
  calories         integer,
  calorie_target   integer,
  protein          integer,
  protein_target   integer,
  water            numeric(4,1),          -- litres or oz, matching DailyLog.water
  -- Body
  weight           numeric(5,1),          -- lbs
  -- Sleep
  sleep_hours      numeric(4,2),
  sleep_quality    integer,               -- 0–100
  -- Activity
  steps            integer,
  -- Screen time
  screen_time      numeric(4,2),          -- hours
  instagram_time   numeric(4,2),          -- hours
  -- Habits
  smoked_today     boolean       not null default false,
  drank_today      boolean       not null default false,
  -- Mental
  confidence_score integer,               -- 1–10
  mood             integer,               -- 1–5
  notes            text          not null default '',
  -- Recovery (manual / WHOOP)
  recovery_score   integer,               -- 0–100
  hrv              integer,               -- ms
  resting_hr       integer,               -- bpm
  strain           numeric(4,2),          -- 0–21
  -- Metadata
  saved_at         timestamptz,           -- client-side save timestamp from DailyLog.savedAt
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  unique (user_id, date)
);

create index if not exists daily_logs_user_date_idx
  on daily_logs (user_id, date desc);

alter table daily_logs enable row level security;

create policy "daily_logs: owner only"
  on daily_logs for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- voice_logs
-- ---------------------------------------------------------------------------
-- One row per voice capture. id is a TEXT primary key — client generates IDs
-- in the format 'vl-{timestamp}' or 'vl-cmd-{timestamp}' (not UUIDs).
-- Upserted on conflict (id).

create table if not exists voice_logs (
  id          text          primary key,   -- client-generated: 'vl-1715000000000'
  user_id     uuid          not null references profiles(id) on delete cascade,
  timestamp   timestamptz   not null,
  transcript  text          not null,
  duration    integer,                     -- seconds
  created_at  timestamptz   not null default now()
);

create index if not exists voice_logs_user_timestamp_idx
  on voice_logs (user_id, timestamp desc);

alter table voice_logs enable row level security;

create policy "voice_logs: owner only"
  on voice_logs for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------------------------
-- One row per workout/activity session. id is UUID — client generates with
-- crypto.randomUUID() in app/fitness/page.tsx.
-- Column names match mapActivityLog() in app/api/sync/route.ts exactly.
-- Upserted on conflict (id).

create table if not exists activity_logs (
  id              uuid          primary key,   -- client-generated UUID
  user_id         uuid          not null references profiles(id) on delete cascade,
  date            date          not null,
  type            text          not null,      -- 'strength'|'run'|'row'|'walk'|'swim'|'bike'|'recovery'|'mobility'|'hiit'|'custom'
  label           text,
  duration        integer,                     -- minutes
  distance        numeric(6,2),                -- default miles
  distance_unit   text          not null default 'miles',
  steps           integer,
  calories        integer,
  rpe             integer,                     -- 1–10
  notes           text,
  source          text          not null default 'manual',
  external_id     text,                        -- for future WHOOP/Strava dedup
  heart_rate_avg  integer,
  heart_rate_max  integer,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()   -- not sent by mapper; updated by DB default on insert
);

create index if not exists activity_logs_user_date_idx
  on activity_logs (user_id, date desc);

create index if not exists activity_logs_user_type_idx
  on activity_logs (user_id, type);

alter table activity_logs enable row level security;

create policy "activity_logs: owner only"
  on activity_logs for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- activity_exercises
-- ---------------------------------------------------------------------------
-- Normalised from ActivityLog.exercises[]. One row per exercise set.
-- id is server-generated (mapper does not provide one).
-- Phase 1 sync: delete-then-insert on every activity save.
-- Column names match mapExercise() in app/api/sync/route.ts exactly.

create table if not exists activity_exercises (
  id          uuid          primary key default gen_random_uuid(),
  activity_id uuid          not null references activity_logs(id) on delete cascade,
  exercise    text          not null,
  sets        integer,
  reps        integer,                     -- string reps (e.g. 'AMRAP') stored as null here
  weight      numeric(6,2),
  weight_unit text          not null default 'lb',   -- 'lb'|'kg'|'bw'
  rpe         integer,
  notes       text,
  sort_order  integer       not null default 0,
  created_at  timestamptz   not null default now()
);

create index if not exists activity_exercises_activity_id_idx
  on activity_exercises (activity_id);

create index if not exists activity_exercises_exercise_idx
  on activity_exercises (exercise);   -- supports progressive overload queries

alter table activity_exercises enable row level security;

-- RLS inherits through parent activity_log.
-- WITH CHECK uses the same parent lookup to block inserting exercises
-- under an activity that belongs to a different user.
create policy "activity_exercises: owner via parent"
  on activity_exercises for all
  using (
    exists (
      select 1 from activity_logs al
      where al.id = activity_exercises.activity_id
        and al.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from activity_logs al
      where al.id = activity_exercises.activity_id
        and al.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
-- One row per project. id is a TEXT primary key — seed data uses slug strings
-- like 'play-productions', 'wine-room'; new user projects may also be slugs
-- or timestamp-based strings.
-- Column names match mapProject() in app/api/sync/route.ts exactly.
-- Upserted on conflict (id).

create table if not exists projects (
  id          text          primary key,   -- client-generated slug or string ID
  user_id     uuid          not null references profiles(id) on delete cascade,
  title       text          not null,
  description text,
  status      text          not null default 'active',   -- 'active'|'paused'|'complete'
  priority    integer       not null default 3,           -- 1–5
  progress    integer       not null default 0,           -- 0–100
  target_date date,
  notes       text,
  urgency     text,                                       -- 'LOW'|'MODERATE'|'HIGH'|'CRITICAL'
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists projects_user_status_idx
  on projects (user_id, status);

create index if not exists projects_user_priority_idx
  on projects (user_id, priority);

alter table projects enable row level security;

create policy "projects: owner only"
  on projects for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- project_tasks
-- ---------------------------------------------------------------------------
-- Normalised from Project.tasks[]. id is TEXT — seed data uses values like
-- 'pp-1', 'wr-2'; new tasks use 'task-{timestamp}-{random}'.
-- Column names match mapTask() in app/api/sync/route.ts exactly.
-- Phase 1 sync: delete-then-insert on every project save.
-- created_at accepts both date strings ('2026-05-01') and ISO timestamps.

create table if not exists project_tasks (
  id          text          primary key,   -- client-generated: 'pp-1' or 'task-...'
  project_id  text          not null references projects(id) on delete cascade,
  text        text          not null,
  done        boolean       not null default false,
  sort_order  integer       not null default 0,
  created_at  timestamptz   not null default now()
);

create index if not exists project_tasks_project_id_idx
  on project_tasks (project_id);

alter table project_tasks enable row level security;

-- RLS inherits through parent project.
-- WITH CHECK uses the same parent lookup to block inserting tasks
-- under a project that belongs to a different user.
create policy "project_tasks: owner via parent"
  on project_tasks for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_tasks.project_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_tasks.project_id
        and p.user_id = auth.uid()
    )
  );


-- =============================================================================
-- DEFERRED TABLES (Phase 1b / Phase 2)
-- =============================================================================
-- The following tables are NOT created here because app/api/sync/route.ts
-- does not write to them in Phase 1. Create them when the sync route is
-- extended to cover them.
--
-- project_updates  — wire in Phase 1b alongside project_updates[] sync
-- stack_items      — wire in Phase 1b once stack saves are centralised
-- stack_logs       — same
-- uploads          — wire in Phase 1b once upload saves are centralised
-- xodus_messages   — wire in Phase 3 for server-side brief caching
-- =============================================================================


-- =============================================================================
-- BOOTSTRAP (run AFTER creating your Supabase Auth account)
-- =============================================================================
-- After signing in via Supabase Auth (magic link, Google, etc.) you will have
-- a real user UUID. Replace <YOUR_SUPABASE_AUTH_UUID> below, then:
--   1. Run this INSERT in the SQL Editor to create your profile row.
--   2. Set PICARD_USER_ID=<YOUR_SUPABASE_AUTH_UUID> in .env.local.
--   3. Add the same var to Vercel env (Settings → Environment Variables).
--   4. Re-deploy or restart dev server — sync writes will then succeed.
--
-- insert into profiles (id, handle, display_name)
-- values ('<YOUR_SUPABASE_AUTH_UUID>', 'Jpicky', 'Jackson');
-- =============================================================================

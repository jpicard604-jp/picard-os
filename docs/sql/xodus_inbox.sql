-- xodus_inbox — universal intake table.
--
-- The Universal Intake route (/api/xodus/intake) and the existing Telegram
-- webhook + Apple Health Shortcut path both write here. The /signals page
-- reads from here.
--
-- Idempotent — safe to run multiple times.

create table if not exists xodus_inbox (
  id              uuid          primary key default gen_random_uuid(),
  source          text          not null default 'unknown',
  chat_id         text,
  user_id_text    text,
  username        text,
  text            text,
  media           jsonb,
  parsed_summary  text,
  brain_result    jsonb,
  actions         jsonb,
  status          text          not null default 'pending',
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists xodus_inbox_status_created_idx
  on xodus_inbox (status, created_at desc);

create index if not exists xodus_inbox_source_idx
  on xodus_inbox (source);

create index if not exists xodus_inbox_created_at_idx
  on xodus_inbox (created_at desc);

alter table xodus_inbox enable row level security;

-- Phase 1: single-user, service role only. The intake route uses the
-- server admin client which bypasses RLS. When Supabase Auth is wired in,
-- add an "owner only" policy keyed on auth.uid().

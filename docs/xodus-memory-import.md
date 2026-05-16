# XODUS Memory Imports

Lightweight, opt-in path for getting curated memory from external AI exports
(ChatGPT first, Claude and Gemini later) into Picard OS without overwriting
the existing curated XODUS memory in code.

## How it works

1. The local pipeline at `scripts/chatgpt-memory-import/` (or future siblings)
   produces a JSON seed file. The first batch lives at:
   `exports/chatgpt-memory-import/xodus-memory-seed.json`
2. In **Settings → XODUS Memory Imports**, click **Preview .json** and pick
   that seed file. Nothing is saved yet.
3. The preview panel shows totals and a per-status breakdown:
   `current / needs_review / paused / outdated`.
4. Click **Import N current** to activate only the `current` records.
   Non-current records (`needs_review`, `paused`, `outdated`) are persisted
   for visibility but **never marked as active memory**.
5. Repeat imports are safe — records are de-duplicated by `id`.

## What gets imported

- **Activated:** `status: 'current'` records only.
- **Stored but not active:** `needs_review`, `paused`, `outdated`. These remain
  visible so XODUS knows what to *not* overemphasize (e.g. paused X-POSE,
  outdated bench numbers, deprecated Navy SEAL identity arc).
- Each record carries a `source` string (e.g.
  `chatgpt_memory_import_2026_05`) so the origin is traceable.

## Storage

- Key: `picard_xodus_memory_imports_v1` (localStorage).
- Reversible: clearing this key in Settings or in DevTools removes only the
  imported records. The curated records in `lib/xodus/memory.ts` are
  untouched.
- The Backup/Export flow in Settings does **not** currently include this key.
  It's intentionally outside the main backup until the import flow stabilises.

## What this does **not** do (yet)

- Does **not** wire imported records into DeepSeek chat context. That's a
  follow-up — `getActiveCurrentImports()` in
  `lib/xodus/memory-imports.ts` is the entry point when we're ready.
- Does **not** push records into Supabase.
- Does **not** write into the real Obsidian vault (staging only lives under
  `exports/chatgpt-memory-import/obsidian-staging/`).
- Does **not** modify the curated static records in `lib/xodus/memory.ts`.

## Files

- `lib/xodus/memory-imports.ts` — types, validation, localStorage helpers.
- `app/settings/page.tsx` — preview / import / clear UI.
- `exports/chatgpt-memory-import/xodus-memory-seed.json` — first batch (40
  records, 30 `current` + 4 `needs_review` + 1 `paused` + 5 `outdated`).
- `exports/chatgpt-memory-import/Import_Decisions.md` — the decision log
  matching that seed.

## Next steps when ready

1. Wire `getActiveCurrentImports()` into the XODUS chat-context builder so
   imported `current` records influence DeepSeek responses.
2. Add an export hook so imports show up in the Obsidian vault export.
3. Add the import key to the main Backup manifest once the schema is stable.

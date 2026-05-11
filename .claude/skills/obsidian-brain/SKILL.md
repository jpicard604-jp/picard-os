# Skill: Obsidian Brain & /brain Page

**When to use:** Any task touching the `/brain` route, brain_notes, XODUS long-term memory, knowledge vault, or the obsidian export system.

## Product Vision

The `/brain` page is an **interactive force-directed node graph** — Obsidian-style, not a flat notes list. Each node is a data record (voice log, workout, project, upload, AI conversation). Edges are detected relationships.

`lib/obsidian-export.ts` is a one-time flat Markdown export for external Obsidian — **not** the living brain. The internal graph is a separate, complementary surface.

## Architecture

```
Data records (any type)
    ↓
brain_notes Supabase table (or localStorage interim)
    ↓
Vault of linked Markdown files (each record = one node with [[wiki-links]])
    ↓
Force-directed graph renderer → /brain page
```

The vault compounds over time: new knowledge auto-links to old knowledge. XODUS reads the vault at session start for cross-session context.

## Graph Library Choice

Select **one** from: `d3-force`, `Cytoscape.js`, `react-flow`, or `vis-network`. Requirements:
- Physics simulation
- Click-to-expand nodes
- Dark theme compatible
- Phase E: nodes only; Phase F: edge detection

## Node Types (planned)

| Type | Source | ID pattern |
|------|--------|-----------|
| Voice log | `picard_voice_logs_v1` | `voice_<timestamp>` |
| Workout | `picard_activity_logs_v1` | `activity_<id>` |
| Project | `picard_projects_v1` | `project_<id>` |
| Upload | `picard_uploads_v1` | `upload_<id>` |
| Daily log | `picard_daily_logs_v1` | `daily_<date>` |
| AI chat | future Supabase | `chat_<id>` |

## XODUS Context Builder

`lib/xodus/brain.ts` → `gatherBrainInput()` assembles the brain context object for each XODUS request. The vault will feed into this as a queryable knowledge base, replacing the current mock-data fallbacks.

## What NOT to do

- Do not build a flat notes list or text editor for `/brain`
- Do not conflate `lib/obsidian-export.ts` (flat Markdown export) with the living vault
- Do not truncate or reset historical records — the vault only grows
- Do not auto-link nodes without a deterministic edge detection strategy

## Files to inspect first

- `lib/obsidian-export.ts` — existing flat export (reference, not the vault)
- `lib/xodus/brain.ts` — brain context assembly
- `app/brain/` — route directory (check if exists before creating)
- `docs/obsidian-brain-guide.md` — full architecture spec (if present)

## Verification

Graph must render in browser, nodes must be interactive. `npx tsc --noEmit`. No hydration errors (graph renderer must be `'use client'` with `dynamic(() => import(...), { ssr: false })`).

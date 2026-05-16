# Picard OS — Task Log

This file tracks active and completed tasks. Claude Code updates this file for every meaningful task.

---

## [2026-05-10] XODUS Inbox UI — review & apply Telegram pending actions

**Status:** complete

**Files added:**
- `app/api/xodus/inbox/route.ts` — GET pending rows (filter: status, limit: 25)
- `app/api/xodus/inbox/[id]/route.ts` — PATCH status applied/ignored/failed
- `lib/xodus/inbox-client.ts` — `fetchInboxItems` + `patchInboxStatus`
- `components/xodus/InboxPanel.tsx` — review/apply UI with action chips, raw toggle, polling

**Files updated:**
- `app/xodus/page.tsx` — third tab `Inbox` with pending-count badge; one-shot count fetch on mount
- `docs/telegram-xodus-intake.md` — § 11 inbox flow diagram, § 12 troubleshooting, TODO checkbox

**Behavior:** Telegram messages land in `xodus_inbox` as pending. Inbox tab lists them with extracted actions. Apply runs the same `applyXodusActionsClient()` used by web chat → writes to existing localStorage stores → PATCHes the row to `applied`. Ignore PATCHes to `ignored`. Both remove from the visible list.

**Brain/Obsidian:** zero new wiring — applied items flow into existing `addNote/addGoals/addActivityLog`, which already feed `/brain` and the Obsidian export.

**Table-missing:** Inbox panel shows an amber callout linking to the doc's SQL section; Settings Telegram row already reflects the same status.

**Build:** ✓ pass (27 routes + inbox routes = 29).

---

## [2026-05-10] Neural Link force-directed upgrade + trends tooltip fix

**Status:** complete

**Ruflo/Rooflow:** checked — no project artifacts. Skipped.

**Diagnosis:** Old `/brain` was static SVG positioned by trig in `computeLayout()`. No physics, no zoom/pan/drag, no hover-fade, no animation. Looked like a graph; behaved like a poster.

**Library chosen:** `d3-force` (3.x) + `@types/d3-force`. Single small dep (~20kb gz). Kept SVG rendering (preserves Tailwind/color tokens, glow, motion classes). Implemented zoom/pan/drag manually with pointer events.

**Files changed:**
- `components/brain/BrainGraph.tsx` — full rewrite (force sim, zoom/pan, node drag, hover-fade, domain filter chips, reset, side panel with connected-nodes list)
- `app/globals.css` — added `brain-pulse` keyframe (hub breathing ring)
- `app/brain/page.tsx` — widened max-w-4xl → max-w-6xl
- `app/trends/page.tsx` — `DarkTooltip` now labels "Day" vs "7-day avg", shows source tag, sorts daily-before-average
- `package.json` — added `d3-force`, `@types/d3-force`

**Interactions implemented:** zoom (wheel), pan (drag background), drag node (pointer), hover (fade unrelated, brighten connected edges), click select (persistent), side panel with connected nodes list, domain filter chips, reset/recenter, hub breathing animation, edge opacity by type weight.

**Build:** ✓ pass (25 routes).

---

## Top-5 interaction upgrades (deferred to next passes)

1. **Card hover lift** across dashboard — subtle 1px translate-y + border brighten on `bg-[#111]` cards; use existing `transition-all duration-150`.
2. **Page transitions** — `framer-motion` (already installed) `AnimatePresence` on route changes for fade + 4px slide.
3. **Active feedback on buttons** — replace flat hover with `active:scale-[0.98] active:bg-white/[0.06]` on all `.field` and CTA buttons.
4. **Chart hover sync** — when hovering the Recovery chart, broadcast the date so HRV/Strain/Sleep charts highlight the same day. Recharts supports this via `<Tooltip>` on a shared payload.
5. **XODUS chat — streaming + typing indicator** — replace `loading` spinner with token-by-token streaming via `ReadableStream`; add 3-dot typing animation while waiting.

## Neural Link follow-ups (deferred)

- Mobile pinch-zoom (current scroll-wheel zoom doesn't translate to touch). Add `d3-zoom` or manual two-finger gesture handler.
- Search box (Cmd+K) to focus a node by label.
- "Time travel" — slider that re-runs `buildBrainGraph()` for a date in the past.
- Save node positions across sessions in `localStorage` so the layout doesn't reshuffle on reload.
- Edge type → distinct line style (dashed for `semantic`, solid for `core`, dotted for `date`).
- Persisted `design-references/` folder: drop Obsidian gif, WHOOP screenshots, etc., with a one-line spec each.

---

## [2026-05-10] XODUS AI Router MVP — DailyGoals intake with DeepSeek fallback

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. MCP tools present in session. No project artifacts.

**Plan:**
- [x] Inspect provider.ts, actions.ts, brain.ts, agent route, DailyGoals.tsx, nutrition-profile.ts
- [x] Create `lib/xodus/intake.ts` — `XodusIntakeResult` type + `intakeFromRuleParser()` fallback
- [x] Create `app/api/xodus/intake/route.ts` — POST handler: AI → parse → fallback to rule-based
- [x] Update `components/dashboard/DailyGoals.tsx` — async submit, loading state, server route, client fallback
- [x] Fix pre-existing build errors: delete root-level duplicate TS/TSX junk files (33 files untracked)
- [x] npm run build — zero errors, 21 routes

**AI Router Design:**
- `lib/ai/provider.ts` handles all provider calls (was already complete)
- `lib/xodus/intake.ts` defines `XodusIntakeResult` type — separate from heavy `XodusAction[]` system in `actions.ts`
- `/api/xodus/intake` is lightweight (600 max tokens) vs `/api/agent` (1200 max tokens, full action system)
- Mock provider falls back to rule-based parser automatically — no AI key required for app to function

**Env vars needed (optional):**
```
AI_PROVIDER=deepseek      # or anthropic, openai, mock (default: auto-select by key)
DEEPSEEK_API_KEY=<key>    # cheapest option — deepseek-chat model
DEEPSEEK_MODEL=deepseek-chat   # optional override
ANTHROPIC_API_KEY=<key>   # alternative provider
OPENAI_API_KEY=<key>      # alternative provider
```

**Fallback behavior:**
- No AI key → `intakeFromRuleParser()` runs client-side (parseXodusInput wrapper)
- AI error/timeout → same client-side fallback
- Mock provider response doesn't parse as XodusIntakeResult → server falls back to rule-based

**UI behavior:**
- Input clears immediately on submit
- Button shows spinner (Loader2) while loading
- Input shows reduced opacity + "Parsing..." placeholder during load
- Feedback shows source ("AI" tag when AI was used)
- Double-submit blocked via `isLoading` guard

**Pre-existing issue fixed:** 33 root-level duplicate `.ts`/`.tsx` files (stale copies of files in `lib/`, `app/`, `components/`) were tracked by git and causing TypeScript errors. Untracked with `git rm --cached -f` and deleted.

---

## [2026-05-10] Obsidian Neural Link /brain — SVG knowledge graph MVP

**Status:** complete

**Ruflo/Rooflow:** checked — no project artifacts. Skipped.

**Plan:**
- [x] Create `lib/brain-graph.ts` — data builder (types, NODE_COLORS, SYSTEM_NODES/EDGES, computeLayout, buildBrainGraph)
- [x] Create `components/brain/BrainGraph.tsx` — SVG renderer with hover, click-to-select, detail panel
- [x] Create `components/brain/BrainGraphLoader.tsx` — 'use client' dynamic import wrapper (Next.js 16 SSR requirement)
- [x] Create `app/brain/page.tsx` — server component page with metadata, delegates to BrainGraphLoader
- [x] Update `components/Sidebar.tsx` — add /brain (Network icon) to SECONDARY_NAV
- [x] npm run build — zero errors, /brain in route list

**Architecture:**
- `lib/brain-graph.ts`: SSR-safe (`typeof window === 'undefined'` guard), reads localStorage via existing lib helpers
- Graph: hub at center (r=0), 8 domain nodes at r=135, data nodes at r=235+ clustered by type domain
- Edges: `<line>` colored by source node type, opacity by edge type (core=0.35, data=0.22, semantic=0.14)
- Nodes: `<circle>` + `<text>`, glow ring on selected, hover ring, hub gets inner white dot
- Labels: always visible for hub/domain; visible on hover or select for data nodes
- viewBox: 640×460, responsive SVG (w-full h-auto)

**Next steps (future):**
- Force-directed simulation (d3-force) for organic layout when node count grows
- ingestObsidianVault() — parse [[wiki-links]] + frontmatter tags
- streamLiveUpdates() — subscribe to STORAGE_EVENTS and patch graph incrementally
- Node filter/search bar
- Zoom + pan (SVG transform or CSS scale)

---

## [2026-05-10] XODUS Chat MVP — conversational interface + action layer

**Status:** complete

**Ruflo/Rooflow:** checked — no project artifacts. Skipped.

**Plan:**
- [x] `lib/xodus/notes.ts` — `XodusNote` store (categories incl. grocery), event bus
- [x] `lib/xodus/chat-types.ts` — chat actions, context, response shapes, readiness types
- [x] `lib/xodus/readiness.ts` — transparent wellness signal (no diagnosis, lists inputs)
- [x] `lib/xodus/chat-context.ts` — client-side compact context gatherer
- [x] `lib/xodus/chat-fallback.ts` — rule-based response + actions (server-safe)
- [x] `lib/xodus/apply-chat-actions.ts` — client applier for goals/notes/nutrition/food
- [x] `app/api/xodus/chat/route.ts` — AI provider call with JSON validation + fallback
- [x] `components/xodus/ChatPanel.tsx` — bubble chat UI, voice input, action chips, readiness pill
- [x] `app/xodus/page.tsx` — Chat / Structured tab toggle on left column
- [x] `npm run build` — 0 errors, /api/xodus/chat in route list

**Architecture:**
- Chat is the new default tab on `/xodus`. Structured (CommandInbox) is one click away. Daily Brief stays on right.
- Server route is stateless. Context arrives from client each turn → keeps prompt compact (~3-line vitals block, 5 goals max).
- AI prompt: 1–3 sentence reply + JSON actions. Output budget 500 tokens, temperature 0.3.
- DeepSeek preferred via existing `lib/ai/provider.ts` auto-select. Falls back to `buildFallbackResponse` when no key, API error, or invalid JSON.
- Actions auto-apply client-side after server response. Visible as colored chips beneath the assistant message.

**Actions supported:**
- `create_goal` → `addGoals(date, [...])` (split commas, weekday/tomorrow resolution)
- `create_note` → `addNote({ category })` — including `grocery` for shopping items
- `update_nutrition` → `saveNutritionProfile(updates)`
- `log_food` → patches today's `DailyLog` calories/protein
- `training_recommendation` → informational only, shown in chip; consumes readiness signal

**Notes / groceries:**
- `lib/xodus/notes.ts` is the source of truth. Key: `picard_xodus_notes_v1`. Event: `picard:notes-updated`.
- Grocery items land as `category: "grocery"` notes — feeds Obsidian export later.

**Readiness / wellness signal:**
- `computeReadiness(ctx)` returns `{ signal: green|amber|red|unknown, inputs[], note }`.
- Pure derivation from self-reported metrics (recovery, sleep, HRV, strain, mood, goal pressure).
- Always lists the inputs used. Never medical language. Shown as a pill above the assistant message.

**Voice support:**
- Browser SpeechRecognition only (no server transcription). Falls back gracefully when unsupported (button hidden).
- Live interim text shown below input. Final transcript appended to input — user still presses Enter to send.

**Obsidian future hooks:**
- XodusNote shape already includes `source: 'xodus'` and `date` field → trivial to export as markdown later.
- /brain `buildBrainGraph()` should ingest notes in a follow-up patch (add `getRecentNotes()` → nodes with `category` → edges to `hub-obsidian`).

**Remaining TODOs (next features, not blockers):**
- [ ] Connect /brain graph to XODUS notes/actions (ingest `getRecentNotes()` → graph nodes)
- [ ] Store XODUS chat summaries into Obsidian-formatted markdown export
- [ ] AI chat history import pipeline (Claude/ChatGPT exports → distilled notes)
- [ ] Persist chat history across page reloads (localStorage; cap last 50 turns)
- [ ] Add "Notes" surface — quick view of grocery list + recent notes on `/xodus` or `/brain`
- [ ] Dashboard card "Open XODUS Chat" if discoverability becomes an issue
- [ ] Server-side transcription path (Whisper) for non-Chrome mobile

**Next TODOs (do not start yet):**
1. **Obsidian Neural Link / /brain page** — force-directed graph, node types, vault architecture
2. **Apple Health / HealthKit for steps** — iOS Shortcut endpoint or XML export parser
3. **AI chat imports into Obsidian vault** — XODUS memory persistence
4. **Strava** — activity sync (low priority)

---

## Format

```
## [YYYY-MM-DD] Task Title
**Status:** planning | in-progress | complete | blocked
**Plan:**
- [ ] Step 1
- [ ] Step 2

**Result:** (filled in on completion)
**Lessons:** (link to tasks/lessons.md entry if applicable)
```

---

## [2026-05-10] WHOOP OAuth debug — callback error handling + status timeout

**Status:** complete

**Root causes found:**
1. `42P01` (table missing) returned a JSON 503 from callback → browser rendered raw JSON white page instead of redirecting back to settings
2. Settings page `fetchWhoopStatus()` had no timeout → hung at "Checking status…" indefinitely
3. No `reason` state in settings UI → all failures showed "Not connected" with no diagnostic info
4. No debug logging → couldn't trace the exact failure from server logs

**Plan:**
- [x] Inspect callback, sync, settings page, docs § 7
- [x] Fix callback: change `42P01` from JSON 503 → redirect to `/settings?whoop=table_missing`
- [x] Fix callback: change `missing_params` / `invalid_state` from JSON 400 → redirect (graceful user experience)
- [x] Add `state_mismatch` redirect for CSRF failures
- [x] Add structured debug logs to callback (booleans only — no token values)
- [x] Add debug log to sync GET
- [x] Settings page: add `whoopReason` state
- [x] Settings page: add 5s AbortController timeout to `fetchWhoopStatus`
- [x] Settings page: map reason codes to human-readable messages (table_missing, db_error, timeout)
- [x] Settings page: handle `?whoop=table_missing` and `?whoop=state_mismatch` URL params
- [x] Update docs/whoop-integration-plan.md § 7 with prominent warning + FK + RLS notes
- [x] npm run build — zero errors

**Files changed:** `app/api/integrations/whoop/callback/route.ts`, `app/api/integrations/whoop/sync/route.ts`, `app/settings/page.tsx`, `docs/whoop-integration-plan.md`

**Remaining manual step:** Create the `whoop_tokens` table in Supabase SQL editor using the SQL in docs/whoop-integration-plan.md § 7. This is the most likely root cause of the connection failure.

---

## [2026-05-10] WHOOP MVP — full OAuth + sync implementation

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. No project artifacts.

**Obsidian/brain artifacts:** `lib/obsidian-export.ts`, `lib/xodus/brain.ts`, `docs/obsidian-brain-guide.md`. No graph UI. No live vault.

**Plan:**
- [x] Inspect types.ts, storage.ts, fitness.ts, supabase/server.ts, api/sync/route.ts, settings/page.tsx
- [x] Create `lib/whoop/client.ts` — server-only WHOOP API client (exchangeCode, refreshWhoopToken, fetchLatestRecovery, fetchLatestCycle, fetchLatestSleep, fetchTodayWorkouts)
- [x] Create `lib/whoop/map.ts` — server-only mappers (mapToWhoopDailySync, mapWorkoutToSync, whoopSportToActivityType)
- [x] Replace `/api/integrations/whoop/auth` stub — full OAuth redirect with httpOnly state cookie, env var validation
- [x] Replace `/api/integrations/whoop/callback` stub — state cookie CSRF validation, code exchange, Supabase token storage, redirect to /settings?whoop=connected
- [x] Replace `/api/integrations/whoop/sync` stub — GET (status check), POST (parallel WHOOP fetch, WHOOP-fields-only upsert to daily_logs, dedup workout upsert)
- [x] Add Integrations section to `app/settings/page.tsx` — WHOOP status dot, Connect button, Sync Now button, ?whoop= param handling
- [x] npm run build — zero errors, 22 routes

**Result:** Full WHOOP OAuth + data sync MVP. Auth route sets httpOnly state cookie, builds WHOOP OAuth URL, redirects. Callback validates cookie, exchanges code via server-only secret, stores tokens in Supabase. Sync GET returns connection status. Sync POST: refreshes token if expiring, parallel fetches recovery/cycle/sleep/workouts, maps to DailyLog fields (never overwrites manual entries), deduplicates workouts by external_id. Settings page shows connection status on load, Connect button links to auth, Sync Now POSTs and applies dailySync fields to localStorage. Build: 22 routes, zero TypeScript errors.

**Files changed:** `lib/whoop/client.ts` (new), `lib/whoop/map.ts` (new), `app/api/integrations/whoop/auth/route.ts` (replaced stub), `app/api/integrations/whoop/callback/route.ts` (replaced stub), `app/api/integrations/whoop/sync/route.ts` (replaced stub), `app/settings/page.tsx` (Integrations section added)

---

## [2026-05-10] WHOOP polish — body measurements, strain rounding, sleep formula, steps investigation

**Status:** complete

**Plan:**
- [x] Add `fetchBodyMeasurements` to `lib/whoop/client.ts` — `GET /user/measurement/body`
- [x] Add `WhoopBodyMeasurement` type and `weightKg` to `WhoopDailySync` in `lib/whoop/types.ts`
- [x] Round strain to 2dp in `lib/whoop/map.ts`
- [x] Wire body measurements into sync route — convert kg → lbs, write to `daily_logs.weight`
- [x] Apply weight to localStorage in `app/settings/page.tsx` `handleWhoopSync`
- [x] Fitness page: add live WHOOP connection status to `IntegrationCard`, fetch on mount
- [x] Fitness page `RecoveryCard`: fix strain display to `toFixed(1)`
- [x] `FitnessWidget`: round strain ring value to 1dp
- [x] `CommandCenter`: replace stepped `sleepHoursToScore` with continuous `(h / 9) * 100`
- [x] `lib/trends.ts`: round strain in daily data points to 1dp
- [x] Investigate WHOOP steps — confirmed NOT available in API v2 (no steps field in any endpoint)
- [x] Document steps limitation, sleep formula, weight sync, strain rounding in docs/whoop-integration-plan.md
- [x] npm run build — zero errors

**Steps finding:** WHOOP API v2 does not expose step counts. The `/cycle`, `/recovery`, `/activity/sleep`, `/activity/workout`, and `/user/measurement/body` endpoints have no steps field. Steps remain manual entry only. Use Apple Health/HealthKit for steps data.

**TODO (future):** Steps are not currently available through the implemented WHOOP API endpoints; use Apple Health/HealthKit or another provider for steps.

**Env vars required (add to .env.local):**
```
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=http://localhost:3000/api/integrations/whoop/callback
```

**Supabase table required before connecting:**
```sql
-- Run in Supabase SQL editor (see docs/whoop-integration-plan.md § 7)
create table if not exists whoop_tokens (
  user_id uuid primary key references profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null,
  whoop_user_id integer,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whoop_tokens enable row level security;
create policy "whoop_tokens: owner only" on whoop_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

---

## [2026-05-10] WHOOP integration stubs — OAuth routes, types, plan doc

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. No project artifacts.

**Obsidian/brain artifacts:** `lib/obsidian-export.ts` (flat export), `lib/xodus/brain.ts` (engine), `docs/obsidian-brain-guide.md` (guide). No graph UI.

**WHOOP API research:** complete. Base URL `https://api.prod.whoop.com/developer/v2/`. OAuth 2.0 authorization_code flow. Key endpoints: `/recovery`, `/cycle`, `/activity/sleep`, `/activity/workout`. Webhooks supported. Rate limits: 100/min, 10k/day.

**Plan:**
- [x] Create `docs/whoop-integration-plan.md` — OAuth flow, data mapping, sync strategy, deferred tables
- [x] Create `lib/whoop/types.ts` — TypeScript interfaces for WHOOP API v2 responses
- [x] Create `app/api/integrations/whoop/auth/route.ts` — stub (GET, 501)
- [x] Create `app/api/integrations/whoop/callback/route.ts` — stub (GET, 501)
- [x] Create `app/api/integrations/whoop/sync/route.ts` — stub (POST, 501)
- [x] npm run build — zero errors
- [x] Update tasks/todo.md result

**Result:** Integration plan created (10 sections: OAuth flow, scopes, endpoint reference, full data mapping tables, token storage SQL, sync strategy, webhook handling, rate limits, implementation order). TypeScript types built for all WHOOP v2 responses. Three route stubs registered and compiling. Build: 22 routes, zero TypeScript errors.

**Files changed:** `docs/whoop-integration-plan.md` (new), `lib/whoop/types.ts` (new), `app/api/integrations/whoop/auth/route.ts` (new), `app/api/integrations/whoop/callback/route.ts` (new), `app/api/integrations/whoop/sync/route.ts` (new)

**Env vars needed (add to .env.local manually):**
```
WHOOP_CLIENT_ID=           # from developer.whoop.com app dashboard
WHOOP_CLIENT_SECRET=       # server-only, never NEXT_PUBLIC_
WHOOP_REDIRECT_URI=        # e.g. http://localhost:3000/api/integrations/whoop/callback
```

---

## [2026-05-10] /trends page — analytics and rolling averages

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. No project artifacts.

**Obsidian/brain artifacts:** `lib/obsidian-export.ts` (flat export), `lib/xodus/brain.ts` (engine), `docs/obsidian-brain-guide.md` (guide). No graph UI. No live vault.

**Plan:**
- [x] Create `lib/trends.ts` — buildAllDailyPoints(), buildMonthlyPoints(), sliceDays()
- [x] Create `app/trends/page.tsx` — 7d/30d/monthly/yearly toggle, 5 recharts charts
- [x] Update `components/dashboard/ActivityOverview.tsx` — "View all →" link to /trends
- [x] npm run build — zero errors
- [x] Update tasks/todo.md result

**Result:** `/trends` created with 5 recharts charts (Recovery, Strain, Sleep, Steps, Workouts) and 4-window toggle. 7-day rolling avg shown as dashed line on daily views. Dashboard Weekly Trend Preview now links to /trends. Build: 19 routes, zero TypeScript errors.

**Files changed:** `lib/trends.ts` (new), `app/trends/page.tsx` (new), `components/dashboard/ActivityOverview.tsx`

---

## [2026-05-10] Obsidian brain guide + CommandInbox /api/agent preview

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. No project artifacts.

**Obsidian/brain artifacts:** `lib/obsidian-export.ts` (flat export), `lib/xodus/brain.ts` (engine). No graph UI. No live Obsidian sync.

**Plan:**
- [x] Inspect docs/xodus-automation-roadmap.md, brain.ts, obsidian-export.ts
- [x] Create docs/obsidian-brain-guide.md
- [x] Update docs/xodus-automation-roadmap.md to reference guide
- [x] Update tasks/lessons.md with brain architecture rule
- [x] Wire CommandInbox → /api/agent (preview-only, additive, no auto-apply)
- [x] npm run build — zero errors

**Result:** `docs/obsidian-brain-guide.md` created (10-section vault architecture guide). Roadmap updated with Obsidian subsection. Lessons updated with brain architecture rule. `CommandInbox.tsx` now fires `fetchAgentSuggestions()` concurrently on every analyze — renders `AgentPreviewSection` (type badge, confidence %, summary, field preview, warnings) after regex cards with zero auto-apply. Build: 18 routes, zero TypeScript errors.

**Files changed:** `docs/obsidian-brain-guide.md` (new), `docs/xodus-automation-roadmap.md`, `tasks/lessons.md`, `components/xodus/CommandInbox.tsx`, `tasks/todo.md`

---

## [2026-05-10] XODUS Agent Foundation — action types, AI provider, /api/agent route

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs. No project artifacts.

**Obsidian/brain artifacts:** `lib/obsidian-export.ts` (flat Markdown export), `lib/xodus/brain.ts` (brain engine). No graph UI. No Obsidian live sync.

**Plan:**
- [x] Inspect voice-parser.ts, CommandInbox.tsx, storage.ts, sync route, brain.ts, obsidian-export.ts
- [x] Create lib/xodus/actions.ts — discriminated union action type system
- [x] Create lib/ai/provider.ts — server-only AI abstraction (DeepSeek/OpenAI/Anthropic/mock)
- [x] Create app/api/agent/route.ts — classify → extract → return XodusAction[]
- [x] npm run build — zero errors (16 static, 3 dynamic routes)
- [x] Update todo.md result

**Result:** XODUS agent foundation built. CommandInbox untouched. No localStorage or Supabase writes from agent route — client applies actions. Mock provider active until AI_PROVIDER + key are set in .env.local.

---

## [2026-05-10] XODUS Automation Roadmap — product direction update

**Status:** complete

**Ruflo/Rooflow:** checked — no `.roo*` files, no `workflow/` dirs found in project. Ruflo MCP tools visible in session but no project-level Ruflo artifacts exist.

**Obsidian/brain artifacts checked:**
- `lib/obsidian-export.ts` — EXISTS (Markdown export for Obsidian import: daily logs, activities, projects, voice logs, XODUS history)
- `lib/xodus/brain.ts` — EXISTS (full brain engine: gatherBrainInput, runXodusBrain, 6 domain briefs)
- No graph/visualization layer exists yet — internal Obsidian-inspired graph is Phase E

**Plan:**
- [x] Inspect current docs, XODUS files, brain.ts, obsidian-export.ts, sync files, app routes
- [x] Check Ruflo/Rooflow artifacts (none found)
- [x] Check Obsidian/brain/graph artifacts (obsidian-export.ts + brain.ts found; no graph UI)
- [x] Create docs/xodus-automation-roadmap.md with all 7 sections
- [x] Update tasks/lessons.md with 3 new rules
- [x] npm run build

**Result:** Roadmap doc created covering XODUS agent pipeline, AI provider abstraction (DeepSeek/anthropic/openai), background agent phases, trends page plan, daily reset rules, Obsidian-style brain graph plan, integration order, and recommended coding sequence.

---

## [2026-05-10] Bootstrap Supabase profile row + PICARD_USER_ID env var

**Status:** complete

**Ruflo/Rooflow:** checked — none found (glob *.roo*, workflow/ dirs: no matches).

**Plan:**
- [x] Confirm .env.local protected by .gitignore
- [x] Add PICARD_USER_ID to .env.local
- [x] Upsert profile row via temporary Next.js API route (`/api/bootstrap-profile`)
- [x] Delete temporary route + script
- [x] Confirm profile row exists (id: 217995d1-e59e-453e-8799-d2ec4d970095, handle: Jpicky, created_at confirmed)
- [ ] Vercel env update — MANUAL: Vercel dashboard → Project → Settings → Environment Variables → add PICARD_USER_ID=217995d1-e59e-453e-8799-d2ec4d970095 (Production)
- [x] npm run build — zero errors, 17 static + 2 dynamic routes

**Result:** Profile row live in Supabase. Phase 1 sync will now succeed for all 4 save functions (saveTodayLog, saveVoiceLog, addActivityLog, saveProjects). Only remaining step is Vercel env var (manual — CLI not installed).

**Note:** Next.js excludes `_`-prefixed route folders from routing (private convention). Bootstrap route was initially named `_bootstrap-profile` and returned 404 — fixed by removing underscore.

---

## [2026-05-10] Create Supabase Phase 1 SQL schema file

**Status:** complete

**Ruflo/Rooflow:** checked — none found (glob *.roo*, workflow/ dirs: no matches).

**Plan:**
- [x] Inspect docs/supabase-schema-plan.md
- [x] Inspect app/api/sync/route.ts mapper column names
- [x] Audit client-side ID formats (voice_logs, projects, project_tasks use text IDs; activity_logs uses UUID)
- [x] Create docs/supabase-phase1-schema.sql
- [x] npm run build — zero errors

**Key correction vs schema plan:** voice_logs, projects, and project_tasks use TEXT primary keys (not UUID). The schema plan assumed UUID for all; the code audit revealed actual client-generated ID formats.

---

## [2026-05-10] Phase 1 Supabase sync layer

**Status:** complete

**Ruflo/Rooflow:** checked — none found (glob for *.roo*, .rooflow dirs, workflow/ dirs: no matches).

**Scope:**
- New `lib/supabase/sync.ts` — client-side fire-and-forget helpers
- New `app/api/sync/route.ts` — server-side POST handler (admin client, camelCase→snake_case mappers)
- Wire sync into 4 centralized save functions: `saveTodayLog`, `saveVoiceLog`, `addActivityLog`, `saveProjects`
- Uploads + stack skipped (Phase 1b) — saves are inline `setStorage` calls in components, not centralized functions

**Tables targeted:** `daily_logs`, `activity_logs`, `activity_exercises`, `voice_logs`, `projects`, `project_tasks`

**Plan:**
- [x] Read lessons.md, schema plan, all lib save functions
- [x] Confirm Ruflo/Rooflow status
- [x] Create lib/supabase/sync.ts
- [x] Create app/api/sync/route.ts
- [x] Wire sync into lib/storage.ts (saveTodayLog, saveVoiceLog)
- [x] Wire sync into lib/fitness.ts (addActivityLog)
- [x] Wire sync into lib/projects.ts (saveProjects)
- [x] npm run build — zero errors
- [ ] Add lesson if new pattern found

**User action required:** Add `PICARD_USER_ID=<supabase-user-uuid>` to `.env.local` (server-only, no NEXT_PUBLIC_) when Supabase Auth is configured. Until then, a placeholder UUID is used and writes will fail FK constraints gracefully.

---

## [2026-05-10] Supabase schema plan and sync strategy

**Status:** complete — planning only, no tables created, no data migrated

**Plan:**
- [x] Check tasks/lessons.md
- [x] Search for Ruflo/Rooflow artifacts → none found
- [x] Run explore agent: full data-layer audit across all pages and lib/ files
- [x] Read lib/storage.ts and lib/mock-data.ts for exact type shapes
- [x] Create docs/supabase-schema-plan.md with schema, RLS, phased sync, risks
- [x] Update tasks/todo.md
- [x] npm run build

**Ruflo/Rooflow:** checked — none found. No workflow artifacts in repo. Skipped per operating rules.

**localStorage keys confirmed:**
- `picard_daily_logs_v1` → `Record<string, DailyLog>` (keyed by YYYY-MM-DD)
- `picard_activity_logs_v1` → `ActivityLog[]`
- `picard_projects_v1` → `Project[]`
- `picard_voice_logs_v1` → `VoiceLog[]`
- `picard_uploads_v1` → `UploadedFile[]`
- `picard_stack_v1` → `StackItem[]`
- `picard_stack_reset_v1` → date string (undocumented daily reset key, stack page only)

**Proposed Supabase tables:** profiles, daily_logs, activity_logs, activity_exercises, voice_logs, projects, project_tasks, project_updates, stack_items, stack_logs, uploads, xodus_messages

**Next step:** Implement Phase 1 sync functions in lib/supabase/sync.ts — write localStorage → Supabase on save, no reads yet.

---

## [2026-05-10] CLAUDE.md: promote Ruflo/Rooflow to active operating rule

**Status:** complete

**Plan:**
- [x] Read CLAUDE.md, tasks/lessons.md (inspect first)
- [x] Add § 4a "Ruflo / Rooflow Workflow Integration" between § 4 and § 5
- [x] Extend § 11 End-of-Task Summary with 3 Ruflo/Rooflow reporting lines
- [x] Add lesson to tasks/lessons.md
- [x] Verify files exist

---

## [2026-05-10] supabase-test route: add env var presence debug info

**Status:** complete

**Plan:**
- [x] Read current route
- [x] Add env boolean map to all response paths (ok and error)
- [x] Move env check before createAdminClient() so missing-key errors are diagnosable
- [x] npm run build

---

## [2026-05-10] Supabase environment and client setup

**Status:** complete

**Context:**
- `.env.local` did not exist — created
- `.gitignore` already covers it via `.env*` and `.env*.local` — no change needed
- `@supabase/supabase-js` v2.105.4 already installed — no install needed
- No existing `lib/supabase/` or `app/api/` — created from scratch

**Plan:**
- [x] Inspect .gitignore, .env.local, package.json, lib/supabase, app/api
- [x] Create .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
- [x] Create lib/supabase/client.ts — browser-safe (NEXT_PUBLIC vars only)
- [x] Create lib/supabase/server.ts — server-only (SECRET_KEY, never exported to client)
- [x] Create app/api/supabase-test/route.ts — GET endpoint, admin client only
- [x] Run npm run build — zero errors
- [x] Add lesson to tasks/lessons.md

**Env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — public, safe in client bundles
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public anon key, safe in client bundles
- `SUPABASE_SECRET_KEY` — server-only, never NEXT_PUBLIC_, never committed

---

## [2026-05-10] Fix XodusCard SSR hydration mismatch

**Status:** complete

**Cause:** `useState(() => runXodusBrain(gatherBrainInput()))` calls `gatherBrainInput()` during both SSR and client hydration. On the server, `localStorage` is absent → score 25. On the client, `localStorage` has real data → score 59. React detects the mismatch.

**Plan:**
- [x] Inspect XodusCard.tsx, brain.ts, page.tsx
- [x] Audit other dashboard components for same pattern
- [x] Identify: QuickStats.tsx `generateDailyStatus(null, {})` is deterministic — not a bug
- [x] Identify: CommandCenter.tsx `useState(new Date())` — low risk, not the reported bug
- [x] Fix XodusCard.tsx: add module-level `EMPTY_BRAIN` constant (deterministic, same on server and client), replace lazy initializer with it, move real data load to useEffect
- [x] Run npm run build — zero errors
- [x] Update tasks/lessons.md

**Pattern chosen:** Stable module-level default → `useState(EMPTY_BRAIN)` → `useEffect` loads real data. Avoids null guard in JSX and any skeleton flash.

---

## [2026-05-10] Initialize project workflow files

**Status:** complete

**Plan:**
- [x] Inspect existing CLAUDE.md, AGENTS.md, MASTER_PROMPT.md
- [x] Prepend Claude Code Operating Rules to CLAUDE.md
- [x] Create tasks/todo.md
- [x] Create tasks/lessons.md
- [x] Verify files exist

**Result:** Operating rules prepended to CLAUDE.md. Both task files created. No app code touched.

**Files changed:** `CLAUDE.md`, `tasks/todo.md` (new), `tasks/lessons.md` (new)

---

## [2026-05-16] XODUS Telegram Chat — make Telegram a real AI surface

**Status:** in progress

**Plan:**
- [x] Inspect existing Telegram webhook, agent route, AI provider, brain router
- [x] Create shared server-side helper `lib/xodus/server-chat.ts` exposing `generateXodusResponse()`
- [x] Refactor `app/api/telegram/webhook` to use shared helper + handle `/start`, `/help`
- [x] Drop dumb "Open /xodus" tail when there are no pending-review actions
- [x] Route `app/api/xodus/chat` through the same shared helper for parity
- [x] Run npm run build — green
- [ ] Mirror localStorage data into Supabase so Telegram has cross-device context
- [ ] Add real task/goal/note/reminder persistence from Telegram intents
- [ ] Add reminder scheduling (cron / Supabase scheduled function)
- [ ] Add voice message transcription (Whisper)
- [ ] Add screenshot / image intake (vision model)

**Result:** Telegram and web chat now share `generateXodusResponse()`. Both pass through `routeXodusInput()` → `callAI()`. Telegram replies are conversational by default; only show the inbox tail when there are actually pending-review actions. Slash commands handled inline. Server-side context is a conservative fallback until Supabase mirroring lands.

---

## [2026-05-16] XODUS Telegram — conversational first

**Status:** in progress

**Plan:**
- [x] Rewrite SYSTEM_PROMPT in `lib/xodus/brain-router.ts` to be conversation-first, no robotic phrases, no false saves
- [x] Inject channel hint (`telegram` vs `web_chat`) into the user message so the model adapts tone
- [x] Soften rule-based fallback replies in `lib/xodus/fallback-router.ts`
- [x] Make `lib/ai/provider.ts` mock return a conversational reply field
- [x] Run npm run build — green
- [ ] Recent-message conversation memory for Telegram (read last N xodus_inbox items by chat_id, pass into context)
- [ ] Add persistence for goals / tasks / notes / daily logs / reminders from Telegram
- [ ] Supabase-backed server context so Telegram can read real daily / project / fitness data

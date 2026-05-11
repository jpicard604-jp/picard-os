# Picard OS — Lessons Learned

Reusable rules distilled from mistakes or user corrections. Claude Code reviews this file at the start of each session and appends to it whenever the user corrects direction or a bug pattern is discovered.

---

## Format

```
### [YYYY-MM-DD] Rule Title
**Rule:** One-sentence directive.
**Why:** Context or incident that produced this rule.
**Apply when:** The conditions under which this rule kicks in.
```

---

## Rules

### [2026-05-10] Ruflo/Rooflow must be actively checked on workflow, UX, data-flow, and integration tasks
**Rule:** Before coding any workflow, automation, UX/UI flow, XODUS behavior, data-flow change, or integration, search the project for Ruflo/Rooflow artifacts (files, skill exports, prompt conventions) and report what was found — even if the answer is "none."
**Why:** Ruflo/Rooflow is the designated workflow/orchestration layer for Picard OS. Silently skipping the check leads to architectural drift where automation logic gets scattered into ad-hoc code instead of a consistent layer.
**Apply when:** Any task touching user flows, dashboard systems, XODUS, localStorage/Supabase sync, design-system outputs, automation, or reusable skill templates. Always include the three Ruflo/Rooflow lines in the end-of-task summary.

### [2026-05-10] Do not run npm audit fix without explicit instruction
**Rule:** Never run `npm audit fix` or `npm audit fix --force` unless the user explicitly asks.
**Why:** Automatic dependency upgrades can introduce breaking changes in a Next.js + Tailwind v4 project.
**Apply when:** Any time security warnings appear in npm output.

### [2026-05-10] Inspect before acting — never assume project state
**Rule:** Always read the relevant files before proposing or making changes.
**Why:** This project has non-obvious localStorage keys, custom event buses, seed data patterns, and Tailwind design tokens that differ from defaults.
**Apply when:** Every session start and before every non-trivial edit.

### [2026-05-10] Supabase secret keys must stay server-only and never be committed
**Rule:** `SUPABASE_SECRET_KEY` (service role key) must never be prefixed with `NEXT_PUBLIC_`, never imported in `'use client'` components, and never committed to git — only in `.env.local` which is gitignored.
**Why:** The service role key bypasses Row Level Security and grants full database access. Exposing it in a client bundle or git history compromises the entire database.
**Apply when:** Any time a new Supabase client or API route is created. Always import `createAdminClient` only from server-side files (Route Handlers, Server Components, server actions).

### [2026-05-10] Never initialize state with new Date() when it feeds locale-formatted text into JSX
**Rule:** `useState(new Date())` that drives `toLocaleTimeString` / `toLocaleDateString` in rendered JSX must use `useState<Date | null>(null)` instead, with null guards on the format calls.
**Why:** Server and client call `new Date()` at different instants, and Node.js and the browser can have different locale tables — producing different formatted strings and a React hydration error.
**Apply when:** Any `'use client'` component that renders time or date strings from a `Date` object initialized in `useState`.

### [2026-05-10] Never use a localStorage-dependent function as a useState lazy initializer
**Rule:** Do not call `gatherBrainInput()`, `getTodayLog()`, `getProjects()`, or any function that reads localStorage inside a `useState(() => ...)` lazy initializer — use a deterministic, empty-input module-level constant as the initial value instead, then load real data in `useEffect`.
**Why:** Next.js SSR runs `useState` initializers on the server (no localStorage → empty data) and again on the client during hydration (real localStorage → different data). The differing initial states cause a React hydration mismatch error. The fix: a module-level `const EMPTY = runFn(emptyInputs)` is computed once with stable empty inputs; both server and client use it as `useState(EMPTY)`; `useEffect` then overwrites with real data.
**Apply when:** Any `'use client'` component that seeds state from localStorage, STORAGE_KEYS, or any function whose output depends on browser APIs.

### [2026-05-10] Check SSR safety on every browser-API touch
**Rule:** Any code touching localStorage, window, Date, or navigator must be wrapped in `typeof window !== 'undefined'` guards or placed in a `useEffect`.
**Why:** Next.js App Router renders components on the server first — browser APIs throw during SSR.
**Apply when:** Adding or editing any `'use client'` component that reads storage or uses browser APIs.

### [2026-05-10] XODUS is the background agent layer, not just a chatbot page
**Rule:** When building or extending XODUS, treat it as an agent pipeline (input → classify → extract → action → confirm → memory), not a chat UI. The chat interface is one input channel. The agent handles writes to daily_log, activity_log, projects, and brain notes via structured JSON actions returned by `/api/agent`.
**Why:** The user corrected direction — XODUS was being built as a display-only brief generator + regex command parser. The correct vision is an automation-first pipeline that can update any data store from any input type.
**Apply when:** Any feature touching XODUS, CommandInbox, voice parsing, or data entry automation. All AI calls go through `lib/ai/provider.ts` server-only. No provider-specific imports in client code.

### [2026-05-10] Picard OS daily state resets, but historical timeline data must never reset
**Rule:** Daily log form inputs and stack checklists reset at day boundary (new YYYY-MM-DD key = empty entry). All historical records (daily_logs Record, activity_logs array, voice_logs array) must never be truncated, overwritten wholesale, or purged by any reset mechanism.
**Why:** The trends page and brain graph depend on complete historical data across all dates. A nightly reset of localStorage keys or Supabase tables would destroy the analytics layer.
**Apply when:** Implementing any reset, cleanup, or "clear day" feature. Confirm it operates on today's entry only, never on the historical collection.

### [2026-05-10] Brain graph should be Obsidian-inspired, not a basic notes page
**Rule:** The `/brain` page should render an interactive force-directed node graph where nodes are data records (voice logs, workouts, projects, uploads, AI conversations) and edges represent detected relationships. Do not build a flat notes list or a text editor — that is not the product vision.
**Why:** The user specified an Obsidian-style neural graph as the brain page concept. `lib/obsidian-export.ts` already exists for flat Markdown export to Obsidian — the internal graph is a separate, complementary surface.
**Apply when:** Building `/brain`. Select a graph library (d3-force, Cytoscape.js, react-flow, or vis-network) that supports physics simulation, click-to-expand, and dark theme. Start with nodes only (Phase E), then add edge detection.

### [2026-05-10] The brain system must be a persistent linked Markdown/wiki architecture, not just database rows or static exports
**Rule:** XODUS long-term memory should be stored as a vault of linked Markdown files (each record = one node with `[[wiki-links]]`), not only as Supabase rows or single flat exports. The vault compounds over time: new knowledge auto-links to old knowledge, enabling XODUS to have persistent cross-session context.
**Why:** AI assistants forget everything between sessions. The Obsidian-inspired vault gives XODUS a queryable knowledge base it can read at session start. `lib/obsidian-export.ts` is a good one-time export but not a living brain — the vault is a separate system.
**Apply when:** Building `/brain`, brain_notes Supabase table, hot-cache generation, or any XODUS memory feature. See `docs/obsidian-brain-guide.md` for the full architecture. Do not conflate the flat Markdown export with the interactive vault.

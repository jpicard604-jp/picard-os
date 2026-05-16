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

### [2026-05-10] Graphs must be physical, not decorative
**Rule:** When a feature is described as a "neural graph", "knowledge graph", or "Obsidian graph", do not ship a statically-positioned SVG layout. Use a real physics simulation (`d3-force` minimum) and ensure: zoom/pan, node drag, hover-fade, selected-node side panel with connected nodes.
**Why:** First /brain build used radial trig and looked correct on screenshots but had zero interaction or motion — failed the product test the moment the user opened it.
**Apply when:** Any task touching the `/brain` route or any future "map/graph/network" surface. Run the interaction checklist before claiming done: zoom · pan · drag · hover-fade · select · connected list · reset · mobile pointer.

### [2026-05-10] Capture design references before re-skinning
**Rule:** Before any design-system upgrade, drop the reference images / gifs the user provides into `design-references/` (or note their absolute path in `tasks/todo.md`) and translate each into a concrete spec line ("hub breathes at ~3s", "unrelated nodes fade to 0.18", "edge opacity doubles on focus") before writing code.
**Why:** Without an explicit translation, references stay vibes; implementation drifts back into whatever feels "premium" in the abstract.
**Apply when:** Any task that mentions Obsidian, WHOOP, Linear, Notion, 21st.dev, Nano Banana, Claude Design, or attaches screenshots/gifs.

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

### [2026-05-16] One server function powers every XODUS surface
**Rule:** Web chat, Telegram, future mobile/voice/SMS surfaces all call a single server-side helper (`lib/xodus/server-chat.ts → generateXodusResponse`). Surface-specific code only handles transport (parsing the inbound request, sending the outbound reply). No surface should call `callAI()` or `routeXodusInput()` directly anymore.
**Why:** Without a single brain function, every new surface drifts — different prompts, different context shapes, different intent vocab. We had two parallel paths (web `/api/xodus/chat` and Telegram webhook) both calling `routeXodusInput` with slightly different surfacing logic. Consolidating prevents that drift.
**Apply when:** Adding a new XODUS input channel (mobile app, SMS, IFTTT, voice). Build a thin transport layer around `generateXodusResponse()` — never duplicate prompt or context-build logic.

### [2026-05-16] Server routes can't read browser localStorage — fail honestly
**Rule:** Server routes (Telegram webhook, cron, scheduled functions) have no access to browser localStorage. When building XODUS context server-side, return a conservative fallback (profile constants + missing-data signal) rather than pretending. Do not claim to have saved data that wasn't actually written.
**Why:** Picard OS's operational memory currently lives in localStorage. Telegram runs on Vercel and sees zero of that. Hacking "fake context" creates a worse experience than honest "I don't know your daily log yet."
**Apply when:** Adding any server-side feature that needs user state. Either (a) mirror state into Supabase first, then read on the server, or (b) accept the limitation explicitly and surface it via `missingDataSignals` in the context.

### [2026-05-16] XODUS is conversation-first; classification is silent
**Rule:** XODUS replies must sound like a person — never "Intent recognized", "Tasks recognized:", or "No action saved". Classification and action emission happen in the background. The reply is for Jackson, not for the system. When persistence for a category isn't wired, mention it briefly only when relevant, never as a tail on every reply.
**Why:** Telegram replies that looked like form receipts felt like a parsing bot. The goal is a real AI operator — texting Jackson like a chief of staff who happens to know his system.
**Apply when:** Editing any XODUS prompt, fallback, mock, or response surface (web, Telegram, future channels). Channel-aware styling lives in the system prompt; transport routes just relay the reply.

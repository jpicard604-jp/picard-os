# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

# Claude Code Operating Rules for Picard OS / XODUS

## 1. Plan Mode Default
- Enter plan mode for any non-trivial task involving 3+ steps, architecture decisions, data flow, integrations, UI systems, or bug fixes.
- Do not jump straight into coding.
- Write a clear plan first with checkable steps.
- If the task starts drifting sideways, stop and re-plan instead of pushing blindly.
- Use plan mode for verification steps, not just implementation.

## 2. Inspect Before Acting
- Always inspect the current project state before editing.
- Read relevant files before proposing changes.
- Do not assume file structure, data shape, localStorage keys, styling conventions, or component architecture.
- Prefer small, targeted changes based on the existing codebase.
- Preserve existing functionality unless explicitly replacing it.

## 3. Subagent / Tool Strategy
- Use subagents or parallel analysis when a task is complex, broad, or research-heavy.
- Keep the main context clean by offloading exploration when useful.
- One subtask per subagent: data layer, UI audit, integration audit, bug tracing, build errors, etc.
- For complex problems, spend more compute on understanding before implementing.

## 4. Integration Awareness
Before implementing major changes, check whether the project already uses or plans to use:
- Next.js / React App Router
- Tailwind
- localStorage data layer
- Supabase or future backend schema
- XODUS brain/context logic
- Ruflo / Rooflow workflows if present
- Vue integrations if present
- UX/UI design software exports, Claude Design references, screenshots, Nano Banana references, or design-system files
- Existing animation libraries, component libraries, charting libraries, or visual frameworks

Do not add Vue, Ruflo/Rooflow, or any UX/UI framework blindly. First inspect whether they exist or are actually needed. If they are relevant, integrate them cleanly with the existing architecture. If they are not present, document that clearly and avoid unnecessary installs.

## 4a. Ruflo / Rooflow Workflow Integration

For any task involving workflows, automations, UX/UI flows, data flow, design-system implementation, AI agents, XODUS behavior, integrations, or product orchestration:

- Actively inspect whether Ruflo/Rooflow skills, files, prompts, exports, or workflow conventions exist in the project.
- If Ruflo/Rooflow artifacts exist, use them as part of the planning process before coding.
- If they do not exist, explicitly state that none were found and continue with the existing architecture.
- Do not ignore Ruflo/Rooflow when the task touches:
  - user flows or dashboard systems
  - XODUS intelligence or AI agent behavior
  - localStorage/Supabase sync or data-flow design
  - Claude Design or UX/UI design-tool outputs
  - automation logic, workflow diagrams, or reusable skills/templates
- Do not invent a Ruflo/Rooflow architecture if no real files or conventions exist in the repo.
- Prefer integrating Ruflo/Rooflow cleanly into the existing Next.js / React / Tailwind / XODUS system.
- If Ruflo/Rooflow conflicts with the current architecture, document the conflict and propose the smallest clean bridge.

## 5. Self-Improvement Loop
- After any correction from the user, update tasks/lessons.md with a short reusable rule.
- Write rules that prevent the same mistake from happening again.
- Review relevant lessons at the start of a session.
- If the same issue repeats, tighten the workflow instead of making another one-off fix.

## 6. Verification Before Done
- Never mark work complete without proving it works.
- Run the relevant checks:
  - npm run build
  - npm run lint if available
  - targeted tests if available
  - manual route checks where relevant
- Check logs and errors before summarizing.
- If build fails, fix the cause instead of hiding it.
- Compare behavior before and after when relevant.
- Ask: "Would a staff engineer approve this?"

## 7. Demand Elegance, But Do Not Overengineer
- For non-trivial changes, pause and ask whether there is a cleaner solution.
- If a fix feels hacky, rethink it.
- Use the simplest durable solution.
- Avoid giant rewrites unless the existing system is truly broken.
- Keep changes minimal, readable, and easy to reverse.

## 8. Autonomous Bug Fixing
- When given a bug report, fix it.
- Do not ask for hand-holding if logs, stack traces, or files provide enough context.
- Point at failing tests, console errors, hydration mismatches, TypeScript errors, and build errors, then resolve them.
- If a bug touches browser-only APIs like localStorage, Date, window, or hydration, check SSR safety.

## 9. Task Management
Maintain project task files:
- tasks/todo.md: plan, checkable steps, progress, and result summary.
- tasks/lessons.md: reusable lessons learned from mistakes or user corrections.

For each meaningful task:
1. Write the plan to tasks/todo.md.
2. Mark items complete as work progresses.
3. Add a short review/results section.
4. Add lessons to tasks/lessons.md when the user corrects direction or when a bug pattern is discovered.

## 10. Core Principles
- Simplicity first.
- No laziness.
- Minimal impact.
- Preserve working code.
- Inspect first.
- Verify before done.
- Build with the actual Picard OS product vision in mind:
  - clean premium WHOOP/Oura-like UI
  - neon blue/black with Miami Vice accents where appropriate
  - mobile-friendly web app
  - XODUS as the intelligence layer
  - localStorage now, Supabase later
  - dashboard metrics derived from real data
  - useful functionality over cosmetic redesigns

## 11. End-of-Task Summary Required
At the end of every task, summarize:
- Files changed
- Why changes were made
- Data/localStorage keys affected
- Integrations touched or intentionally not touched
- Verification performed
- Build/lint/test result
- Any remaining risks or next steps

- Ruflo/Rooflow checked: yes / no
- Ruflo/Rooflow artifacts found: (list files/skills, or "none")
- Ruflo/Rooflow used or intentionally skipped: (one-line reason)

**Important:** Do not run `npm audit fix` or `npm audit fix --force` unless explicitly instructed.

---

# Picard OS — CLAUDE.md

Personal operating system for Jpicky. This is the source of truth for how Claude Code should understand, build, and extend this app.

---

## App Vision

Picard OS is a unified personal command center — a mobile-first PWA that aggregates fitness data, life metrics, project tracking, daily voice logs, file uploads, and AI assistance into one cohesive interface. It is named and styled after a single owner (Jpicky / Jean-Paul Picard). It is not a SaaS product; it is a personal tool built to be owned, extended, and operated at near-zero cost.

The core experience is:
- Open the app from your phone's home screen
- See your day at a glance (metrics, projects, tasks, health)
- Talk to XODUS AI for insight, planning, or dictation
- Log a voice note or upload a file without friction
- Check fitness rings, workout logs, nutrition, and recovery

---

## Visual Style

- **Theme:** Dark mode first. Deep blacks (#0a0a0a), near-blacks (#111), with electric accent colors.
- **Accent palette:** Electric blue (#3b82f6), neon green (#22c55e), and warm amber (#f59e0b) used sparingly for status indicators and CTAs.
- **Typography:** Geist (already installed via Next.js font optimization). Use `font-mono` for data/metrics, `font-sans` for prose.
- **Density:** Information-dense but not cluttered. Cards with tight padding. Minimal chrome.
- **Motion:** Subtle transitions (150–200ms ease-out). No decorative animations — motion serves purpose only.
- **Border style:** `border border-white/10` for dark surfaces. Rounded corners at `rounded-xl` or `rounded-2xl`.
- **Glassmorphism:** Use `backdrop-blur` + semi-transparent backgrounds only in the top nav / drawer overlays.
- **Icons:** Lucide React. Never heroicons or other libraries unless already installed.
- **No gradients** on backgrounds. Gradients only on metric/progress ring fills.

---

## XODUS AI Behavior

XODUS is the embedded AI assistant persona within Picard OS. It is Claude under the hood.

- **Name:** XODUS. Never refer to it as "Claude" or "Assistant" in the UI.
- **Tone:** Direct, confident, minimal. Speaks like a trusted chief of staff, not a chatbot.
- **Default mode:** Chat interface accessible via a persistent bottom bar button (tap to expand).
- **Capabilities to build toward:**
  - Answer questions about the user's own data (fitness, projects, logs)
  - Summarize voice logs and uploaded docs
  - Suggest daily priorities based on project status and health metrics
  - Help compose messages, plans, or notes via dictation
- **Context injection:** Every XODUS request should receive a system context block with today's date, recent fitness summary, and any pinned notes.
- **Streaming:** Always stream XODUS responses. No loading spinner waiting for full reply.
- **Model:** Use `claude-sonnet-4-6` by default. Switch to `claude-haiku-4-5-20251001` for fast/cheap operations (auto-tagging, summarization, quick lookups).
- **Prompt caching:** Enable prompt caching on the system context block (it will be stable across turns).

---

## Mobile / PWA Requirements

This app must be a fully installable PWA. Mobile is the primary target.

- **Manifest:** `/public/manifest.json` with `display: standalone`, `theme_color`, `background_color`, app icons at 192×192 and 512×512.
- **Service Worker:** Register a service worker for offline shell caching and push notification support.
- **Viewport:** Always `width=device-width, initial-scale=1, viewport-fit=cover`. Account for safe areas (`env(safe-area-inset-*)`).
- **Touch targets:** All interactive elements must be at least 44×44px. No hover-only interactions.
- **Bottom navigation:** Primary navigation lives in a fixed bottom bar (not a sidebar), styled to avoid the iOS home indicator.
- **No horizontal scroll** anywhere at any screen width.
- **Performance budget:** Lighthouse mobile score ≥ 90. Keep JS bundles lean — code split aggressively.

---

## Upload Center

A dedicated module for ingesting files into the personal knowledge base.

- **Supported types:** PDF, image (JPG/PNG/HEIC), audio (MP3/M4A/WAV), plain text, Markdown, CSV.
- **UI:** Drag-and-drop zone + "tap to upload" on mobile. Shows upload progress per file.
- **Processing pipeline:**
  1. File lands in Supabase Storage (or local if no Supabase yet).
  2. Metadata recorded in DB (filename, type, size, timestamp, user tag).
  3. If PDF or image: queue for OCR/extraction (use free-tier APIs or edge functions).
  4. If audio: queue for transcription (Whisper via API or local).
  5. Extracted text stored alongside original for XODUS to reference.
- **Tagging:** User can tag files on upload (project name, category). Auto-tag suggestions from XODUS.
- **No file size limit enforced in UI** — backend limits handled server-side with clear error messaging.

---

## Voice Log / Dictation

First-class feature. Must work on mobile without friction.

- **Entry point:** One-tap record button on the main dashboard and within XODUS chat.
- **Recording:** Use the Web Speech API for live transcription where supported; fallback to MediaRecorder + server-side Whisper for unsupported browsers (mainly non-Chrome).
- **Output:** Transcription saved as a timestamped voice log entry. Original audio optionally stored.
- **Post-processing:** XODUS auto-summarizes logs longer than 30 seconds. Summary is shown inline beneath the transcript.
- **Editing:** User can edit the transcript inline before saving.
- **Use cases:** Daily journal, meeting notes, workout notes, quick task capture.

---

## Current Projects

Track these as first-class entities in the Projects module. Each project has:
- Name, status (active / paused / complete), description, priority (1–5)
- Associated tasks (simple checklist, not a full PM tool)
- Last updated timestamp
- Optional linked files from Upload Center

**Known active projects** (seed data — update as reality changes):
- Picard OS (this app)
- [Add more in next prompt]

---

## Fitness Tracking

Health and fitness data is a core pillar of the dashboard.

- **Metrics to display:** HRV, resting heart rate, recovery score, sleep duration, sleep quality, strain/activity, steps, calories burned, calories consumed, weight, body fat %, VO2 max.
- **Dashboard widgets:** Recovery ring, sleep ring, strain ring — always visible on home screen.
- **Manual entry:** User can log workouts, weight, and food manually if integrations are unavailable.
- **History view:** 7-day and 30-day sparklines for each metric.
- **Goals:** User-defined targets shown as progress bars (e.g., daily steps, calorie deficit).

---

## Identity Metrics

A personal "vital signs" panel beyond fitness — indicators of overall life quality.

- **Categories:**
  - **Cognitive:** Focus sessions logged, books read, learning streaks
  - **Financial:** Net worth delta (manual input), savings rate (manual input)
  - **Social:** Quality interactions logged (manual, 1-click)
  - **Creative:** Creative output logged (uploads, voice logs, writing sessions)
  - **Spiritual/Mental:** Mood log (1–5 scale, daily), meditation minutes
- **Visualization:** Weekly radar chart showing balance across all categories.
- **Privacy:** This data never leaves the device or the user's own backend. No third-party analytics on identity metrics.

---

## Low-Cost / Free Architecture Philosophy

This is a personal app. Every architectural decision should default to the cheapest viable option.

- **Hosting:** Vercel free tier. Never provision paid compute unless free tier is exhausted.
- **Database:** Supabase free tier (PostgreSQL + storage + auth). No paid DB.
- **AI inference:** Anthropic API pay-per-token. Use prompt caching and Haiku for cheap tasks.
- **Auth:** Supabase Auth (free). Single user — no multi-tenancy needed.
- **Storage:** Supabase Storage (free tier: 1GB). Files over limit go to Google Drive (user's own account via API).
- **Transcription:** OpenAI Whisper API (pay-per-minute, very cheap). Cache transcripts — never re-transcribe.
- **Analytics:** None. No third-party telemetry.
- **Cron/background jobs:** Vercel cron (free tier: 1 invocation/day is enough for daily summaries).
- **Rule:** Do not introduce a paid service without flagging it explicitly and confirming with the user.

---

## Integration Rules

> Full detail: `.claude/skills/picard-os-integrations/SKILL.md`

- **WHOOP:** OAuth 2.0, pull recovery/HRV/sleep/workouts, cache in Supabase, never expose tokens client-side. Pass `recoveryScoreOverride` in `DailyStatusExtras`.
- **Apple Health:** No web API — XML export via Upload Center or iOS Shortcut POST to API endpoint. No native app.
- **MyFitnessPal:** No official API — CSV export or manual paste. Never scrape.
- **Gmail / Calendar:** MCP tools available (deferred). Use only on explicit user instruction.
- **Rule:** Do not add any integration without reading the skill first.

---

## Coding Preferences

- **Language:** TypeScript strict mode. No `any`. No `// @ts-ignore` without a comment explaining why.
- **Framework:** Next.js App Router. Server Components by default; add `"use client"` only when needed.
- **Styling:** Tailwind CSS v4 utility classes only. No CSS modules, no styled-components, no inline `style={}` unless unavoidable.
- **State:** Prefer URL state (searchParams) and server state. Use `useState`/`useReducer` only for local UI state. No Redux or Zustand unless complexity demands it.
- **Data fetching:** Server Components with `fetch` + Next.js caching. React Query only if client-side polling is required.
- **API routes:** Next.js Route Handlers (`app/api/`). Keep them thin — business logic in `lib/`.
- **File structure:** Feature-based under `app/` for routes; shared logic in `lib/`; shared UI components in `components/`; types in `types/`.
- **No comments** unless the why is non-obvious.
- **No premature abstraction.** Build the specific thing needed. Generalize only after the third repetition.
- **Read `node_modules/next/dist/docs/`** before using any Next.js API — this version has breaking changes.
- **Test manually** by running `npm run dev` and checking the feature in a browser before reporting done.

---

## Token Budget

| Task size | Definition | Strategy |
|-----------|-----------|---------|
| Small | Single file, obvious fix | Read 1 file, edit, verify with `tsc --noEmit` |
| Medium | 2–5 files, single feature | Read relevant files only, plan in text, implement, build |
| Large | Cross-cutting, 5+ files | Plan mode required. Use subagents for exploration. Build verify separately. |

Load skills on-demand — do not dump all skill files into context. Read CLAUDE.md for rules, load a skill only when that domain is explicitly in scope.

## Module Priorities

**Completed:** Foundation, Dashboard, XODUS brief, Voice Log, Upload Center, Projects, Stack.

**Next (build in order):**
1. **WHOOP Integration** — OAuth flow, live data sync, `recoveryScoreOverride` path in extras
2. **XODUS Chat** — Streaming chat interface, context injection from `gatherBrainInput()`
3. **Brain / /brain** — Force-directed graph, node types, vault architecture (see obsidian-brain skill)
4. **Trends** — 7/30-day sparklines across metrics, history charts
5. **Identity Metrics** — Radar chart, manual logging (cognitive, financial, social, creative, mental)
6. **Nutrition / MFP** — CSV import path, macro dashboard
7. **Apple Health** — XML export parser, Shortcut endpoint
8. **Supabase migration** — Move from localStorage to Supabase (auth + tables)

---

## Commands

```bash
npm run dev          # start dev server on http://localhost:3000
npx tsc --noEmit     # type-check without building — run this before every commit
npm run build        # production build (also catches type errors)
npm run lint         # ESLint
```

No test suite exists yet. Verify features manually in the browser at localhost:3000.

---

## Current Implementation State

These modules are **built and working** (localStorage-only, no Supabase yet):

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ | Dashboard: XodusCard, DailyGoals, QuickStats, FitnessWidget, ActivityOverview, TodayTimeline, StackPreview |
| `/daily` | ✅ | Comprehensive daily log form — all fields, saves to localStorage |
| `/fitness` | ✅ | Activity log, progressive overload sparklines, log form, integration placeholders |
| `/projects` | ✅ | Project list with tasks, expand/collapse, localStorage persistence |
| `/voice` | ✅ | VoiceCapture with parsed training detection, Save as Activity flow |
| `/xodus` | ✅ | Full XODUS brief from generateXodusOutput() |
| `/stack` | ✅ | Stack tracker with timing groups |
| `/uploads` | ✅ | Upload center with FileReader base64 previews |
| `/log` | ✅ | Simplified log form (backward compat) |

**lib/ additions (2026-05-10):** `nutrition-profile.ts` (cut targets, 210g/2200 cal), `daily-goals.ts` (XODUS NL parser + goal CRUD), `xodus/brain.ts` (context builder).

---

## Data Layer

> Full detail: `.claude/skills/picard-os-data-layer/SKILL.md`

localStorage primitives in `lib/storage.ts` (`STORAGE_KEYS`, `STORAGE_EVENTS`). Scoring pipeline: `generateDailyStatus()` → `generateXodusOutput()` → rendered brief. All `'use client'` components use `useState(EMPTY_CONSTANT)` + `useEffect` to load real data — never seed from localStorage directly. See `XodusCard.tsx` for the canonical pattern. Nutrition targets: 210g protein / 2200 cal (confirmed cut). `DailyLog.steps` is authoritative — never sum with `ActivityLog.steps`.

---

## Component Architecture

> Full detail: `.claude/skills/xodus-ui/SKILL.md`

Dashboard composition in `app/page.tsx`. All cards in `components/dashboard/` are self-contained `'use client'` components. Bottom nav: `components/BottomNav.tsx`, 5 items (Home | XODUS | Daily | Projects | Stack). Design tokens and glow utilities in `app/globals.css`. Icons: Lucide React only.

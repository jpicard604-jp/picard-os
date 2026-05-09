# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

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

### WHOOP
- **Source:** WHOOP Developer API (OAuth 2.0).
- **Data pulled:** Recovery score, HRV, resting HR, sleep stages, strain, workouts.
- **Sync cadence:** On app open + once per hour via background sync.
- **Storage:** Cache latest values in Supabase. Never store raw WHOOP tokens in client code.
- **Fallback:** If WHOOP API is unavailable, show last-cached values with a staleness indicator.

### MyFitnessPal
- **Source:** No official public API. Use user-exported CSV or manual log entry as primary path. If a community API wrapper is available and stable, document it clearly before using.
- **Data pulled:** Daily calorie intake, macro breakdown, food log entries.
- **Manual path:** User pastes or uploads daily MFP export; XODUS parses and ingests it.
- **Do not scrape** MyFitnessPal's web interface.

### Apple Health
- **Source:** Apple Health has no web API. Integration is iOS-only via a companion shortcut or Health export.
- **Primary path:** User exports Health data (XML) via the iOS Health app; Upload Center ingests and parses it.
- **Secondary path:** iOS Shortcut that POSTs daily summary JSON to a Picard OS API endpoint (document the shortcut schema clearly).
- **Data pulled:** Steps, active calories, workouts, weight, sleep (if tracked via Apple).
- **Do not** build a native iOS app just for Health access. Keep it web-first.

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

## Module Priorities

Build in this order. Do not skip ahead.

1. **Foundation** — Layout shell, bottom nav, dark theme, PWA manifest + service worker, Supabase connection.
2. **Dashboard** — Home screen with fitness widget placeholders, project summary, voice log quick-capture.
3. **XODUS AI** — Chat interface, streaming responses, system context injection.
4. **Voice Log** — Record, transcribe, summarize, display log history.
5. **Upload Center** — File ingestion, metadata storage, text extraction pipeline.
6. **Fitness / WHOOP** — WHOOP OAuth flow, data sync, metric display, history charts.
7. **Projects** — Project list, task management, file linking.
8. **Identity Metrics** — Manual logging, radar chart, history.
9. **Nutrition / MFP** — Manual log + CSV import path.
10. **Apple Health** — Export parser + Shortcut endpoint.

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
| `/` | ✅ | Full dashboard: CommandCenter, QuickStats, FitnessWidget, ActivityOverview, XodusCard, TodayTimeline, ProjectSummary, StackPreview |
| `/daily` | ✅ | Comprehensive daily log form — all fields, saves to localStorage |
| `/fitness` | ✅ | Activity log, progressive overload sparklines, log form, integration placeholders |
| `/projects` | ✅ | Project list with tasks, expand/collapse, localStorage persistence |
| `/voice` | ✅ | VoiceCapture with parsed training detection, Save as Activity flow |
| `/xodus` | ✅ | Full XODUS brief generated from generateXodusOutput() |
| `/stack` | ✅ | Stack tracker with timing groups |
| `/uploads` | ✅ | Upload center with FileReader base64 previews |
| `/log` | ✅ | Simplified log form (backward compat) |

---

## Data Layer

### localStorage Keys (`lib/storage.ts` — `STORAGE_KEYS`)
| Key | Type | Purpose |
|-----|------|---------|
| `picard_daily_logs_v1` | `Record<string, DailyLog>` | Daily log entries keyed by YYYY-MM-DD |
| `picard_activity_logs_v1` | `ActivityLog[]` | Workout/activity entries (falls back to SEED_ACTIVITIES) |
| `picard_projects_v1` | `Project[]` | Projects + tasks (falls back to SEED_PROJECTS) |
| `picard_voice_logs_v1` | `VoiceLog[]` | Voice log transcripts |
| `picard_uploads_v1` | `UploadedFile[]` | Upload metadata |
| `picard_stack_v1` | `StackItem[]` | Supplement stack (falls back to JACKSON.stack) |

### CustomEvent Bus (`STORAGE_EVENTS`)
All reactive dashboard components listen to these events on `window`:
- `picard:daily-log-updated` — fired by `saveTodayLog()`
- `picard:activity-log-updated` — fired by `addActivityLog()`
- `picard:voice-log-saved` — fired after saving a voice log
- `picard:projects-updated` — fired by `saveProjects()`
- `picard:stack-updated` — fired when stack state changes

**Pattern:** Every `'use client'` component that reads from storage must also call `refresh()` on the relevant events. See `XodusCard.tsx` for the canonical example.

### Seed Data Pattern
`getProjects()`, `getActivityLogs()`, `getStorage(key, fallback)` all return seed/mock data when localStorage is empty. Seed data lives in `lib/projects.ts` → `SEED_PROJECTS`, `lib/fitness.ts` → `SEED_ACTIVITIES`, and `lib/mock-data.ts` → `JACKSON`.

---

## lib/ Module Map

| Module | Exports | Purpose |
|--------|---------|---------|
| `storage.ts` | `STORAGE_KEYS`, `STORAGE_EVENTS`, `DailyLog`, `VoiceLog`, `getStorage`, `setStorage`, `getTodayLog`, `saveTodayLog` | All localStorage primitives and types |
| `mock-data.ts` | `JACKSON` | Static mock data for WHOOP/nutrition/streaks until real APIs connect |
| `daily-status.ts` | `generateDailyStatus(log, extras)` | Scoring engine → executionScore, alerts[], strengths[], focuses[] |
| `xodus-message.ts` | `generateXodusOutput(log, extras)` | Calls generateDailyStatus, builds prose paragraphs for XODUS |
| `fitness.ts` | `ActivityLog`, `getActivityLogs`, `addActivityLog`, `getThisWeekLogs`, `getTodayActivity`, `suggestNextWeight` | Activity log CRUD + progressive overload logic |
| `activity-summary.ts` | `getDailyActivitySummary()` | Unified daily view: merged steps, active minutes, weekly stats, balance status |
| `voice-parser.ts` | `parseTrainingFromVoiceLog(transcript)` | Regex-based extraction of workout/exercise data from voice transcripts |
| `projects.ts` | `Project`, `Task`, `getProjects`, `saveProjects`, `getOverdueCount`, `daysUntil` | Project + task CRUD |

### Scoring Pipeline
```
DailyLog + DailyStatusExtras
    ↓
generateDailyStatus()      → executionScore (0–100), alerts[], strengths[], recoveryLevel, disciplineLevel
    ↓
generateXodusOutput()      → paragraphs[], urgency, focusRecommendation
    ↓
XodusCard / /xodus page    → renders prose brief
```

`DailyStatusExtras` must be assembled at the call site (client component) and includes: `voiceLogsToday`, `uploadsToday`, `stackTaken`, `stackTotal`, `overdueProjects`, `weeklyWorkouts`, `activityMinutesToday`, `todayActivityLabel`, `todayActivityType`.

### ActivityLog Merge Rule
`DailyLog.steps` is the authoritative daily step total (user's explicit input). `ActivityLog.steps` are per-workout steps (used as fallback). `getDailyActivitySummary()` enforces this — never sum both naively.

---

## Component Architecture

### Dashboard composition (`app/page.tsx`)
```
GreetingHeader → CommandCenter → QuickActions → WhatNeedsAttention
→ XodusCard → TodayTimeline → QuickStats → FitnessWidget
→ ActivityOverview → ProjectSummary → StackPreview
```

All dashboard cards are in `components/dashboard/`. Each is a self-contained `'use client'` component that manages its own data refresh via storage events.

### Bottom Nav
5 items hardcoded in `components/BottomNav.tsx`: Home | XODUS | Daily | Projects | Stack.
`/fitness` is NOT in the nav — accessed via link on FitnessWidget. Add new nav items to `NAV_ITEMS` array in that file.

### Design Tokens (Tailwind)
- Backgrounds: `bg-[#0a0a0a]` (page), `bg-[#111]` (card), `bg-[#0f0f0f]` (inset)
- Borders: `border border-white/10` (standard), `border border-white/[0.07]` (subtle)
- Cards use `card-elevated` utility class (defined in `globals.css`)
- Glow utilities: `glow-green`, `glow-blue`, `glow-amber`, `glow-red`
- Label pattern: `text-[9px] font-mono uppercase tracking-widest text-zinc-600`
- Data value pattern: `text-lg font-mono font-bold text-white`

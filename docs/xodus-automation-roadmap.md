# XODUS Automation Roadmap
# Picard OS — Product Direction & Implementation Plan

*Last updated: 2026-05-10*

---

## Core Principle

XODUS is not a chatbot page. It is the background agent layer of Picard OS — a pipeline that ingests any input (voice, text, screenshot, upload, wearable data), reasons about it, extracts structured values, updates the relevant data stores, and summarizes what changed. The chat UI is just one of many input channels.

---

## 1. XODUS Agent Architecture

### Current State
- `lib/xodus/brain.ts` — pure-function brain engine. Reads all localStorage, computes domain briefs and insights. No AI model calls. No write side.
- `app/xodus/page.tsx` — CommandInbox + DailyBriefPanel. CommandInbox parses text commands client-side via regex (`lib/command-parser.ts`).
- `lib/obsidian-export.ts` — generates a Markdown flat-file export of all local records, formatted for Obsidian import. Exists but no graph layer.

### Target State: Agent Pipeline

```
Input (any channel)
    ↓
/api/agent  ← server route, POST
    ↓
[1] Classify: what type of input is this?
    daily log update | workout log | project update | nutrition | note | brain memory | query
    ↓
[2] Extract: pull structured values
    { protein: 180, calories: 2200, weight: 181.5, ... }
    { exercise: 'Bench Press', sets: 4, reps: 5, weight: 230 }
    { project: 'play-productions', update: '...', progressBump: 5 }
    ↓
[3] Action: write to data stores
    → POST /api/sync (existing) — Supabase
    → response includes JSON action payload for client to apply to localStorage
    ↓
[4] Confirm: structured response
    { summary: string, actions: XodusAction[], changed: string[] }
    ↓
[5] Memory: save relevant context to brain history
    key insight, theme, or pattern stored for future context injection
```

### Input Channels (phased)
| Channel | Phase | Status |
|---------|-------|--------|
| Text command (CommandInbox) | A | Exists — regex only, needs AI |
| Voice transcript | A | Exists — voice-parser.ts, needs AI routing |
| File/screenshot upload | B | Upload Center exists; parsing TBD |
| WHOOP API data | C | Not built |
| Nutrition screenshot | C | Not built |
| Gmail / Drive document | D | Not built |

---

## 2. AI Provider Abstraction

### Principle
- All AI model calls are server-only. No API keys in client code. No provider-specific imports in client components.
- The abstraction lives in `lib/ai/` — a single interface, multiple backends.
- Model selection is per-task: cheap/fast for classification and extraction, capable for reasoning and briefs.

### Planned File: `lib/ai/provider.ts`

```typescript
// Server-only — never import in 'use client' files
export type AIProvider = 'anthropic' | 'deepseek' | 'openai' | 'local'

export interface AIRequest {
  provider?: AIProvider       // defaults to env var XODUS_AI_PROVIDER
  model?: string              // provider-specific model ID
  systemPrompt: string
  userMessage: string
  responseFormat?: 'text' | 'json'
  maxTokens?: number
}

export interface AIResponse {
  text: string
  provider: AIProvider
  model: string
  inputTokens?: number
  outputTokens?: number
}

export async function callAI(req: AIRequest): Promise<AIResponse>
```

### Provider Configuration (env vars — server-only, never NEXT_PUBLIC_)
```
XODUS_AI_PROVIDER=deepseek          # default provider
XODUS_AI_MODEL=deepseek-chat        # default model
ANTHROPIC_API_KEY=...               # used when provider=anthropic
DEEPSEEK_API_KEY=...                # used when provider=deepseek
OPENAI_API_KEY=...                  # used when provider=openai
```

### Provider Routing Logic
```
XODUS_AI_PROVIDER=deepseek → POST https://api.deepseek.com/v1/chat/completions
                               model: deepseek-chat (cheap) or deepseek-reasoner (complex)
XODUS_AI_PROVIDER=anthropic → Anthropic API
                               model: claude-haiku-4-5-20251001 (cheap) or claude-sonnet-4-6 (capable)
XODUS_AI_PROVIDER=openai    → OpenAI API
                               model: gpt-4o-mini (cheap) or gpt-4o (capable)
```

### Cost Strategy
- Classification + extraction tasks → cheapest model (DeepSeek chat ~$0.001/1K tokens, or Haiku)
- Daily brief generation → mid-tier (DeepSeek chat or Haiku)
- Complex reasoning, voice summarization → capable model (Sonnet or DeepSeek reasoner)
- All prompts include caching headers for stable system context blocks

### Planned Route: `/api/agent`

```
POST /api/agent
Body: {
  input: string             // raw text, voice transcript, or structured data
  inputType: 'text' | 'voice' | 'upload' | 'api_data'
  context?: {               // injected server-side from Supabase/localStorage snapshot
    todayDate: string
    recentLog?: object
    activeProjects?: object[]
  }
}

Response: {
  ok: boolean
  summary: string           // human-readable confirmation
  actions: XodusAction[]    // structured changes for client to apply
  raw?: string              // full model output for debugging
}
```

### XodusAction Types

```typescript
type XodusAction =
  | { type: 'UPDATE_DAILY_LOG';   payload: Partial<DailyLog> }
  | { type: 'LOG_ACTIVITY';       payload: Partial<ActivityLog> }
  | { type: 'UPDATE_PROJECT';     projectId: string; payload: Partial<Project> }
  | { type: 'ADD_TASK';           projectId: string; taskText: string }
  | { type: 'LOG_VOICE';          payload: Partial<VoiceLog> }
  | { type: 'SAVE_BRAIN_NOTE';    content: string; tags: string[] }
  | { type: 'QUERY_RESPONSE';     answer: string }
  | { type: 'NOOP';               reason: string }
```

Client receives actions array, applies them to localStorage, dispatches STORAGE_EVENTS, then calls existing `/api/sync` to persist to Supabase.

---

## 3. Structured JSON Action Pipeline

### Prompt Strategy
System prompt is stable (cacheable) and includes:
- Today's date and user timezone
- Current daily log summary (if logged)
- Active projects list (titles, progress, priority)
- User preferences (protein target, calorie target, workout target)
- Available action types with JSON schemas

User message is the raw input.

Model is instructed to return ONLY a JSON object:
```json
{
  "classification": "daily_log_update",
  "confidence": 0.95,
  "summary": "Logged 220g protein, 2400 calories, and 8.2h sleep.",
  "actions": [
    { "type": "UPDATE_DAILY_LOG", "payload": { "protein": 220, "calories": 2400, "sleepHours": 8.2 } }
  ]
}
```

### Validation Layer
- Response is parsed as JSON; malformed responses fall back to `NOOP` with the raw text shown.
- Each action type has a Zod schema for validation before any localStorage write.
- Actions that fail validation are skipped individually — other actions in the array still apply.

---

## 4. Background Agent Phases

### Phase A — User-triggered (current priority)
- User types or speaks into CommandInbox
- Action dispatched to `/api/agent`
- Response applied client-side
- Confirmation shown inline
- No background execution

### Phase B — Scheduled daily jobs
- Vercel Cron (free tier: 1 job/day) fires at 6:00 AM user timezone
- Generates daily brief: pulls yesterday's Supabase data, runs scoring, saves summary to `brain_notes` table
- Weekly summary fires every Sunday: trend comparison, goal progress, XODUS recommendation
- Implementation: `app/api/cron/daily-brief/route.ts` protected by `CRON_SECRET` header

### Phase C — Integration-triggered
- WHOOP webhook → `/api/webhooks/whoop` → parse recovery/sleep/workout → run XODUS action pipeline → update Supabase
- Nutrition upload → Upload Center → OCR/parse → action pipeline → update daily_log.calories/protein
- No polling; event-driven only

### Phase D — Proactive recommendations
- On app open: XODUS checks if today's log is missing → nudge
- After WHOOP sync: if recovery is red + no rest day logged → proactive recommendation
- Brain graph detects patterns (e.g., low mood correlates with low sleep) → weekly insight surface

### Deduplication Safety
- All Supabase writes use `upsert` with conflict targets — duplicate writes are idempotent
- localStorage writes check timestamps before overwriting newer data
- Agent responses include a `requestId` to prevent double-applying on retry

---

## 5. Trends / Timeline Page

### Route: `/trends`

### Views
| View | Data Range | Granularity |
|------|-----------|-------------|
| Weekly | Last 7 days | Daily bars |
| 30-day | Last 30 days | Daily bars + 7-day rolling avg |
| Monthly | Current calendar month | Daily |
| Yearly | Last 12 months | Weekly averages |

### Metrics (togglable)
- Recovery score (0–100, from daily_logs.recovery_score)
- Strain / activity minutes (daily_logs / activity_logs)
- Sleep hours (daily_logs.sleep_hours)
- HRV (daily_logs.hrv)
- Resting HR (daily_logs.resting_hr)
- Steps (daily_logs.steps)
- Calories consumed (daily_logs.calories)
- Protein consumed (daily_logs.protein)
- Weight (daily_logs.weight)
- Discipline / execution score (derived via generateDailyStatus)
- Weekly workout count (from activity_logs)
- Project progress (from projects — rolling snapshot)

### Rolling Averages
Computed client-side from the full dataset:
- 7-day: mean of last 7 data points
- 30-day: mean of last 30 data points
- Comparison label: "+8% vs last 30d" shown on current period

### Chart Library
recharts is already installed. Use `<LineChart>` + `<AreaChart>` with custom dark theme tokens.

### Data Source
Phase 1: read from localStorage (same pattern as existing dashboard cards).
Phase 2: read from Supabase `daily_logs` table (paginated, date-range query).

### Dashboard Integration
- `FitnessWidget` and `ActivityOverview` weekly previews become links → `/trends?view=weekly`
- Dashboard cards stay read-only widgets; `/trends` is the full analytics surface

### Daily Reset Rules (see §6)
- Dashboard input state (daily form) resets at day boundary
- Trend data never resets — it reads historical records by date
- Trend page detects "no data for date" gracefully (gap in chart, no crash)

---

## 6. Daily Reset Logic

### What Resets Daily
| Item | Resets? | How |
|------|---------|-----|
| Daily log form inputs | YES | New date → new empty DailyLog entry |
| Stack checklist (takenToday) | YES | Existing daily reset logic in stack page |
| XODUS execution score | YES | Derived fresh from today's log each render |
| CommandInbox input | YES | Session state, clears on page reload |

### What Never Resets
| Item | Storage | Notes |
|------|---------|-------|
| Daily logs history | `picard_daily_logs_v1` (Record keyed by YYYY-MM-DD) | Each day is a separate key — no overwrite |
| Activity logs | `picard_activity_logs_v1` (array) | Prepend only, never truncate |
| Voice logs | `picard_voice_logs_v1` (array) | Append only |
| Projects | `picard_projects_v1` | Mutable state — updates are upserts, not replaces |
| Supabase tables | All tables | Date-keyed or append-only; no nightly purge |

### XODUS Date Awareness
- "today" → `new Date().toISOString().slice(0, 10)`
- "yesterday" → subtract 1 day
- "last Monday" → compute the most recent Monday
- Date-specific entries reference the YYYY-MM-DD key directly
- Agent context injection always includes `todayDate` and `yesterdayDate`

### Implementation Note
The `getTodayLog()` function in `lib/storage.ts` already keys by today's date. A new day = a new empty log. Historical logs remain accessible via `getStorage(STORAGE_KEYS.DAILY_LOGS, {})` which returns the full Record. This is correct behavior — no changes needed.

---

## 7. Obsidian Brain / Neural Graph Page

### Artifact Status
- `lib/obsidian-export.ts` EXISTS — generates flat Markdown export of all records, formatted for Obsidian import. This is a data export tool, not a graph UI.
- No Obsidian vault integration, no `.md` sync, no Obsidian plugin detected in project.
- **Conclusion:** No live Obsidian integration. Build an internal Obsidian-inspired graph as a native page. Do not create an Obsidian plugin or file-sync.

### Route: `/brain`

### Node Types
| Node Type | Data Source | Color |
|-----------|-------------|-------|
| AI conversation | `picard_command_history_v1` | Cyan |
| Voice log | `picard_voice_logs_v1` | Purple |
| Project / goal | `picard_projects_v1` | Amber |
| Task | Project.tasks[] | Amber/dim |
| Workout | `picard_activity_logs_v1` | Green |
| Daily log | `picard_daily_logs_v1` | Blue |
| Upload / screenshot | `picard_uploads_v1` | Pink |
| Brain note / insight | `brain_notes` (future) | White |

### Edge Types
| Edge | Logic |
|------|-------|
| Project link | Voice log mentions project name → edge |
| Date proximity | Records within same day → soft edge |
| Repeated pattern | Same exercise/theme appears 3+ times |
| Supports goal | Task under project, voice log references project |
| Mentioned with | Co-occurrence of terms in text fields |

### Visual Style
- Dark canvas: `bg-[#080808]`
- Nodes: filled circles, radius proportional to recency or connection count
- Edges: semi-transparent lines, weight proportional to relationship strength
- Active node: glow ring (color matches domain)
- Click node: slide-up detail panel with full record
- Filter bar: by time range, domain (health, fitness, projects, mental), project name

### Graph Library Options (evaluate at implementation time)
1. **d3-force** — maximum control, steeper implementation effort
2. **react-flow** — good for DAG/flowchart style, less physics-based
3. **vis-network** — simpler API, physics simulation built-in
4. **Cytoscape.js** — mature graph library, good filter/layout support
No library is installed yet. Select at implementation based on bundle size and SSR compatibility.

### Graph Data Assembly (Phase E — reading local records)
```typescript
// lib/brain-graph.ts
export interface GraphNode {
  id: string
  type: NodeType
  label: string
  date: string
  domain: string
  data: unknown      // full record reference
  weight: number     // connection count, used for radius
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  strength: number   // 0–1
}

export function buildBrainGraph(): { nodes: GraphNode[]; edges: GraphEdge[] }
```

Edge detection runs client-side on page load: scan all records, extract text, detect co-occurrence and relationships. No server required for Phase E.

### Export Integration
`lib/obsidian-export.ts` can continue to serve the "download for Obsidian" feature alongside the internal graph. They are complementary, not redundant.

### Obsidian Brain Architecture
The full persistent linked Markdown/wiki architecture for the XODUS brain is documented in detail in:
**`docs/obsidian-brain-guide.md`**

Key points (summary):
- Each record type (daily log, workout, voice log, project update, upload) becomes its own Markdown node with `[[wiki-links]]` to related nodes
- A hot-cache file (`vault/_hot-cache.md`) is pre-generated weekly and injected into the XODUS system prompt for persistent context across sessions
- The `/brain` graph page visualizes these nodes and edges as a force-directed graph
- `lib/obsidian-export.ts` is a flat one-time export; the internal brain vault is a separate, living system
- Brain vault Supabase schema (`brain_notes` table) is deferred to Phase E

---

## 8. Integration Roadmap

### Order and Rationale

| Priority | Integration | Rationale |
|----------|-------------|-----------|
| 1 | WHOOP | Most data-dense; recovery + HRV + sleep auto-populates daily_log recovery fields |
| 2 | Nutrition screenshot/upload parsing | High daily friction point; OCR from iPhone screenshot removes manual entry |
| 3 | Gmail / Google Drive | XODUS can summarize emails, link docs to projects; lower daily impact |
| 4 | AI conversation history import | Feed prior Claude/XODUS conversations into brain graph |
| 5 | Obsidian vault sync (optional) | Low priority — internal graph is the primary surface |

### WHOOP Plan (Phase D in coding priority)
- OAuth 2.0 flow: user authorizes, tokens stored in Supabase (never client-visible)
- Scoped endpoints: `/v1/recovery`, `/v1/sleep`, `/v1/workouts`, `/v1/hr_data`
- Sync cadence: on app open + hourly webhook or poll
- Data mapped to: `daily_logs` (recovery_score, hrv, resting_hr, sleep_hours, strain) and `activity_logs` (duration, rpe, heart_rate_avg)
- Dedup: WHOOP workout IDs stored in `activity_logs.external_id`
- Route: `app/api/integrations/whoop/` directory (auth, callback, sync handlers)

### Nutrition Screenshot Parsing (Phase F in coding priority)
- User photographs MFP or any nutrition label
- Uploaded to Upload Center → triggers XODUS vision pipeline
- Server sends image to AI model (vision-capable: GPT-4o, Claude Sonnet, or Gemini)
- Model extracts: calories, protein, carbs, fat, meal name
- Action: `UPDATE_DAILY_LOG` with extracted values (user confirms before save)
- Fallback: manual entry form pre-filled with extracted values

---

## 9. Recommended Next Coding Order

| Step | Task | Rationale |
|------|------|-----------|
| A | XODUS agent pipeline: `/api/agent` route + `lib/ai/provider.ts` | Unlocks all AI-powered features |
| B | AI provider env config + DeepSeek integration first | Cheapest; validate pipeline end-to-end with low cost |
| C | Trends / timeline page skeleton at `/trends` | High visible value; uses existing data; recharts already installed |
| D | WHOOP OAuth research + route stubs | Most impactful integration; plan before building |
| E | Brain graph page skeleton at `/brain` — nodes only, no edges yet | Uses existing local records; graph library TBD |
| F | Nutrition screenshot parsing via XODUS vision pipeline | Reduces daily friction; depends on agent pipeline (Step A) |

### Step A Detail — What to Build First
1. `lib/ai/provider.ts` — `callAI()` function, env-var routing to DeepSeek/Anthropic/OpenAI
2. `app/api/agent/route.ts` — POST handler, classify → extract → return `XodusAction[]`
3. System prompt for daily-log classification (covers the most common XODUS inputs)
4. Client-side action applier in CommandInbox: receives actions, applies to localStorage, dispatches events
5. Wire existing voice transcript parser output through the agent pipeline instead of regex-only

### What NOT to Build Yet
- Full WHOOP OAuth flow (research first)
- Brain graph edges (nodes first)
- Gmail / Drive integration
- Proactive recommendations (Phase D behavior)
- Any UI redesign

---

## Appendix: Existing Artifacts Summary

| File | Status | Purpose |
|------|--------|---------|
| `lib/xodus/brain.ts` | Exists, working | Pure-function brain engine, 6 domain briefs |
| `lib/obsidian-export.ts` | Exists, working | Flat Markdown export for Obsidian import |
| `lib/supabase/sync.ts` | Exists, working | Fire-and-forget client→Supabase sync |
| `app/api/sync/route.ts` | Exists, working | Server sync POST handler |
| `lib/command-parser.ts` | Exists (assumed) | Regex-based command parsing in CommandInbox |
| `docs/supabase-phase1-schema.sql` | Exists | Phase 1 table schemas (7 tables) |
| `docs/supabase-schema-plan.md` | Exists | Full schema plan including deferred tables |
| `lib/xodus/actions.ts` | Exists, built | Discriminated union action type system |
| `lib/ai/provider.ts` | Exists, built | Server-only AI abstraction (DeepSeek/OpenAI/Anthropic/mock) |
| `app/api/agent/route.ts` | Exists, built | XODUS agent POST route — classify → extract → XodusAction[] |
| `docs/obsidian-brain-guide.md` | Exists | Full persistent brain/vault architecture guide |
| `/trends` | NOT YET BUILT | Next: trends/timeline page |
| `/brain` | NOT YET BUILT | Phase E: brain graph page |

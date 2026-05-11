# XODUS Agent Router

> **Status:** Phase 1 shipped — central agent powers `/xodus` chat. Reusable by Telegram, voice, shortcuts, screenshots, and uploads when those channels come online.

XODUS is the in-app AI **operator** inside Picard OS — not just a chatbot, not just a regex parser. The user can talk to it like ChatGPT/Claude and have it safely mutate Picard OS data.

DeepSeek is the cheap default model behind it. OpenAI and Anthropic are pluggable. XODUS is the personality and the action surface.

---

## 1. One router, many channels

```
web_chat ─┐
telegram ─┤
voice    ─┼──▶ routeXodusInput()  ──▶ XodusAgentResult ──▶ applyXodusActionsClient()
shortcut ─┤        (server)              · reply              (browser)
upload   ─┤                              · actions[]              ↓
screenshot┘                              · autoApply[]      localStorage / UI updates
manual ───┘                              · needsReview[]
```

Every input channel produces the same `XodusRouteInput`:

```ts
{
  text:    string
  source:  'web_chat' | 'telegram' | 'voice' | 'shortcut' | 'upload' | 'screenshot' | 'manual'
  now?:    string         // YYYY-MM-DD
  context: XodusChatContext
  media?:  Array<{ kind, fileName?, mimeType?, url?, caption? }>
}
```

The router returns a `XodusAgentResult` (see § 3) that the channel applies.

---

## 2. Action schema

All action types live in `lib/xodus/action-types.ts` as a discriminated union:

| Type | Purpose | Auto-apply? |
|---|---|---|
| `create_note` | Add a note (any category) | yes |
| `update_note` | Edit existing note by fuzzy match | yes if matched |
| `create_goal` | New daily goal | yes |
| `complete_goal` | Mark a goal done by fuzzy match | yes if matched |
| `update_goal` | Change goal title/date/status | yes if matched |
| `create_grocery` | Add items to grocery note | yes |
| `update_nutrition_profile` | Change protein/cal targets or phase | **only at conf ≥ 0.85** |
| `log_food` | Log calories/protein/carbs/fat to daily log | yes |
| `log_manual_health` | Steps, distance, sleep, weight, etc. | yes |
| `create_workout_log` | New ActivityLog with exercises | yes |
| `create_project_update` | Pin update to a project | **needs review** |
| `create_memory_candidate` | Suggest a memory record | **needs review** |
| `training_recommendation` | Informational training intensity advice | shown in reply only |
| `add_open_loop` | New open-loop reminder | yes |
| `save_pending_review` | Channel can't handle this input yet | **needs review** |
| `no_op` | Just chat, no mutation | n/a |

Each action carries `confidence: 0..1`. The auto-apply gate is `0.6` for normal actions, `0.85` for `update_nutrition_profile`.

---

## 3. Agent result

```ts
type XodusAgentResult = {
  reply:               string
  intent:              'daily_planning' | 'note' | 'grocery' | 'nutrition' | 'manual_health'
                      | 'workout_log' | 'project_update' | 'memory' | 'training' | 'mixed' | 'unknown'
  actions:             XodusAction[]
  autoApplyActions:    XodusAction[]
  needsReviewActions:  XodusAction[]
  confidence:          number
  source:              'ai' | 'rule_based'
  missingDataSignals?: string[]
  warnings?:           string[]
}
```

---

## 4. AI provider behaviour

`lib/ai/provider.ts` auto-selects: **DeepSeek** (cheapest) → Anthropic → OpenAI → mock.

The system prompt (`brain-router.ts`) tells XODUS:
- It's an action-taking agent, not a chatbot.
- Profile facts (cutting, 184 lb, 2,200 kcal / 210g protein, active projects) — never changed unless user explicitly says so.
- Strict JSON only, every action has `type` + `confidence`.
- Never diagnose mental health. Never infer it from voice tone.
- Never invent data (no fabricated steps, food, calendar entries).
- Screenshots/images with no extraction → `save_pending_review`.
- Confidence calibration: 0.9+ explicit, 0.5–0.65 ambiguous → needs review, ≤0.4 → pending or no_op.

---

## 5. Rule-based fallback

`lib/xodus/fallback-router.ts` covers the common phrasings so the agent stays useful with no AI key:

- Workouts: `"3 sets pull-ups, 4 sets bench, 5 sets dead hangs"` → `create_workout_log` with exercises array.
- Manual health: `"log 8500 steps"`, `"walked 4 miles"`, `"active energy 600"`, `"slept 7.5 hours"`, `"weighed 184"`.
- Nutrition: `"ate 900 cal and 80g protein"` → `log_food`. `"set protein to 220"` → `update_nutrition_profile`.
- Grocery: `"add eggs and rice to groceries"` → `create_grocery` with items array.
- Project: `"add note to Porsche: order brake rotors"` → `create_note` (car) + `create_project_update`.
- Memory: `"remember that I prefer Telegram"` → `create_memory_candidate` (needs review).
- Goal completion: `"I dunked today"` → `complete_goal` (fuzzy-matches today's goals).
- Free notes: `"log that today was rough"` → `create_note` (personal). NO mental-health language.
- Training: `"should I train today"` → `training_recommendation` using `computeReadiness()`.

---

## 6. Application strategies

### 6a. Client-side (today)

`lib/xodus/action-applier.ts → applyXodusActionsClient(actions)` runs in the browser and mutates localStorage via the existing `lib/` modules (`daily-goals`, `nutrition-profile`, `storage`, `notes`, `fitness`). Returns per-action `{ status: 'applied' | 'pending' | 'failed', message }`.

ChatPanel calls this twice per response:
1. `autoApplyActions` → mutate immediately
2. `needsReviewActions` → currently saved as notes for review

### 6b. Server-side (Telegram + future channels)

**Telegram cannot write the browser's localStorage.** Two paths exist:

1. **Inbox queue** (recommended first): persist `XodusInboxItem` server-side (Supabase), surface in `/xodus` UI for one-tap apply. The browser still does the localStorage mutation via the client applier.
2. **Direct Supabase apply** (when those tables exist): server applier mirrors the client applier but writes Supabase rows. Requires `daily_logs`, `activity_logs`, `xodus_notes`, `xodus_goals` tables.

`lib/xodus/action-types.ts` already defines `XodusInboxItem` for the queue path.

---

## 7. Safety boundaries

| Allowed | Forbidden |
|---|---|
| Create/update notes, groceries, goals | Edit source code or repo files |
| Mark goals done by fuzzy match | Delete arbitrary data |
| Log food/manual health/workouts | Change env vars or secrets |
| Update nutrition profile (high conf only) | Run shell commands |
| Suggest memory candidates (needs review) | Diagnose mental health |
| Suggest project updates (needs review) | Infer mental health from voice tone |

Source-code/dev actions, if ever added, must live behind an explicit `admin: true` flag with separate confirmation. Not in this pass.

---

## 8. Screenshot / image foundation

Phase 1 does **not** extract from images. `routeXodusInput()` accepts a `media` field; any attached media without an extraction pipeline produces a `save_pending_review` action with the media metadata preserved. Future MyFitnessPal screenshot OCR slots in as an extraction step before the AI call.

---

## 9. Example mappings

| Input | Expected actions |
|---|---|
| "I did 3 sets pull-ups, 4 sets bench, 5 sets dead hangs today." | `create_workout_log` (3 exercises) |
| "I dunked today." | `complete_goal` (goalQuery="dunk"), optional `create_memory_candidate` if no goal exists |
| "Health sync: steps 8500, distance 4.2 miles, active energy 600." | `log_manual_health` |
| "I ate 900 cal and 80g protein." | `log_food` |
| "Add note to Porsche: order brake rotors." | `create_note` (car) + `create_project_update` (Porsche) |
| "Rough day, keep training lighter." | `create_note` (personal) + `training_recommendation` (low) |
| "MyFitnessPal screenshot." (image attached, no parser) | `save_pending_review` |
| "Remember I prefer Telegram input over shortcuts." | `create_memory_candidate` (design_preference, needs_confirmation) |

---

## 10. Files

- `lib/xodus/action-types.ts` — discriminated union, auto-apply policy, intent classifier, input/result envelopes
- `lib/xodus/brain-router.ts` — `routeXodusInput()`, system prompt, AI JSON validator, action splitter
- `lib/xodus/fallback-router.ts` — rule-based parser for all the common phrasings
- `lib/xodus/action-applier.ts` — `applyXodusActionsClient()` for browser
- `app/api/xodus/chat/route.ts` — thin wrapper, returns legacy `actions` + new `agent` envelope
- `components/xodus/ChatPanel.tsx` — consumes agent envelope, shows applied vs pending counts

---

## 11. Remaining TODOs

- [ ] Telegram channel: webhook endpoint that calls `routeXodusInput({ source: 'telegram', ... })` and persists results to a Supabase `xodus_inbox` table
- [ ] `/xodus` inbox UI for one-tap apply of pending review items
- [ ] Server-side applier for Supabase mirror tables (when phase 2 schema lands)
- [ ] Screenshot OCR pipeline (MyFitnessPal first) — extract text → re-run through router
- [ ] Voice channel: pass `source: 'voice'` and emit pure transcripts (no tone inference)
- [ ] Project name fuzzy matching against actual `projects` localStorage (currently just stored as a note)
- [ ] Real memory candidate persistence (today saved as note for review)

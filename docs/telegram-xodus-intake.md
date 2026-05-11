# Telegram → XODUS Intake

> **Status:** Webhook + inbox shipped. Run the SQL in § 5, set the env vars, point Telegram at the webhook, and start texting XODUS from your phone.

Telegram is **XODUS's texting interface**. Every message lands in the same central `routeXodusInput()` agent router used by the web chat. DeepSeek is the model behind XODUS; Picard OS / Supabase is the source of truth.

---

## 1. Architecture

```
Phone Telegram
   │  (text, photo, voice, document)
   ▼
Telegram Servers
   │  POST update
   ▼
/api/integrations/telegram/webhook         ← this repo
   · verify TELEGRAM_WEBHOOK_SECRET header (optional)
   · verify chat_id ∈ TELEGRAM_ALLOWED_CHAT_ID
   · extract text + media metadata
   ▼
routeXodusInput({ text, source: 'telegram', media })
   · DeepSeek/AI provider via lib/ai/provider.ts
   · falls back to rule-based router with no key
   ▼
XodusAgentResult { reply, actions[], autoApply[], needsReview[] }
   ▼
Supabase: xodus_inbox row inserted (pending)
   ▼
sendTelegramMessage(chatId, reply)         ← XODUS replies to you on Telegram
   ▼
(later) /xodus inbox UI surfaces pending items → user taps Apply → client-side applier writes localStorage
```

**Telegram never writes the browser's localStorage.** It cannot — it runs server-side. All Telegram-originated actions land in `xodus_inbox` as **pending** and get applied later from the `/xodus` UI by the existing `applyXodusActionsClient()`. This is the safest MVP and the path that keeps the existing data layer intact.

---

## 2. Env vars

| Variable | Required? | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | Bot API token from BotFather. Server-only. |
| `TELEGRAM_ALLOWED_CHAT_ID` | strongly recommended | Comma-separated allow-list of chat IDs. If unset, the webhook accepts any chat — fine for first test, never in production. |
| `TELEGRAM_WEBHOOK_SECRET` | optional | Telegram passes this back as `X-Telegram-Bot-Api-Secret-Token` on each update. Adds a third layer of auth. |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` | yes for persistence | Required to insert into `xodus_inbox`. Without these the webhook still replies but doesn't persist. |
| `DEEPSEEK_API_KEY` (or `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`) | optional | Without a key the rule-based fallback router runs. |

Set these in `.env.local` for dev and in Vercel → Project → Settings → Environment Variables for production. **Never commit secrets.**

---

## 3. One-time Telegram setup

### 3a. Create the bot

1. Open Telegram → search **@BotFather** → start chat
2. Send `/newbot`
3. Pick a name (e.g. *XODUS*) and a unique username (e.g. *picard_xodus_bot*)
4. BotFather returns your `TELEGRAM_BOT_TOKEN` — copy it

### 3b. Find your chat ID

1. Send any message to your new bot
2. Open this URL in a browser (replace TOKEN):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find `"chat":{"id":123456789,...}` — that's your `TELEGRAM_ALLOWED_CHAT_ID`

### 3c. Set the webhook (production)

Replace TOKEN, URL, and SECRET. The `secret_token` is optional but recommended.

```powershell
$token  = "YOUR_BOT_TOKEN"
$url    = "https://picard-os.vercel.app/api/integrations/telegram/webhook"
$secret = "YOUR_WEBHOOK_SECRET"   # any random string, must match TELEGRAM_WEBHOOK_SECRET env var

Invoke-RestMethod `
  -Uri "https://api.telegram.org/bot$token/setWebhook" `
  -Method POST `
  -Body @{ url = $url; secret_token = $secret; drop_pending_updates = "true" }
```

Verify it stuck:
```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
# Look for: "url": "...", "pending_update_count": 0
```

Remove the webhook later:
```powershell
Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/deleteWebhook"
```

---

## 4. Local dev

Telegram **cannot** call `localhost`. Two options:

1. **Test against Vercel.** Point the webhook at your production deployment. Edits to local code don't get hit by Telegram.
2. **Use a tunnel.** Run `ngrok http 3000` (or Cloudflare Tunnel), get the public HTTPS URL, set the webhook to `<tunnel>/api/integrations/telegram/webhook`. Set the same env vars in `.env.local`.

For pure logic testing without Telegram, you can POST a fake Update payload at the local route:

```powershell
$body = @'
{
  "update_id": 1,
  "message": {
    "message_id": 1,
    "date": 1715300000,
    "chat": { "id": 123456789 },
    "from": { "id": 123456789, "username": "test" },
    "text": "Add eggs and rice to groceries"
  }
}
'@

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/integrations/telegram/webhook" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json" } `
  -Body $body
```

This works only when `TELEGRAM_BOT_TOKEN` is set — the route exits early otherwise.

---

## 5. Supabase — `xodus_inbox` table

Open Supabase → SQL Editor → New query. Paste and run:

```sql
create table if not exists xodus_inbox (
  id              uuid          primary key default gen_random_uuid(),
  source          text          not null default 'telegram',
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

alter table xodus_inbox enable row level security;

-- Phase 1 single-user: service role only (Supabase Auth not wired into this app yet).
-- The webhook uses the server-side admin client, which bypasses RLS. When Auth lands,
-- add an "owner only" policy keyed on auth.uid().
```

The webhook handles a missing table gracefully — it still replies to Telegram but flags `inbox not configured`. The Settings page surfaces the same signal.

---

## 6. Security

- **Allow-list.** `TELEGRAM_ALLOWED_CHAT_ID` is the primary gate. Unknown chats get a polite *"Unauthorized chat."* reply and nothing persists.
- **Webhook secret.** `TELEGRAM_WEBHOOK_SECRET` adds defense-in-depth: a forged POST without the correct `X-Telegram-Bot-Api-Secret-Token` header is rejected before any work runs.
- **No token echo.** The route never returns the bot token or webhook secret in any response.
- **Server-only secrets.** `lib/telegram/client.ts` reads `process.env.TELEGRAM_BOT_TOKEN` only on the server. Do not import it from a client component.
- **HTTPS only.** Telegram requires the webhook URL to be HTTPS — Vercel enforces this.

---

## 7. Reply behavior

The webhook replies with the XODUS-voice text from the agent plus a short status line:

```
Captured 4 goals for tomorrow.
4 actions queued
Open /xodus to review and apply.
```

```
Added eggs, chicken, rice to groceries.
1 actions queued
Open /xodus to review and apply.
```

When the inbox table is missing:
```
Got it.
Note: XODUS inbox table not set up yet — message received but not persisted.
```

When the chat isn't authorized:
```
Unauthorized chat.
```

---

## 8. Examples (input → action plan)

| Text from Telegram | Action plan |
|---|---|
| "Add eggs and rice to groceries" | `create_grocery` (auto-apply) |
| "Tomorrow I need to train, study, and finish the brain page" | 3× `create_goal` (auto-apply) |
| "I did 3 sets pull-ups, 4 sets bench, 5 sets dead hangs" | `create_workout_log` with exercises array |
| "I ate 900 cal and 80g protein" | `log_food` |
| "Log 8500 steps today" / "Health sync: steps 8500, distance 4.2, active energy 600" | `log_manual_health` |
| "Add note to Porsche: order brake rotors" | `create_note` (car) + `create_project_update` (Porsche, needs review) |
| "Remember I prefer Telegram input over shortcuts" | `create_memory_candidate` (needs review) |
| "I dunked today" | `complete_goal` (fuzzy) or `create_memory_candidate` if no matching goal |
| MyFitnessPal screenshot (photo attached) | `save_pending_review` — *"Saved the attachment for XODUS review. Image extraction is next."* |
| Voice note (audio attached) | `save_pending_review` — audio transcription pipeline TODO |

---

## 9. Media / screenshot handling

The webhook **extracts media metadata only** (kind, file name, mime type, caption). It never fetches the file from Telegram in this MVP. The agent emits a `save_pending_review` action so the message is preserved verbatim in `xodus_inbox` and surfaces in `/xodus` later.

Next steps for media:
- Pull the file via `getFile` → fetch the file URL with the bot token
- For images: route through an OCR or vision step (e.g. MyFitnessPal screenshot → `log_food`)
- For voice: route through Whisper → re-run text through `routeXodusInput`

These slot in as **extraction steps before the agent call** — the action schema doesn't change.

---

## 10. Health / manual data via Telegram

Manual health works out of the box because `routeXodusInput()` already supports `log_manual_health`:

```
"Log 8500 steps today"            → log_manual_health { steps: 8500 }
"Walked 4.2 miles today"          → log_manual_health { distanceMiles: 4.2 }
"Health sync: steps 8500, distance 4.2 miles, active energy 600"
                                  → log_manual_health { steps: 8500, distanceMiles: 4.2, activeEnergyKcal: 600 }
"Slept 7.5 hours"                 → log_manual_health { sleepHours: 7.5 }
"Weighed 184 today"               → log_manual_health { weightLb: 184 }
```

Because Telegram runs server-side, **these are persisted to `xodus_inbox` as pending**, not applied directly to `daily_logs`. The `/xodus` UI will let you tap Apply, which routes through `applyXodusActionsClient()` and writes the existing localStorage `daily_logs` keys.

When `daily_logs` lives in Supabase (phase 2 of the data-layer migration), a server-side applier will be able to write the rows directly. Until then, the inbox queue is the safe path.

---

## 11. /xodus inbox UI — coming next

The Settings page surfaces inbox status today (configured / restricted / table ready). The next iteration of `/xodus` will add an "Inbox" tab that:

- lists pending `xodus_inbox` rows newest-first
- shows the original message + extracted actions
- has Apply / Dismiss buttons per row
- on Apply, calls `applyXodusActionsClient()` and PATCHes the row to `status: applied`

This is the canonical place to review and apply anything XODUS captured from Telegram, future voice messages, screenshot OCR results, or other server-side channels.

---

## 12. Remaining TODOs

- [ ] Build `/xodus` inbox UI (list, apply, dismiss)
- [ ] Telegram file download + OCR (start with MyFitnessPal screenshots)
- [ ] Voice transcription pipeline (Whisper) for voice notes
- [ ] Server-side direct `daily_logs` writes (phase 2 — when Supabase mirror tables land)
- [ ] Inbox status badge on `/xodus` page header (pending count)
- [ ] Multi-user support (Telegram username → Supabase Auth uid mapping)

# XODUS Universal Intake → iOS Shortcuts

> **Endpoint:** `POST https://picard-os.vercel.app/api/xodus/intake`
> **Status:** Live, version `intake-v1`.
> **Old Apple Health route:** `/api/integrations/apple-health/sync` still works (v6) but the simpler path going forward is `/api/xodus/intake`.

XODUS now has a single forgiving intake endpoint. Send messy text. Get logged. Process later.

---

## 1. Shortcut setup

**Action:** *Get Contents of URL*

| Field | Value |
|---|---|
| URL | `https://picard-os.vercel.app/api/xodus/intake` |
| Method | `POST` |
| Headers | `X-XODUS-INTAKE-SECRET: <your-secret>` (only if you set `XODUS_INTAKE_SECRET` in Vercel env) |
| Request Body | JSON or plain text — both work |

### Option A — JSON

```json
{
  "source": "apple_shortcut",
  "message": "5676 steps today"
}
```

### Option B — Plain text

```
5676 steps today
```

Set `Content-Type: text/plain` and the route will accept the raw body as the message.

---

## 2. What XODUS does on receipt

1. **Auth** (optional `X-XODUS-INTAKE-SECRET` header)
2. **Normalize** — extract `message` from any of `message / text / body / content / raw` keys, or use plain-text body
3. **Classify** — rule-based tagger assigns tags like `health`, `fitness`, `task`, `goal`, `nutrition`, `grocery`, `idea`, `mood`, `project`, `money`
4. **Store** in `xodus_inbox` (Supabase) with `processed: false`
5. **Reply fast** — under 1s, no AI calls

DeepSeek/AI processing happens later (out of band). The Shortcut never waits.

---

## 3. Example responses

**Success:**
```json
{
  "ok": true,
  "stored": true,
  "id": "8c91…",
  "source": "shortcut",
  "tags": ["health", "activity"],
  "messagePreview": "5676 steps today",
  "processed": false,
  "version": "intake-v1"
}
```

**Stored=false (Supabase not configured or table missing — message accepted but not persisted):**
```json
{
  "ok": true,
  "stored": false,
  "reason": "no_supabase",
  "source": "shortcut",
  "tags": ["health", "activity"],
  "messagePreview": "5676 steps today",
  "processed": false,
  "version": "intake-v1"
}
```

**Unauthorized:**
```json
{ "ok": false, "stored": false, "reason": "unauthorized", "version": "intake-v1" }
```

**No usable message:**
```json
{ "ok": false, "stored": false, "reason": "no_message", "version": "intake-v1" }
```

---

## 4. Other input shapes the route accepts

| Body | Treated as |
|---|---|
| `{"source":"voice","message":"need groceries tomorrow"}` | voice intake |
| `{"source":"manual","message":"call John"}` | manual intake, tag → `task` |
| `{"text":"ran 2 miles and felt good"}` | source defaults to manual |
| `{"raw":"5676 count Today, 7:17 AM"}` | source defaults to manual, message = raw value |
| `"5676 steps today"` (text/plain) | manual intake |

Unknown fields land in `metadata`. The original body is preserved in `actions[0].payload.rawPayload`.

---

## 5. SQL setup

If `xodus_inbox` doesn't exist yet, run `docs/sql/xodus_inbox.sql` in Supabase SQL editor. The route reports `stored: false, reason: "table_missing"` when the table is absent — the Shortcut still gets a 200.

---

## 6. Env vars

| Variable | Required? | Purpose |
|---|---|---|
| `XODUS_INTAKE_SECRET` | recommended | Shared secret for `X-XODUS-INTAKE-SECRET` or `Authorization: Bearer …`. If unset, route runs in open mode. |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` | for persistence | Without these the route still accepts requests but returns `stored: false`. |
| `DEEPSEEK_API_KEY` | optional, future | Required when `XODUS_AI_PROCESSING_ENABLED=true`. Today: ignored. |
| `XODUS_AI_PROCESSING_ENABLED` | optional, future | Set to `"true"` to flip on DeepSeek processing once that path is wired. |

---

## 7. Inspect captured items

Open `/signals` in Picard OS. Pending intake items from this route appear with source badges and tag chips.

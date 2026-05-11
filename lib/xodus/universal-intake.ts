// XODUS Universal Intake — server-side shared logic.
//
// Goal: accept messy input from any source (Telegram, iOS Shortcut, voice,
// manual, plain text, JSON), normalize it into a uniform shape, classify
// lightly with rules, and persist to xodus_inbox. DeepSeek/AI processing
// happens later, on the queue.
//
// Storage: reuses the existing xodus_inbox table via saveXodusInboxItem().
// No schema changes. Tags + classifier metadata are folded into existing
// columns (actions jsonb + parsed_summary text).

import { saveXodusInboxItem } from './inbox-server'
import type { XodusInputSource } from './action-types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NormalizedIntake {
  source:      XodusInputSource | string
  message:     string                       // human-readable text
  rawPayload:  unknown                      // original JSON body (or string)
  metadata:    Record<string, unknown>      // any extra fields from the source
  createdAt:   string                       // ISO timestamp
  tags:        string[]                     // rule-based classification
}

export interface IntakeStoreResult {
  ok:       boolean
  stored:   boolean
  id?:      string
  reason?:  string                          // when stored=false (e.g. 'no_supabase')
}

// Map any free-form source string to the existing XodusInputSource union,
// or pass through as a string for novel sources.
const SOURCE_ALIASES: Record<string, XodusInputSource> = {
  telegram:                'telegram',
  apple_shortcut:          'shortcut',
  apple_health_shortcut:   'shortcut',
  shortcut:                'shortcut',
  ios_shortcut:            'shortcut',
  voice:                   'voice',
  upload:                  'upload',
  screenshot:              'screenshot',
  web_chat:                'web_chat',
  chat:                    'web_chat',
  manual:                  'manual',
}

function coerceSource(input: unknown): XodusInputSource {
  const s = String(input ?? '').trim().toLowerCase()
  return SOURCE_ALIASES[s] ?? 'manual'
}

// ─── Normalize ────────────────────────────────────────────────────────────────
//
// Accepts any of these shapes (and more):
//   { source, message }
//   { source, text }
//   { source, raw }
//   { text }
//   { raw }
//   plain string body
// Returns a NormalizedIntake or null if no usable text could be extracted.

export function normalizeIntakePayload(
  body: unknown,
  contentType: string | null,
): NormalizedIntake | null {
  const createdAt = new Date().toISOString()

  // Plain text body
  if (typeof body === 'string') {
    const text = body.trim()
    if (!text) return null
    return {
      source:     'manual',
      message:    text,
      rawPayload: body,
      metadata:   { contentType: contentType ?? 'text/plain' },
      createdAt,
      tags:       classifyRuleBased(text),
    }
  }

  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>

  // Extract message from many possible keys, in priority order
  const candidates = [b.message, b.text, b.body, b.content, b.raw]
  let message = ''
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      message = c.trim()
      break
    }
  }
  if (!message) return null

  const source = coerceSource(b.source)

  // Capture anything else as metadata (excluding message/source we already used)
  const metadata: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(b)) {
    if (['message', 'text', 'body', 'content', 'raw', 'source'].includes(k)) continue
    metadata[k] = v
  }

  return {
    source,
    message,
    rawPayload: body,
    metadata,
    createdAt,
    tags: classifyRuleBased(message),
  }
}

// ─── Rule-based classification (no AI) ────────────────────────────────────────
//
// Returns a small set of tags. Intentionally permissive — a message can
// match several domains. DeepSeek will refine this later.

const RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: 'health',    patterns: [/\bsteps?\b/i, /\bcount\b/i, /\bsleep\b/i, /\bhrv\b/i, /\brecovery\b/i, /\bweight\b/i] },
  { tag: 'fitness',   patterns: [/\bbench\b/i, /\bsquat\b/i, /\bdead-?lift\b/i, /\bworkout\b/i, /\blift\b/i, /\brun\b/i, /\bran\b/i, /\bgym\b/i, /\bcardio\b/i, /\blegs?\b/i, /\bchest\b/i, /\bback\b/i, /\bpush-?ups?\b/i, /\bpull-?ups?\b/i, /\bsore\b/i, /\bsets?\b/i, /\breps?\b/i] },
  { tag: 'activity',  patterns: [/\bsteps?\b/i, /\bmiles?\b/i, /\bdistance\b/i, /\bwalk(ed|ing)?\b/i, /\bran\b/i] },
  { tag: 'nutrition', patterns: [/\bcalor(ies|y)\b/i, /\bprotein\b/i, /\bcarbs?\b/i, /\bfats?\b/i, /\bmeals?\b/i, /\bate\b/i, /\beat\b/i, /\bfood\b/i, /\bdiet\b/i] },
  { tag: 'grocery',   patterns: [/\bgroceries\b/i, /\bgrocery\b/i, /\bbuy\b/i, /\bpick up\b/i, /\beggs?\b/i, /\bmilk\b/i, /\brice\b/i] },
  { tag: 'task',      patterns: [/\bremind\b/i, /\btodo\b/i, /\bto do\b/i, /\bneed to\b/i, /\bhave to\b/i, /\bcall\b/i, /\bemail\b/i, /\btomorrow\b/i, /\btonight\b/i] },
  { tag: 'goal',      patterns: [/\bgoal\b/i, /\bwant to\b/i, /\bhit\b/i, /\breach\b/i, /\baim\b/i, /\btarget\b/i] },
  { tag: 'idea',      patterns: [/\bidea\b/i, /\bbuild\b/i, /\bshould (we|i)\b/i, /\bwhat if\b/i, /\bmaybe\b/i] },
  { tag: 'project',   patterns: [/\bpicard\b/i, /\bxodus\b/i, /\bporsche\b/i, /\bplay\b/i, /\bgraton\b/i, /\bneurobuild\b/i, /\bapartment\b/i, /\bflying elephants\b/i] },
  { tag: 'money',     patterns: [/\$\d/, /\bspent\b/i, /\bpaid\b/i, /\bbought\b/i, /\bcost\b/i, /\bsaved\b/i] },
  { tag: 'mood',      patterns: [/\bgreat\b/i, /\bawesome\b/i, /\bcooked\b/i, /\brough\b/i, /\btired\b/i, /\bstrong\b/i, /\bfelt\b/i] },
]

export function classifyRuleBased(message: string): string[] {
  const tags = new Set<string>()
  for (const { tag, patterns } of RULES) {
    if (patterns.some(p => p.test(message))) tags.add(tag)
  }
  return Array.from(tags)
}

// ─── Store ────────────────────────────────────────────────────────────────────
//
// Persists the normalized intake to xodus_inbox via the existing helper.
// Returns { ok: true, stored: true|false, reason? } — never throws.

export async function storeIntake(item: NormalizedIntake): Promise<IntakeStoreResult> {
  try {
    const res = await saveXodusInboxItem({
      source:        item.source as XodusInputSource,
      text:          item.message,
      parsedSummary: item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : undefined,
      // Park tags + classifier info + raw payload under actions (jsonb, freeform).
      // Real XodusActions go through routeXodusInput; raw intake uses a single
      // pseudo-action so /signals can render it consistently.
      actions: [{
        type:    'save_pending_review',
        reason:  'raw_intake',
        payload: {
          classifier: 'rule_based_v1',
          tags:       item.tags,
          metadata:   item.metadata,
          rawPayload: item.rawPayload,
          createdAt:  item.createdAt,
        },
        confidence: 0.5,
      }],
    })

    if (res.ok) return { ok: true, stored: true, id: res.id }
    return { ok: true, stored: false, reason: res.reason ?? 'unknown' }
  } catch (e) {
    console.error('[universal-intake] storeIntake threw:', e)
    return { ok: true, stored: false, reason: 'exception' }
  }
}

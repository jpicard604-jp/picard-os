// /api/xodus/intake — universal raw intake.
//
// XODUS's nervous system: accept ANY messy input from ANY source, store
// it raw, return success fast. AI/DeepSeek processing happens later out
// of band (see lib/xodus/deepseek.ts).
//
// Auth: optional. If XODUS_INTAKE_SECRET is set, require X-XODUS-INTAKE-SECRET
// header (or Authorization: Bearer <secret>). If not set, open mode for dev.
//
// Accepts:
//   - JSON: { source, message } | { source, text } | { source, raw } | { text } | { raw }
//   - text/plain body: the message itself
//
// Never crashes. Always returns JSON.

import { NextRequest, NextResponse } from 'next/server'
import { normalizeIntakePayload, storeIntake } from '@/lib/xodus/universal-intake'
import { isDeepSeekEnabled } from '@/lib/xodus/deepseek'

const ROUTE_VERSION = 'intake-v1'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const expected = process.env.XODUS_INTAKE_SECRET
  if (!expected) return true   // open mode when no secret is configured (dev)

  const headerSecret = req.headers.get('x-xodus-intake-secret')
  const auth         = req.headers.get('authorization') ?? ''
  const bearer       = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''

  return headerSecret === expected || bearer === expected
}

// ─── GET — health ─────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    ok:        true,
    route:     'xodus intake alive',
    version:   ROUTE_VERSION,
    aiEnabled: isDeepSeekEnabled(),
  })
}

// ─── POST — ingest ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log(`[xodus/intake/${ROUTE_VERSION}] POST entered`)

  try {
    // 1. Auth
    if (!authorized(req)) {
      return NextResponse.json(
        { ok: false, stored: false, reason: 'unauthorized', version: ROUTE_VERSION },
        { status: 401 },
      )
    }
    if (!process.env.XODUS_INTAKE_SECRET) {
      console.log(`[xodus/intake/${ROUTE_VERSION}] open mode — no secret configured`)
    }

    // 2. Parse body — accept JSON or plain text
    const contentType = req.headers.get('content-type')
    let body: unknown
    try {
      if (contentType && contentType.includes('application/json')) {
        body = await req.json()
      } else {
        body = await req.text()
      }
    } catch {
      // Fall back to text on any JSON parse failure
      try { body = await req.text() } catch { body = '' }
    }

    // 3. Normalize
    const normalized = normalizeIntakePayload(body, contentType)
    if (!normalized) {
      return NextResponse.json(
        { ok: false, stored: false, reason: 'no_message', version: ROUTE_VERSION,
          note: 'Provide message/text/raw field or plain-text body.' },
        { status: 400 },
      )
    }

    console.log(`[xodus/intake/${ROUTE_VERSION}] normalized source:"${normalized.source}" len:${normalized.message.length} tags:${normalized.tags.join(',') || 'none'}`)

    // 4. Store (non-blocking failure path — always returns)
    const store = await storeIntake(normalized)

    if (store.stored) {
      console.log(`[xodus/intake/${ROUTE_VERSION}] stored id:${store.id}`)
    } else {
      console.log(`[xodus/intake/${ROUTE_VERSION}] not stored — reason:${store.reason}`)
    }

    // 5. Reply fast — AI processing is deferred
    return NextResponse.json({
      ok:             true,
      stored:         store.stored,
      reason:         store.stored ? undefined : store.reason,
      id:             store.id,
      source:         normalized.source,
      tags:           normalized.tags,
      messagePreview: normalized.message.slice(0, 120),
      processed:      false,
      version:        ROUTE_VERSION,
    })

  } catch (e) {
    console.error(`[xodus/intake/${ROUTE_VERSION}] unhandled:`, e)
    return NextResponse.json(
      { ok: false, stored: false, reason: 'internal_error', version: ROUTE_VERSION },
      { status: 500 },
    )
  }
}

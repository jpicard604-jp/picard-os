// Telegram → XODUS webhook.
//
// POST: Telegram delivers an Update payload here. We verify allow-list + optional
//       secret, parse the message, run it through the central XODUS router, save
//       the result to the xodus_inbox table, and reply to Telegram.
//
// GET:  Light status endpoint used by Settings page (no secrets exposed).
//
// IMPORTANT: never echoes the bot token or secret in any response.

import { NextRequest, NextResponse } from 'next/server'
import {
  extractTelegramMessage,
  sendTelegramMessage,
  verifyAllowedChat,
  verifyWebhookSecret,
  type TelegramMedia,
} from '@/lib/telegram/client'
import { routeXodusInput } from '@/lib/xodus/brain-router'
import { saveXodusInboxItem, getInboxStatus } from '@/lib/xodus/inbox-server'
import type { XodusChatContext } from '@/lib/xodus/chat-types'
import type { XodusInputMedia } from '@/lib/xodus/action-types'

// ─── Minimal context for server-only channels ────────────────────────────────
//
// Telegram has no access to localStorage, so we build a conservative context
// from the confirmed nutrition profile and an empty daily log. The agent
// router still routes correctly — it just can't reference today's vitals.

function buildServerContext(todayDate: string): XodusChatContext {
  return {
    todayDate,
    dailyLog: null,
    nutritionProfile: {
      phase:         'cutting',
      proteinTarget: 210,
      calorieTarget: 2200,
      carbTarget:    210,
      fatTarget:     58,
    },
    todayGoals:        [],
    recentActivities: [],
    recentNotes:      [],
    weekActivityCount: 0,
    missingDataSignals: ['steps_apple_health_planned', 'server_side_no_localstorage'],
  }
}

// ─── Reply formatter ──────────────────────────────────────────────────────────

function summarizeReply(
  baseReply: string,
  appliedCount: number,
  reviewCount: number,
  inbox: { ok: boolean; reason?: string },
): string {
  const lines = [baseReply.trim()]

  if (appliedCount > 0 || reviewCount > 0) {
    const bits: string[] = []
    if (reviewCount > 0) bits.push(`${reviewCount} pending review`)
    if (appliedCount > 0) bits.push(`${appliedCount} actions queued`)
    lines.push(bits.join(' · '))
  }

  if (!inbox.ok) {
    if (inbox.reason === 'table_missing') {
      lines.push('Note: XODUS inbox table not set up yet — message received but not persisted.')
    } else if (inbox.reason === 'no_supabase') {
      lines.push('Note: Supabase not configured server-side — message not persisted.')
    } else if (inbox.reason === 'insert_failed') {
      lines.push('Note: inbox write failed — see server logs.')
    }
  } else {
    lines.push('Open /xodus to review and apply.')
  }

  return lines.join('\n')
}

// ─── GET — light status for Settings page ────────────────────────────────────

export async function GET() {
  const hasToken    = !!process.env.TELEGRAM_BOT_TOKEN
  const hasAllowed  = !!process.env.TELEGRAM_ALLOWED_CHAT_ID
  const hasSecret   = !!process.env.TELEGRAM_WEBHOOK_SECRET
  const inbox       = await getInboxStatus()

  return NextResponse.json({
    configured: hasToken,
    restricted: hasAllowed,
    secretSet:  hasSecret,
    inbox: {
      ready:  inbox.tableReady,
      reason: inbox.reason ?? null,
    },
  })
}

// ─── POST — Telegram webhook ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Optional webhook secret check
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
  if (!verifyWebhookSecret(secretHeader)) {
    return NextResponse.json({ ok: false, reason: 'invalid_secret' }, { status: 401 })
  }

  // 2. Bot token must exist server-side for replies
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      ok: false,
      reason: 'no_token',
      note: 'Set TELEGRAM_BOT_TOKEN in env. See docs/telegram-xodus-intake.md.',
    })
  }

  // 3. Parse incoming update
  let update: unknown
  try {
    update = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const msg = extractTelegramMessage(update)
  if (!msg) {
    // Non-message updates (callbacks, etc.) — ack so Telegram stops retrying.
    return NextResponse.json({ ok: true, skipped: 'no_message' })
  }

  // 4. Allow-list check
  const allow = verifyAllowedChat(msg.chatId)
  if (!allow.ok) {
    await sendTelegramMessage(msg.chatId, 'Unauthorized chat.')
    return NextResponse.json({ ok: false, reason: allow.reason })
  }

  // 5. Empty text + no media → ack & exit
  if (!msg.text && msg.media.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'empty' })
  }

  // 6. Build agent media payload (metadata only — no fetch/OCR yet)
  const agentMedia: XodusInputMedia[] = msg.media.map((m: TelegramMedia) => ({
    kind:     m.kind === 'photo' || m.kind === 'video' ? 'image' : (m.kind === 'voice' || m.kind === 'audio' ? 'audio' : 'document'),
    fileName: m.fileName,
    mimeType: m.mimeType,
    caption:  m.caption ?? msg.caption,
  }))

  // 7. Run through the central XODUS router
  const todayDate = new Date().toISOString().slice(0, 10)
  const ctx       = buildServerContext(todayDate)
  const text      = msg.text || msg.caption || (msg.media.length > 0 ? '[media attachment]' : '')

  let agent
  try {
    agent = await routeXodusInput({
      text,
      source:  'telegram',
      context: ctx,
      media:   agentMedia.length > 0 ? agentMedia : undefined,
    })
  } catch (err) {
    console.error('[telegram] routeXodusInput threw', err)
    await sendTelegramMessage(msg.chatId, 'XODUS hit an error processing that. Try again or check logs.')
    return NextResponse.json({ ok: false, reason: 'router_error' })
  }

  // 8. Persist to xodus_inbox (server-side — Telegram can't write localStorage)
  const inbox = await saveXodusInboxItem({
    source:        'telegram',
    chatId:        msg.chatId,
    userIdText:    msg.userId,
    username:      msg.username,
    text,
    media:         msg.media,
    parsedSummary: agent.reply,
    brainResult:   agent,
    actions:       agent.actions,
  })

  // 9. Reply to Telegram with XODUS voice
  const reply = summarizeReply(
    agent.reply,
    agent.autoApplyActions.length,
    agent.needsReviewActions.length,
    inbox,
  )
  await sendTelegramMessage(msg.chatId, reply)

  return NextResponse.json({
    ok: true,
    intent: agent.intent,
    auto:   agent.autoApplyActions.length,
    review: agent.needsReviewActions.length,
    inbox:  inbox.ok ? 'saved' : (inbox.reason ?? 'failed'),
  })
}

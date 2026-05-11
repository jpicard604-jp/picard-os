import { NextRequest, NextResponse } from 'next/server'
import {
  extractTelegramMessage,
  sendTelegramMessage,
  verifyAllowedChat,
  verifyWebhookSecret,
  type TelegramMedia,
} from '@/lib/telegram/client'
import { routeXodusInput } from '@/lib/xodus/brain-router'
import { saveXodusInboxItem } from '@/lib/xodus/inbox-server'
import type { XodusChatContext } from '@/lib/xodus/chat-types'
import type { XodusInputMedia } from '@/lib/xodus/action-types'

// Conservative server-side context — no localStorage access here.
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
    todayGoals:         [],
    recentActivities:  [],
    recentNotes:       [],
    weekActivityCount: 0,
    missingDataSignals: ['server_side_no_localstorage'],
  }
}

function buildReply(
  baseReply:   string,
  autoCount:   number,
  reviewCount: number,
  inboxOk:     boolean,
): string {
  const lines = [baseReply.trim()]
  if (autoCount > 0 || reviewCount > 0) {
    const bits: string[] = []
    if (reviewCount > 0) bits.push(`${reviewCount} pending review`)
    if (autoCount   > 0) bits.push(`${autoCount} actions queued`)
    lines.push(bits.join(' · '))
  }
  lines.push(
    inboxOk
      ? 'Open /xodus to review and apply.'
      : 'Note: inbox not configured — message received but not persisted.',
  )
  return lines.join('\n')
}

// ─── GET — health / status ────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, route: 'telegram webhook alive' })
}

// ─── POST — Telegram webhook ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Optional webhook secret
  if (!verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false, reason: 'invalid_secret' }, { status: 401 })
  }

  // 2. Bot token must exist to reply
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: false, reason: 'no_token' })
  }

  // 3. Parse update
  let update: unknown
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = extractTelegramMessage(update)
  if (!msg) return NextResponse.json({ ok: true, skipped: 'no_message' })

  // 4. Allow-list
  const allow = verifyAllowedChat(msg.chatId)
  if (!allow.ok) {
    await sendTelegramMessage(msg.chatId, 'Unauthorized chat.')
    return NextResponse.json({ ok: false, reason: allow.reason })
  }

  if (!msg.text && msg.media.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'empty' })
  }

  console.log(`[telegram] chat:${msg.chatId} user:${msg.username ?? 'unknown'} text:${(msg.text ?? '').slice(0, 80)}`)

  // 5. Build agent inputs
  const agentMedia: XodusInputMedia[] = msg.media.map((m: TelegramMedia) => ({
    kind:     m.kind === 'photo' || m.kind === 'video' ? 'image'
            : m.kind === 'voice' || m.kind === 'audio' ? 'audio'
            : 'document',
    fileName: m.fileName,
    mimeType: m.mimeType,
    caption:  m.caption ?? msg.caption,
  }))

  const todayDate = new Date().toISOString().slice(0, 10)
  const ctx       = buildServerContext(todayDate)
  const text      = msg.text || msg.caption || (msg.media.length > 0 ? '[media attachment]' : '')

  // 6. Route through XODUS agent
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
    await sendTelegramMessage(msg.chatId, 'XODUS hit an error processing that. Try again.')
    return NextResponse.json({ ok: false, reason: 'router_error' })
  }

  // 7. Persist to xodus_inbox
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

  // 8. Reply with XODUS voice + status line
  const reply = buildReply(
    agent.reply,
    agent.autoApplyActions.length,
    agent.needsReviewActions.length,
    inbox.ok,
  )
  await sendTelegramMessage(msg.chatId, reply)

  return NextResponse.json({
    ok:     true,
    intent: agent.intent,
    auto:   agent.autoApplyActions.length,
    review: agent.needsReviewActions.length,
    inbox:  inbox.ok ? 'saved' : (inbox.reason ?? 'failed'),
  })
}

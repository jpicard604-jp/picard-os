// Telegram webhook — Telegram is a first-class mobile chat surface for XODUS.
//
// Pipeline:
//   Telegram update → extract message
//                  → /start, /help handled inline
//                  → generateXodusResponse() (shared with web /api/xodus/chat)
//                  → reply via Telegram Bot API
//                  → persist to xodus_inbox for /xodus review
//
// This route never reads browser localStorage. The shared helper builds a
// conservative server-side fallback context until Supabase mirroring lands.

import { NextRequest, NextResponse } from 'next/server'
import {
  extractTelegramMessage,
  sendTelegramMessage,
  verifyAllowedChat,
  verifyWebhookSecret,
  type TelegramMedia,
} from '@/lib/telegram/client'
import { generateXodusResponse } from '@/lib/xodus/server-chat'
import { saveXodusInboxItem } from '@/lib/xodus/inbox-server'
import type { XodusInputMedia } from '@/lib/xodus/action-types'

const START_REPLY = [
  'XODUS is online.',
  '',
  'Text me like your AI operator: goals, reminders, project updates, daily plans, random thoughts.',
  'Type /help for examples.',
].join('\n')

const HELP_REPLY = [
  'Try things like:',
  '• "What should I focus on today?"',
  '• "Add this as a goal: cut to 180 by end of cycle."',
  '• "Remind me tomorrow to order Porsche rotor screws."',
  '• "Energy 8, mental 82."',
  '• "Benched 295 for 4 sets of 5."',
  '',
  'Voice + screenshots are on the roadmap — text works today.',
].join('\n')

const NON_TEXT_REPLY =
  'I can read text right now. Voice notes and screenshots are next on the list.'

// ─── GET — health / status ────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'xodus-telegram-webhook',
    configured: {
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      ai:       !!(process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    },
  })
}

// ─── POST — Telegram webhook ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Optional webhook secret. Returns true when no secret configured (dev mode).
  if (!verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false, reason: 'invalid_secret' }, { status: 401 })
  }

  // 2. Telegram token is required to reply, but we still ack the update so
  //    Telegram doesn't retry forever in a broken state.
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN missing — webhook acking without replying.')
    return NextResponse.json({ ok: true, configured: false, reason: 'no_token' })
  }

  // 3. Parse update.
  let update: unknown
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = extractTelegramMessage(update)
  if (!msg) return NextResponse.json({ ok: true, skipped: 'no_message' })

  // 4. Allow-list.
  const allow = verifyAllowedChat(msg.chatId)
  if (!allow.ok) {
    await sendTelegramMessage(msg.chatId, 'Unauthorized chat.')
    return NextResponse.json({ ok: false, reason: allow.reason })
  }

  const text = (msg.text ?? '').trim()
  const hasMedia = msg.media.length > 0

  // 5. Slash commands handled inline.
  if (text === '/start' || text.startsWith('/start ')) {
    await sendTelegramMessage(msg.chatId, START_REPLY)
    return NextResponse.json({ ok: true, handled: 'start' })
  }
  if (text === '/help' || text.startsWith('/help ')) {
    await sendTelegramMessage(msg.chatId, HELP_REPLY)
    return NextResponse.json({ ok: true, handled: 'help' })
  }

  // 6. Empty update — nothing to do.
  if (!text && !hasMedia) {
    return NextResponse.json({ ok: true, skipped: 'empty' })
  }

  // 7. Non-text-only messages get a polite "text only" reply for now. We still
  //    save the media to xodus_inbox below so it isn't lost.
  const isTextOnly = !!text
  if (!isTextOnly) {
    await sendTelegramMessage(msg.chatId, NON_TEXT_REPLY)
  }

  // 8. Build agent media inputs (kept for future intake; text path uses them too
  //    if a caption is present).
  const agentMedia: XodusInputMedia[] = msg.media.map((m: TelegramMedia) => ({
    kind:     m.kind === 'photo' || m.kind === 'video' ? 'image'
            : m.kind === 'voice' || m.kind === 'audio' ? 'audio'
            : 'document',
    fileName: m.fileName,
    mimeType: m.mimeType,
    caption:  m.caption ?? msg.caption,
  }))

  // Use whatever text we have; fall back to caption / media placeholder so
  // the AI still has *something* to respond to when media is present.
  const inputText = text || msg.caption || (hasMedia ? '[non-text attachment]' : '')

  // Log only what's safe — never log secrets, never log full message bodies.
  console.log(`[telegram] chat:${msg.chatId} user:${msg.username ?? 'unknown'} len:${inputText.length} media:${msg.media.length}`)

  // 9. Route through the shared XODUS chat function.
  let response
  try {
    response = await generateXodusResponse({
      message:        inputText,
      source:         'telegram',
      media:          agentMedia.length > 0 ? agentMedia : undefined,
      telegramChatId: msg.chatId,
      userId:         msg.userId,
    })
  } catch (err) {
    console.error('[telegram] generateXodusResponse threw', err)
    await sendTelegramMessage(msg.chatId, 'XODUS hit an error processing that. Try again.')
    return NextResponse.json({ ok: false, reason: 'router_error' })
  }

  // 10. Persist to xodus_inbox (optional — degrades gracefully if not configured).
  const inbox = await saveXodusInboxItem({
    source:        'telegram',
    chatId:        msg.chatId,
    userIdText:    msg.userId,
    username:      msg.username,
    text:          inputText,
    media:         msg.media,
    parsedSummary: response.reply,
    brainResult:   response.agent,
    actions:       response.agent.actions,
  })

  // 11. Send the reply. Append a short pending-review tail ONLY if there are
  //     actually actions waiting for review — otherwise this feels like a chat.
  if (isTextOnly) {
    const reviewCount = response.debug.reviewActions
    let outbound = response.reply.trim()
    if (reviewCount > 0) {
      outbound += `\n\n${reviewCount} pending review — open /xodus to confirm.`
    }
    await sendTelegramMessage(msg.chatId, outbound)
  }

  return NextResponse.json({
    ok:     true,
    intent: response.intent,
    auto:   response.debug.autoActions,
    review: response.debug.reviewActions,
    inbox:  inbox.ok ? 'saved' : (inbox.reason ?? 'failed'),
  })
}

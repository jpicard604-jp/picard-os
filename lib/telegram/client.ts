// Telegram Bot helpers — SERVER ONLY.
// TELEGRAM_BOT_TOKEN must never reach the browser. Do not import this file from
// any 'use client' component or shared client module.

export interface TelegramFile {
  fileId:   string
  fileName?: string
  mimeType?: string
  size?:    number
}

export interface TelegramMedia {
  kind:      'photo' | 'document' | 'audio' | 'voice' | 'video'
  fileName?: string
  mimeType?: string
  caption?:  string
  file?:     TelegramFile
}

export interface ParsedTelegramMessage {
  chatId:    string
  userId:    string
  username?: string
  firstName?: string
  text:      string
  caption?:  string
  media:     TelegramMedia[]
  timestamp: string
  updateId?: number
}

// ─── Allow-list ──────────────────────────────────────────────────────────────

export function verifyAllowedChat(chatId: string): { ok: true } | { ok: false; reason: string } {
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (!allowed) {
    // Open mode for initial setup — caller may still log a warning.
    return { ok: true }
  }
  // Support a comma-separated list of allowed chat IDs.
  const list = allowed.split(',').map(s => s.trim()).filter(Boolean)
  if (list.includes(chatId)) return { ok: true }
  return { ok: false, reason: 'unauthorized_chat' }
}

// ─── Telegram Update parser ──────────────────────────────────────────────────

// Minimal typing — Telegram update is a large surface area; we only read what we use.
interface TgUpdate {
  update_id?: number
  message?: {
    message_id?: number
    date?:       number
    chat?:       { id?: number | string; username?: string }
    from?:       { id?: number | string; username?: string; first_name?: string }
    text?:       string
    caption?:    string
    photo?:      Array<{ file_id?: string; file_size?: number; width?: number; height?: number }>
    document?:   { file_id?: string; file_name?: string; mime_type?: string; file_size?: number }
    voice?:      { file_id?: string; mime_type?: string; duration?: number; file_size?: number }
    audio?:      { file_id?: string; file_name?: string; mime_type?: string; file_size?: number }
    video?:      { file_id?: string; mime_type?: string; file_size?: number }
  }
  edited_message?: TgUpdate['message']
  channel_post?:   TgUpdate['message']
}

export function extractTelegramMessage(update: unknown): ParsedTelegramMessage | null {
  if (typeof update !== 'object' || update === null) return null
  const u = update as TgUpdate
  const msg = u.message ?? u.edited_message ?? u.channel_post
  if (!msg) return null
  const chatId = msg.chat?.id != null ? String(msg.chat.id) : ''
  const userId = msg.from?.id != null ? String(msg.from.id) : chatId
  if (!chatId) return null

  const media: TelegramMedia[] = []

  // Photos: Telegram sends multiple sizes; take the largest (last).
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    const largest = msg.photo[msg.photo.length - 1]
    if (largest.file_id) {
      media.push({
        kind: 'photo',
        caption: msg.caption,
        file: { fileId: largest.file_id, size: largest.file_size },
      })
    }
  }
  if (msg.document?.file_id) {
    media.push({
      kind: 'document',
      fileName: msg.document.file_name,
      mimeType: msg.document.mime_type,
      caption: msg.caption,
      file: { fileId: msg.document.file_id, fileName: msg.document.file_name, mimeType: msg.document.mime_type, size: msg.document.file_size },
    })
  }
  if (msg.voice?.file_id) {
    media.push({
      kind: 'voice',
      mimeType: msg.voice.mime_type,
      file: { fileId: msg.voice.file_id, mimeType: msg.voice.mime_type, size: msg.voice.file_size },
    })
  }
  if (msg.audio?.file_id) {
    media.push({
      kind: 'audio',
      fileName: msg.audio.file_name,
      mimeType: msg.audio.mime_type,
      file: { fileId: msg.audio.file_id, fileName: msg.audio.file_name, mimeType: msg.audio.mime_type, size: msg.audio.file_size },
    })
  }
  if (msg.video?.file_id) {
    media.push({
      kind: 'video',
      mimeType: msg.video.mime_type,
      caption: msg.caption,
      file: { fileId: msg.video.file_id, mimeType: msg.video.mime_type, size: msg.video.file_size },
    })
  }

  return {
    chatId,
    userId,
    username:  msg.from?.username,
    firstName: msg.from?.first_name,
    text:      typeof msg.text === 'string' ? msg.text : '',
    caption:   typeof msg.caption === 'string' ? msg.caption : undefined,
    media,
    timestamp: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
    updateId:  u.update_id,
  }
}

// ─── Sender ──────────────────────────────────────────────────────────────────

export async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, reason: 'no_token' }
  // Trim to Telegram's 4096 character cap with a safety margin.
  const safeText = text.length > 4000 ? text.slice(0, 4000) + '…' : text

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id: chatId,
        text:    safeText,
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[telegram] sendMessage failed', res.status, body.slice(0, 200))
      return { ok: false, reason: `http_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[telegram] sendMessage threw', err)
    return { ok: false, reason: 'network' }
  }
}

// ─── Webhook secret verification ─────────────────────────────────────────────
//
// When you call setWebhook with a `secret_token`, Telegram sends it on each
// update as the X-Telegram-Bot-Api-Secret-Token header. Verify before doing work.

export function verifyWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  return !!headerValue && headerValue === expected
}

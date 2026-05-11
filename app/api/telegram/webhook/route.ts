import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, route: 'telegram webhook alive' })
}

export async function POST(request: NextRequest) {
  // Validate optional webhook secret
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (envSecret) {
    const secret = request.headers.get('x-telegram-bot-api-secret-token')
    if (secret !== envSecret) {
      return NextResponse.json({ ok: false, reason: 'invalid_secret' }, { status: 401 })
    }
  }

  let update: Record<string, unknown>
  try {
    update = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined
  const chatId  = (message?.chat as Record<string, unknown> | undefined)?.id as number | undefined
  const text     = (message?.text as string | undefined)
  const username = ((message?.from as Record<string, unknown> | undefined)?.username as string | undefined)

  console.log(`[telegram] chat:${chatId ?? 'unknown'} user:${username ?? 'unknown'} text:${(text ?? '').slice(0, 80)}`)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (token && chatId && text) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text: `XODUS received: ${text}` }),
      })
    } catch (err) {
      console.error('[telegram] sendMessage failed', err)
    }
  }

  return NextResponse.json({ ok: true })
}

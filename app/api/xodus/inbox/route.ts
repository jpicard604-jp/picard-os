// GET /api/xodus/inbox
//
// Returns recent xodus_inbox rows (default: pending, latest 25).
// Used by the /xodus Inbox panel to surface Telegram/server-side agent results
// for client-side review and apply.
//
// Auth note: Phase 1 is single-user — the route uses the admin client and is
// not gated. Future: switch to a Supabase-Auth-gated route once Auth is wired
// across the app.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const DEFAULT_LIMIT = 25
const MAX_LIMIT     = 100
const VALID_STATUS = new Set(['pending', 'applied', 'ignored', 'failed', 'all'])

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ ok: false, reason: 'no_supabase', items: [] })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const limitP = parseInt(req.nextUrl.searchParams.get('limit') ?? `${DEFAULT_LIMIT}`, 10)
  const limit  = Number.isFinite(limitP) ? Math.min(Math.max(limitP, 1), MAX_LIMIT) : DEFAULT_LIMIT

  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ ok: false, reason: 'invalid_status' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    let query = supabase
      .from('xodus_inbox')
      .select('id, source, chat_id, user_id_text, username, text, media, parsed_summary, brain_result, actions, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') query = query.eq('status', status)

    const { data, error } = await query

    if (error?.code === '42P01') {
      return NextResponse.json({ ok: false, reason: 'table_missing', items: [] })
    }
    if (error) {
      console.error('[xodus_inbox:GET] db_error', error.code, error.message)
      return NextResponse.json({ ok: false, reason: 'db_error', items: [] }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data ?? [] })
  } catch (err) {
    console.error('[xodus_inbox:GET] threw', err)
    return NextResponse.json({ ok: false, reason: 'unknown', items: [] }, { status: 500 })
  }
}

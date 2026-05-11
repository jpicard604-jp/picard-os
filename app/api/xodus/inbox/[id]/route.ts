// PATCH /api/xodus/inbox/:id
//
// Updates the status of a single xodus_inbox row to applied/ignored/failed.
// Called by the /xodus Inbox panel after the client-side applier runs.
//
// Body: { status: 'applied' | 'ignored' | 'failed', appliedSummary?: string }
//
// Auth: same single-user Phase 1 caveat as the GET route — admin client, ungated.
// Future TODO: gate on Supabase Auth uid.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const VALID_STATUS = new Set(['applied', 'ignored', 'failed', 'pending'])

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ ok: false, reason: 'missing_id' }, { status: 400 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ ok: false, reason: 'no_supabase' })
  }

  let body: { status?: unknown; appliedSummary?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status : ''
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ ok: false, reason: 'invalid_status' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (typeof body.appliedSummary === 'string' && body.appliedSummary.length > 0) {
    patch.parsed_summary = body.appliedSummary.slice(0, 1000)
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('xodus_inbox')
      .update(patch)
      .eq('id', id)
      .select('id, status, updated_at')
      .maybeSingle()

    if (error?.code === '42P01') {
      return NextResponse.json({ ok: false, reason: 'table_missing' })
    }
    if (error) {
      console.error('[xodus_inbox:PATCH] db_error', error.code, error.message)
      return NextResponse.json({ ok: false, reason: 'db_error' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, item: data })
  } catch (err) {
    console.error('[xodus_inbox:PATCH] threw', err)
    return NextResponse.json({ ok: false, reason: 'unknown' }, { status: 500 })
  }
}

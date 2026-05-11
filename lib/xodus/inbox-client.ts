// Client-safe helpers for the XODUS inbox.
//
// Fetches and mutates xodus_inbox rows through the existing API routes.
// All Supabase access stays server-side; the browser only hits /api/xodus/inbox*.

import type { XodusAction, XodusAgentResult, XodusInputSource } from './action-types'

export interface InboxItem {
  id:             string
  source:         XodusInputSource
  chat_id:        string | null
  user_id_text:   string | null
  username:       string | null
  text:           string | null
  media:          unknown
  parsed_summary: string | null
  brain_result:   XodusAgentResult | null
  actions:        XodusAction[]    | null
  status:         'pending' | 'applied' | 'ignored' | 'failed'
  created_at:     string
  updated_at:     string
}

export type InboxFetchStatus = 'ok' | 'table_missing' | 'no_supabase' | 'db_error' | 'network' | 'unknown'

export interface InboxFetchResult {
  status: InboxFetchStatus
  items:  InboxItem[]
  reason?: string
}

export async function fetchInboxItems(opts: { status?: string; limit?: number } = {}): Promise<InboxFetchResult> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.limit)  params.set('limit',  String(opts.limit))

  try {
    const res  = await fetch(`/api/xodus/inbox${params.toString() ? `?${params}` : ''}`, { cache: 'no-store' })
    const data = await res.json() as { ok: boolean; reason?: string; items?: InboxItem[] }

    if (data.ok) {
      return { status: 'ok', items: data.items ?? [] }
    }

    switch (data.reason) {
      case 'table_missing': return { status: 'table_missing', items: [], reason: data.reason }
      case 'no_supabase':   return { status: 'no_supabase',   items: [], reason: data.reason }
      case 'db_error':      return { status: 'db_error',      items: [], reason: data.reason }
      default:              return { status: 'unknown',       items: [], reason: data.reason }
    }
  } catch (err) {
    console.error('[inbox-client] fetch failed', err)
    return { status: 'network', items: [] }
  }
}

export async function patchInboxStatus(
  id: string,
  status: 'applied' | 'ignored' | 'failed' | 'pending',
  appliedSummary?: string,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(`/api/xodus/inbox/${encodeURIComponent(id)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status, appliedSummary }),
    })
    const data = await res.json() as { ok: boolean; reason?: string }
    return data
  } catch (err) {
    console.error('[inbox-client] patch failed', err)
    return { ok: false, reason: 'network' }
  }
}

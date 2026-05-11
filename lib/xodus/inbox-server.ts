// Server-side XODUS inbox helper.
//
// Telegram (and future server-side channels) cannot write the browser's
// localStorage, so agent results land here as pending items. The /xodus
// UI (future) will pick them up and apply via the client-side applier.
//
// Gracefully handles a missing xodus_inbox table — returns
//   { ok: false, reason: 'table_missing' }
// without crashing. SQL lives in docs/telegram-xodus-intake.md.

import { createAdminClient } from '../supabase/server'
import type {
  XodusAction,
  XodusAgentResult,
  XodusInputSource,
} from './action-types'
import type { TelegramMedia } from '../telegram/client'

export interface InboxInsert {
  source:      XodusInputSource
  chatId?:     string
  userIdText?: string
  username?:   string
  text?:       string
  media?:      TelegramMedia[] | unknown[]
  parsedSummary?: string
  brainResult?: XodusAgentResult
  actions?:    XodusAction[]
}

export interface InboxSaveResult {
  ok:      boolean
  reason?: 'table_missing' | 'no_supabase' | 'insert_failed' | 'unknown'
  id?:     string
}

export async function saveXodusInboxItem(item: InboxInsert): Promise<InboxSaveResult> {
  // Supabase env not configured → don't crash, just signal.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, reason: 'no_supabase' }
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return { ok: false, reason: 'no_supabase' }
  }

  const row = {
    source:          item.source,
    chat_id:         item.chatId       ?? null,
    user_id_text:    item.userIdText   ?? null,
    username:        item.username     ?? null,
    text:            item.text         ?? null,
    media:           item.media        ?? null,
    parsed_summary:  item.parsedSummary ?? null,
    brain_result:    item.brainResult  ?? null,
    actions:         item.actions      ?? null,
    status:          'pending',
  }

  try {
    const { data, error } = await supabase
      .from('xodus_inbox')
      .insert(row)
      .select('id')
      .maybeSingle()

    if (error?.code === '42P01') {
      return { ok: false, reason: 'table_missing' }
    }
    if (error) {
      console.error('[xodus_inbox] insert failed', error.code, error.message)
      return { ok: false, reason: 'insert_failed' }
    }

    const id = (data as { id?: string } | null)?.id
    return { ok: true, id }
  } catch (err) {
    console.error('[xodus_inbox] threw', err)
    return { ok: false, reason: 'unknown' }
  }
}

export async function getInboxStatus(): Promise<{ configured: boolean; tableReady: boolean; reason?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return { configured: false, tableReady: false, reason: 'no_supabase' }
  }
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('xodus_inbox').select('id').limit(1)
    if (error?.code === '42P01') return { configured: true, tableReady: false, reason: 'table_missing' }
    if (error) return { configured: true, tableReady: false, reason: 'db_error' }
    return { configured: true, tableReady: true }
  } catch {
    return { configured: false, tableReady: false, reason: 'no_supabase' }
  }
}

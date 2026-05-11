'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Inbox, Send, RefreshCw, Check, X, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { fetchInboxItems, patchInboxStatus, type InboxItem, type InboxFetchStatus } from '@/lib/xodus/inbox-client'
import { applyXodusActionsClient } from '@/lib/xodus/action-applier'
import type { XodusAction } from '@/lib/xodus/action-types'

// ── Source meta ──────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; dot: string; tint: string }> = {
  telegram:   { label: 'Telegram',  dot: 'bg-sky-400',     tint: 'text-sky-300 border-sky-500/25 bg-sky-500/[0.06]' },
  web_chat:   { label: 'Web Chat',  dot: 'bg-cyan-400',    tint: 'text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.06]' },
  voice:      { label: 'Voice',     dot: 'bg-violet-400',  tint: 'text-violet-300 border-violet-500/25 bg-violet-500/[0.06]' },
  shortcut:   { label: 'Shortcut',  dot: 'bg-pink-400',    tint: 'text-pink-300 border-pink-500/25 bg-pink-500/[0.06]' },
  upload:     { label: 'Upload',    dot: 'bg-amber-400',   tint: 'text-amber-300 border-amber-500/25 bg-amber-500/[0.06]' },
  screenshot: { label: 'Image',     dot: 'bg-rose-400',    tint: 'text-rose-300 border-rose-500/25 bg-rose-500/[0.06]' },
  manual:     { label: 'Manual',    dot: 'bg-zinc-400',    tint: 'text-zinc-300 border-zinc-500/25 bg-zinc-500/[0.06]' },
}

// ── Action chip ──────────────────────────────────────────────────────────────

function actionLabel(a: XodusAction): string {
  switch (a.type) {
    case 'create_note':              return `📝 ${a.body.length > 36 ? a.body.slice(0, 36) + '…' : a.body}`
    case 'update_note':              return `✏️ ${a.noteQuery.slice(0, 32)}`
    case 'create_goal':              return `🎯 ${a.title}`
    case 'complete_goal':            return `✓ ${a.goalQuery}`
    case 'update_goal':              return `✏️ ${a.goalQuery}`
    case 'create_grocery':           return `🛒 ${a.items.slice(0, 3).join(', ')}${a.items.length > 3 ? '…' : ''}`
    case 'update_nutrition_profile': return `🎯 Nutrition update`
    case 'log_food': {
      const bits: string[] = []
      if (a.calories) bits.push(`${a.calories} cal`)
      if (a.protein)  bits.push(`${a.protein}g p`)
      return `🍽 ${bits.join(' · ') || 'food'}`
    }
    case 'log_manual_health': {
      const bits: string[] = []
      if (a.steps)          bits.push(`${a.steps} steps`)
      if (a.distanceMiles)  bits.push(`${a.distanceMiles} mi`)
      if (a.activeEnergyKcal) bits.push(`${a.activeEnergyKcal} kcal`)
      if (a.sleepHours)     bits.push(`${a.sleepHours}h sleep`)
      if (a.weightLb)       bits.push(`${a.weightLb} lb`)
      return `📊 ${bits.join(' · ') || 'health'}`
    }
    case 'create_workout_log':
      return `💪 ${a.exercises?.length ?? 0} exercises${a.title ? ` · ${a.title}` : ''}`
    case 'create_project_update':    return `📦 ${a.projectName ?? 'project'}: ${a.update.slice(0, 32)}`
    case 'create_memory_candidate':  return `🧠 ${a.title}`
    case 'training_recommendation':  return `💡 ${a.intensity ?? ''} training`
    case 'add_open_loop':            return `🔁 ${a.title}`
    case 'save_pending_review':      return `⏳ Review: ${a.reason.slice(0, 32)}`
    case 'no_op':                    return `· no-op`
  }
}

function ActionChip({ a }: { a: XodusAction }) {
  return (
    <span className="inline-block text-[10px] font-mono px-2 py-1 rounded-md border text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.06]">
      {actionLabel(a)}
    </span>
  )
}

// ── Time formatter ───────────────────────────────────────────────────────────

function fmtRel(iso: string): string {
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Inbox row ────────────────────────────────────────────────────────────────

function InboxRow({
  item, onApply, onIgnore, applying,
}: {
  item:     InboxItem
  onApply:  (item: InboxItem) => void
  onIgnore: (item: InboxItem) => void
  applying: boolean
}) {
  const [showRaw, setShowRaw] = useState(false)
  const source = SOURCE_META[item.source] ?? SOURCE_META.manual
  const actions = item.actions ?? item.brain_result?.actions ?? []
  const hasMedia = Array.isArray(item.media) && item.media.length > 0

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[--surface-raised] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${source.dot}`} />
          <span className={`text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${source.tint}`}>
            {source.label}
          </span>
          {item.username && (
            <span className="text-[10px] font-mono text-zinc-600 truncate">@{item.username}</span>
          )}
          {hasMedia && (
            <span className="text-[9px] font-mono text-amber-400/80 uppercase tracking-wider">media</span>
          )}
        </div>
        <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0">{fmtRel(item.created_at)}</span>
      </div>

      {/* Body */}
      <div className="px-3.5 py-3 space-y-2">
        {item.text && (
          <p className="text-[12px] text-zinc-200 leading-relaxed break-words">{item.text}</p>
        )}
        {item.parsed_summary && (
          <p className="text-[11px] text-cyan-300/80 leading-relaxed border-l-2 border-cyan-500/30 pl-2">
            {item.parsed_summary}
          </p>
        )}

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {actions.map((a, i) => <ActionChip key={i} a={a} />)}
          </div>
        )}

        {showRaw && (
          <pre className="text-[9px] font-mono text-zinc-500 bg-[#0a0a0f] border border-white/[0.04] rounded-lg p-2 overflow-x-auto max-h-48">
            {JSON.stringify({ actions, brain_result: item.brain_result, media: item.media }, null, 2)}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-white/[0.04] bg-white/[0.015]">
        <button
          onClick={() => setShowRaw(s => !s)}
          className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          {showRaw ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {showRaw ? 'Hide raw' : 'Raw'}
        </button>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onIgnore(item)}
            disabled={applying}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] disabled:opacity-30 transition-all"
          >
            <X size={11} /> Ignore
          </button>
          <button
            onClick={() => onApply(item)}
            disabled={applying || actions.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-500/25 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12] disabled:opacity-30 transition-all"
          >
            {applying ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            Apply{actions.length > 0 ? ` (${actions.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export interface InboxPanelProps {
  onCountChange?: (pendingCount: number) => void
}

export default function InboxPanel({ onCountChange }: InboxPanelProps) {
  const [items, setItems]       = useState<InboxItem[]>([])
  const [status, setStatus]     = useState<InboxFetchStatus>('ok')
  const [loading, setLoading]   = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [toast, setToast]       = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await fetchInboxItems({ status: 'pending', limit: 25 })
    setItems(res.items)
    setStatus(res.status)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    // Poll every 30s so new Telegram messages show up without a hard refresh.
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    onCountChange?.(status === 'ok' ? items.length : 0)
  }, [items, status, onCountChange])

  function flashToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleApply = useCallback(async (item: InboxItem) => {
    const actions = item.actions ?? item.brain_result?.actions ?? []
    if (actions.length === 0) {
      flashToast('No actions to apply on this item.')
      return
    }

    setApplyingId(item.id)
    try {
      const result = await applyXodusActionsClient(actions)
      const summary =
        result.failed > 0
          ? `${result.applied} applied · ${result.pending} pending · ${result.failed} failed`
          : result.pending > 0
            ? `${result.applied} applied · ${result.pending} pending`
            : `Applied ${result.applied} action${result.applied === 1 ? '' : 's'}`

      const newStatus: 'applied' | 'failed' =
        result.applied > 0 ? 'applied' : (result.failed > 0 ? 'failed' : 'applied')

      const patchRes = await patchInboxStatus(item.id, newStatus, summary)
      if (patchRes.ok) {
        setItems(prev => prev.filter(i => i.id !== item.id))
        flashToast(summary)
      } else {
        flashToast(`Applied locally, but inbox update failed: ${patchRes.reason ?? 'unknown'}`)
      }
    } catch (err) {
      console.error('[InboxPanel] apply failed', err)
      flashToast('Apply failed — check console')
    } finally {
      setApplyingId(null)
    }
  }, [])

  const handleIgnore = useCallback(async (item: InboxItem) => {
    setApplyingId(item.id)
    const res = await patchInboxStatus(item.id, 'ignored')
    if (res.ok) {
      setItems(prev => prev.filter(i => i.id !== item.id))
      flashToast('Ignored.')
    } else {
      flashToast(`Ignore failed: ${res.reason ?? 'unknown'}`)
    }
    setApplyingId(null)
  }, [])

  // ── Renders ────────────────────────────────────────────────────────────────

  const headerCount = useMemo(() => items.length, [items])

  return (
    <div className="rounded-2xl bg-[--surface] border border-white/[0.07] overflow-hidden card-elevated">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Inbox size={12} className="text-cyan-400/80" strokeWidth={2.5} />
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-400/80">
            XODUS Inbox
          </span>
          {status === 'ok' && headerCount > 0 && (
            <span className="text-[9px] font-mono text-amber-400/80 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/[0.08]">
              {headerCount} pending
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
        {loading && items.length === 0 && (
          <p className="text-[11px] font-mono text-zinc-600 text-center py-8">Loading…</p>
        )}

        {!loading && status === 'table_missing' && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-3.5 py-3 space-y-1.5">
            <p className="text-[12px] text-amber-300 font-medium">xodus_inbox table is not set up yet.</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Run the SQL from{' '}
              <a
                href="https://github.com/jpicard604-jp/picard-os/blob/main/docs/telegram-xodus-intake.md#5-supabase--xodus_inbox-table"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 underline hover:text-amber-200"
              >
                docs/telegram-xodus-intake.md § 5
              </a>{' '}
              in Supabase to enable inbox persistence.
            </p>
          </div>
        )}

        {!loading && status === 'no_supabase' && (
          <p className="text-[11px] text-zinc-500 px-2 py-6 text-center leading-relaxed">
            Supabase server env vars not configured.<br />Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
          </p>
        )}

        {!loading && (status === 'db_error' || status === 'network' || status === 'unknown') && (
          <p className="text-[11px] text-red-400/80 px-2 py-6 text-center">
            Inbox unreachable ({status}). Check server logs.
          </p>
        )}

        {!loading && status === 'ok' && items.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Send size={16} className="text-zinc-700 mx-auto" />
            <p className="text-[11px] font-mono text-zinc-600 leading-relaxed px-4">
              No pending XODUS inbox items.<br />
              Text the Telegram bot or use XODUS chat to create actions.
            </p>
          </div>
        )}

        {items.map(item => (
          <InboxRow
            key={item.id}
            item={item}
            onApply={handleApply}
            onIgnore={handleIgnore}
            applying={applyingId === item.id}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="border-t border-white/[0.05] px-4 py-2.5 bg-cyan-500/[0.06]">
          <p className="text-[11px] font-mono text-cyan-300">{toast}</p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Inbox, Check, X, ChevronDown, ChevronUp, Loader2, Send, Zap } from 'lucide-react'
import { fetchInboxItems, patchInboxStatus, type InboxItem, type InboxFetchStatus } from '@/lib/xodus/inbox-client'
import { applyXodusActionsClient } from '@/lib/xodus/action-applier'
import type { XodusAction } from '@/lib/xodus/action-types'

// ── Constants ─────────────────────────────────────────────────────────────────

type StatusFilter = 'pending' | 'all' | 'applied'
type SourceFilter = 'all' | 'telegram' | 'voice' | 'upload' | 'web_chat' | 'manual'

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'pending',  label: 'Pending' },
  { id: 'all',      label: 'All'     },
  { id: 'applied',  label: 'Applied' },
]

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: 'all',      label: 'All'      },
  { id: 'telegram', label: 'Telegram' },
  { id: 'voice',    label: 'Voice'    },
  { id: 'web_chat', label: 'Web'      },
  { id: 'upload',   label: 'Upload'   },
  { id: 'manual',   label: 'Manual'   },
]

const SOURCE_META: Record<string, { label: string; dot: string; pill: string }> = {
  telegram:   { label: 'Telegram',  dot: 'bg-sky-400',     pill: 'text-sky-300    border-sky-500/25    bg-sky-500/[0.06]'    },
  web_chat:   { label: 'Web Chat',  dot: 'bg-cyan-400',    pill: 'text-cyan-300   border-cyan-500/25   bg-cyan-500/[0.06]'   },
  voice:      { label: 'Voice',     dot: 'bg-violet-400',  pill: 'text-violet-300 border-violet-500/25 bg-violet-500/[0.06]' },
  shortcut:   { label: 'Shortcut',  dot: 'bg-pink-400',    pill: 'text-pink-300   border-pink-500/25   bg-pink-500/[0.06]'   },
  upload:     { label: 'Upload',    dot: 'bg-amber-400',   pill: 'text-amber-300  border-amber-500/25  bg-amber-500/[0.06]'  },
  screenshot: { label: 'Image',     dot: 'bg-rose-400',    pill: 'text-rose-300   border-rose-500/25   bg-rose-500/[0.06]'   },
  manual:     { label: 'Manual',    dot: 'bg-zinc-400',    pill: 'text-zinc-300   border-zinc-500/25   bg-zinc-500/[0.06]'   },
}

const STATUS_PILL: Record<string, string> = {
  pending: 'text-amber-300  border-amber-500/30   bg-amber-500/[0.08]',
  applied: 'text-cyan-300   border-cyan-500/25   bg-cyan-500/[0.06]',
  ignored: 'text-zinc-500   border-zinc-700/40   bg-white/[0.02]',
  failed:  'text-red-400    border-red-500/25    bg-red-500/[0.06]',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRel(iso: string): string {
  const d   = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function actionLabel(a: XodusAction): string {
  switch (a.type) {
    case 'create_note':              return `📝 ${a.body.length > 40 ? a.body.slice(0, 40) + '…' : a.body}`
    case 'update_note':              return `✏️ ${a.noteQuery.slice(0, 36)}`
    case 'create_goal':              return `🎯 ${a.title}`
    case 'complete_goal':            return `✓ ${a.goalQuery}`
    case 'update_goal':              return `✏️ ${a.goalQuery}`
    case 'create_grocery':           return `🛒 ${a.items.slice(0, 4).join(', ')}${a.items.length > 4 ? '…' : ''}`
    case 'update_nutrition_profile': return `🎯 Nutrition update`
    case 'log_food': {
      const b: string[] = []
      if (a.calories) b.push(`${a.calories} cal`)
      if (a.protein)  b.push(`${a.protein}g protein`)
      return `🍽 ${b.join(' · ') || 'food'}`
    }
    case 'log_manual_health': {
      const b: string[] = []
      if (a.steps)           b.push(`${a.steps} steps`)
      if (a.distanceMiles)   b.push(`${a.distanceMiles} mi`)
      if (a.activeEnergyKcal) b.push(`${a.activeEnergyKcal} kcal`)
      if (a.sleepHours)      b.push(`${a.sleepHours}h sleep`)
      if (a.weightLb)        b.push(`${a.weightLb} lb`)
      return `📊 ${b.join(' · ') || 'health'}`
    }
    case 'create_workout_log':      return `💪 ${a.title ?? (a.activityType ?? 'workout')}${a.exercises?.length ? ` · ${a.exercises.length} ex` : ''}`
    case 'create_project_update':   return `📦 ${a.projectName ?? 'project'}: ${a.update.slice(0, 36)}`
    case 'create_memory_candidate': return `🧠 ${a.title}`
    case 'training_recommendation': return `💡 ${a.intensity ?? ''} training`
    case 'add_open_loop':           return `🔁 ${a.title}`
    case 'save_pending_review':     return `⏳ ${a.reason.slice(0, 36)}`
    case 'no_op':                   return `· no-op`
  }
}

// ── Signal row ────────────────────────────────────────────────────────────────

function SignalRow({
  item, onApply, onIgnore, applyingId,
}: {
  item:       InboxItem
  onApply:    (item: InboxItem) => void
  onIgnore:   (item: InboxItem) => void
  applyingId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const src     = SOURCE_META[item.source] ?? SOURCE_META.manual
  const actions = item.actions ?? item.brain_result?.actions ?? []
  const loading = applyingId === item.id
  const isPending = item.status === 'pending'

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[--surface-raised] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${src.dot}`} />
        <span className={`text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded border ${src.pill}`}>
          {src.label}
        </span>
        {item.username && (
          <span className="text-[10px] font-mono text-zinc-600">@{item.username}</span>
        )}
        <span className={`ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded border ${STATUS_PILL[item.status] ?? STATUS_PILL.ignored}`}>
          {item.status}
        </span>
        <span className="text-[10px] font-mono text-zinc-700 ml-2">{fmtRel(item.created_at)}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {item.text && (
          <p className="text-[12px] text-zinc-200 leading-relaxed break-words">{item.text}</p>
        )}
        {item.parsed_summary && (
          <p className="text-[11px] text-cyan-300/80 leading-relaxed border-l-2 border-cyan-500/30 pl-2.5">
            {item.parsed_summary}
          </p>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {actions.map((a, i) => (
              <span
                key={i}
                className="inline-block text-[10px] font-mono px-2 py-0.5 rounded border text-zinc-400 border-white/[0.08] bg-white/[0.03]"
              >
                {actionLabel(a)}
              </span>
            ))}
          </div>
        )}
        {expanded && (
          <pre className="text-[9px] font-mono text-zinc-600 bg-[#0a0a0f] border border-white/[0.04] rounded-lg p-2 overflow-x-auto max-h-40 mt-1">
            {JSON.stringify({ actions, media: item.media }, null, 2)}
          </pre>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04] bg-white/[0.01]">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[10px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'Hide' : 'Raw'}
        </button>
        {isPending && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onIgnore(item)}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] disabled:opacity-30 transition-all"
            >
              <X size={10} /> Ignore
            </button>
            <button
              onClick={() => onApply(item)}
              disabled={loading || actions.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono text-cyan-300 border border-cyan-500/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.12] disabled:opacity-30 transition-all"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Apply{actions.length > 0 ? ` (${actions.length})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [items,       setItems]         = useState<InboxItem[]>([])
  const [fetchStatus, setFetchStatus]   = useState<InboxFetchStatus>('ok')
  const [loading,     setLoading]       = useState(true)
  const [applyingId,  setApplyingId]    = useState<string | null>(null)
  const [toast,       setToast]         = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await fetchInboxItems({ status: statusFilter, limit: 50 })
    setItems(res.items)
    setFetchStatus(res.status)
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    void refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  function flashToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleApply = useCallback(async (item: InboxItem) => {
    const actions = item.actions ?? item.brain_result?.actions ?? []
    if (actions.length === 0) { flashToast('No actions to apply.'); return }

    setApplyingId(item.id)
    try {
      const result  = await applyXodusActionsClient(actions)
      const summary = result.failed > 0
        ? `${result.applied} applied · ${result.pending} pending · ${result.failed} failed`
        : result.pending > 0 ? `${result.applied} applied · ${result.pending} pending`
        : `Applied ${result.applied} action${result.applied === 1 ? '' : 's'}`

      const newStatus: 'applied' | 'failed' = result.applied > 0 ? 'applied' : (result.failed > 0 ? 'failed' : 'applied')
      const patchRes = await patchInboxStatus(item.id, newStatus, summary)

      if (patchRes.ok) {
        if (statusFilter === 'pending') {
          setItems(prev => prev.filter(i => i.id !== item.id))
        } else {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i))
        }
        flashToast(summary)
      } else {
        flashToast(`Applied locally, inbox update failed: ${patchRes.reason ?? 'unknown'}`)
      }
    } catch {
      flashToast('Apply failed — check console')
    } finally {
      setApplyingId(null)
    }
  }, [statusFilter])

  const handleIgnore = useCallback(async (item: InboxItem) => {
    setApplyingId(item.id)
    const res = await patchInboxStatus(item.id, 'ignored')
    if (res.ok) {
      if (statusFilter === 'pending') {
        setItems(prev => prev.filter(i => i.id !== item.id))
      } else {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'ignored' as const } : i))
      }
      flashToast('Ignored.')
    } else {
      flashToast(`Ignore failed: ${res.reason ?? 'unknown'}`)
    }
    setApplyingId(null)
  }, [statusFilter])

  const displayed = sourceFilter === 'all'
    ? items
    : items.filter(i => i.source === sourceFilter)

  const pendingCount = items.filter(i => i.status === 'pending').length

  return (
    <div className="pb-24 lg:pb-10">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-6 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 10% 0%, rgba(56,189,248,0.07) 0%, transparent 70%)' }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/xodus"
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <ArrowLeft size={11} /> XODUS
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-sky-400" strokeWidth={2} />
              <h1 className="font-display font-light text-3xl text-white tracking-tight">Signals</h1>
              {pendingCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/[0.12] border border-amber-500/30 text-amber-300">
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-zinc-600 mt-1.5">
              All captured inputs — Telegram, voice, uploads, chat
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] disabled:opacity-30 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-8 pt-4 space-y-4">
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[--surface] border border-white/[0.06] w-fit">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-[0.1em] transition-colors ${
                statusFilter === tab.id
                  ? 'bg-gradient-to-br from-sky-500/15 to-cyan-500/10 text-white border border-sky-500/25'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Source filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setSourceFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors ${
                sourceFilter === f.id
                  ? 'bg-sky-500/[0.12] border border-sky-500/30 text-sky-300'
                  : 'bg-white/[0.03] border border-white/[0.06] text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Empty / error states */}
        {loading && displayed.length === 0 && (
          <p className="text-[11px] font-mono text-zinc-600 py-12 text-center">Loading…</p>
        )}

        {!loading && fetchStatus === 'table_missing' && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-4">
            <p className="text-[12px] text-amber-300 font-medium mb-1">xodus_inbox table not set up.</p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Run the SQL from{' '}
              <code className="text-amber-300/80 text-[10px]">docs/telegram-xodus-intake.md § 5</code>
              {' '}in Supabase to enable signal persistence.
            </p>
          </div>
        )}

        {!loading && fetchStatus === 'no_supabase' && (
          <p className="text-[11px] text-zinc-500 py-10 text-center leading-relaxed">
            Supabase not configured.<br />
            Set <code className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-zinc-400">SUPABASE_SECRET_KEY</code>.
          </p>
        )}

        {!loading && (fetchStatus === 'db_error' || fetchStatus === 'network') && (
          <p className="text-[11px] text-red-400/80 py-10 text-center">
            Signals unreachable ({fetchStatus}). Check server logs.
          </p>
        )}

        {!loading && fetchStatus === 'ok' && displayed.length === 0 && (
          <div className="text-center py-14 space-y-2">
            <Inbox size={20} className="text-zinc-700 mx-auto" />
            <p className="text-[11px] font-mono text-zinc-600 leading-relaxed">
              {sourceFilter !== 'all'
                ? `No ${statusFilter === 'all' ? '' : statusFilter + ' '}${SOURCE_FILTERS.find(f => f.id === sourceFilter)?.label ?? ''} signals.`
                : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}signals yet.`
              }
            </p>
            {statusFilter === 'pending' && (
              <p className="text-[10px] font-mono text-zinc-700">
                Text the Telegram bot or use XODUS chat to capture inputs.
              </p>
            )}
          </div>
        )}

        {/* Signal list */}
        <div className="space-y-2 max-w-2xl">
          {displayed.map(item => (
            <SignalRow
              key={item.id}
              item={item}
              onApply={handleApply}
              onIgnore={handleIgnore}
              applyingId={applyingId}
            />
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-cyan-500/25 shadow-xl">
            <Send size={11} className="text-cyan-400 flex-shrink-0" />
            <p className="text-[11px] font-mono text-cyan-300 whitespace-nowrap">{toast}</p>
          </div>
        </div>
      )}
    </div>
  )
}

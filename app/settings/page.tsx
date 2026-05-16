'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Upload, Trash2, CheckCircle2, AlertTriangle, HardDrive, FileText, RotateCcw, Zap, RefreshCw, Link2, Heart, Send, Brain, ChevronDown } from 'lucide-react'
import { STORAGE_KEYS, setStorage, resetStorageKey, validateStorageKey, getTodayLog, saveTodayLog, emptyLog, getTodayKey } from '@/lib/storage'
import { downloadObsidianExport, downloadXodusObsidianExport, downloadVaultZip } from '@/lib/obsidian-export'
import type { WhoopDailySync } from '@/lib/whoop/types'
import {
  parseSeedJson,
  getImportedRecords,
  setImportedRecords,
  clearImportedRecords,
  importCurrentOnly,
  persistNonCurrentForVisibility,
  statusBreakdown,
  type XodusMemoryImport,
  type StatusBreakdown,
} from '@/lib/xodus/memory-imports'
import { useWhoopAutoSync, WHOOP_AUTO_SYNC_TIMESTAMP_KEY } from '@/hooks/useWhoopAutoSync'

/* ─── Backup manifest — every key included in export/import/clear ────────────── */
const BACKUP_MANIFEST = [
  { key: STORAGE_KEYS.DAILY_LOGS,     label: 'Daily Logs',     desc: 'Daily check-in entries, targets, notes' },
  { key: STORAGE_KEYS.ACTIVITY_LOGS,  label: 'Activity Logs',  desc: 'Workouts, sets, reps, distance' },
  { key: STORAGE_KEYS.VOICE_LOGS,     label: 'Voice Logs',     desc: 'Voice transcript history' },
  { key: STORAGE_KEYS.UPLOAD_HISTORY, label: 'Uploads',        desc: 'Uploaded file metadata & previews' },
  { key: STORAGE_KEYS.STACK_STATE,    label: 'Stack',          desc: 'Supplement stack & taken status' },
  { key: STORAGE_KEYS.PROJECTS,       label: 'Projects',       desc: 'Projects, tasks & progress' },
] as const

const META_KEY = 'picard_settings_meta_v1'

interface Meta {
  lastExport: string | null
  lastImport: string | null
  lastClear: string | null
  importVersion: string | null
}

interface KeyStat { bytes: number; count: number | null }

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function readKeyStats(): KeyStat[] {
  return BACKUP_MANIFEST.map(({ key }) => {
    const raw = localStorage.getItem(key)
    if (!raw) return { bytes: 0, count: null }
    const bytes = new Blob([raw]).size
    let count: number | null = null
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) count = p.length
      else if (typeof p === 'object' && p !== null) count = Object.keys(p).length
    } catch {}
    return { bytes, count }
  })
}

function fmtBytes(n: number): string {
  if (n === 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function fmtRel(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  // Fire one WHOOP auto-sync attempt on Settings mount (guarded by timestamp).
  const whoopAuto = useWhoopAutoSync()
  void WHOOP_AUTO_SYNC_TIMESTAMP_KEY // keep the import referenced for tooling

  const [meta, setMeta] = useState<Meta>({
    lastExport: null, lastImport: null, lastClear: null, importVersion: null,
  })
  const [stats, setStats] = useState<KeyStat[]>([])
  const [storageEst, setStorageEst] = useState<{ usage: number; quota: number } | null>(null)
  const [clearStep, setClearStep] = useState<'idle' | 'confirm'>('idle')
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [storageHealth, setStorageHealth] = useState<Array<{ ok: boolean; error?: string }>>([])
  const [whoopConnected, setWhoopConnected] = useState<boolean | null>(null)
  const [whoopLastSync, setWhoopLastSync] = useState<string | null>(null)
  const [whoopReason, setWhoopReason] = useState<string | null>(null)
  const [whoopSyncing, setWhoopSyncing] = useState(false)
  const [appleHealth, setAppleHealth] = useState<{ connected: boolean; lastSync: string | null; reason: string | null } | null>(null)
  const [telegram, setTelegram] = useState<{
    configured: boolean
    restricted: boolean
    secretSet:  boolean
    inbox: { ready: boolean; reason: string | null }
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const seedFileRef = useRef<HTMLInputElement>(null)

  /* ── XODUS Memory Imports state ────────────────────────────────────────── */
  const [storedImports, setStoredImports] = useState<XodusMemoryImport[]>([])
  const [storedBreakdown, setStoredBreakdown] = useState<StatusBreakdown>({ total: 0, current: 0, needs_review: 0, paused: 0, outdated: 0 })
  const [preview, setPreview] = useState<{
    records: XodusMemoryImport[]
    breakdown: StatusBreakdown
    skipped: number
    fileName: string
  } | null>(null)
  const [importsClearStep, setImportsClearStep] = useState<'idle' | 'confirm'>('idle')

  const refreshImports = useCallback(() => {
    const records = getImportedRecords()
    setStoredImports(records)
    setStoredBreakdown(statusBreakdown(records))
  }, [])

  const refreshStats = useCallback(() => {
    setStats(readKeyStats())
    setStorageHealth(BACKUP_MANIFEST.map(({ key }) => validateStorageKey(key)))
  }, [])

  const fetchAppleHealthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/apple-health/sync')
      const data = await res.json() as { connected: boolean; lastSync?: string | null; reason?: string }
      setAppleHealth({
        connected: data.connected,
        lastSync:  data.lastSync ?? null,
        reason:    data.reason ?? null,
      })
    } catch {
      setAppleHealth({ connected: false, lastSync: null, reason: 'error' })
    }
  }, [])

  const fetchTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/telegram/webhook')
      const data = await res.json() as {
        configured: boolean; restricted: boolean; secretSet: boolean
        inbox: { ready: boolean; reason: string | null }
      }
      setTelegram(data)
    } catch {
      setTelegram({ configured: false, restricted: false, secretSet: false, inbox: { ready: false, reason: 'error' } })
    }
  }, [])

  const fetchWhoopStatus = useCallback(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch('/api/integrations/whoop/sync', { signal: controller.signal })
      clearTimeout(timeout)
      const data = await res.json() as { connected: boolean; lastSync: string | null; reason?: string }
      setWhoopConnected(data.connected)
      setWhoopLastSync(data.lastSync ?? null)
      setWhoopReason(data.reason ?? null)
    } catch (err) {
      clearTimeout(timeout)
      setWhoopConnected(false)
      setWhoopReason(err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'error')
    }
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY)
      if (raw) setMeta(JSON.parse(raw))
    } catch {}

    refreshStats()
    refreshImports()
    void fetchWhoopStatus()
    void fetchAppleHealthStatus()
    void fetchTelegramStatus()

    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => {
        if (e.usage !== undefined && e.quota !== undefined) {
          setStorageEst({ usage: e.usage, quota: e.quota })
        }
      })
    }

    // Handle WHOOP OAuth redirect params
    const params = new URLSearchParams(window.location.search)
    const whoopParam = params.get('whoop')
    if (whoopParam) {
      window.history.replaceState({}, '', window.location.pathname)
      if (whoopParam === 'connected') toast$('WHOOP connected')
      else if (whoopParam === 'denied') toast$('WHOOP authorization denied', false)
      else if (whoopParam === 'table_missing') toast$('whoop_tokens table missing — run the SQL in Supabase first', false)
      else if (whoopParam === 'state_mismatch') toast$('OAuth state mismatch — try connecting again', false)
      else if (whoopParam === 'error') toast$('WHOOP connection failed — check server logs', false)
    }
  }, [refreshStats, refreshImports, fetchWhoopStatus, fetchAppleHealthStatus, fetchTelegramStatus])

  /* ── XODUS Memory Imports handlers ────────────────────────────────────── */
  function handleSeedPreview(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = String(evt.target?.result ?? '')
      const result = parseSeedJson(text)
      if (!result.ok) {
        toast$(result.error ?? 'Could not parse seed file', false)
        return
      }
      setPreview({
        records: result.records,
        breakdown: statusBreakdown(result.records),
        skipped: result.skipped,
        fileName: file.name,
      })
      toast$(`Loaded ${result.records.length} record${result.records.length !== 1 ? 's' : ''} for preview`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleImportCurrent() {
    if (!preview) return
    const existing = getImportedRecords()
    const mergeCurrent = importCurrentOnly(preview.records, existing)
    const withNonCurrent = persistNonCurrentForVisibility(preview.records, mergeCurrent.merged)
    setImportedRecords(withNonCurrent)
    refreshImports()
    setPreview(null)
    toast$(`Imported ${mergeCurrent.added} current · ${mergeCurrent.skipped} already present · ${mergeCurrent.ignoredByStatus} not current`)
  }

  function handleClearImports() {
    if (importsClearStep === 'idle') {
      setImportsClearStep('confirm')
      setTimeout(() => setImportsClearStep('idle'), 4000)
      return
    }
    clearImportedRecords()
    setImportsClearStep('idle')
    setPreview(null)
    refreshImports()
    toast$('Staged XODUS memory imports cleared')
  }

  function saveMeta(next: Meta) {
    setMeta(next)
    localStorage.setItem(META_KEY, JSON.stringify(next))
  }

  function toast$(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function handleObsidianExport() {
    try {
      downloadObsidianExport()
      toast$('Obsidian Markdown downloaded')
    } catch {
      toast$('Failed to generate export', false)
    }
  }

  function handleXodusObsidianExport() {
    try {
      downloadXodusObsidianExport()
      toast$('XODUS Memory & Notes downloaded')
    } catch {
      toast$('Failed to generate XODUS export', false)
    }
  }

  const [vaultZipLoading, setVaultZipLoading] = useState(false)
  async function handleVaultZipExport() {
    if (vaultZipLoading) return
    setVaultZipLoading(true)
    try {
      await downloadVaultZip()
      toast$('Vault ZIP downloaded')
    } catch {
      toast$('Failed to generate Vault ZIP', false)
    } finally {
      setVaultZipLoading(false)
    }
  }

  /* Per-section reset */
  function handleSectionReset(key: string, label: string) {
    if (resetConfirm !== key) {
      setResetConfirm(key)
      setTimeout(() => setResetConfirm(null), 4000)
      return
    }
    resetStorageKey(key)
    setResetConfirm(null)
    refreshStats()
    toast$(`${label} cleared`)
  }

  /* Export */
  function handleExport() {
    const data: Record<string, unknown> = {}
    BACKUP_MANIFEST.forEach(({ key }) => {
      const raw = localStorage.getItem(key)
      if (raw) {
        try { data[key] = JSON.parse(raw) } catch { data[key] = raw }
      }
    })

    const backup = {
      version: '1.0',
      app: 'picard-os',
      exportedAt: new Date().toISOString(),
      keys: BACKUP_MANIFEST.map((m) => m.key),
      data,
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `picard-os-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const now = new Date().toISOString()
    saveMeta({ ...meta, lastExport: now })
    toast$('Backup downloaded')
  }

  /* Import */
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const backup = JSON.parse(evt.target?.result as string)

        if (backup.app !== 'picard-os') {
          toast$('Not a valid Picard OS backup', false); return
        }
        if (!backup.data || typeof backup.data !== 'object') {
          toast$('Backup file contains no data', false); return
        }

        // Per-key shape validation
        const ARRAY_KEYS = [STORAGE_KEYS.ACTIVITY_LOGS, STORAGE_KEYS.VOICE_LOGS, STORAGE_KEYS.UPLOAD_HISTORY, STORAGE_KEYS.STACK_STATE, STORAGE_KEYS.PROJECTS]
        const warnings: string[] = []
        for (const key of ARRAY_KEYS) {
          if (backup.data[key] !== undefined && !Array.isArray(backup.data[key])) {
            warnings.push(key)
          }
        }
        if (backup.data[STORAGE_KEYS.DAILY_LOGS] !== undefined &&
            (typeof backup.data[STORAGE_KEYS.DAILY_LOGS] !== 'object' || Array.isArray(backup.data[STORAGE_KEYS.DAILY_LOGS]))) {
          warnings.push(STORAGE_KEYS.DAILY_LOGS)
        }
        if (warnings.length > 0) {
          toast$(`Skipped ${warnings.length} malformed key(s) — backup may be partial`, false)
        }

        let restored = 0
        BACKUP_MANIFEST.forEach(({ key }) => {
          if (backup.data[key] !== undefined && !warnings.includes(key)) {
            setStorage(key, backup.data[key])
            restored++
          }
        })

        const now = new Date().toISOString()
        saveMeta({ ...meta, lastImport: now, importVersion: backup.version ?? '?' })
        refreshStats()

        // Notify reactive components
        window.dispatchEvent(new CustomEvent('picard:daily-log-updated'))
        window.dispatchEvent(new CustomEvent('picard:activity-log-updated'))
        window.dispatchEvent(new CustomEvent('picard:projects-updated'))
        window.dispatchEvent(new CustomEvent('picard:stack-updated'))

        toast$(`Restored ${restored} of ${BACKUP_MANIFEST.length} datasets`)
      } catch {
        toast$('Failed to parse backup file', false)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  /* Clear */
  function handleClear() {
    if (clearStep === 'idle') { setClearStep('confirm'); return }

    BACKUP_MANIFEST.forEach(({ key }) => localStorage.removeItem(key))
    const now = new Date().toISOString()
    saveMeta({ ...meta, lastClear: now })
    setClearStep('idle')
    refreshStats()

    window.dispatchEvent(new CustomEvent('picard:daily-log-updated'))
    window.dispatchEvent(new CustomEvent('picard:projects-updated'))
    window.dispatchEvent(new CustomEvent('picard:stack-updated'))

    toast$('All Picard OS data cleared')
  }

  async function handleWhoopSync() {
    setWhoopSyncing(true)
    try {
      const res = await fetch('/api/integrations/whoop/sync', { method: 'POST' })
      const data = await res.json() as { synced: boolean; dailySync?: WhoopDailySync; workoutsAdded?: number; reason?: string }

      if (!data.synced) {
        toast$(`Sync failed: ${data.reason ?? 'unknown error'}`, false)
        return
      }

      // Apply WHOOP fields to today's localStorage log
      if (data.dailySync) {
        const sync = data.dailySync
        const existing = getTodayLog() ?? emptyLog(getTodayKey())
        const weightLb = sync.weightKg !== null && sync.weightKg !== undefined
          ? Math.round(sync.weightKg * 2.20462 * 10) / 10
          : null
        saveTodayLog({
          ...existing,
          recoveryScore: sync.recoveryScore ?? existing.recoveryScore,
          hrv: sync.hrv ?? existing.hrv,
          restingHR: sync.restingHR ?? existing.restingHR,
          strain: sync.strain ?? existing.strain,
          sleepHours: sync.sleepHours ?? existing.sleepHours,
          ...(weightLb !== null ? { weight: weightLb } : {}),
          savedAt: new Date().toISOString(),
        })
      }

      const added = data.workoutsAdded ?? 0
      toast$(`WHOOP synced${added > 0 ? ` · ${added} workout${added !== 1 ? 's' : ''} added` : ''}`)
      void fetchWhoopStatus()
    } catch {
      toast$('Sync request failed', false)
    } finally {
      setWhoopSyncing(false)
    }
  }

  const totalBytes = stats.reduce((s, k) => s + k.bytes, 0)

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(236,72,153,0.07) 0%, rgba(34,211,238,0.02) 50%, transparent 70%)' }}
        />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Configuration</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">
            Settings
          </h1>
        </div>
      </div>

      <div className="px-4 lg:px-6 pt-6 space-y-5 lg:max-w-2xl">

        {/* ── XODUS Memory Imports (moved to top for visibility) ──────────── */}
        <section>
          <p className="section-title mb-3">XODUS Memory Imports</p>
          <p className="text-[12px] text-zinc-500 mb-3 leading-relaxed">
            Upload <code className="font-mono text-[11px] text-zinc-400">xodus-memory-seed.json</code> from <code className="font-mono text-[11px] text-zinc-400">exports/chatgpt-memory-import/</code>.
          </p>
          <div className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">

            <div className="flex items-start gap-4 px-5 py-4 border-b border-white/[0.04]">
              <div className="flex-shrink-0 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${storedBreakdown.current > 0 ? 'bg-green-400' : 'bg-zinc-700'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium flex items-center gap-2">
                  <Brain size={13} className="text-violet-400" strokeWidth={2.5} />
                  Staged imports from AI exports
                </p>
                <p className="text-[12px] mt-0.5 text-zinc-600 leading-relaxed">
                  Preview a <code className="font-mono text-[11px] text-zinc-500">xodus-memory-seed.json</code> file, then import only <code className="font-mono text-[11px] text-zinc-500">status: current</code> records.
                  Existing XODUS memory is never overwritten.
                </p>
                {storedBreakdown.total > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-500">
                    <span><span className="text-zinc-300">{storedBreakdown.total}</span> stored</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-green-300/90">{storedBreakdown.current} current</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-amber-300/80">{storedBreakdown.needs_review} needs_review</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500">{storedBreakdown.paused} paused</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-zinc-500">{storedBreakdown.outdated} outdated</span>
                  </div>
                )}
                {storedBreakdown.total === 0 && (
                  <p className="text-[11px] font-mono text-zinc-700 mt-1.5">No imports staged yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium">Preview seed file</p>
                <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                  Select a JSON seed (e.g. <code className="font-mono text-[11px]">exports/chatgpt-memory-import/xodus-memory-seed.json</code>). Nothing is saved until you import.
                </p>
              </div>
              <button
                onClick={() => seedFileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-zinc-300 text-[13px] font-medium hover:bg-white/[0.09] active:scale-[0.98] transition-all flex-shrink-0"
              >
                <Upload size={14} strokeWidth={2} />
                Preview .json
              </button>
              <input
                ref={seedFileRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSeedPreview}
                className="hidden"
              />
            </div>

            {preview && (
              <div className="px-5 py-4 border-b border-white/[0.04] bg-white/[0.015]">
                <p className="text-[12px] text-zinc-400 mb-2">
                  Preview · <span className="font-mono text-zinc-500">{preview.fileName}</span>
                  {preview.skipped > 0 && (
                    <span className="text-amber-400/80"> · skipped {preview.skipped} malformed record{preview.skipped !== 1 ? 's' : ''}</span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-500 mb-3">
                  <span><span className="text-zinc-300">{preview.breakdown.total}</span> total</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-green-300/90">{preview.breakdown.current} current</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-amber-300/80">{preview.breakdown.needs_review} needs_review</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">{preview.breakdown.paused} paused</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">{preview.breakdown.outdated} outdated</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleImportCurrent}
                    disabled={preview.breakdown.current === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/[0.10] border border-violet-500/25 text-violet-200 text-[13px] font-medium hover:bg-violet-500/[0.16] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Brain size={14} strokeWidth={2} />
                    Import {preview.breakdown.current} current
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    className="px-4 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 text-[13px] font-medium hover:bg-white/[0.03] hover:border-white/[0.13] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[11px] font-mono text-zinc-700 mt-2">
                  Only <span className="text-green-300/80">status: current</span> records are activated. Other records are stored for visibility but not used by XODUS.
                </p>
              </div>
            )}

            {storedImports.length > 0 && (
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <p className="text-[11px] font-mono text-zinc-700 mb-1.5">Most recent imports</p>
                <ul className="space-y-1">
                  {storedImports
                    .filter(r => r.status === 'current')
                    .slice(0, 5)
                    .map(r => (
                      <li key={r.id} className="text-[12px] text-zinc-400 truncate">
                        <span className="font-mono text-[10px] text-zinc-600 mr-2">{r.category}</span>
                        {r.title}
                      </li>
                    ))}
                  {storedImports.filter(r => r.status === 'current').length === 0 && (
                    <li className="text-[12px] text-zinc-600">No current records imported yet.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-300 font-medium">Clear staged imports</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Removes all records under <code className="font-mono">picard_xodus_memory_imports_v1</code>. Does not affect curated XODUS memory.
                </p>
              </div>
              <button
                onClick={handleClearImports}
                disabled={storedBreakdown.total === 0 && importsClearStep === 'idle'}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all flex-shrink-0 ${
                  importsClearStep === 'confirm'
                    ? 'bg-red-500/[0.14] border border-red-500/30 text-red-300'
                    : 'border border-white/[0.07] text-zinc-500 hover:border-red-500/25 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <Trash2 size={12} strokeWidth={2} />
                {importsClearStep === 'confirm' ? 'Click again to confirm' : 'Clear'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Integrations ─────────────────────────────────────────────────── */}
        <section>
          <p className="section-title mb-3">Integrations</p>
          <div className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
              {/* WHOOP status dot */}
              <div className="flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  whoopConnected === null ? 'bg-zinc-700' :
                  whoopConnected ? 'bg-green-400' : 'bg-zinc-600'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium flex items-center gap-2">
                  <Zap size={13} className="text-cyan-400" strokeWidth={2.5} />
                  WHOOP
                </p>
                <p className={`text-[12px] mt-0.5 ${
                  whoopConnected === null ? 'text-zinc-600' :
                  whoopConnected ? 'text-zinc-600' :
                  whoopReason === 'table_missing' ? 'text-amber-500/80' :
                  whoopReason && whoopReason !== 'not_connected' ? 'text-red-400/70' :
                  'text-zinc-600'
                }`}>
                  {whoopConnected === null
                    ? 'Checking status…'
                    : whoopConnected
                      ? `Connected${whoopLastSync ? ` · Last sync ${fmtRel(whoopLastSync)}` : ''}${whoopAuto.lastAttemptAt ? ` · Auto-sync ${fmtRel(whoopAuto.lastAttemptAt)} (${whoopAuto.lastStatus ?? '—'})` : ''}`
                      : whoopReason === 'table_missing'
                        ? 'Setup required — create whoop_tokens table in Supabase (see docs § 7)'
                        : whoopReason === 'db_error'
                          ? 'Database error — check Supabase credentials in .env.local'
                          : whoopReason === 'timeout'
                            ? 'Status check timed out — server may be starting up'
                            : 'Not connected — recovery, HRV, sleep, and strain auto-fill when connected'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {whoopConnected ? (
                  <button
                    onClick={handleWhoopSync}
                    disabled={whoopSyncing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/20 text-cyan-300 text-[13px] font-medium hover:bg-cyan-500/[0.14] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <RefreshCw size={13} strokeWidth={2} className={whoopSyncing ? 'animate-spin' : ''} />
                    {whoopSyncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                ) : (
                  <a
                    href="/api/integrations/whoop/auth"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-zinc-300 text-[13px] font-medium hover:bg-white/[0.09] active:scale-[0.98] transition-all"
                  >
                    <Link2 size={13} strokeWidth={2} />
                    Connect
                  </a>
                )}
              </div>
            </div>

            {/* Apple Health row — honest planned state, no fake Connect */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
              <div className="flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  appleHealth?.connected ? 'bg-green-400' : 'bg-zinc-700'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium flex items-center gap-2">
                  <Heart size={13} className="text-pink-400" strokeWidth={2.5} />
                  Apple Health
                </p>
                <p className="text-[12px] mt-0.5 text-zinc-600 leading-relaxed">
                  {appleHealth === null
                    ? 'Checking status…'
                    : appleHealth.connected
                      ? `Receiving · Last sync ${fmtRel(appleHealth.lastSync)}`
                      : appleHealth.reason === 'not_configured'
                        ? 'Apple Health sync runs through an iOS Shortcut. Local and production setup both documented.'
                        : appleHealth.reason === 'table_missing'
                          ? 'Setup pending — run the integration_meta SQL in Supabase (see setup guide)'
                          : 'Not connected — follow the setup guide to build the iOS Shortcut'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href="https://github.com/jpicard604-jp/picard-os/blob/main/docs/apple-health-shortcut-setup.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-500 text-[13px] font-medium hover:bg-white/[0.08] hover:text-zinc-300 active:scale-[0.98] transition-all"
                >
                  <FileText size={13} strokeWidth={2} />
                  Setup guide
                </a>
              </div>
            </div>

            {/* Telegram → XODUS row — server-side intake via private bot */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  telegram === null
                    ? 'bg-zinc-700'
                    : telegram.configured && telegram.inbox.ready
                      ? 'bg-green-400'
                      : telegram.configured
                        ? 'bg-amber-400'
                        : 'bg-zinc-700'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium flex items-center gap-2">
                  <Send size={13} className="text-sky-400" strokeWidth={2.5} />
                  Telegram → XODUS
                </p>
                <p className="text-[12px] mt-0.5 text-zinc-600 leading-relaxed">
                  {telegram === null
                    ? 'Checking status…'
                    : !telegram.configured
                      ? 'Text XODUS notes, goals, groceries, health logs, screenshots, and quick thoughts. Set TELEGRAM_BOT_TOKEN to enable.'
                      : telegram.inbox.ready
                        ? `Configured${telegram.restricted ? ' · restricted to allowed chat' : ' · open (no chat allow-list)'}${telegram.secretSet ? ' · webhook secret set' : ''}`
                        : telegram.inbox.reason === 'table_missing'
                          ? 'Bot configured — run the xodus_inbox SQL to enable persistence (see setup guide)'
                          : telegram.inbox.reason === 'no_supabase'
                            ? 'Bot configured — Supabase env vars missing, messages will not persist'
                            : 'Bot configured — inbox status unknown'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href="https://github.com/jpicard604-jp/picard-os/blob/main/docs/telegram-xodus-intake.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-500 text-[13px] font-medium hover:bg-white/[0.08] hover:text-zinc-300 active:scale-[0.98] transition-all"
                >
                  <FileText size={13} strokeWidth={2} />
                  Setup guide
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Data, Memory & Exports ───────────────────────────────────────── */}
        <section>
          <p className="section-title mb-3">Data, Memory & Exports</p>

          {/* Obsidian Exports — most-used, expanded by default */}
          <details open className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden mb-3">
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300">
              <span>Obsidian Exports</span>
              <ChevronDown size={12} strokeWidth={2} className="text-zinc-700" />
            </summary>
            <div className="border-t border-white/[0.04]">
              {/* Vault ZIP — first because it's the most common */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 font-medium">Vault ZIP</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                    Create a multi-file Obsidian staging export.
                  </p>
                </div>
                <button
                  onClick={handleVaultZipExport}
                  disabled={vaultZipLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300 text-[13px] font-medium hover:bg-emerald-500/[0.14] active:scale-[0.98] transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-wait"
                >
                  <Download size={14} strokeWidth={2} />
                  {vaultZipLoading ? 'Building…' : 'Export'}
                </button>
              </div>

              {/* XODUS Memory + Notes export */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 font-medium">XODUS Memory & Notes</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                    Export current XODUS memory and notes as Markdown.
                  </p>
                </div>
                <button
                  onClick={handleXodusObsidianExport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 text-violet-300 text-[13px] font-medium hover:bg-violet-500/[0.14] active:scale-[0.98] transition-all flex-shrink-0"
                >
                  <FileText size={14} strokeWidth={2} />
                  Export .md
                </button>
              </div>

              {/* Flat single-file Obsidian export — legacy */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 font-medium">Flat Obsidian Export</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                    Legacy single-file export of logs / updates.
                  </p>
                </div>
                <button
                  onClick={handleObsidianExport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/20 text-cyan-300 text-[13px] font-medium hover:bg-cyan-500/[0.14] active:scale-[0.98] transition-all flex-shrink-0"
                >
                  <FileText size={14} strokeWidth={2} />
                  Export .md
                </button>
              </div>
            </div>
          </details>

          {/* Backup / Data Tools — collapsed by default */}
          <details className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden mb-3">
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300">
              <span>Backup / Data Tools</span>
              <ChevronDown size={12} strokeWidth={2} className="text-zinc-700" />
            </summary>
            <div className="border-t border-white/[0.04]">
              {/* Full Backup Export */}
              <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 font-medium">Export Full Backup</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                    Download all Picard OS data as a single JSON file.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 text-white text-[13px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all flex-shrink-0"
                >
                  <Download size={14} strokeWidth={2.5} />
                  Export
                </button>
              </div>

              {/* Import Backup */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 font-medium">Import Full Backup</p>
                  <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                    Restore from a previously-exported Picard OS JSON file.
                  </p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-zinc-300 text-[13px] font-medium hover:bg-white/[0.09] active:scale-[0.98] transition-all flex-shrink-0"
                >
                  <Upload size={14} strokeWidth={2} />
                  Import
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
          </details>
        </section>

        {/* ── Advanced / Debug — collapsed by default ──────────────────────── */}
        <section>
          <p className="section-title mb-3">Advanced / Debug</p>
          <details className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden mb-3">
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300">
              <span>Data inventory <span className="text-zinc-700">· {fmtBytes(totalBytes)} total</span></span>
              <ChevronDown size={12} strokeWidth={2} className="text-zinc-700" />
            </summary>
          <div className="border-t border-white/[0.04]">
            {BACKUP_MANIFEST.map(({ key, label, desc }, i) => {
              const stat = stats[i]
              const health = storageHealth[i]
              const hasData = (stat?.bytes ?? 0) > 0
              const isCorrupt = health && !health.ok && hasData
              const isResetting = resetConfirm === key
              return (
                <div
                  key={key}
                  className={`px-5 py-3 ${i < BACKUP_MANIFEST.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isCorrupt ? 'bg-red-400' : hasData ? 'bg-green-400' : 'bg-zinc-700'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-200">{label}</p>
                      <p className="text-[10px] font-mono text-zinc-600">{desc}</p>
                      {isCorrupt && (
                        <p className="text-[10px] font-mono text-red-400/80 mt-0.5">Corrupted — {health.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[11px] font-mono text-zinc-500">{stat ? fmtBytes(stat.bytes) : '—'}</p>
                        {stat?.count !== null && stat?.count !== undefined && (
                          <p className="text-[9px] font-mono text-zinc-700">{stat.count} item{stat.count !== 1 ? 's' : ''}</p>
                        )}
                      </div>
                      {hasData && (
                        <button
                          onClick={() => handleSectionReset(key, label)}
                          title={isResetting ? 'Click again to confirm' : `Clear ${label}`}
                          className={`flex items-center justify-center w-6 h-6 rounded-md transition-all ${
                            isResetting
                              ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                              : 'border border-white/[0.07] text-zinc-700 hover:border-red-500/25 hover:text-red-500'
                          }`}
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Browser storage estimate */}
            <div className="px-5 py-3 border-t border-white/[0.04] flex items-center gap-2">
              <HardDrive size={11} className="text-zinc-700 flex-shrink-0" />
              <span className="text-[10px] font-mono text-zinc-700">
                {storageEst
                  ? `Browser storage: ${fmtBytes(storageEst.usage)} used · ${fmtBytes(storageEst.quota)} quota`
                  : 'Storage estimate unavailable in this browser'}
              </span>
            </div>
          </div>
          </details>

          {/* History — also under Advanced */}
          <details className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-[12px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300">
              <span>History</span>
              <ChevronDown size={12} strokeWidth={2} className="text-zinc-700" />
            </summary>
            <div className="border-t border-white/[0.04]">
              {[
                { label: 'Last export', value: fmtRel(meta.lastExport) },
                {
                  label: 'Last import',
                  value: meta.lastImport
                    ? `${fmtRel(meta.lastImport)}${meta.importVersion ? ` · v${meta.importVersion}` : ''}`
                    : 'Never',
                },
                { label: 'Last clear', value: fmtRel(meta.lastClear) },
              ].map(({ label, value }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-5 py-3.5 ${
                    i < arr.length - 1 ? 'border-b border-white/[0.04]' : ''
                  }`}
                >
                  <span className="text-[12px] text-zinc-500">{label}</span>
                  <span className="text-[12px] font-mono text-zinc-400">{value}</span>
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* ── Danger Zone ──────────────────────────────────────────────────── */}
        <section>
          <p className="text-[11px] font-medium text-red-500/70 uppercase tracking-[0.08em] mb-3">
            Danger Zone
          </p>
          <div className="rounded-2xl bg-[--surface] border border-red-500/[0.14] card-elevated overflow-hidden">
            <div className="px-5 py-4">
              {clearStep === 'idle' ? (
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-zinc-200 font-medium">Clear All Data</p>
                    <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                      Permanently remove all Picard OS data from this device
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-[13px] font-medium hover:bg-red-500/[0.14] active:scale-[0.98] transition-all flex-shrink-0"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    Clear
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] text-amber-300 font-medium mb-1">
                        This cannot be undone
                      </p>
                      <p className="text-[12px] text-zinc-500 leading-relaxed">
                        Export a backup first. All daily logs, activities, voice logs, uploads,
                        stack data, and projects will be permanently removed from this device.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setClearStep('idle')}
                      className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 text-[13px] font-medium hover:bg-white/[0.03] hover:border-white/[0.13] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClear}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/[0.12] border border-red-500/25 text-red-300 text-[13px] font-semibold hover:bg-red-500/[0.18] transition-colors"
                    >
                      Yes, delete everything
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Supabase migration note ───────────────────────────────────────── */}
        <p className="text-[10px] font-mono text-zinc-700 leading-relaxed px-1">
          Backup schema v1.0 · Keys map directly to future Supabase table names ·
          When cloud sync is added, this export/import path remains as a manual override
        </p>
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[13px] font-medium shadow-xl whitespace-nowrap animate-in ${
            toast.ok
              ? 'bg-[--surface-raised] border-green-500/25 text-green-300'
              : 'bg-[--surface-raised] border-red-500/25 text-red-300'
          }`}
        >
          {toast.ok
            ? <CheckCircle2 size={14} className="flex-shrink-0" />
            : <AlertTriangle size={14} className="flex-shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}

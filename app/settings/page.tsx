'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Upload, Trash2, CheckCircle2, AlertTriangle, HardDrive, FileText, RotateCcw } from 'lucide-react'
import { STORAGE_KEYS, setStorage, resetStorageKey, validateStorageKey } from '@/lib/storage'
import { downloadObsidianExport } from '@/lib/obsidian-export'

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
  const [meta, setMeta] = useState<Meta>({
    lastExport: null, lastImport: null, lastClear: null, importVersion: null,
  })
  const [stats, setStats] = useState<KeyStat[]>([])
  const [storageEst, setStorageEst] = useState<{ usage: number; quota: number } | null>(null)
  const [clearStep, setClearStep] = useState<'idle' | 'confirm'>('idle')
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [storageHealth, setStorageHealth] = useState<Array<{ ok: boolean; error?: string }>>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshStats = useCallback(() => {
    setStats(readKeyStats())
    setStorageHealth(BACKUP_MANIFEST.map(({ key }) => validateStorageKey(key)))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(META_KEY)
      if (raw) setMeta(JSON.parse(raw))
    } catch {}

    refreshStats()

    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => {
        if (e.usage !== undefined && e.quota !== undefined) {
          setStorageEst({ usage: e.usage, quota: e.quota })
        }
      })
    }
  }, [refreshStats])

  function saveMeta(next: Meta) {
    setMeta(next)
    localStorage.setItem(META_KEY, JSON.stringify(next))
  }

  function toast$(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  /* Obsidian export */
  function handleObsidianExport() {
    try {
      downloadObsidianExport()
      toast$('Obsidian Markdown downloaded')
    } catch {
      toast$('Failed to generate export', false)
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

  const totalBytes = stats.reduce((s, k) => s + k.bytes, 0)

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(99,102,241,0.04) 0%, transparent 60%)' }}
        />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Configuration</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">
            Settings
          </h1>
        </div>
      </div>

      <div className="px-4 lg:px-6 pt-6 space-y-5 lg:max-w-2xl">

        {/* ── Backup & Export ──────────────────────────────────────────────── */}
        <section>
          <p className="section-title mb-3">Backup & Data</p>
          <div className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">
            {/* Export */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium">Export Backup</p>
                <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                  Download all Picard OS data as a single JSON file
                </p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-[13px] font-semibold hover:bg-zinc-100 active:scale-[0.98] transition-all flex-shrink-0"
              >
                <Download size={14} strokeWidth={2.5} />
                Export
              </button>
            </div>

            {/* Import */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium">Import Backup</p>
                <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                  Restore all data from a previously exported JSON file
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

            {/* Obsidian export */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-zinc-200 font-medium">Export Obsidian Markdown</p>
                <p className="text-[12px] text-zinc-600 mt-0.5 leading-relaxed">
                  All logs, projects, and voice notes as clean Markdown — ready for Obsidian
                </p>
              </div>
              <button
                onClick={handleObsidianExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 text-violet-300 text-[13px] font-medium hover:bg-violet-500/[0.14] active:scale-[0.98] transition-all flex-shrink-0"
              >
                <FileText size={14} strokeWidth={2} />
                Export .md
              </button>
            </div>
          </div>
        </section>

        {/* ── Data Inventory ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Data Inventory</p>
            <span className="text-[10px] font-mono text-zinc-700">{fmtBytes(totalBytes)} total</span>
          </div>
          <div className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">
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
        </section>

        {/* ── History ──────────────────────────────────────────────────────── */}
        <section>
          <p className="section-title mb-3">History</p>
          <div className="rounded-2xl bg-[--surface] border border-white/[0.06] card-elevated overflow-hidden">
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

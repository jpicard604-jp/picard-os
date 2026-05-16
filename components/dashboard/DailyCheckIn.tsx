'use client'

// Daily Check-In — two-part card at the top of the dashboard.
//   Left  : Mental State (0–100, DailyLog.mentalScore)
//   Right : Energy       (1–10,  DailyLog.energyScore)
//
// Once both are filled for today's date, the full card collapses into a single
// compact "complete" strip with an Edit button. Next calendar day, the full
// card reappears automatically.
//
// Timestamps (mentalScoreUpdatedAt / energyScoreUpdatedAt) are stored on the
// DailyLog so a future productivity-period analyzer can correlate
// mental/energy with time-of-day, recovery, workouts, stimulants, etc.

import { useEffect, useState, useCallback } from 'react'
import { Heart, Zap, Pencil, Check } from 'lucide-react'
import {
  getTodayLog,
  saveTodayLog,
  emptyLog,
  getTodayKey,
  STORAGE_EVENTS,
} from '@/lib/storage'

function mentalBand(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'No check-in yet', color: 'text-zinc-500' }
  if (score < 25)  return { label: 'Low',         color: 'text-pink-400' }
  if (score < 50)  return { label: 'Rough',       color: 'text-amber-400' }
  if (score < 70)  return { label: 'Okay',        color: 'text-zinc-300' }
  if (score < 85)  return { label: 'Solid',       color: 'text-cyan-300' }
  return                  { label: 'Locked In',   color: 'text-emerald-300' }
}

function energyBand(score: number | null): { label: string; color: string } {
  if (score === null) return { label: '—',         color: 'text-zinc-500' }
  if (score <= 2) return { label: 'Drained',     color: 'text-pink-400' }
  if (score <= 4) return { label: 'Low',         color: 'text-amber-400' }
  if (score <= 6) return { label: 'Steady',      color: 'text-zinc-300' }
  if (score <= 8) return { label: 'High',        color: 'text-cyan-300' }
  return               { label: 'Wired / Peak', color: 'text-emerald-300' }
}

export default function DailyCheckIn() {
  const [hydrated, setHydrated] = useState(false)
  const [mental, setMental] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const hydrate = useCallback(() => {
    const log = getTodayLog()
    setMental(log?.mentalScore ?? null)
    setEnergy(log?.energyScore ?? null)
    setHydrated(true)
  }, [])

  useEffect(() => {
    hydrate()
    const onUpdate = () => hydrate()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, onUpdate)
    return () => window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, onUpdate)
  }, [hydrate])

  function commitMental(next: number) {
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    const now = new Date().toISOString()
    saveTodayLog({
      ...existing,
      mentalScore: next,
      mentalScoreUpdatedAt: now,
      savedAt: now,
    })
    flashSaved()
  }

  function commitEnergy(next: number) {
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    const now = new Date().toISOString()
    saveTodayLog({
      ...existing,
      energyScore: next,
      energyScoreUpdatedAt: now,
      savedAt: now,
    })
    flashSaved()
  }

  function flashSaved() {
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 900)
  }

  const bothFilled = mental !== null && energy !== null
  const showCompact = hydrated && bothFilled && !editing

  // ── Compact "complete" strip ────────────────────────────────────────────
  if (showCompact) {
    return (
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <Heart size={11} className="text-pink-400" strokeWidth={2.5} />
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-zinc-500">Check-in</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">Complete</span>
          <span className="text-zinc-700">·</span>
          <span className="text-[13px] text-zinc-200 font-mono tabular-nums">
            Mental <span className="text-white font-semibold">{mental}</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[13px] text-zinc-200 font-mono tabular-nums">
            Energy <span className="text-white font-semibold">{energy}</span>
          </span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] text-zinc-400 text-[12px] hover:bg-white/[0.04] hover:text-zinc-200 transition-colors flex-shrink-0"
        >
          <Pencil size={11} strokeWidth={2} />
          Edit
        </button>
      </div>
    )
  }

  // ── Full check-in card ──────────────────────────────────────────────────
  const mb = mentalBand(mental)
  const eb = energyBand(energy)
  const mentalDisplay = mental ?? 0
  const energyDisplay = energy ?? 0
  const mentalTrack = `linear-gradient(to right, rgba(34,211,238,0.85) 0%, rgba(236,72,153,0.85) ${mentalDisplay}%, rgba(255,255,255,0.06) ${mentalDisplay}%, rgba(255,255,255,0.06) 100%)`
  const energyTrack = `linear-gradient(to right, rgba(74,222,128,0.85) 0%, rgba(251,191,36,0.85) ${energyDisplay * 10}%, rgba(255,255,255,0.06) ${energyDisplay * 10}%, rgba(255,255,255,0.06) 100%)`

  return (
    <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">Daily Check-In</p>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <Check size={10} strokeWidth={2.5} /> Saved
            </span>
          )}
          {editing && bothFilled && (
            <button
              onClick={() => setEditing(false)}
              className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── Mental ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart size={12} className="text-pink-400" strokeWidth={2.5} />
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">Mental State</p>
            </div>
            <p className={`text-[11px] font-mono ${mb.color}`}>{mb.label}</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold text-white tabular-nums">
              {hydrated && mental !== null ? mental : '—'}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">/ 100</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={mentalDisplay}
            aria-label="Mental state from 0 to 100"
            onChange={(e) => setMental(Number(e.target.value))}
            onMouseUp={(e) => commitMental(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => commitMental(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => commitMental(Number((e.target as HTMLInputElement).value))}
            className="w-full appearance-none h-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
            style={{ background: mentalTrack }}
          />
          <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
            <span>0</span><span>50</span><span>100</span>
          </div>
        </div>

        {/* ── Energy ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-amber-400" strokeWidth={2.5} />
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">Energy</p>
            </div>
            <p className={`text-[11px] font-mono ${eb.color}`}>{eb.label}</p>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold text-white tabular-nums">
              {hydrated && energy !== null ? energy : '—'}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">/ 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={energyDisplay || 1}
            aria-label="Energy from 1 to 10"
            onChange={(e) => setEnergy(Number(e.target.value))}
            onMouseUp={(e) => commitEnergy(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => commitEnergy(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => commitEnergy(Number((e.target as HTMLInputElement).value))}
            className="w-full appearance-none h-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
            style={{ background: energyTrack }}
          />
          <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-600">
            <span>1 · Drained</span><span>5</span><span>10 · Peak</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] font-mono text-zinc-700 mt-4 leading-relaxed">
        Self-check only — not a diagnosis. Timestamps are stored so XODUS can later analyze your most-productive periods alongside recovery, workouts, stimulants, and workload.
      </p>
    </div>
  )
}

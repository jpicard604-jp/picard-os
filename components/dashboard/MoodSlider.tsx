'use client'

// Dashboard Mood / Mental State slider (0–100).
//
// - Writes to today's DailyLog.mentalScore via saveTodayLog().
// - Reads back from localStorage on mount (deterministic empty-initial render
//   to avoid hydration mismatch).
// - This stores a self-check value. Future trend analysis and the productivity
//   graph can consume DailyLog.mentalScore — wiring is left for a follow-up.

import { useEffect, useState, useCallback } from 'react'
import { Heart } from 'lucide-react'
import {
  getTodayLog,
  saveTodayLog,
  emptyLog,
  getTodayKey,
  STORAGE_EVENTS,
} from '@/lib/storage'

function bandFor(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'No check-in yet', color: 'text-zinc-500' }
  if (score < 25)  return { label: 'Low',         color: 'text-pink-400' }
  if (score < 50)  return { label: 'Rough',       color: 'text-amber-400' }
  if (score < 70)  return { label: 'Okay',        color: 'text-zinc-300' }
  if (score < 85)  return { label: 'Solid',       color: 'text-cyan-300' }
  return                  { label: 'Locked In',   color: 'text-emerald-300' }
}

export default function MoodSlider() {
  const [score, setScore] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const hydrate = useCallback(() => {
    const log = getTodayLog()
    setScore(log?.mentalScore ?? null)
    setHydrated(true)
  }, [])

  useEffect(() => {
    hydrate()
    const onUpdate = () => hydrate()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, onUpdate)
    return () => window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, onUpdate)
  }, [hydrate])

  function commit(next: number) {
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    saveTodayLog({
      ...existing,
      mentalScore: next,
      savedAt: new Date().toISOString(),
    })
  }

  const band = bandFor(score)
  const display = score ?? 0
  // Inline gradient via percentage stop so the filled portion shows the
  // value visually without bringing in a slider library.
  const filledStop = `${display}%`
  const trackBg = `linear-gradient(to right, rgba(34,211,238,0.85) 0%, rgba(236,72,153,0.85) ${filledStop}, rgba(255,255,255,0.06) ${filledStop}, rgba(255,255,255,0.06) 100%)`

  return (
    <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={13} className="text-pink-400" strokeWidth={2.5} />
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
            Mental Check-In
          </p>
        </div>
        <p className={`text-[11px] font-mono ${band.color}`}>{band.label}</p>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-semibold text-white tabular-nums">
          {hydrated && score !== null ? score : '—'}
        </span>
        <span className="text-[11px] font-mono text-zinc-600">/ 100</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={display}
        aria-label="Mood / mental state from 0 to 100"
        onChange={(e) => setScore(Number(e.target.value))}
        onMouseUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commit(Number((e.target as HTMLInputElement).value))}
        className="w-full appearance-none h-2 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
        style={{ background: trackBg }}
      />

      <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
        <span>0 · Low</span>
        <span>50 · Okay</span>
        <span>100 · Locked In</span>
      </div>

      <p className="text-[10px] font-mono text-zinc-700 mt-3 leading-relaxed">
        Self-check only — not a diagnosis. Stored for future trend analysis.
      </p>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import { STORAGE_EVENTS, getTodayLog, getTodayKey } from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'

type RingProps = {
  value: number
  max: number
  color: string
  label: string
  unit: string
  size?: number
  strokeWidth?: number
}

function Ring({ value, max, color, label, unit, size = 88, strokeWidth = 7 }: RingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / max, 1)
  const offset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-mono font-bold text-white leading-none">{value}</span>
          <span className="text-[9px] text-zinc-600 mt-0.5">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] font-medium text-zinc-500 tracking-wide">{label}</span>
    </div>
  )
}

export default function FitnessWidget() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [activeMin, setActiveMin] = useState(0)

  useEffect(() => {
    const refresh = () => {
      setLog(getTodayLog())
      setActiveMin(getDailyActivitySummary().activeMinutesToday)
    }
    refresh()
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    }
  }, [])

  const score = log?.recoveryScore ?? null
  const hrv = log?.hrv ?? null
  const restingHR = log?.restingHR ?? null
  const sleepHours = log?.sleepHours ?? null
  const sleepQuality = log?.sleepQuality ?? null
  const strain = log?.strain ?? null
  const glowClass = score === null ? '' : score >= 70 ? 'glow-green' : score >= 50 ? 'glow-amber' : 'glow-red'

  return (
    <div className={`mx-4 mt-3 rounded-2xl bg-[#111] border border-white/10 p-5 card-elevated ${glowClass}`}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Recovery Rings</span>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{getTodayKey()}</span>
      </div>

      <div className="flex justify-around">
        <Ring value={score ?? 0} max={100} color={score === null ? 'rgba(255,255,255,0.15)' : '#22c55e'} label="Recovery" unit={score !== null ? '%' : '—'} />
        <Ring value={sleepHours ?? 0} max={9} color={sleepHours === null ? 'rgba(255,255,255,0.15)' : '#22d3ee'} label="Sleep" unit={sleepHours !== null ? 'hr' : '—'} />
        <Ring value={strain !== null ? Math.round(strain * 10) / 10 : 0} max={21} color={strain === null ? 'rgba(255,255,255,0.15)' : '#a855f7'} label="Strain" unit={strain !== null ? '/21' : '—'} />
      </div>

      <div className="grid grid-cols-4 gap-1 mt-5 pt-4 border-t border-white/[0.07]">
        {[
          { label: 'HRV', value: hrv !== null ? `${hrv}ms` : '—' },
          { label: 'HR Rest', value: restingHR !== null ? `${restingHR}` : '—' },
          { label: 'Sleep Q', value: sleepQuality !== null ? `${sleepQuality}%` : '—' },
          { label: 'Active', value: activeMin > 0 ? `${activeMin}m` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-700">{label}</p>
            <p className="text-sm font-mono font-semibold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

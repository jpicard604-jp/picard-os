'use client'

import { useState, useEffect } from 'react'
import { JACKSON } from '@/lib/mock-data'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import { STORAGE_EVENTS } from '@/lib/storage'

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
  const { score, hrv, restingHR, sleepHours, sleepScore, strain } = JACKSON.today.recovery
  const glowClass = score >= 70 ? 'glow-green' : score >= 50 ? 'glow-amber' : 'glow-red'
  const [activeMin, setActiveMin] = useState(0)

  useEffect(() => {
    const refresh = () => setActiveMin(getDailyActivitySummary().activeMinutesToday)
    refresh()
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    }
  }, [])

  return (
    <div className={`mx-4 mt-3 rounded-2xl bg-[#111] border border-white/10 p-5 card-elevated ${glowClass}`}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Recovery Rings</span>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{JACKSON.today.date}</span>
      </div>

      <div className="flex justify-around">
        <Ring value={score} max={100} color="#22c55e" label="Recovery" unit="%" />
        <Ring value={sleepHours} max={9} color="#3b82f6" label="Sleep" unit="hr" />
        <Ring value={strain} max={21} color="#f59e0b" label="Strain" unit="/21" />
      </div>

      <div className="grid grid-cols-4 gap-1 mt-5 pt-4 border-t border-white/[0.07]">
        {[
          { label: 'HRV', value: `${hrv}ms` },
          { label: 'HR Rest', value: `${restingHR}` },
          { label: 'Sleep Q', value: `${sleepScore}%` },
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

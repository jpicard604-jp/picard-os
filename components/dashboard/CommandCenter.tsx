'use client'

import { useState, useEffect } from 'react'
import { ScoreRing } from '@/components/ui/score-ring'
import {
  getTodayLog,
  getStorage,
  getVoiceLogsToday,
  STORAGE_EVENTS,
  STORAGE_KEYS,
} from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'
import { generateDailyStatus } from '@/lib/daily-status'
import { getProjects, getOverdueCount } from '@/lib/projects'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import type { StackItem } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'

type RingColor = 'pink' | 'cyan'

interface RingDef {
  label: string
  value: number
  displayLabel: string
  sub: string
  subColor: string
  color: RingColor
}

export default function CommandCenter() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [status, setStatus] = useState(() => generateDailyStatus(null, {}))
  const [now, setNow] = useState(new Date())

  function refresh() {
    const todayLog = getTodayLog()
    setLog(todayLog)
    const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
    const voiceLogs = getVoiceLogsToday()
    const projects = getProjects()
    const activity = getDailyActivitySummary()
    setStatus(generateDailyStatus(todayLog, {
      voiceLogsToday: voiceLogs.length,
      stackTaken: stackItems.filter((i) => i.takenToday).length,
      stackTotal: stackItems.length,
      overdueProjects: getOverdueCount(projects),
      weeklyWorkouts: activity.weeklyWorkouts,
      activityMinutesToday: activity.activeMinutesToday,
      todayActivityLabel: activity.activityLabelToday ?? undefined,
      todayActivityType: activity.activityTypeToday ?? undefined,
    }))
  }

  useEffect(() => {
    refresh()
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60_000)
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    }
  }, [])

  // Suppress unused warning
  void status

  const r = JACKSON.today.recovery
  const n = JACKSON.today.nutrition
  const calories = log?.calories ?? n.calories.consumed
  const protein = log?.protein ?? n.protein.consumed
  const proteinTarget = log?.proteinTarget ?? n.protein.target
  const nutritionPct = Math.min(100, Math.round((protein / proteinTarget) * 100))
  const strainPct = Math.min(100, Math.round((r.strain / 21) * 100))

  const rings: RingDef[] = [
    {
      label: 'RECOVERY',
      value: r.score,
      displayLabel: `${r.score}`,
      sub: 'Optimal',
      subColor: 'text-cyan-400',
      color: 'pink',
    },
    {
      label: 'SLEEP',
      value: r.sleepScore,
      displayLabel: `${r.sleepScore}`,
      sub: 'Good',
      subColor: 'text-cyan-400',
      color: 'cyan',
    },
    {
      label: 'STRAIN',
      value: strainPct,
      displayLabel: `${r.strain}`,
      sub: 'Moderate',
      subColor: 'text-pink-400',
      color: 'pink',
    },
    {
      label: 'NUTRITION',
      value: nutritionPct,
      displayLabel: `${nutritionPct}%`,
      sub: nutritionPct >= 85 ? 'Excellent' : 'On Track',
      subColor: 'text-cyan-400',
      color: 'cyan',
    },
  ]

  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-4">
      {/* Left — Today Overview */}
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-5">
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-4">Today Overview</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
          <div>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Time</p>
            <p className="text-2xl font-semibold text-white leading-none">{timeStr}</p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Date</p>
            <p className="text-lg font-semibold text-white leading-tight mt-0.5">{dateStr}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.05]">
          <div>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Calories</p>
            <p className="text-sm font-mono font-bold text-white">{calories.toLocaleString()}</p>
            <p className="text-[8px] text-zinc-700 font-mono mt-0.5">kcal</p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">Steps</p>
            <p className="text-sm font-mono font-bold text-white">
              {log?.steps ? log.steps.toLocaleString() : '—'}
            </p>
            <p className="text-[8px] text-zinc-700 font-mono mt-0.5">steps</p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mb-1">HRV</p>
            <p className="text-sm font-mono font-bold text-white">{r.hrv}</p>
            <p className="text-[8px] text-zinc-700 font-mono mt-0.5">ms ❤</p>
          </div>
        </div>
      </div>

      {/* Right — Score Rings */}
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-5">
        <div className="grid grid-cols-4 h-full gap-2">
          {rings.map(({ label, value, displayLabel, sub, subColor, color }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <p className="text-[7px] font-mono uppercase tracking-[0.14em] text-zinc-500">{label}</p>
              <ScoreRing
                value={value}
                size={88}
                strokeWidth={11}
                color={color}
                label={displayLabel}
              />
              <div className="h-0.5 w-12 rounded-full bg-gradient-to-r from-pink-500 to-cyan-400 flex-shrink-0" />
              <p className={`text-[9px] font-mono leading-none ${subColor}`}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

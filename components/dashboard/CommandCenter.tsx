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

// Derive a 0-100 sleep quality from logged hours when sleepQuality isn't entered
function sleepHoursToScore(h: number): number {
  if (h >= 9) return 100
  if (h >= 8) return 90
  if (h >= 7.5) return 82
  if (h >= 7) return 72
  if (h >= 6) return 58
  if (h >= 5) return 40
  return 25
}

export default function CommandCenter() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [now, setNow] = useState(new Date())

  function refresh() {
    const todayLog = getTodayLog()
    setLog(todayLog)
    const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
    const voiceLogs = getVoiceLogsToday()
    const projects = getProjects()
    const activity = getDailyActivitySummary()
    // Keep status computed so WhatNeedsAttention / QuickStats stay in sync
    generateDailyStatus(todayLog, {
      voiceLogsToday: voiceLogs.length,
      stackTaken: stackItems.filter((i) => i.takenToday).length,
      stackTotal: stackItems.length,
      overdueProjects: getOverdueCount(projects),
      weeklyWorkouts: activity.weeklyWorkouts,
      activityMinutesToday: activity.activeMinutesToday,
      todayActivityLabel: activity.activityLabelToday ?? undefined,
      todayActivityType: activity.activityTypeToday ?? undefined,
    })
  }

  useEffect(() => {
    refresh()
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60_000)
    const events = [
      STORAGE_EVENTS.DAILY_LOG_UPDATED,
      STORAGE_EVENTS.VOICE_LOG_SAVED,
      STORAGE_EVENTS.PROJECTS_UPDATED,
      STORAGE_EVENTS.ACTIVITY_LOG_UPDATED,
      STORAGE_EVENTS.STACK_UPDATED,
    ]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, refresh))
    }
  }, [])

  // Recovery data from today's log (null = not logged)
  const recScore = log?.recoveryScore ?? null
  const hrv = log?.hrv ?? null
  const sleepHours = log?.sleepHours ?? null
  const sleepQuality = log?.sleepQuality ?? (sleepHours !== null ? sleepHoursToScore(sleepHours) : null)
  const strain = log?.strain ?? null
  const strainPct = strain !== null ? Math.min(100, Math.round((strain / 21) * 100)) : 0

  // Nutrition from log
  const proteinConsumed = log?.protein ?? 0
  const proteinTarget = log?.proteinTarget ?? 180
  const caloriesConsumed = log?.calories ?? 0
  const nutritionPct = proteinTarget > 0 ? Math.min(100, Math.round((proteinConsumed / proteinTarget) * 100)) : 0

  const rings: RingDef[] = [
    {
      label: 'RECOVERY',
      value: recScore ?? 0,
      displayLabel: recScore !== null ? `${recScore}` : '—',
      sub: recScore === null ? 'Log it' : recScore >= 70 ? 'Adapted' : recScore >= 50 ? 'Partial' : 'Strained',
      subColor: recScore === null ? 'text-zinc-600' : recScore >= 70 ? 'text-cyan-400' : recScore >= 50 ? 'text-purple-400' : 'text-pink-400',
      color: 'pink',
    },
    {
      label: 'SLEEP',
      value: sleepQuality ?? 0,
      displayLabel: sleepQuality !== null ? `${sleepQuality}` : '—',
      sub: sleepQuality === null ? 'Log it' : sleepQuality >= 80 ? 'Good' : sleepQuality >= 60 ? 'Fair' : 'Poor',
      subColor: sleepQuality === null ? 'text-zinc-600' : sleepQuality >= 80 ? 'text-cyan-400' : 'text-purple-400',
      color: 'cyan',
    },
    {
      label: 'STRAIN',
      value: strainPct,
      displayLabel: strain !== null ? `${strain}` : '—',
      sub: strain === null ? 'Log it' : strain >= 14 ? 'High' : strain >= 7 ? 'Moderate' : 'Low',
      subColor: strain === null ? 'text-zinc-600' : strain >= 14 ? 'text-pink-400' : 'text-purple-400',
      color: 'pink',
    },
    {
      label: 'NUTRITION',
      value: nutritionPct,
      displayLabel: `${nutritionPct}%`,
      sub: nutritionPct >= 85 ? 'On Target' : nutritionPct > 0 ? 'Tracking' : 'Log it',
      subColor: nutritionPct >= 85 ? 'text-cyan-400' : nutritionPct > 0 ? 'text-purple-400' : 'text-zinc-600',
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
            <p className="text-sm font-mono font-bold text-white">
              {caloriesConsumed > 0 ? caloriesConsumed.toLocaleString() : '—'}
            </p>
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
            <p className="text-sm font-mono font-bold text-white">{hrv ?? '—'}</p>
            <p className="text-[8px] text-zinc-700 font-mono mt-0.5">ms</p>
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

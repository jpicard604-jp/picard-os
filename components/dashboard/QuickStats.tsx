'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
import type { StackItem } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'

function ScoreBar({ pct, id }: { pct: number; id: string }) {
  return (
    <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden w-full">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${Math.min(pct, 100)}%`,
          background: `linear-gradient(to right, #22d3ee, #f472b6)`,
        }}
      />
    </div>
  )
}

export default function QuickStats() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [status, setStatus] = useState(() => generateDailyStatus(null, {}))

  function refresh() {
    const todayLog = getTodayLog()
    setLog(todayLog)
    const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
    const voiceLogs = getVoiceLogsToday()
    const projects = getProjects()
    setStatus(generateDailyStatus(todayLog, {
      voiceLogsToday: voiceLogs.length,
      stackTaken: stackItems.filter((i) => i.takenToday).length,
      stackTotal: stackItems.length,
      overdueProjects: getOverdueCount(projects),
    }))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    }
  }, [])

  const { executionScore, disciplineLevel } = status
  const mentalScore = log?.confidenceScore ?? JACKSON.today.confidence
  const mentalLabel = mentalScore >= 8 ? 'Excellent' : mentalScore >= 6 ? 'Calm' : mentalScore >= 4 ? 'Neutral' : 'Low'

  const protein = log?.protein ?? JACKSON.today.nutrition.protein.consumed
  const proteinTarget = log?.proteinTarget ?? JACKSON.today.nutrition.protein.target
  const proteinPct = Math.round((protein / proteinTarget) * 100)

  const calories = log?.calories ?? JACKSON.today.nutrition.calories.consumed
  const calTarget = log?.calorieTarget ?? JACKSON.today.nutrition.calories.target
  const calPct = Math.round((calories / calTarget) * 100)

  return (
    <div className="space-y-3">
      {/* Discipline Score */}
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">Discipline Score</p>
          <span className="text-2xl font-bold text-white font-display">{executionScore}</span>
        </div>
        <p className="text-[9px] font-mono text-cyan-400 mb-2">{disciplineLevel.replace('_', ' ')}</p>
        <ScoreBar pct={executionScore} id="discipline" />
      </div>

      {/* Mental Score */}
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">Mental Score</p>
          <span className="text-2xl font-bold text-white font-display">{Math.round(mentalScore * 10)}</span>
        </div>
        <p className="text-[9px] font-mono text-pink-400 mb-2">{mentalLabel}</p>
        <ScoreBar pct={mentalScore * 10} id="mental" />
      </div>

      {/* Nutrition quick view */}
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">Nutrition</p>
          <Link href="/daily" className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400">Update →</Link>
        </div>
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">Protein</span>
              <span className="text-[10px] font-mono text-white">{protein}g <span className="text-zinc-600">/ {proteinTarget}g</span></span>
            </div>
            <ScoreBar pct={proteinPct} id="protein" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-wider">Calories</span>
              <span className="text-[10px] font-mono text-white">{calories.toLocaleString()} <span className="text-zinc-600">/ {calTarget.toLocaleString()}</span></span>
            </div>
            <ScoreBar pct={calPct} id="calories" />
          </div>
        </div>
      </div>
    </div>
  )
}

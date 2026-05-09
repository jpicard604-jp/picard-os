'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getTodayLog, STORAGE_EVENTS } from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'
import { JACKSON } from '@/lib/mock-data'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import type { DailyActivitySummary } from '@/lib/activity-summary'

type StatRowProps = {
  label: string
  value: string
  sub?: string
  pct?: number
  barColor?: string
  warn?: boolean
  good?: boolean
}

function StatRow({ label, value, sub, pct, barColor = '#3b82f6', warn, good }: StatRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0">
      <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 w-20 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {pct !== undefined && (
          <div className="flex-1 h-0.5 bg-white/[0.07] rounded-full overflow-hidden min-w-0">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {sub && (
          <span className={`text-[9px] font-mono ${warn ? 'text-amber-400' : good ? 'text-green-400' : 'text-zinc-600'}`}>
            {sub}
          </span>
        )}
        <span className={`text-sm font-mono font-semibold tabular-nums ${warn ? 'text-amber-300' : good ? 'text-green-300' : 'text-white'}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

export default function QuickStats() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [activity, setActivity] = useState<DailyActivitySummary>(() => getDailyActivitySummary())

  function refresh() {
    setLog(getTodayLog())
    setActivity(getDailyActivitySummary())
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    }
  }, [])

  const mock = JACKSON.today
  const proteinConsumed = log?.protein ?? mock.nutrition.protein.consumed
  const proteinTarget   = log?.proteinTarget ?? mock.nutrition.protein.target
  const calConsumed     = log?.calories ?? mock.nutrition.calories.consumed
  const calTarget       = log?.calorieTarget ?? mock.nutrition.calories.target
  const screenTotal     = log?.screenTime ?? mock.screenTime.total
  const screenTarget    = mock.screenTime.target
  const screenIG        = log?.instagramTime ?? mock.screenTime.instagram
  const drank           = log?.drankToday ?? false
  const noDrink         = mock.streaks.noDrinking
  const fromLog         = log !== null
  const activeMin       = activity.activeMinutesToday

  const proteinPct = Math.round((proteinConsumed / proteinTarget) * 100)
  const calPct     = Math.round((calConsumed / calTarget) * 100)
  const screenOver = screenTotal > screenTarget

  return (
    <div className="mx-4 mt-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-zinc-700">Metrics</span>
        <Link href="/daily" className="text-[9px] font-mono text-blue-400 hover:text-blue-300 transition-colors">
          {fromLog ? 'Update →' : 'Log today →'}
        </Link>
      </div>
      <div className="rounded-xl bg-[#0f0f0f] border border-white/[0.06] overflow-hidden">
        <StatRow
          label="Protein"
          value={`${proteinConsumed}g`}
          sub={`${proteinPct}% of ${proteinTarget}g`}
          pct={proteinPct}
          barColor="#3b82f6"
          good={proteinPct >= 80}
          warn={proteinPct < 60}
        />
        <StatRow
          label="Calories"
          value={calConsumed.toLocaleString()}
          sub={`of ${calTarget.toLocaleString()}`}
          pct={calPct}
          barColor="#22c55e"
        />
        <StatRow
          label="Screen"
          value={`${screenTotal}h`}
          sub={screenOver ? `+${(screenTotal - screenTarget).toFixed(1)}h over · IG ${screenIG}h` : `${(screenTarget - screenTotal).toFixed(1)}h left`}
          warn={screenOver}
          good={!screenOver && screenTotal > 0}
        />
        <StatRow
          label={drank ? 'Alcohol' : 'No Alcohol'}
          value={drank ? '—' : `${noDrink}d`}
          sub={drank ? 'Streak reset' : 'streak'}
          warn={drank}
          good={!drank && noDrink > 0}
        />
        <StatRow
          label="Active"
          value={activeMin > 0 ? `${activeMin}m` : '—'}
          sub={activeMin >= 30 ? 'goal hit' : activeMin > 0 ? `${30 - activeMin}m to go` : 'none today'}
          pct={activeMin > 0 ? Math.min(100, Math.round((activeMin / 30) * 100)) : undefined}
          barColor="#f59e0b"
          good={activeMin >= 30}
          warn={activeMin > 0 && activeMin < 20}
        />
      </div>
      {!fromLog && (
        <p className="text-[9px] font-mono text-zinc-700 mt-2 text-center">
          estimated · <Link href="/daily" className="text-blue-500/80 hover:text-blue-400">log today</Link> for live metrics
        </p>
      )}
    </div>
  )
}

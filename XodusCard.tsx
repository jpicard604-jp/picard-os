'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Footprints, Timer, Dumbbell, Activity, Waves, Bike, PersonStanding } from 'lucide-react'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import type { DailyActivitySummary, BalanceStatus } from '@/lib/activity-summary'
import { STORAGE_EVENTS } from '@/lib/storage'
import { ACTIVITY_TYPE_COLORS } from '@/lib/fitness'
import type { ActivityType } from '@/lib/fitness'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const BALANCE_STYLES: Record<BalanceStatus, { text: string; bg: string; border: string }> = {
  PUSH:        { text: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20' },
  OPTIMAL:     { text: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/20' },
  MONITOR:     { text: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/20' },
  OVERREACHING:{ text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20' },
  REST:        { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
}

const TYPE_ICONS: Partial<Record<ActivityType, React.ElementType>> = {
  strength: Dumbbell,
  run: Activity,
  walk: Footprints,
  row: Waves,
  bike: Bike,
  recovery: PersonStanding,
}

function ActivityTypeBadge({ type, label }: { type: string; label: string }) {
  const c = ACTIVITY_TYPE_COLORS[type as ActivityType] ?? ACTIVITY_TYPE_COLORS.custom
  const Icon = TYPE_ICONS[type as ActivityType] ?? Activity
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
      <Icon size={9} />
      {label}
    </span>
  )
}

export default function ActivityOverview() {
  const [s, setS] = useState<DailyActivitySummary>(() => getDailyActivitySummary())

  useEffect(() => {
    const refresh = () => setS(getDailyActivitySummary())
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    }
  }, [])

  const balance = BALANCE_STYLES[s.balanceStatus]
  const today = new Date().getDay()
  const todayDotIndex = today === 0 ? 6 : today - 1

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-[#111] border border-white/10 card-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600">Activity</span>
        <span className={`inline-flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-0.5 rounded-full border ${balance.bg} ${balance.border} ${balance.text} uppercase tracking-wider`}>
          <span className={`w-1 h-1 rounded-full ${balance.text.replace('text-', 'bg-')}`} />
          {s.balanceStatus}
        </span>
      </div>

      {/* Today row */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
        {/* Steps */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1 mb-1">
            <Footprints size={9} className="text-zinc-600" />
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700">Steps</p>
          </div>
          <p className="text-base font-mono font-bold text-white leading-none">
            {s.stepsToday > 0 ? s.stepsToday.toLocaleString() : '—'}
          </p>
          <p className="text-[8px] text-zinc-700 mt-0.5 font-mono">
            {s.stepsToday >= 10000 ? 'goal' : s.stepsToday > 0 ? `${(10000 - s.stepsToday).toLocaleString()} to go` : 'not logged'}
          </p>
        </div>

        {/* Active minutes */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1 mb-1">
            <Timer size={9} className="text-zinc-600" />
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700">Active</p>
          </div>
          <p className="text-base font-mono font-bold text-white leading-none">
            {s.activeMinutesToday > 0 ? `${s.activeMinutesToday}m` : '—'}
          </p>
          <p className="text-[8px] text-zinc-700 mt-0.5 font-mono">
            {s.activeMinutesToday >= 30 ? 'goal hit' : s.activeMinutesToday > 0 ? `${30 - s.activeMinutesToday}m to 30` : 'none today'}
          </p>
        </div>

        {/* Activity type */}
        <div className="px-4 py-3">
          <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mb-1">Today</p>
          {s.hasActivityToday && s.activityTypeToday ? (
            <div className="mt-0.5">
              <ActivityTypeBadge type={s.activityTypeToday} label={s.activityLabelToday ?? s.activityTypeToday} />
            </div>
          ) : (
            <p className="text-base font-mono font-bold text-zinc-700 leading-none">—</p>
          )}
          <p className="text-[8px] text-zinc-700 mt-1 font-mono">
            {s.hasActivityToday ? 'logged' : 'none yet'}
          </p>
        </div>
      </div>

      {/* Week dot row */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mb-2">This week — {s.weeklyWorkouts} session{s.weeklyWorkouts !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-1.5">
          {WEEK_LABELS.map((label, i) => {
            const isToday = i === todayDotIndex
            const hasActivity = s.weekDays[i]
            const isFuture = i > todayDotIndex
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-all ${
                    hasActivity
                      ? 'bg-blue-500'
                      : isFuture
                      ? 'bg-white/[0.05]'
                      : 'bg-white/[0.12]'
                  } ${isToday ? 'ring-1 ring-blue-400/40 ring-offset-1 ring-offset-[#111]' : ''}`}
                />
                <span className={`text-[8px] font-mono ${isToday ? 'text-blue-400' : 'text-zinc-700'}`}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly breakdown stats */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        <div className="px-4 py-3 text-center">
          <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mb-1">Strength</p>
          <p className="text-sm font-mono font-bold text-white">{s.weeklyStrengthSessions}</p>
          <p className="text-[8px] text-zinc-700 font-mono">sessions</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mb-1">Run</p>
          <p className="text-sm font-mono font-bold text-white">
            {s.weeklyRunDistance > 0 ? `${s.weeklyRunDistance.toFixed(1)}` : '—'}
          </p>
          <p className="text-[8px] text-zinc-700 font-mono">{s.weeklyRunDistance > 0 ? 'miles' : 'no runs'}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mb-1">Row</p>
          <p className="text-sm font-mono font-bold text-white">
            {s.weeklyRowMinutes > 0 ? `${s.weeklyRowMinutes}` : '—'}
          </p>
          <p className="text-[8px] text-zinc-700 font-mono">{s.weeklyRowMinutes > 0 ? 'min' : 'none'}</p>
        </div>
      </div>

      {/* Balance label footer */}
      <div className={`px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between`}>
        <p className={`text-[10px] font-mono ${balance.text}`}>{s.balanceLabel}</p>
        <Link href="/fitness" className="text-[9px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors">
          Fitness →
        </Link>
      </div>
    </div>
  )
}

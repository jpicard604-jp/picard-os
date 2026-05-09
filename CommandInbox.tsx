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
import { generateDailyStatus } from '@/lib/daily-status'
import { getProjects, getOverdueCount } from '@/lib/projects'
import { getDailyActivitySummary } from '@/lib/activity-summary'
import type { StackItem } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'

const URGENCY_PILL = {
  LOW:      { text: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20'  },
  MODERATE: { text: 'text-sky-400',    bg: 'bg-sky-400/10 border-sky-400/20'      },
  HIGH:     { text: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20'  },
  CRITICAL: { text: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20'      },
}

const SCORE_BAR = {
  high: 'bg-green-500',
  mid:  'bg-sky-500',
  low:  'bg-amber-500',
  crit: 'bg-red-500',
}

const RECOVERY_TEXT: Record<string, string> = {
  ADAPTED:    'text-green-400',
  RECOVERING: 'text-sky-400',
  STRAINED:   'text-red-400',
}

const DISCIPLINE_TEXT: Record<string, string> = {
  LOCKED_IN:  'text-green-400',
  CONSISTENT: 'text-sky-400',
  SLIPPING:   'text-amber-400',
  OFF:        'text-red-400',
}

export default function CommandCenter() {
  const [status, setStatus] = useState(() => generateDailyStatus(null, {}))

  function refresh() {
    const log = getTodayLog()
    const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
    const voiceLogs = getVoiceLogsToday()
    const projects = getProjects()
    const activitySummary = getDailyActivitySummary()

    setStatus(generateDailyStatus(log, {
      voiceLogsToday: voiceLogs.length,
      stackTaken: stackItems.filter((i) => i.takenToday).length,
      stackTotal: stackItems.length,
      overdueProjects: getOverdueCount(projects),
      weeklyWorkouts: activitySummary.weeklyWorkouts,
      activityMinutesToday: activitySummary.activeMinutesToday,
      todayActivityLabel: activitySummary.activityLabelToday ?? undefined,
      todayActivityType: activitySummary.activityTypeToday ?? undefined,
    }))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    }
  }, [])

  const {
    executionScore, urgencyLevel, recoveryLevel,
    disciplineLevel, stackCompletion, loggedToday,
  } = status

  const urgencyStyle = URGENCY_PILL[urgencyLevel]
  const noDrink = JACKSON.today.streaks.noDrinking
  const hrv = JACKSON.today.recovery.hrv

  const barColor =
    executionScore >= 75 ? SCORE_BAR.high :
    executionScore >= 55 ? SCORE_BAR.mid  :
    executionScore >= 35 ? SCORE_BAR.low  :
    SCORE_BAR.crit

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <section className="relative px-5 pt-10 pb-7 lg:px-10 lg:pt-12 border-b border-white/[0.05] overflow-hidden">
      {/* Atmospheric ambient glow */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 0%, rgba(59,130,246,0.05) 0%, transparent 55%)',
        }}
      />

      <div className="relative flex items-start justify-between gap-4">
        {/* Left — score display */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-600 mb-5">
            {dayName}, {monthDay}
          </p>

          {/* Score number — Sora display font, pure white, no color coding */}
          <div className="flex items-end gap-2 mb-4">
            <span
              className="font-display font-light text-white leading-none tracking-tight tabular-nums"
              style={{ fontSize: 'clamp(72px, 10vw, 100px)' }}
            >
              {executionScore}
            </span>
            <span className="text-xl font-mono text-zinc-700 mb-2.5">/100</span>
          </div>

          {/* Progress bar — color indicates performance level */}
          <div className="h-[2px] w-52 lg:w-64 bg-white/[0.06] rounded-full mb-5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${Math.max(3, executionScore)}%` }}
            />
          </div>

          {/* Status labels */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono uppercase tracking-wider ${urgencyStyle.bg} ${urgencyStyle.text}`}
            >
              <span className="w-1 h-1 rounded-full bg-current" />
              {urgencyLevel}
            </span>
            <span className={`text-[11px] font-mono font-semibold ${RECOVERY_TEXT[recoveryLevel] ?? 'text-zinc-400'}`}>
              {recoveryLevel}
            </span>
            <span className="text-zinc-800">·</span>
            <span className={`text-[11px] font-mono font-semibold ${DISCIPLINE_TEXT[disciplineLevel] ?? 'text-zinc-400'}`}>
              {disciplineLevel.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Right — quick context */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-8">
          {!loggedToday && (
            <Link
              href="/daily"
              className="text-[9px] font-mono text-amber-400/80 bg-amber-500/[0.07] border border-amber-500/20 rounded-full px-3 py-1.5 uppercase tracking-wider hover:bg-amber-500/[0.12] transition-colors mb-1"
            >
              Log today
            </Link>
          )}
          <div className="space-y-1.5 text-right">
            <p className="text-[9px] font-mono text-zinc-600">{noDrink}d alcohol-free</p>
            <p className="text-[9px] font-mono text-zinc-600">
              Stack {Math.round(stackCompletion * 100)}%
            </p>
            <p className="text-[9px] font-mono text-zinc-600">HRV {hrv}ms</p>
            <p className={`text-[9px] font-mono ${loggedToday ? 'text-green-500/70' : 'text-zinc-700'}`}>
              {loggedToday ? '✓ logged' : 'log pending'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

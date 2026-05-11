'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { STORAGE_EVENTS } from '@/lib/storage'
import { gatherBrainInput, runXodusBrain } from '@/lib/xodus/brain'
import type { XodusBrainOutput, BrainInsight } from '@/lib/xodus/brain'
import { CONFIRMED_NUTRITION_PROFILE } from '@/lib/nutrition-profile'

const LEVEL_DOT: Record<BrainInsight['level'], string> = {
  critical: 'bg-pink-400 shadow-[0_0_5px_rgba(236,72,153,0.6)]',
  warning:  'bg-purple-400',
  info:     'bg-zinc-500',
  positive: 'bg-cyan-400',
}

// Stable SSR-safe default: deterministic output with empty inputs.
// Used as the initial useState value so server and client render identically.
// useEffect replaces this with real localStorage data after mount.
const EMPTY_BRAIN: XodusBrainOutput = runXodusBrain({
  dailyLog: null, weekLogs: [], todayLogs: [],
  stackItems: [], projects: [], voiceLogsToday: 0,
  uploadsToday: 0, alcoholStreak: 0,
  nutritionProfile: CONFIRMED_NUTRITION_PROFILE,
})

function InsightRow({ insight }: { insight: BrainInsight }) {
  return (
    <Link
      href={insight.href}
      className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04] last:border-0 group"
    >
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${LEVEL_DOT[insight.level]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-zinc-300 leading-snug">{insight.headline}</p>
        {insight.action && (
          <p className="text-[10px] font-mono text-zinc-600 mt-0.5 group-hover:text-zinc-500 transition-colors">
            {insight.action} →
          </p>
        )}
      </div>
    </Link>
  )
}

export default function XodusCard() {
  const [brain, setBrain] = useState<XodusBrainOutput>(EMPTY_BRAIN)

  function refresh() {
    setBrain(runXodusBrain(gatherBrainInput()))
  }

  useEffect(() => {
    refresh()
    const events = [
      STORAGE_EVENTS.DAILY_LOG_UPDATED,
      STORAGE_EVENTS.VOICE_LOG_SAVED,
      STORAGE_EVENTS.ACTIVITY_LOG_UPDATED,
      STORAGE_EVENTS.STACK_UPDATED,
      STORAGE_EVENTS.PROJECTS_UPDATED,
    ]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => events.forEach((e) => window.removeEventListener(e, refresh))
  }, [])

  const { brief, nextAction, insights, executionScore, urgency, loggedToday } = brain
  const topInsights = insights.filter((i) => i.level === 'critical' || i.level === 'warning').slice(0, 3)
  const urgencyColor = urgency === 'LOW' ? 'text-cyan-400' : urgency === 'MODERATE' ? 'text-purple-400' : 'text-pink-400'

  return (
    <div
      className="rounded-2xl bg-[#181818] p-5"
      style={{
        border: '1px solid rgba(236,72,153,0.35)',
        boxShadow: '0 0 0 1px rgba(236,72,153,0.10), 0 4px 40px rgba(236,72,153,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={13} className="text-pink-400 flex-shrink-0" strokeWidth={2.5} />
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-pink-400 font-semibold">
            XODUS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-zinc-600">Score</span>
          <span className="text-[11px] font-mono font-bold text-white">{executionScore}</span>
          <span className={`text-[8px] font-mono uppercase tracking-wider ${urgencyColor}`}>{urgency}</span>
        </div>
      </div>

      {/* Brief */}
      <div className="space-y-2 mb-4">
        {brief.slice(0, 2).map((para, i) => (
          <p key={i} className="text-[13px] text-zinc-300 leading-relaxed">{para}</p>
        ))}
      </div>

      {/* Top insights (warnings/critical only) */}
      {topInsights.length > 0 && (
        <div className="mb-4 bg-white/[0.02] rounded-xl px-2 py-1">
          {topInsights.map((insight) => (
            <InsightRow key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Next action */}
      <Link
        href={nextAction.href}
        className="block w-full py-2.5 px-4 rounded-xl bg-pink-500/[0.08] border border-pink-500/20 text-[12px] font-medium text-pink-300 hover:bg-pink-500/[0.14] transition-colors mb-3"
      >
        → {nextAction.text}
      </Link>

      {/* Footer */}
      <div className="flex items-center gap-3 justify-end">
        <Link
          href="/xodus"
          className="px-4 py-1.5 rounded-full border border-white/20 bg-white/[0.06] text-[11px] font-medium text-white hover:bg-white/[0.10] transition-colors"
        >
          Full Brief
        </Link>
        <Link
          href="/daily"
          className="px-4 py-1.5 rounded-full border border-white/20 bg-white/[0.06] text-[11px] font-medium text-white hover:bg-white/[0.10] transition-colors"
        >
          {loggedToday ? 'Update Log' : 'Log Today'}
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getTodayLog,
  getStorage,
  getVoiceLogsToday,
  getUploadsToday,
  STORAGE_EVENTS,
  STORAGE_KEYS,
} from '@/lib/storage'
import { generateXodusOutput } from '@/lib/xodus-message'
import type { XodusOutput } from '@/lib/xodus-message'
import type { StackItem, UploadedFile, UrgencyLevel } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'
import { getProjects, getOverdueCount } from '@/lib/projects'
import { getThisWeekLogs } from '@/lib/fitness'
import CommandInbox from '@/components/xodus/CommandInbox'

const URGENCY_STYLE: Record<UrgencyLevel, { pill: string; dot: string; accent: string }> = {
  LOW:      { pill: 'text-green-400 bg-green-400/10 border-green-400/20',  dot: 'bg-green-400',  accent: 'rgba(34,197,94,0.06)'    },
  MODERATE: { pill: 'text-sky-400 bg-sky-400/10 border-sky-400/20',        dot: 'bg-sky-400',    accent: 'rgba(56,189,248,0.06)'   },
  HIGH:     { pill: 'text-amber-400 bg-amber-400/10 border-amber-400/20',  dot: 'bg-amber-400',  accent: 'rgba(245,158,11,0.055)'  },
  CRITICAL: { pill: 'text-red-400 bg-red-400/10 border-red-400/20',        dot: 'bg-red-400',    accent: 'rgba(239,68,68,0.055)'   },
}

function buildExtras() {
  const voiceLogs = getVoiceLogsToday()
  const uploads = getUploadsToday<UploadedFile>()
  const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
  const projects = getProjects()
  const weekLogs = getThisWeekLogs()

  return {
    voiceLogsToday: voiceLogs.length,
    uploadsToday: uploads.length,
    stackTaken: stackItems.filter((i) => i.takenToday).length,
    stackTotal: stackItems.length,
    overdueProjects: getOverdueCount(projects),
    weeklyWorkouts: weekLogs.filter((l) => l.type === 'strength').length,
  }
}

function DailyBriefPanel({ output }: { output: XodusOutput }) {
  const { paragraphs, urgency, executionScore, recoveryState, focusRecommendation, loggedToday } = output
  const style = URGENCY_STYLE[urgency]

  return (
    <div className="space-y-3">
      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono uppercase tracking-wider ${style.pill}`}>
          <span className={`w-1 h-1 rounded-full ${style.dot}`} />
          {urgency}
        </span>
        <span className="text-[10px] font-mono text-zinc-600">Score <span className="text-white font-semibold">{executionScore}/100</span></span>
        <span className="text-zinc-700 text-[10px]">·</span>
        <span className="text-[10px] font-mono text-zinc-600">Recovery <span className="text-green-400 font-semibold">{recoveryState}</span></span>
      </div>

      {/* Brief card */}
      <div className="rounded-2xl bg-[--surface] border border-white/[0.07] overflow-hidden card-elevated">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-sky-400/80">
              Daily Brief · {JACKSON.today.date}
            </span>
          </div>
          {!loggedToday && (
            <span className="text-[9px] font-mono text-amber-400/70">estimated</span>
          )}
        </div>

        <div className="px-5 py-5 space-y-3.5">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className={`leading-relaxed ${
                i === paragraphs.length - 1
                  ? 'text-white font-medium text-[13px]'
                  : 'text-zinc-400 text-[13px]'
              }`}
            >
              {para}
            </p>
          ))}
        </div>

        {focusRecommendation && (
          <div className="px-5 py-3.5 border-t border-white/[0.05] bg-white/[0.015]">
            <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-1.5">Focus</p>
            <p className="text-[12px] text-zinc-300">{focusRecommendation}</p>
          </div>
        )}
      </div>

      {/* Log CTA */}
      <Link
        href="/daily"
        className="flex items-center justify-center w-full py-3 rounded-xl bg-sky-600/[0.07] border border-sky-500/20 text-[12px] font-medium text-sky-400 hover:bg-sky-600/[0.12] transition-colors"
      >
        {loggedToday ? 'Update Today\'s Log →' : 'Log Today for Full Brief →'}
      </Link>
    </div>
  )
}

export default function XodusPage() {
  const [output, setOutput] = useState<XodusOutput>(() => generateXodusOutput(null))

  function refresh() {
    const log = getTodayLog()
    setOutput(generateXodusOutput(log, buildExtras()))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    }
  }, [])

  const style = URGENCY_STYLE[output.urgency]

  return (
    <div className="pb-8">
      {/* Hero header */}
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 15% 0%, ${style.accent} 0%, transparent 55%)`,
          }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-1.5 h-1.5 rounded-full ${style.dot} shadow-[0_0_8px_currentColor]`} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                Command Inbox
              </span>
            </div>
            <h1 className="font-display font-light text-4xl lg:text-5xl text-white tracking-tight leading-none">
              XODUS
            </h1>
          </div>
          <p className="text-[11px] font-mono text-zinc-700 pb-1 hidden lg:block">
            Tell XODUS what happened. It handles the rest.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 lg:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-5 pt-4">
        {/* Left: Command Inbox (primary) */}
        <div>
          <CommandInbox />
        </div>

        {/* Right: Daily Brief (context) */}
        <div className="mt-5 lg:mt-0">
          <DailyBriefPanel output={output} />
        </div>
      </div>
    </div>
  )
}

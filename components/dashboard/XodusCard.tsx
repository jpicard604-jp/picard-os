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
import type { UrgencyLevel, StackItem, UploadedFile } from '@/lib/mock-data'
import { getProjects, getOverdueCount } from '@/lib/projects'
import { getThisWeekLogs, getTodayActivity } from '@/lib/fitness'
import { JACKSON } from '@/lib/mock-data'

const URGENCY_STYLES: Record<UrgencyLevel, { badge: string; dot: string }> = {
  LOW:      { badge: 'text-green-400 bg-green-400/10 border-green-400/20',  dot: 'bg-green-400'  },
  MODERATE: { badge: 'text-blue-400 bg-blue-400/10 border-blue-400/20',    dot: 'bg-blue-400'   },
  HIGH:     { badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400'  },
  CRITICAL: { badge: 'text-red-400 bg-red-400/10 border-red-400/20',       dot: 'bg-red-400'    },
}

function buildExtras() {
  const voiceLogs = getVoiceLogsToday()
  const uploads = getUploadsToday<UploadedFile>()
  const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
  const projects = getProjects()
  const weekLogs = getThisWeekLogs()
  const todayActivity = getTodayActivity()

  return {
    voiceLogsToday: voiceLogs.length,
    uploadsToday: uploads.length,
    stackTaken: stackItems.filter((i) => i.takenToday).length,
    stackTotal: stackItems.length,
    overdueProjects: getOverdueCount(projects),
    weeklyWorkouts: weekLogs.length,
    todayActivityLabel: todayActivity ? (todayActivity.label ?? todayActivity.type) : undefined,
    todayActivityType: todayActivity?.type,
  }
}

export default function XodusCard() {
  const [output, setOutput] = useState<XodusOutput>(() => generateXodusOutput(null))

  function refresh() {
    const log = getTodayLog()
    setOutput(generateXodusOutput(log, buildExtras()))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    }
  }, [])

  const { paragraphs, urgency, focusRecommendation, loggedToday } = output
  const styles = URGENCY_STYLES[urgency]

  return (
    <div className="mx-4 mt-3 rounded-xl bg-[#0d1117] border border-blue-500/[0.10] border-l-2 border-l-blue-500/40 glow-blue overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-blue-400/80">XODUS Brief</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-wider ${styles.badge}`}>
          <span className={`w-1 h-1 rounded-full ${styles.dot}`} />
          {urgency}
        </span>
      </div>

      {/* Intelligence prose */}
      <div className="px-5 pb-4 space-y-2.5">
        {paragraphs.slice(0, 2).map((para, i) => (
          <p key={i} className="text-sm text-zinc-300 leading-relaxed">{para}</p>
        ))}
      </div>

      {/* Focus line */}
      {focusRecommendation && (
        <div className="px-5 py-3 border-t border-white/[0.05]">
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-700 block mb-1">Focus</span>
          <p className="text-xs text-zinc-400 leading-relaxed">{focusRecommendation}</p>
        </div>
      )}

      {/* CTA */}
      <div className="px-5 py-3.5 border-t border-white/[0.05] flex items-center justify-between">
        <Link
          href="/xodus"
          className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          Talk to XODUS →
        </Link>
        <Link
          href="/daily"
          className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {loggedToday ? 'Update log' : 'Log today'}
        </Link>
      </div>
    </div>
  )
}

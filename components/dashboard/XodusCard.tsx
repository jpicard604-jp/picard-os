'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity } from 'lucide-react'
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
import type { StackItem, UploadedFile } from '@/lib/mock-data'
import { getProjects, getOverdueCount } from '@/lib/projects'
import { getThisWeekLogs, getTodayActivity } from '@/lib/fitness'
import { JACKSON } from '@/lib/mock-data'

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

  const { paragraphs, focusRecommendation, loggedToday } = output

  return (
    <div
      className="rounded-2xl bg-[#181818] p-5"
      style={{
        border: '1px solid rgba(236,72,153,0.35)',
        boxShadow: '0 0 0 1px rgba(236,72,153,0.10), 0 4px 40px rgba(236,72,153,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <Activity size={14} className="text-pink-400 flex-shrink-0" strokeWidth={2.5} />
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-pink-400 font-semibold">
          XODUS AI Coach Insight
        </p>
      </div>

      {/* Prose */}
      <div className="space-y-2 mb-5">
        {paragraphs.slice(0, 3).map((para, i) => (
          <p key={i} className="text-[13px] text-zinc-300 leading-relaxed">{para}</p>
        ))}
        {focusRecommendation && (
          <p className="text-[12px] text-zinc-500 italic leading-relaxed">{focusRecommendation}</p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 justify-end">
        <Link
          href="/xodus"
          className="px-4 py-1.5 rounded-full border border-white/20 bg-white/[0.06] text-[11px] font-medium text-white hover:bg-white/[0.10] transition-colors"
        >
          View Plan
        </Link>
        <Link
          href={loggedToday ? '/daily' : '/daily'}
          className="px-4 py-1.5 rounded-full border border-white/20 bg-white/[0.06] text-[11px] font-medium text-white hover:bg-white/[0.10] transition-colors"
        >
          {loggedToday ? 'Update Log' : 'Log Today'}
        </Link>
      </div>
    </div>
  )
}

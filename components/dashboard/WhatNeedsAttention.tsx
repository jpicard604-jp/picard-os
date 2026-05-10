'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  getTodayLog,
  getStorage,
  getVoiceLogsToday,
  STORAGE_EVENTS,
  STORAGE_KEYS,
} from '@/lib/storage'
import { generateDailyStatus } from '@/lib/daily-status'
import type { StatusAlert } from '@/lib/daily-status'
import { getProjects, getOverdueCount } from '@/lib/projects'
import type { StackItem } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'

const ALERT_STYLES = {
  critical: { border: 'border-l-red-500/50',   dot: 'bg-red-500',   text: 'text-red-400'   },
  warning:  { border: 'border-l-amber-500/50', dot: 'bg-amber-500', text: 'text-amber-400' },
  info:     { border: 'border-l-blue-500/30',  dot: 'bg-blue-500',  text: 'text-blue-400'  },
}

const CATEGORY_HREF: Record<string, string> = {
  nutrition:  '/daily',
  recovery:   '/daily',
  discipline: '/daily',
  mental:     '/daily',
  logging:    '/daily',
  projects:   '/projects',
}

function AlertRow({ alert }: { alert: StatusAlert }) {
  const style = ALERT_STYLES[alert.level]
  return (
    <Link
      href={CATEGORY_HREF[alert.category] ?? '/daily'}
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 border-l-2 ${style.border} hover:bg-white/[0.02] transition-colors`}
    >
      <div className={`w-1 h-1 rounded-full flex-shrink-0 ${style.dot}`} />
      <p className="flex-1 text-xs text-zinc-400 leading-relaxed">{alert.message}</p>
      <ChevronRight size={11} className="text-zinc-700 flex-shrink-0" />
    </Link>
  )
}

export default function WhatNeedsAttention() {
  const [alerts, setAlerts] = useState<StatusAlert[]>([])

  function refresh() {
    const log = getTodayLog()
    const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
    const voiceLogs = getVoiceLogsToday()
    const projects = getProjects()
    const status = generateDailyStatus(log, {
      voiceLogsToday: voiceLogs.length,
      stackTaken: stackItems.filter((i) => i.takenToday).length,
      stackTotal: stackItems.length,
      overdueProjects: getOverdueCount(projects),
    })
    setAlerts(status.alerts)
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    }
  }, [])

  if (alerts.length === 0) return null

  return (
    <div>
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 mb-2 px-0.5">
        Attention · {alerts.length}
      </p>
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] overflow-hidden">
        {alerts.map((alert, i) => (
          <AlertRow key={i} alert={alert} />
        ))}
      </div>
    </div>
  )
}

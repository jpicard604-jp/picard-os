'use client'

import { useState, useEffect } from 'react'
import { Mic, Upload, CalendarDays, Pill, FolderKanban } from 'lucide-react'
import {
  getTodayLog,
  getStorage,
  getVoiceLogsToday,
  getUploadsToday,
  STORAGE_EVENTS,
  STORAGE_KEYS,
} from '@/lib/storage'
import type { VoiceLog } from '@/lib/storage'
import type { StackItem, UploadedFile } from '@/lib/mock-data'
import { JACKSON } from '@/lib/mock-data'
import { getProjects } from '@/lib/projects'

interface TimelineEvent {
  id: string
  time: string
  sortKey: string
  icon: typeof Mic
  iconColor: string
  title: string
  sub?: string
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function buildTimeline(): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const todayStr = new Date().toISOString().slice(0, 10)

  // Daily log
  const log = getTodayLog()
  if (log?.savedAt) {
    events.push({
      id: 'daily-log',
      time: fmtTime(log.savedAt),
      sortKey: log.savedAt,
      icon: CalendarDays,
      iconColor: 'text-blue-400',
      title: 'Daily log saved',
      sub: log.confidenceScore ? `Confidence ${log.confidenceScore}/10` : undefined,
    })
  }

  // Voice logs
  const voiceLogs = getVoiceLogsToday()
  voiceLogs.forEach((vl: VoiceLog) => {
    events.push({
      id: `voice-${vl.id}`,
      time: fmtTime(vl.timestamp),
      sortKey: vl.timestamp,
      icon: Mic,
      iconColor: 'text-red-400',
      title: 'Voice log',
      sub: vl.transcript.slice(0, 60) + (vl.transcript.length > 60 ? '…' : ''),
    })
  })

  // Uploads (today only)
  const uploads = getUploadsToday<UploadedFile>()
  uploads.slice(0, 3).forEach((f) => {
    events.push({
      id: `upload-${f.id}`,
      time: '',
      sortKey: todayStr + '-upload-' + f.id,
      icon: Upload,
      iconColor: 'text-teal-400',
      title: f.name,
      sub: `${f.category} · ${f.size}`,
    })
  })

  // Stack (if any taken today)
  const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
  const taken = stackItems.filter((i) => i.takenToday).length
  if (taken > 0) {
    events.push({
      id: 'stack',
      time: '',
      sortKey: todayStr + '-stack',
      icon: Pill,
      iconColor: 'text-purple-400',
      title: `Stack — ${taken}/${stackItems.length} taken`,
      sub: stackItems.filter((i) => i.takenToday).map((i) => i.name.split(' ')[0]).join(', '),
    })
  }

  // Project updates today (from voice or manual)
  const projects = getProjects()
  for (const project of projects) {
    for (const update of (project.updates ?? [])) {
      if (!update.timestamp.startsWith(todayStr)) continue
      events.push({
        id: `project-update-${update.id}`,
        time: fmtTime(update.timestamp),
        sortKey: update.timestamp,
        icon: FolderKanban,
        iconColor: 'text-emerald-400',
        title: `${project.title} updated`,
        sub: update.text.length > 60
          ? update.text.slice(0, 60) + '…'
          : update.text,
      })
    }
  }

  // Suppress unused JACKSON reference warning
  void JACKSON

  return events.sort((a, b) => (a.sortKey > b.sortKey ? -1 : 1))
}

export default function TodayTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([])

  function refresh() {
    setEvents(buildTimeline())
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
      window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    }
  }, [])

  if (events.length === 0) return null

  return (
    <div className="mx-4 mt-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-0.5">Today's Activity</p>
      <div className="rounded-xl bg-[#0f0f0f] border border-white/[0.08] overflow-hidden">
        {events.map((event) => {
          const Icon = event.icon
          return (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={13} className={event.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{event.title}</p>
                {event.sub && <p className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">{event.sub}</p>}
              </div>
              {event.time && (
                <span className="text-[9px] font-mono text-zinc-700 flex-shrink-0 mt-0.5">{event.time}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

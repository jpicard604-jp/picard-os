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

// Suppress unused icon imports — kept for future use
void Mic; void Upload; void CalendarDays; void Pill; void FolderKanban

interface LogEntry {
  id: string
  sortKey: string
  time: string
  title: string
  detail: string
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function buildLogs(): LogEntry[] {
  const entries: LogEntry[] = []
  const todayStr = new Date().toISOString().slice(0, 10)

  const log = getTodayLog()
  if (log?.savedAt) {
    entries.push({
      id: 'daily-log',
      sortKey: log.savedAt,
      time: fmtTime(log.savedAt),
      title: 'Daily log saved',
      detail: log.confidenceScore ? `Confidence ${log.confidenceScore}/10` : 'Logged',
    })
  }

  const voiceLogs = getVoiceLogsToday()
  voiceLogs.forEach((vl: VoiceLog) => {
    entries.push({
      id: `voice-${vl.id}`,
      sortKey: vl.timestamp,
      time: fmtTime(vl.timestamp),
      title: 'Voice note',
      detail: vl.transcript.slice(0, 40) + (vl.transcript.length > 40 ? '…' : ''),
    })
  })

  const uploads = getUploadsToday<UploadedFile>()
  uploads.slice(0, 2).forEach((f) => {
    entries.push({
      id: `upload-${f.id}`,
      sortKey: todayStr + '-upload-' + f.id,
      time: '—',
      title: f.name.slice(0, 24) + (f.name.length > 24 ? '…' : ''),
      detail: `${f.category} · ${f.size}`,
    })
  })

  const stackItems = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)
  const taken = stackItems.filter((i) => i.takenToday)
  if (taken.length > 0) {
    entries.push({
      id: 'stack',
      sortKey: todayStr + '-stack',
      time: '—',
      title: `Stack — ${taken.length}/${stackItems.length} taken`,
      detail: taken.slice(0, 3).map((i) => i.name.split(' ')[0]).join(', '),
    })
  }

  const projects = getProjects()
  for (const project of projects) {
    for (const update of (project.updates ?? [])) {
      if (!update.timestamp.startsWith(todayStr)) continue
      entries.push({
        id: `project-update-${update.id}`,
        sortKey: update.timestamp,
        time: fmtTime(update.timestamp),
        title: `${project.title}`,
        detail: update.text.slice(0, 40) + (update.text.length > 40 ? '…' : ''),
      })
    }
  }

  return entries.sort((a, b) => (a.sortKey > b.sortKey ? -1 : 1)).slice(0, 6)
}

export default function TodayTimeline() {
  const [entries, setEntries] = useState<LogEntry[]>([])

  function refresh() {
    setEntries(buildLogs())
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

  return (
    <div className="rounded-2xl bg-[#181818] border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.05]">
        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">Recent Logs</p>
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[11px] text-zinc-600 font-mono">No activity logged today</p>
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-[10px] font-mono text-zinc-600 w-10 flex-shrink-0 tabular-nums">
                {entry.time}
              </span>
              <span className="flex-1 text-[12px] font-medium text-white truncate">{entry.title}</span>
              <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0 truncate max-w-[90px]">{entry.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

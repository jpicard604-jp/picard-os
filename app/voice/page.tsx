'use client'

import { useState, useEffect } from 'react'
import VoiceCapture from '@/components/dashboard/VoiceCapture'
import { getStorage, STORAGE_KEYS, STORAGE_EVENTS } from '@/lib/storage'
import type { VoiceLog } from '@/lib/storage'

function fmtDuration(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function VoicePage() {
  const [logs, setLogs] = useState<VoiceLog[]>([])

  function refresh() {
    setLogs(getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, []))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
    return () => window.removeEventListener(STORAGE_EVENTS.VOICE_LOG_SAVED, refresh)
  }, [])

  return (
    <div className="pb-4">
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(239,68,68,0.05) 0%, transparent 55%)' }}
        />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Capture</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none mb-2">
            Voice Log
          </h1>
          <p className="text-[13px] text-zinc-500 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <VoiceCapture />

      <div className="mx-4 mt-3 rounded-2xl bg-[--surface] border border-white/[0.06] overflow-hidden card-elevated">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Recent Logs</p>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-zinc-600">No voice logs yet</p>
            <p className="text-xs text-zinc-700 mt-1 font-mono">Record your first log above</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="px-5 py-3.5 border-b border-white/[0.05] last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono text-zinc-700">{fmtTimestamp(log.timestamp)}</span>
                <span className="text-[9px] font-mono text-zinc-700">{fmtDuration(log.duration)}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{log.transcript}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

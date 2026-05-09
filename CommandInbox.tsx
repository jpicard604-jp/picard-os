'use client'

import { useState, useEffect } from 'react'
import { JACKSON } from '@/lib/mock-data'

export default function GreetingHeader() {
  const [greeting, setGreeting] = useState('')
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    setTimeStr(
      now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    )
  }, [])

  const { score, state, hrv } = JACKSON.today.recovery
  const stateColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  const dotColor = score >= 70 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="px-4 pt-7 pb-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-600">{timeStr}</p>
      <h1 className="text-[1.6rem] font-semibold text-white mt-1 tracking-tight leading-tight">
        {greeting ? `${greeting}, ${JACKSON.handle}.` : `Welcome, ${JACKSON.handle}.`}
      </h1>
      <div className="flex items-center gap-2 mt-2.5">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className={`text-xs font-mono ${stateColor}`}>{state}</span>
        <span className="text-zinc-700 text-xs">·</span>
        <span className="text-xs text-zinc-500">Recovery {score}</span>
        <span className="text-zinc-700 text-xs">·</span>
        <span className="text-xs text-zinc-500">HRV {hrv}ms</span>
      </div>
    </div>
  )
}

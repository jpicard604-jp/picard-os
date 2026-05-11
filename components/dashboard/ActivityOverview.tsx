'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MiniTrendChart } from '@/components/ui/mini-trend-chart'
import { STORAGE_EVENTS } from '@/lib/storage'
import { JACKSON } from '@/lib/mock-data'

// 7-day seed data (Mon→Sun) — replaced by real data once WHOOP connects
const RECOVERY_SEED = [68, 72, 65, 74, 71, 78, JACKSON.today.recovery.score]
const STRAIN_SEED   = [15, 12, 9, 14, 11, 8, JACKSON.today.recovery.strain]
const SLEEP_SEED    = [72, 75, 70, 78, 68, 82, JACKSON.today.recovery.sleepScore]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface TrendCardProps {
  label: string
  data: number[]
  color: string
  current: number | string
  status: string
  statusColor: string
}

function TrendCard({ label, data, color, current, status, statusColor }: TrendCardProps) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500 mb-1">{label}</p>
      <MiniTrendChart data={data} color={color} height={64} />
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="text-[7px] font-mono text-zinc-700 flex-1 text-center">{d.charAt(0)}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xl font-bold font-display ${statusColor}`}>{current}</span>
        <span className={`text-[9px] font-mono ${statusColor}`}>{status}</span>
      </div>
    </div>
  )
}

export default function ActivityOverview() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const refresh = () => setTick(t => t + 1)
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    return () => {
      window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
      window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, refresh)
    }
  }, [])

  const r = JACKSON.today.recovery

  return (
    <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 font-semibold">
          Weekly Trend Preview
        </p>
        <Link href="/trends" className="text-[9px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors">
          View all →
        </Link>
      </div>
      <div className="flex gap-5">
        <TrendCard
          label="Recovery"
          data={RECOVERY_SEED}
          color="#22d3ee"
          current={r.score}
          status="Optimal"
          statusColor="text-cyan-400"
        />
        <div className="w-px bg-white/[0.05] flex-shrink-0" />
        <TrendCard
          label="Strain"
          data={STRAIN_SEED}
          color="#f472b6"
          current={r.strain}
          status="Moderate"
          statusColor="text-pink-400"
        />
        <div className="w-px bg-white/[0.05] flex-shrink-0" />
        <TrendCard
          label="Sleep"
          data={SLEEP_SEED}
          color="#c084fc"
          current={r.sleepScore}
          status="Good"
          statusColor="text-purple-400"
        />
      </div>
    </div>
  )
}

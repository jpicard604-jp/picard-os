'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays, Dumbbell, Mic, Upload,
  FolderKanban, Pill, Utensils, CheckCircle2, Sparkles,
} from 'lucide-react'
import { getTodayLog, saveTodayLog, emptyLog, getTodayKey } from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'

const ROUTE_ACTIONS = [
  { href: '/fitness',  icon: Dumbbell,     label: 'Activity',   color: 'text-green-400',  glow: 'bg-green-500/[0.07] border-green-500/[0.16]'  },
  { href: '/voice',    icon: Mic,          label: 'Voice Note', color: 'text-red-400',    glow: 'bg-red-500/[0.07] border-red-500/[0.16]'      },
  { href: '/uploads',  icon: Upload,       label: 'Screenshot', color: 'text-teal-400',   glow: 'bg-teal-500/[0.07] border-teal-500/[0.16]'    },
  { href: '/projects', icon: FolderKanban, label: 'Projects',   color: 'text-amber-400',  glow: 'bg-amber-500/[0.07] border-amber-500/[0.16]'  },
  { href: '/stack',    icon: Pill,         label: 'Stack',      color: 'text-violet-400', glow: 'bg-violet-500/[0.07] border-violet-500/[0.16]' },
  { href: '/daily',    icon: CalendarDays, label: 'Daily Log',  color: 'text-sky-400',    glow: 'bg-sky-500/[0.07] border-sky-500/[0.16]'      },
] as const

export default function QuickCapture() {
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [foodSaved, setFoodSaved] = useState(false)

  function saveFood() {
    if (calories === '' && protein === '') return
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    const updated: DailyLog = {
      ...existing,
      calories:  calories !== '' ? Number(calories) : existing.calories,
      protein:   protein  !== '' ? Number(protein)  : existing.protein,
      savedAt: new Date().toISOString(),
    }
    saveTodayLog(updated)
    setFoodSaved(true)
    setTimeout(() => {
      setFoodSaved(false)
      setCalories('')
      setProtein('')
    }, 2000)
  }

  const canSave = calories !== '' || protein !== ''

  return (
    <div className="mx-4 mt-4 lg:mx-0 lg:mt-0 mb-4">
      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-700 mb-2.5 px-0.5">Quick Capture</p>

      {/* Inline food logger */}
      <div className="rounded-2xl bg-[--surface] border border-white/[0.06] p-4 card-elevated mb-2.5">
        <div className="flex items-center gap-2 mb-3">
          <Utensils size={11} className="text-amber-400" />
          <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500">Log Food</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[--surface-raised] border border-white/[0.09] rounded-xl px-3 py-2.5 flex items-center gap-1.5 focus-within:border-sky-500/30 transition-colors">
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveFood()}
              placeholder="—"
              className="flex-1 bg-transparent text-white text-[13px] font-mono focus:outline-none placeholder-zinc-700 min-w-0 w-0"
            />
            <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">kcal</span>
          </div>
          <div className="flex-1 bg-[--surface-raised] border border-white/[0.09] rounded-xl px-3 py-2.5 flex items-center gap-1.5 focus-within:border-sky-500/30 transition-colors">
            <input
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveFood()}
              placeholder="—"
              className="flex-1 bg-transparent text-white text-[13px] font-mono focus:outline-none placeholder-zinc-700 min-w-0 w-0"
            />
            <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">g prot</span>
          </div>
          <button
            onClick={saveFood}
            disabled={!canSave}
            className={`flex-shrink-0 flex items-center justify-center px-3.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200 ${
              foodSaved
                ? 'bg-green-500/15 border border-green-500/25 text-green-400'
                : 'bg-white text-zinc-950 hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed'
            }`}
          >
            {foodSaved ? <CheckCircle2 size={13} /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Ask XODUS CTA */}
      <Link
        href="/xodus"
        className="flex items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] px-4 py-3.5 mb-2.5 hover:bg-sky-500/[0.09] transition-colors group"
      >
        <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-500/15 transition-colors">
          <Sparkles size={14} className="text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-sky-400 leading-none mb-0.5">Ask XODUS</p>
          <p className="text-[10px] text-zinc-600 font-mono">Dictate updates, attach screenshots, log anything</p>
        </div>
        <span className="text-zinc-700 text-[11px] flex-shrink-0">→</span>
      </Link>

      {/* Route action grid */}
      <div className="grid grid-cols-3 gap-2">
        {ROUTE_ACTIONS.map(({ href, icon: Icon, label, color, glow }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-2 rounded-xl border py-3.5 px-2 text-center transition-all duration-150 active:scale-[0.95] hover:brightness-125 ${glow}`}
          >
            <Icon size={15} className={color} />
            <span className={`text-[11px] font-semibold leading-none ${color}`}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

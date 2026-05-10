'use client'

import { useState, useEffect } from 'react'
import { JACKSON } from '@/lib/mock-data'
import type { StackItem, CompoundTiming } from '@/lib/mock-data'
import { getStorage, setStorage, STORAGE_KEYS, STORAGE_EVENTS, getTodayKey } from '@/lib/storage'

const STACK_RESET_KEY = 'picard_stack_reset_v1'

const CATEGORY_STYLES = {
  Performance: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  Recovery:    'text-cyan-400 bg-cyan-400/[0.07] border-cyan-400/15',
  Health:      'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Stimulant:   'text-pink-400 bg-pink-400/10 border-pink-400/20',
  Peptide:     'text-purple-400 bg-purple-400/[0.07] border-purple-400/15',
}

const TIMING_ORDER: CompoundTiming[] = ['AM', 'With meals', 'Pre-workout', 'PM', 'As needed']

function StackRow({
  item,
  onToggle,
}: {
  item: StackItem
  onToggle: (id: string) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] last:border-0 transition-opacity duration-200 ${
        item.takenToday ? 'opacity-100' : 'opacity-60'
      }`}
    >
      <button
        onClick={() => onToggle(item.id)}
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-200 ${
          item.takenToday
            ? 'bg-cyan-400/15 border-cyan-400/35'
            : 'bg-transparent border-white/20'
        }`}
        aria-label={item.takenToday ? 'Mark as not taken' : 'Mark as taken'}
      >
        {item.takenToday && (
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{item.name}</p>
          {item.notes && (
            <span className="text-[8px] text-zinc-700 truncate hidden sm:inline">{item.notes}</span>
          )}
        </div>
        <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{item.dose}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`text-[8px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${CATEGORY_STYLES[item.category]}`}
        >
          {item.category}
        </span>
      </div>
    </div>
  )
}

export default function StackPage() {
  const [items, setItems] = useState<StackItem[]>(JACKSON.stack)

  useEffect(() => {
    const today = getTodayKey()
    const lastReset = localStorage.getItem(STACK_RESET_KEY) ?? ''
    let saved = getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack)

    if (lastReset !== today) {
      saved = saved.map((item) => ({ ...item, takenToday: false }))
      setStorage(STORAGE_KEYS.STACK_STATE, saved)
      localStorage.setItem(STACK_RESET_KEY, today)
      window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.STACK_UPDATED))
    }

    setItems(saved)
  }, [])

  function toggle(id: string) {
    setItems((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, takenToday: !item.takenToday } : item))
      setStorage(STORAGE_KEYS.STACK_STATE, updated)
      return updated
    })
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.STACK_UPDATED))
  }

  const taken = items.filter((i) => i.takenToday).length
  const total = items.length

  const grouped = TIMING_ORDER.reduce<Record<string, StackItem[]>>((acc, timing) => {
    const group = items.filter((i) => i.timing === timing)
    if (group.length > 0) acc[timing] = group
    return acc
  }, {})

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-6 lg:px-10 border-b border-white/[0.05] overflow-hidden mb-4">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(236,72,153,0.07) 0%, rgba(34,211,238,0.02) 50%, transparent 70%)' }} />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Compounds</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">Daily Stack</h1>
        </div>
      </div>

      {/* Progress summary */}
      <div className="mx-4 mb-3 rounded-2xl bg-[#181818] border border-white/[0.06] px-4 py-3.5 card-elevated">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400 font-medium">{taken} of {total} taken today</span>
          <span className="text-xs font-mono text-pink-400">{Math.round((taken / total) * 100)}%</span>
        </div>
        <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(taken / total) * 100}%`, background: 'linear-gradient(to right, #22d3ee, #ec4899)' }}
          />
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mx-4 mb-3 text-[9px] text-zinc-700 font-mono leading-relaxed">
        This is a personal tracking tool only. Not medical advice. Consult a physician before adding any compound.
      </p>

      {/* Groups */}
      {Object.entries(grouped).map(([timing, group]) => (
        <div key={timing} className="mx-4 mt-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 mb-1.5 px-1">{timing}</p>
          <div className="rounded-2xl bg-[#181818] border border-white/[0.06] overflow-hidden card-elevated">
            {group.map((item) => (
              <StackRow key={item.id} item={item} onToggle={toggle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

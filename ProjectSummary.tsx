'use client'

import { useState, useEffect } from 'react'
import { JACKSON } from '@/lib/mock-data'
import type { StackItem, CompoundTiming } from '@/lib/mock-data'
import { getStorage, setStorage, STORAGE_KEYS, STORAGE_EVENTS, getTodayKey } from '@/lib/storage'

const STACK_RESET_KEY = 'picard_stack_reset_v1'

const CATEGORY_STYLES = {
  Performance: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Recovery: 'text-green-400 bg-green-400/10 border-green-400/20',
  Health: 'text-teal-400 bg-teal-400/10 border-teal-400/20',
  Stimulant: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Peptide: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
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
            ? 'bg-green-400/20 border-green-400/40'
            : 'bg-transparent border-white/20'
        }`}
        aria-label={item.takenToday ? 'Mark as not taken' : 'Mark as taken'}
      >
        {item.takenToday && (
          <div className="w-2 h-2 rounded-full bg-green-400" />
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
      <div className="px-4 pt-7 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-600">Compounds</p>
        <h1 className="text-2xl font-semibold text-white mt-1 tracking-tight">Daily Stack</h1>
      </div>

      {/* Progress summary */}
      <div className="mx-4 mb-3 rounded-xl bg-[#111] border border-white/10 px-4 py-3.5 card-elevated">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400 font-medium">{taken} of {total} taken today</span>
          <span className="text-xs font-mono text-zinc-600">{Math.round((taken / total) * 100)}%</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${(taken / total) * 100}%` }}
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
          <div className="rounded-xl bg-[#111] border border-white/10 overflow-hidden card-elevated">
            {group.map((item) => (
              <StackRow key={item.id} item={item} onToggle={toggle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

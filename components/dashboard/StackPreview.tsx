'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getStorage, STORAGE_KEYS, STORAGE_EVENTS } from '@/lib/storage'
import { JACKSON } from '@/lib/mock-data'
import type { StackItem } from '@/lib/mock-data'

const CATEGORY_COLORS: Record<string, string> = {
  Performance: 'text-cyan-400 bg-cyan-400/10',
  Recovery:    'text-cyan-400 bg-cyan-400/[0.07]',
  Health:      'text-purple-400 bg-purple-400/10',
  Stimulant:   'text-pink-400 bg-pink-400/10',
  Peptide:     'text-purple-400 bg-purple-400/[0.07]',
}

export default function StackPreview() {
  const [items, setItems] = useState<StackItem[]>([])

  function refresh() {
    setItems(getStorage<StackItem[]>(STORAGE_KEYS.STACK_STATE, JACKSON.stack))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
    return () => window.removeEventListener(STORAGE_EVENTS.STACK_UPDATED, refresh)
  }, [])

  const amStack = items.filter((s) => s.timing === 'AM' || s.timing === 'With meals')
  const taken = items.filter((s) => s.takenToday).length
  const total = items.length

  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-zinc-600">Daily Stack</span>
        <Link href="/stack" className="text-[9px] font-mono text-pink-400 hover:text-pink-300 transition-colors">
          {taken}/{total} taken →
        </Link>
      </div>

      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
        {amStack.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.takenToday ? 'bg-cyan-400/15' : 'bg-white/5'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  item.takenToday ? 'bg-cyan-400' : 'bg-zinc-700'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${item.takenToday ? 'text-white' : 'text-zinc-500'}`}>
                {item.name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[9px] font-mono text-zinc-700">{item.dose}</span>
              <span
                className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full uppercase tracking-wider ${CATEGORY_COLORS[item.category] ?? 'text-zinc-400 bg-zinc-400/10'}`}
              >
                {item.category}
              </span>
            </div>
          </div>
        ))}
        {amStack.length === 0 && (
          <div className="px-4 py-3">
            <p className="text-[11px] text-zinc-600">No AM compounds — <Link href="/stack" className="text-zinc-500 hover:text-zinc-300">view full stack →</Link></p>
          </div>
        )}
      </div>
    </div>
  )
}

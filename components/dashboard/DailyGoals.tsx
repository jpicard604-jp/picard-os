'use client'

import { useState, useEffect } from 'react'
import { Check, X, Plus, Loader2 } from 'lucide-react'
import {
  getTodayGoals, addGoals, toggleGoal, deleteGoal,
  type DailyGoal, type GoalCategory,
} from '@/lib/daily-goals'
import { saveNutritionProfile } from '@/lib/nutrition-profile'
import { intakeFromRuleParser, type XodusIntakeResult } from '@/lib/xodus/intake'

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  fitness:   'text-green-500',
  nutrition: 'text-amber-500',
  project:   'text-blue-400',
  school:    'text-purple-400',
  errand:    'text-orange-400',
  personal:  'text-pink-400',
  other:     'text-zinc-500',
}

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  fitness:   'FIT',
  nutrition: 'NUT',
  project:   'PROJ',
  school:    'SCH',
  errand:    'ERR',
  personal:  'SELF',
  other:     'OTH',
}

export default function DailyGoals() {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [goals, setGoals]       = useState<DailyGoal[]>([])
  const [input, setInput]       = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function refresh() {
    setGoals(getTodayGoals())
  }

  useEffect(() => {
    refresh()
    window.addEventListener('picard:goals-updated', refresh)
    return () => window.removeEventListener('picard:goals-updated', refresh)
  }, [])

  function applyResult(result: XodusIntakeResult, trimmed: string) {
    if (result.goals.length > 0) {
      addGoals(result.targetDate, result.goals)
    }

    if (result.nutritionUpdates) {
      saveNutritionProfile(result.nutritionUpdates)
    }

    const isToday = result.targetDate === todayStr
    const dateLabel = isToday ? '' : ` for ${result.targetDate}`
    const parts: string[] = []

    if (result.goals.length > 0) {
      parts.push(`${result.goals.length} goal${result.goals.length > 1 ? 's' : ''} added${dateLabel}`)
    }
    if (result.nutritionUpdates) {
      parts.push('nutrition updated')
    }
    if (result.source === 'ai') {
      parts.push('AI')
    }
    if (parts.length === 0 && trimmed) {
      parts.push('nothing extracted — try being more specific')
    }

    if (parts.length > 0) {
      setFeedback(parts.join(' · '))
      setTimeout(() => setFeedback(null), 3500)
    }

    if (isToday) refresh()
  }

  async function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setInput('')
    setIsLoading(true)

    let result: XodusIntakeResult

    try {
      const res = await fetch('/api/xodus/intake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: trimmed, date: todayStr }),
      })

      if (!res.ok) throw new Error('intake route error')

      const data = (await res.json()) as { ok: boolean; result: XodusIntakeResult }
      if (!data.ok || !data.result) throw new Error('invalid response')

      result = data.result
    } catch {
      result = intakeFromRuleParser(trimmed)
    } finally {
      setIsLoading(false)
    }

    applyResult(result, trimmed)
  }

  const doneCount = goals.filter(g => g.done).length
  const donePct   = goals.length > 0 ? Math.round((doneCount / goals.length) * 100) : 0

  return (
    <div className="rounded-2xl bg-[#111] border border-white/[0.07] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">Today's Goals</span>
        {goals.length > 0 && (
          <span className="text-[9px] font-mono text-zinc-600">{doneCount}/{goals.length} · {donePct}%</span>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !isLoading) handleSubmit() }}
          disabled={isLoading}
          placeholder={isLoading ? 'Parsing...' : 'train chest, finish parser, buy groceries...'}
          className={`flex-1 bg-[#0f0f0f] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] font-mono text-white placeholder-zinc-700 focus:outline-none focus:border-blue-500/40 min-w-0 transition-opacity ${isLoading ? 'opacity-40' : ''}`}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`flex-shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
            isLoading
              ? 'bg-blue-500/5 border-blue-500/10 text-blue-500/30 cursor-wait'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
          }`}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </div>

      {feedback && (
        <p className="text-[9px] font-mono text-cyan-600">{feedback}</p>
      )}

      {goals.length > 0 ? (
        <div className="space-y-1.5">
          {goals.map(goal => (
            <div key={goal.id} className="flex items-start gap-2 group">
              <button
                onClick={() => { toggleGoal(todayStr, goal.id); refresh() }}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                  goal.done
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'border-white/[0.1] text-transparent hover:border-white/20'
                }`}
              >
                <Check size={9} />
              </button>
              <span className={`flex-1 text-[11px] font-mono leading-snug ${goal.done ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                {goal.text}
              </span>
              <span className={`text-[7px] font-mono ${CATEGORY_COLORS[goal.category]} mt-0.5 flex-shrink-0`}>
                {CATEGORY_LABELS[goal.category]}
              </span>
              <button
                onClick={() => { deleteGoal(todayStr, goal.id); refresh() }}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-400 transition-all mt-0.5"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-mono text-zinc-700">No goals set — type above, separate with commas</p>
      )}
    </div>
  )
}

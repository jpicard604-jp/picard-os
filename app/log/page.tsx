'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  getStorage,
  setStorage,
  getTodayKey,
  emptyLog,
  saveTodayLog,
  STORAGE_KEYS,
} from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'
import { JACKSON } from '@/lib/mock-data'

function NumInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  unit,
  decimal,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  hint?: string
  unit?: string
  decimal?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</label>
        {hint && <span className="text-[9px] text-zinc-700 font-mono">{hint}</span>}
      </div>
      <div className="flex items-center gap-2 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 focus-within:border-blue-500/30 transition-colors">
        <input
          type="number"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={placeholder ?? '—'}
          className="flex-1 bg-transparent text-white text-base font-mono focus:outline-none placeholder-zinc-700 min-w-0"
        />
        {unit && <span className="text-xs text-zinc-600 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
  trueLabel = 'Yes',
  falseLabel = 'No',
  trueColor = 'bg-red-500/15 border-red-500/30 text-red-400',
  falseColor = 'bg-green-500/15 border-green-500/30 text-green-400',
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
  trueLabel?: string
  falseLabel?: string
  trueColor?: string
  falseColor?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">{label}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
            value ? trueColor : 'border-white/10 text-zinc-700 bg-transparent'
          }`}
        >
          {trueLabel}
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
            !value ? falseColor : 'border-white/10 text-zinc-700 bg-transparent'
          }`}
        >
          {falseLabel}
        </button>
      </div>
    </div>
  )
}

function ConfidencePicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
        Confidence Score
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-semibold border transition-all duration-150 ${
              value === n
                ? n >= 8
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : n >= 6
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'border-white/10 text-zinc-700 bg-transparent'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LogPage() {
  const [form, setForm] = useState<DailyLog>(emptyLog(getTodayKey()))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const all = getStorage<Record<string, DailyLog>>(STORAGE_KEYS.DAILY_LOGS, {})
    const existing = all[getTodayKey()]
    if (existing) setForm(existing)
  }, [])

  function update<K extends keyof DailyLog>(key: K, value: DailyLog[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function save() {
    const log: DailyLog = { ...form, savedAt: new Date().toISOString() }
    saveTodayLog(log)
    setForm(log)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const { protein, calories, screenTime } = JACKSON.today.nutrition
    ? {
        protein: JACKSON.today.nutrition.protein,
        calories: JACKSON.today.nutrition.calories,
        screenTime: JACKSON.today.screenTime,
      }
    : { protein: { target: 180 }, calories: { target: 2500 }, screenTime: { target: 2 } }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-7 pb-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-600">Daily Check-In</p>
        <h1 className="text-2xl font-semibold text-white mt-1 tracking-tight">Log Today</h1>
        <p className="text-xs text-zinc-600 mt-1 font-mono">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* NUTRITION */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Nutrition</p>
        <div className="rounded-2xl bg-[#111] border border-white/10 p-4 card-elevated space-y-3">
          <NumInput
            label="Calories"
            value={form.calories}
            onChange={(v) => update('calories', v)}
            placeholder="0"
            hint={`target ${calories.target.toLocaleString()}`}
            unit="kcal"
          />
          <NumInput
            label="Protein"
            value={form.protein}
            onChange={(v) => update('protein', v)}
            placeholder="0"
            hint={`target ${protein.target}g`}
            unit="g"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumInput
              label="Body Weight"
              value={form.weight}
              onChange={(v) => update('weight', v)}
              placeholder="180"
              unit="lb"
              decimal
            />
            <NumInput
              label="Water"
              value={form.water}
              onChange={(v) => update('water', v)}
              placeholder="0"
              unit="glasses"
            />
          </div>
        </div>
      </div>

      {/* TIME */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Time</p>
        <div className="rounded-2xl bg-[#111] border border-white/10 p-4 card-elevated space-y-3">
          <NumInput
            label="Screen Time"
            value={form.screenTime}
            onChange={(v) => update('screenTime', v)}
            placeholder="0.0"
            hint={`target ${JACKSON.today.screenTime.target}h`}
            unit="hours"
            decimal
          />
          <NumInput
            label="Instagram Time"
            value={form.instagramTime}
            onChange={(v) => update('instagramTime', v)}
            placeholder="0.0"
            unit="hours"
            decimal
          />
        </div>
      </div>

      {/* HABITS */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Habits</p>
        <div className="rounded-2xl bg-[#111] border border-white/10 p-4 card-elevated space-y-4">
          <Toggle
            label="Smoked Today"
            value={form.smokedToday}
            onChange={(v) => update('smokedToday', v)}
            trueLabel="Yes"
            falseLabel="No"
            trueColor="bg-red-500/15 border-red-500/30 text-red-400"
            falseColor="bg-green-500/15 border-green-500/30 text-green-400"
          />
          <Toggle
            label="Drank Alcohol Today"
            value={form.drankToday}
            onChange={(v) => update('drankToday', v)}
            trueLabel="Yes"
            falseLabel="No — streak continues"
            trueColor="bg-red-500/15 border-red-500/30 text-red-400"
            falseColor="bg-green-500/15 border-green-500/30 text-green-400"
          />
        </div>
      </div>

      {/* MENTAL */}
      <div className="mx-4 mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Mental</p>
        <div className="rounded-2xl bg-[#111] border border-white/10 p-4 card-elevated space-y-4">
          <ConfidencePicker
            value={form.confidenceScore}
            onChange={(v) => update('confidenceScore', v)}
          />
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="What's going on today? What matters most?"
              rows={4}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-blue-500/30 transition-colors resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mx-4 mt-2">
        <button
          onClick={save}
          className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            saved
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {saved ? (
            <>
              <CheckCircle2 size={16} />
              Saved — XODUS updated
            </>
          ) : (
            'Save Log'
          )}
        </button>
        <p className="text-[9px] text-zinc-700 font-mono text-center mt-2">
          Saved locally. XODUS reads this to personalize your daily brief.
        </p>
      </div>
    </div>
  )
}

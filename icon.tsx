'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  getStorage,
  getTodayKey,
  emptyLog,
  saveTodayLog,
  STORAGE_KEYS,
} from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'
import { JACKSON } from '@/lib/mock-data'

/* ─── Shared field wrapper ───────────────────────────────────────────────────── */
function FieldWrap({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[11px] font-medium text-zinc-400 tracking-wide">{label}</label>
        {hint && <span className="text-[10px] text-zinc-600 font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function NumInput({
  label, value, onChange, placeholder, hint, unit, decimal,
}: {
  label: string; value: number | null; onChange: (v: number | null) => void
  placeholder?: string; hint?: string; unit?: string; decimal?: boolean
}) {
  return (
    <FieldWrap label={label} hint={hint}>
      <div className="flex items-center gap-2 bg-[--surface-raised] border border-white/[0.09] rounded-xl px-4 py-3.5 focus-within:border-sky-500/35 transition-colors">
        <input
          type="number"
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={placeholder ?? '—'}
          className="flex-1 bg-transparent text-white text-[15px] font-mono focus:outline-none placeholder-zinc-700 min-w-0"
        />
        {unit && <span className="text-[11px] text-zinc-600 font-mono flex-shrink-0">{unit}</span>}
      </div>
    </FieldWrap>
  )
}

function Toggle({
  label, value, onChange, trueLabel = 'Yes', falseLabel = 'No',
  trueColor = 'bg-red-500/12 border-red-500/25 text-red-300',
  falseColor = 'bg-green-500/12 border-green-500/25 text-green-300',
}: {
  label: string; value: boolean; onChange: (v: boolean) => void
  trueLabel?: string; falseLabel?: string; trueColor?: string; falseColor?: string
}) {
  return (
    <FieldWrap label={label}>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-3 rounded-xl border text-[13px] font-medium transition-all duration-150 ${
            value ? trueColor : 'border-white/[0.07] text-zinc-600 bg-transparent hover:border-white/[0.12] hover:text-zinc-400'
          }`}
        >
          {trueLabel}
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-3 rounded-xl border text-[13px] font-medium transition-all duration-150 ${
            !value ? falseColor : 'border-white/[0.07] text-zinc-600 bg-transparent hover:border-white/[0.12] hover:text-zinc-400'
          }`}
        >
          {falseLabel}
        </button>
      </div>
    </FieldWrap>
  )
}

function ScorePicker({
  label, value, onChange, max = 10, colorThresholds,
}: {
  label: string; value: number | null; onChange: (v: number) => void
  max?: number; colorThresholds?: { high: number; mid: number }
}) {
  const t = colorThresholds ?? { high: Math.round(max * 0.8), mid: Math.round(max * 0.6) }
  return (
    <FieldWrap label={label}>
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-xl text-[12px] font-mono font-semibold border transition-all duration-150 ${
              value === n
                ? n >= t.high
                  ? 'bg-green-500/15 border-green-500/35 text-green-300'
                  : n >= t.mid
                  ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                  : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                : 'border-white/[0.07] text-zinc-700 bg-transparent hover:border-white/[0.12] hover:text-zinc-500'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </FieldWrap>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-4">
      <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-[0.08em] mb-2.5 px-1">{title}</p>
      <div className="rounded-2xl bg-[--surface] border border-white/[0.06] p-5 card-elevated space-y-4">
        {children}
      </div>
    </div>
  )
}

export default function DailyPage() {
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

  const mockProteinTarget = JACKSON.today.nutrition.protein.target
  const mockCalTarget = JACKSON.today.nutrition.calories.target
  const screenTarget = JACKSON.today.screenTime.target

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(59,130,246,0.04) 0%, transparent 60%)' }}
        />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Daily Check-In</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none mb-2">
            Daily Log
          </h1>
          <p className="text-[13px] text-zinc-500 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="pt-5">
        <Section title="Body">
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Body Weight" value={form.weight} onChange={(v) => update('weight', v)}
              placeholder="180" unit="lb" decimal />
            <NumInput label="Sleep" value={form.sleepHours} onChange={(v) => update('sleepHours', v)}
              placeholder="7.5" unit="hrs" decimal />
          </div>
          <NumInput label="Steps Today" value={form.steps} onChange={(v) => update('steps', v)}
            placeholder="0" unit="steps" />
        </Section>

        <Section title="Nutrition">
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Calories" value={form.calories} onChange={(v) => update('calories', v)}
              placeholder="0" unit="kcal" />
            <NumInput label="Cal Target" value={form.calorieTarget} onChange={(v) => update('calorieTarget', v)}
              placeholder={String(mockCalTarget)} unit="kcal" hint={`default ${mockCalTarget}`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Protein" value={form.protein} onChange={(v) => update('protein', v)}
              placeholder="0" unit="g" />
            <NumInput label="Protein Target" value={form.proteinTarget} onChange={(v) => update('proteinTarget', v)}
              placeholder={String(mockProteinTarget)} unit="g" hint={`default ${mockProteinTarget}g`} />
          </div>
          <NumInput label="Water" value={form.water} onChange={(v) => update('water', v)}
            placeholder="0" unit="glasses" />
        </Section>

        <Section title="Screen Time">
          <NumInput label="Total Screen Time" value={form.screenTime} onChange={(v) => update('screenTime', v)}
            placeholder="0.0" hint={`target ${screenTarget}h`} unit="hours" decimal />
          <NumInput label="Instagram Time" value={form.instagramTime} onChange={(v) => update('instagramTime', v)}
            placeholder="0.0" unit="hours" decimal />
        </Section>

        <Section title="Habits">
          <Toggle label="Smoked Today" value={form.smokedToday} onChange={(v) => update('smokedToday', v)} />
          <Toggle label="Drank Alcohol Today" value={form.drankToday} onChange={(v) => update('drankToday', v)}
            falseLabel="No — streak continues" />
        </Section>

        <Section title="Mental">
          <ScorePicker label="Mood / Energy (1–5)" value={form.mood} onChange={(v) => update('mood', v)}
            max={5} colorThresholds={{ high: 4, mid: 3 }} />
          <ScorePicker label="Confidence (1–10)" value={form.confidenceScore} onChange={(v) => update('confidenceScore', v)}
            max={10} />
          <FieldWrap label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="What's on your mind today?"
              rows={4}
              className="w-full bg-[--surface-raised] border border-white/[0.09] rounded-xl px-4 py-3.5 text-[14px] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-sky-500/35 transition-colors resize-none leading-relaxed"
            />
          </FieldWrap>
        </Section>

        {/* Save */}
        <div className="mx-4 mt-1">
          <button
            onClick={save}
            className={`w-full py-4 rounded-2xl text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-2 tracking-wide ${
              saved
                ? 'bg-green-500/12 border border-green-500/25 text-green-300'
                : 'bg-white text-zinc-950 hover:bg-zinc-100 active:scale-[0.99]'
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
          <p className="text-[9px] text-zinc-700 font-mono text-center mt-3">
            Saved locally · XODUS reads this to personalize your daily brief
          </p>
        </div>
      </div>
    </div>
  )
}

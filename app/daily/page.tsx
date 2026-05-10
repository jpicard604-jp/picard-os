'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Activity, Droplets, Monitor, Leaf, Brain, Sparkles, Heart } from 'lucide-react'
import {
  getStorage,
  getTodayKey,
  emptyLog,
  saveTodayLog,
  STORAGE_KEYS,
} from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'

/* ─── Field wrapper ─────────────────────────────────────────────────────────── */
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
      <div className="flex items-center gap-2 bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-3.5 focus-within:border-pink-500/30 transition-colors">
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
  trueColor = 'bg-pink-500/12 border-pink-500/25 text-pink-300',
  falseColor = 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300',
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
                  ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                  : n >= t.mid
                  ? 'bg-pink-500/15 border-pink-500/35 text-pink-300'
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

/* ─── Section ───────────────────────────────────────────────────────────────── */
function Section({
  title, icon, children, completion,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  completion?: { filled: number; total: number }
}) {
  const pct = completion ? Math.round((completion.filled / completion.total) * 100) : null
  const complete = pct === 100

  return (
    <div className="mx-4 mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          {icon && <span className="opacity-70">{icon}</span>}
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.1em]">{title}</p>
        </div>
        {completion && (
          <span className={`text-[9px] font-mono tabular-nums transition-colors ${complete ? 'text-cyan-400' : 'text-zinc-700'}`}>
            {completion.filled}/{completion.total}
          </span>
        )}
      </div>

      <div className="rounded-2xl bg-[--surface] border border-white/[0.06] overflow-hidden card-elevated">
        {/* Completion accent line */}
        {pct !== null && (
          <div className="h-[2px] w-full">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: complete
                  ? 'linear-gradient(to right, #22d3ee, #ec4899)'
                  : 'rgba(168,85,247,0.45)',
              }}
            />
          </div>
        )}
        <div className="p-5 space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── XODUS insight ─────────────────────────────────────────────────────────── */
function getInsight(form: DailyLog): string {
  if (form.smokedToday) return 'Smoking flagged — XODUS will adjust your weekly discipline trajectory accordingly.'
  if (form.sleepHours !== null && form.sleepHours !== undefined && form.sleepHours < 6) {
    return `Only ${form.sleepHours}h of sleep. Scale back intensity today and protect tonight's recovery window.`
  }
  if (form.mood !== null && form.mood !== undefined && form.mood >= 4 &&
      form.confidenceScore !== null && form.confidenceScore !== undefined && form.confidenceScore >= 8) {
    return 'High mood + confidence today. Ideal state for demanding creative or strategic work — use it.'
  }
  const calTarget = form.calorieTarget ?? 2500
  if (form.calories !== null && form.calories !== undefined && form.calories > calTarget * 1.1) {
    return 'Calories tracking above target. One adjusted meal tonight keeps your weekly average on track.'
  }
  if (form.protein !== null && form.protein !== undefined &&
      form.proteinTarget !== null && form.proteinTarget !== undefined &&
      form.protein >= form.proteinTarget) {
    return 'Protein target hit. Muscle protein synthesis is covered — recovery is on track for today.'
  }
  if (form.steps !== null && form.steps !== undefined && form.steps >= 10000) {
    return `${form.steps.toLocaleString()} steps logged. Strong movement day — this compounds over weeks.`
  }
  return 'Complete your log for XODUS\'s most accurate daily brief and personalized recommendations.'
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
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

  const mockProteinTarget = 180
  const mockCalTarget = 2500
  const screenTarget = 2
  const calTarget = form.calorieTarget ?? mockCalTarget

  const calPct = form.calories && calTarget ? Math.min(110, Math.round((form.calories / calTarget) * 100)) : 0
  const insight = getInsight(form)

  const bodyFilled = [form.weight, form.sleepHours, form.sleepQuality, form.steps].filter((v) => v !== null && v !== undefined).length
  const nutritionFilled = [form.calories, form.protein, form.water].filter((v) => v !== null && v !== undefined).length
  const screenFilled = [form.screenTime, form.instagramTime].filter((v) => v !== null && v !== undefined).length
  const recoveryFilled = [form.recoveryScore, form.hrv, form.restingHR, form.strain].filter((v) => v !== null && v !== undefined).length
  const mentalFilled = [
    form.mood,
    form.confidenceScore,
    form.notes?.trim() ? 1 : null,
  ].filter((v) => v !== null && v !== undefined).length

  const sleepColor = form.sleepHours === null || form.sleepHours === undefined
    ? 'text-zinc-700'
    : form.sleepHours >= 7 ? 'text-cyan-400' : form.sleepHours >= 6 ? 'text-purple-400' : 'text-pink-400'

  const moodColor = form.mood === null || form.mood === undefined
    ? 'text-zinc-700'
    : form.mood >= 4 ? 'text-cyan-400' : form.mood >= 3 ? 'text-purple-400' : 'text-pink-400'

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-6 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(236,72,153,0.07) 0%, rgba(34,211,238,0.03) 50%, transparent 70%)' }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Daily Check-In</p>
            <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">
              Daily Log
            </h1>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono pb-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Live snapshot bar */}
      <div className="mx-4 mt-4 mb-1 grid grid-cols-4 gap-2">
        {([
          {
            label: 'Weight',
            display: form.weight ? `${form.weight}` : '—',
            unit: form.weight ? 'lb' : '',
            color: form.weight ? 'text-cyan-400' : 'text-zinc-700',
          },
          {
            label: 'Sleep',
            display: form.sleepHours ? `${form.sleepHours}` : '—',
            unit: form.sleepHours ? 'h' : '',
            color: sleepColor,
          },
          {
            label: 'Calories',
            display: form.calories ? `${form.calories}` : '—',
            unit: '',
            color: form.calories ? 'text-pink-400' : 'text-zinc-700',
          },
          {
            label: 'Mood',
            display: form.mood ? `${form.mood}/5` : '—',
            unit: '',
            color: moodColor,
          },
        ] as const).map(({ label, display, unit, color }) => (
          <div key={label} className="rounded-xl bg-[--surface] border border-white/[0.06] px-3 py-2.5 text-center">
            <p className={`text-[15px] font-mono font-bold leading-none ${color}`}>
              {display}
              {unit && <span className="text-[8px] text-zinc-700 ml-0.5 font-normal">{unit}</span>}
            </p>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="pt-3">
        {/* Body */}
        <Section
          title="Body"
          icon={<Activity size={11} className="text-cyan-400" />}
          completion={{ filled: bodyFilled, total: 4 }}
        >
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Body Weight" value={form.weight} onChange={(v) => update('weight', v)}
              placeholder="180" unit="lb" decimal />
            <NumInput label="Sleep Hours" value={form.sleepHours} onChange={(v) => update('sleepHours', v)}
              placeholder="7.5" unit="hrs" decimal />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Sleep Quality" value={form.sleepQuality} onChange={(v) => update('sleepQuality', v)}
              placeholder="0–100" unit="%" />
            <NumInput label="Steps Today" value={form.steps} onChange={(v) => update('steps', v)}
              placeholder="0" unit="steps" />
          </div>
        </Section>

        {/* Recovery */}
        <Section
          title="Recovery"
          icon={<Heart size={11} className="text-cyan-400" />}
          completion={{ filled: recoveryFilled, total: 4 }}
        >
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Recovery Score" value={form.recoveryScore} onChange={(v) => update('recoveryScore', v)}
              placeholder="0–100" unit="%" />
            <NumInput label="HRV" value={form.hrv} onChange={(v) => update('hrv', v)}
              placeholder="0" unit="ms" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Resting HR" value={form.restingHR} onChange={(v) => update('restingHR', v)}
              placeholder="0" unit="bpm" />
            <NumInput label="Strain" value={form.strain} onChange={(v) => update('strain', v)}
              placeholder="0–21" unit="/21" decimal />
          </div>
          <div className="flex items-start gap-2 px-1">
            <p className="text-[10px] text-zinc-700 font-mono leading-relaxed">
              Enter WHOOP or Apple Health values. These power recovery rings on the dashboard and XODUS coaching.
            </p>
          </div>
        </Section>

        {/* Nutrition */}
        <Section
          title="Nutrition"
          icon={<Droplets size={11} className="text-pink-400" />}
          completion={{ filled: nutritionFilled, total: 3 }}
        >
          {/* Calorie progress bar */}
          <div className="bg-[--surface-raised] rounded-xl px-4 py-3 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono text-zinc-600">Calories vs Target</p>
              <p className="text-[10px] font-mono">
                <span className={calPct >= 90 ? 'text-cyan-400 font-semibold' : 'text-white'}>
                  {form.calories ?? 0}
                </span>
                <span className="text-zinc-700"> / {calTarget} kcal</span>
              </p>
            </div>
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, calPct)}%`,
                  background: calPct >= 110
                    ? '#ec4899'
                    : calPct >= 90
                    ? '#22d3ee'
                    : 'rgba(168,85,247,0.6)',
                }}
              />
            </div>
          </div>

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

        {/* Screen Time */}
        <Section
          title="Screen Time"
          icon={<Monitor size={11} className="text-purple-400" />}
          completion={{ filled: screenFilled, total: 2 }}
        >
          <NumInput label="Total Screen Time" value={form.screenTime} onChange={(v) => update('screenTime', v)}
            placeholder="0.0" hint={`target ${screenTarget}h`} unit="hours" decimal />
          <NumInput label="Instagram Time" value={form.instagramTime} onChange={(v) => update('instagramTime', v)}
            placeholder="0.0" unit="hours" decimal />
        </Section>

        {/* Habits */}
        <Section
          title="Habits"
          icon={<Leaf size={11} className="text-cyan-400" />}
        >
          <Toggle label="Smoked Today" value={form.smokedToday} onChange={(v) => update('smokedToday', v)} />
          <Toggle
            label="Drank Alcohol Today"
            value={form.drankToday}
            onChange={(v) => update('drankToday', v)}
            falseLabel="No — streak continues"
          />
        </Section>

        {/* Mental */}
        <Section
          title="Mental"
          icon={<Brain size={11} className="text-pink-400" />}
          completion={{ filled: mentalFilled, total: 3 }}
        >
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
              className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[14px] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors resize-none leading-relaxed"
            />
          </FieldWrap>
        </Section>

        {/* XODUS insight card */}
        <div className="mx-4 mb-4 rounded-2xl border border-pink-500/[0.15] bg-[--surface] px-4 py-4 flex items-start gap-3 card-elevated">
          <div className="w-7 h-7 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles size={12} className="text-pink-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-pink-400/70 mb-1.5">XODUS Insight</p>
            <p className="text-[12px] text-zinc-400 leading-relaxed">{insight}</p>
          </div>
        </div>

        {/* Save */}
        <div className="mx-4">
          <button
            onClick={save}
            className={`w-full py-4 rounded-2xl text-[14px] font-semibold transition-all duration-300 flex items-center justify-center gap-2 tracking-wide ${
              saved
                ? 'bg-cyan-500/12 border border-cyan-500/25 text-cyan-300'
                : 'bg-gradient-to-r from-pink-500 to-cyan-400 text-white hover:opacity-90 active:scale-[0.99]'
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

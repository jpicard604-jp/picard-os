'use client'

import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, Trash2, CheckCircle2 } from 'lucide-react'
import {
  getActivityLogs,
  addActivityLog,
  getThisWeekLogs,
  getExerciseHistory,
  getUniqueExercises,
  suggestNextWeight,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
} from '@/lib/fitness'
import type { ActivityLog, ActivityType, ExerciseSet } from '@/lib/fitness'
import { STORAGE_EVENTS, getTodayLog } from '@/lib/storage'
import type { DailyLog } from '@/lib/storage'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  type: ActivityType
  label: string
  duration: string
  distance: string
  steps: string
  rpe: string
  notes: string
  exercises: Array<{ exercise: string; sets: string; reps: string; weight: string; weightUnit: 'lb' | 'kg' | 'bw' }>
}

const EMPTY_FORM: FormState = {
  type: 'strength',
  label: '',
  duration: '',
  distance: '',
  steps: '',
  rpe: '',
  notes: '',
  exercises: [],
}

const CARDIO_TYPES: ActivityType[] = ['run', 'row', 'walk', 'swim', 'bike', 'hiit']
const STRENGTH_TYPE: ActivityType[] = ['strength']
const ALL_TYPES: ActivityType[] = ['strength', 'run', 'row', 'walk', 'swim', 'bike', 'recovery', 'mobility', 'hiit', 'custom']

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72
  const h = 22
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  const last = data[data.length - 1]
  const lastX = w
  const lastY = h - ((last - min) / range) * (h - 4) - 2
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}

// ─── Week Summary ──────────────────────────────────────────────────────────────

function WeekSummary({ logs }: { logs: ActivityLog[] }) {
  const strength = logs.filter((l) => l.type === 'strength').length
  const runDist = logs.filter((l) => l.type === 'run').reduce((s, l) => s + (l.distance ?? 0), 0)
  const rowMin = logs.filter((l) => l.type === 'row').reduce((s, l) => s + (l.duration ?? 0), 0)
  const totalSteps = logs.reduce((s, l) => s + (l.steps ?? 0), 0)
  const stats = [
    { label: 'Sessions', value: `${logs.length}`, sub: `${strength} strength` },
    { label: 'Run', value: runDist > 0 ? `${runDist.toFixed(1)}mi` : '—', sub: 'this week' },
    { label: 'Row', value: rowMin > 0 ? `${rowMin}min` : '—', sub: 'this week' },
    { label: 'Steps', value: totalSteps > 0 ? `${(totalSteps / 1000).toFixed(1)}k` : '—', sub: 'from workouts' },
  ]
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-[#181818] border border-white/[0.06] p-4 card-elevated">
      <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-3">This Week</p>
      <div className="grid grid-cols-4 gap-2">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="text-center">
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700">{label}</p>
            <p className="text-base font-mono font-bold text-white mt-1 leading-none">{value}</p>
            <p className="text-[8px] text-zinc-700 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Log Activity Form ─────────────────────────────────────────────────────────

function LogActivityForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function addExercise() {
    setForm((p) => ({
      ...p,
      exercises: [...p.exercises, { exercise: '', sets: '', reps: '', weight: '', weightUnit: 'lb' }],
    }))
  }

  function updateExercise(i: number, k: string, v: string) {
    setForm((p) => {
      const exs = [...p.exercises]
      exs[i] = { ...exs[i], [k]: v }
      return { ...p, exercises: exs }
    })
  }

  function removeExercise(i: number) {
    setForm((p) => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }))
  }

  function save() {
    const isStrength = STRENGTH_TYPE.includes(form.type)
    const exercises: ExerciseSet[] = isStrength
      ? form.exercises
          .filter((e) => e.exercise.trim())
          .map((e) => ({
            exercise: e.exercise.trim(),
            sets: e.sets ? Number(e.sets) : undefined,
            reps: e.reps ? Number(e.reps) : undefined,
            weight: e.weight ? Number(e.weight) : undefined,
            weightUnit: e.weightUnit,
          }))
      : []

    const entry: ActivityLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: form.type,
      label: form.label.trim() || undefined,
      duration: form.duration ? Number(form.duration) : undefined,
      distance: form.distance ? Number(form.distance) : undefined,
      distanceUnit: 'miles',
      steps: form.steps ? Number(form.steps) : undefined,
      rpe: form.rpe ? Number(form.rpe) : undefined,
      notes: form.notes.trim() || undefined,
      exercises: exercises.length > 0 ? exercises : undefined,
      source: 'manual',
      createdAt: new Date().toISOString(),
    }

    addActivityLog(entry)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setOpen(false)
      setForm(EMPTY_FORM)
      onSaved()
    }, 1200)
  }

  const showDistance = CARDIO_TYPES.includes(form.type)
  const showSteps = ['run', 'walk', 'hiit', 'custom'].includes(form.type)
  const showExercises = STRENGTH_TYPE.includes(form.type)

  return (
    <div className="mx-4 mt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-cyan-400 text-white text-sm font-semibold hover:opacity-90 transition-all"
        >
          <Plus size={16} />
          Log Activity
        </button>
      ) : (
        <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4 card-elevated space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">New Activity</p>
            <button onClick={() => setOpen(false)} className="text-zinc-700 hover:text-zinc-400 transition-colors">
              <ChevronUp size={16} />
            </button>
          </div>

          {/* Type picker */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map((t) => {
                const c = ACTIVITY_TYPE_COLORS[t]
                return (
                  <button
                    key={t}
                    onClick={() => set('type', t)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all ${
                      form.type === t ? `${c.bg} ${c.border} ${c.text}` : 'border-white/[0.08] text-zinc-700'
                    }`}
                  >
                    {ACTIVITY_TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Label */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Label (optional)</p>
            <input
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder={`e.g. Upper — Chest & Back`}
              className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors"
            />
          </div>

          {/* Duration + Distance/RPE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Duration (min)</p>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => set('duration', e.target.value)}
                placeholder="45"
                className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors"
              />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                {showDistance ? 'Distance (mi)' : 'RPE (1–10)'}
              </p>
              <input
                type="number"
                value={showDistance ? form.distance : form.rpe}
                onChange={(e) => showDistance ? set('distance', e.target.value) : set('rpe', e.target.value)}
                placeholder={showDistance ? '3.1' : '7'}
                className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Steps (cardio/walk/run/custom) */}
          {showSteps && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Steps</p>
              <input
                type="number"
                value={form.steps}
                onChange={(e) => set('steps', e.target.value)}
                placeholder="8000"
                className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors"
              />
            </div>
          )}

          {/* Exercise builder */}
          {showExercises && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Exercises</p>
                <button
                  onClick={addExercise}
                  className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Plus size={11} />
                  Add
                </button>
              </div>
              {form.exercises.length === 0 && (
                <p className="text-[10px] text-zinc-700 font-mono py-2">No exercises added — tap Add to log sets.</p>
              )}
              {form.exercises.map((ex, i) => (
                <div key={i} className="mb-2 bg-[--surface-raised] rounded-xl border border-white/[0.08] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={ex.exercise}
                      onChange={(e) => updateExercise(i, 'exercise', e.target.value)}
                      placeholder="Exercise name"
                      className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none"
                    />
                    <button onClick={() => removeExercise(i)} className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'sets', placeholder: 'Sets', label: 'Sets' },
                      { key: 'reps', placeholder: 'Reps', label: 'Reps' },
                      { key: 'weight', placeholder: 'Wt', label: 'Weight' },
                    ].map(({ key, placeholder }) => (
                      <input
                        key={key}
                        type="number"
                        value={(ex as Record<string, string>)[key]}
                        onChange={(e) => updateExercise(i, key, e.target.value)}
                        placeholder={placeholder}
                        className="bg-[--surface-raised] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none text-center"
                      />
                    ))}
                    <select
                      value={ex.weightUnit}
                      onChange={(e) => updateExercise(i, 'weightUnit', e.target.value)}
                      className="bg-[--surface-raised] border border-white/[0.08] rounded-lg px-1 py-1.5 text-xs text-zinc-400 focus:outline-none"
                    >
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                      <option value="bw">bw</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">Notes</p>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="How did it feel?"
              rows={2}
              className="w-full bg-[--surface-raised] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/30 transition-colors resize-none"
            />
          </div>

          {/* Save button */}
          <button
            onClick={save}
            disabled={saved}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              saved
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-gradient-to-r from-pink-500 to-cyan-400 text-white hover:opacity-90'
            }`}
          >
            {saved ? (
              <>
                <CheckCircle2 size={15} />
                Saved
              </>
            ) : (
              'Save Activity'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({ log }: { log: ActivityLog }) {
  const [expanded, setExpanded] = useState(false)
  const c = ACTIVITY_TYPE_COLORS[log.type]
  const hasExercises = log.exercises && log.exercises.length > 0

  return (
    <div className="rounded-xl bg-[#181818] border border-white/[0.06] p-3.5 mb-2">
      <div
        className="flex items-center justify-between"
        onClick={() => hasExercises && setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text} flex-shrink-0`}>
            {ACTIVITY_TYPE_LABELS[log.type]}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {log.label ?? ACTIVITY_TYPE_LABELS[log.type]}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {log.duration && <span className="text-[10px] font-mono text-zinc-600">{log.duration}min</span>}
          {log.distance && <span className="text-[10px] font-mono text-zinc-600">{log.distance}mi</span>}
          {log.rpe && <span className="text-[10px] font-mono text-zinc-700">RPE {log.rpe}</span>}
          {hasExercises && (
            expanded ? <ChevronUp size={14} className="text-zinc-600" /> : <ChevronDown size={14} className="text-zinc-600" />
          )}
        </div>
      </div>

      {expanded && hasExercises && (
        <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
          {log.exercises!.map((ex, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">{ex.exercise}</span>
              <span className="text-[10px] font-mono text-zinc-600">
                {ex.sets && `${ex.sets}×`}{ex.reps}{ex.weight && ` @ ${ex.weight}${ex.weightUnit ?? 'lb'}`}
                {ex.notes && ` · ${ex.notes}`}
              </span>
            </div>
          ))}
          {log.notes && <p className="text-[10px] text-zinc-700 mt-1.5 italic">{log.notes}</p>}
        </div>
      )}

      {!hasExercises && log.notes && (
        <p className="text-[10px] text-zinc-700 mt-2 italic">{log.notes}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        {log.source !== 'manual' && (
          <span className="text-[8px] font-mono text-zinc-700 uppercase">{log.source}</span>
        )}
        {log.steps && (
          <span className="text-[9px] font-mono text-zinc-700">{log.steps.toLocaleString()} steps</span>
        )}
      </div>
    </div>
  )
}

// ─── Activity History ──────────────────────────────────────────────────────────

function ActivityHistory({ logs }: { logs: ActivityLog[] }) {
  const grouped = logs.reduce<Record<string, ActivityLog[]>>((acc, l) => {
    if (!acc[l.date]) acc[l.date] = []
    acc[l.date].push(l)
    return acc
  }, {})

  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a)).slice(0, 14)

  if (dates.length === 0) {
    return (
      <div className="mx-4 mt-3 rounded-2xl bg-[#181818] border border-white/[0.06] p-5 card-elevated text-center">
        <p className="text-sm text-zinc-600">No activities logged yet.</p>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Activity History</p>
      <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4 card-elevated">
        {dates.map((date) => {
          const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <div key={date} className="mb-4 last:mb-0">
              <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-2">{label}</p>
              {grouped[date].map((log) => (
                <ActivityCard key={log.id} log={log} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Progressive Overload ──────────────────────────────────────────────────────

function ProgressiveOverload({ logs }: { logs: ActivityLog[] }) {
  const exercises = getUniqueExercises(logs)
  const withHistory = exercises
    .map((name) => ({ name, history: getExerciseHistory(logs, name) }))
    .filter((e) => e.history.length >= 2 && e.history[0].weight !== undefined)

  if (withHistory.length === 0) return null

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-[#181818] border border-white/[0.06] p-5 card-elevated">
      <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-4">Progressive Overload</p>
      <div className="flex flex-col gap-5">
        {withHistory.slice(0, 5).map(({ name, history }) => {
          const latest = history[0]
          const prev = history[1]
          const weights = history.map((h) => h.weight ?? 0).reverse()
          const delta = (latest.weight ?? 0) - (prev.weight ?? 0)
          const trendColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#71717a'
          const trendText = delta > 0 ? `+${delta}lb` : delta < 0 ? `${delta}lb` : 'same'
          const trendClass = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'
          const suggestion = suggestNextWeight(history, name)

          return (
            <div key={name} className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{name}</p>
                <p className="text-[9px] text-zinc-700 mt-0.5 font-mono">
                  <span className={trendClass}>{trendText}</span>
                  {' '}vs last · {history.length} sessions
                </p>
                {suggestion && (
                  <p className="text-[9px] font-mono text-cyan-400/70 mt-0.5">
                    Next: {suggestion.weight}lb (+{suggestion.increment})
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Sparkline data={weights} color={trendColor} />
                <span className="text-sm font-mono font-bold text-white w-10 text-right">{latest.weight}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Integration Placeholders ──────────────────────────────────────────────────

interface IntegrationCardProps {
  name: string
  tagline: string
  dataPoints: string[]
  setupPath: string
  accentClass: string
  connected?: boolean | null
  connectHref?: string
}

function IntegrationCard({ name, tagline, dataPoints, setupPath, accentClass, connected, connectHref }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusLabel = connected === true ? 'Connected' : connected === false ? 'Not connected' : 'Checking…'
  const statusClass = connected === true
    ? 'text-green-400 border-green-500/30 bg-green-500/5'
    : 'text-zinc-600 border-zinc-700/40 bg-zinc-800/30'

  return (
    <div className="rounded-xl bg-[#181818] border border-white/[0.06] overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="text-[10px] text-zinc-600 font-mono">{tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${statusClass}`}>
            {statusLabel}
          </span>
          {expanded ? <ChevronUp size={13} className="text-zinc-600" /> : <ChevronDown size={13} className="text-zinc-600" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {dataPoints.map((d) => (
              <span key={d} className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${accentClass}`}>{d}</span>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 font-mono leading-relaxed">{setupPath}</p>
          {connectHref ? (
            <Link
              href={connectHref}
              className="block w-full py-2 rounded-xl text-[11px] font-mono text-center border border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
            >
              {connected ? 'Manage in Settings →' : 'Connect in Settings →'}
            </Link>
          ) : (
            <button
              disabled
              className="w-full py-2 rounded-xl text-[11px] font-mono text-zinc-600 border border-zinc-800 bg-zinc-900/50 cursor-not-allowed"
            >
              Connect — coming soon
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Recovery Card ─────────────────────────────────────────────────────────────

function RecoveryCard() {
  const [log, setLog] = useState<DailyLog | null>(null)

  useEffect(() => {
    const refresh = () => setLog(getTodayLog())
    refresh()
    window.addEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
    return () => window.removeEventListener(STORAGE_EVENTS.DAILY_LOG_UPDATED, refresh)
  }, [])

  const score = log?.recoveryScore ?? null
  const hrv = log?.hrv ?? null
  const restingHR = log?.restingHR ?? null
  const sleepHours = log?.sleepHours ?? null
  const strain = log?.strain ?? null
  const hasData = score !== null || hrv !== null || restingHR !== null

  const scoreColor = score === null ? 'text-zinc-600'
    : score >= 70 ? 'text-cyan-400'
    : score >= 50 ? 'text-purple-400'
    : 'text-pink-400'

  const stateLabel = score === null ? 'No data'
    : score >= 70 ? 'ADAPTED'
    : score >= 50 ? 'RECOVERING'
    : 'STRAINED'

  const stateColor = score === null ? 'text-zinc-600'
    : score >= 70 ? 'text-cyan-400'
    : score >= 50 ? 'text-purple-400'
    : 'text-pink-400'

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-[#181818] border border-white/[0.06] p-5 card-elevated">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Recovery</p>
        {!hasData ? (
          <Link href="/daily" className="text-[9px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors">
            Log recovery →
          </Link>
        ) : (
          <span className="text-[9px] font-mono text-zinc-700 bg-zinc-800/60 px-2 py-0.5 rounded-full">from daily log</span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2 text-center">
        {[
          { label: 'Recovery', value: score !== null ? `${score}%` : '—', color: scoreColor },
          { label: 'HRV', value: hrv !== null ? `${hrv}ms` : '—', color: 'text-white' },
          { label: 'RHR', value: restingHR !== null ? `${restingHR}` : '—', color: 'text-white' },
          { label: 'Sleep', value: sleepHours !== null ? `${sleepHours}h` : '—', color: 'text-cyan-400' },
          { label: 'Strain', value: strain !== null ? strain.toFixed(1) : '—', color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-700">{label}</p>
            <p className={`text-sm font-mono font-bold mt-1 leading-none ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-zinc-600">State</span>
        <span className={`text-xs font-mono ${stateColor}`}>{stateLabel}</span>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function FitnessPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [weekLogs, setWeekLogs] = useState<ActivityLog[]>([])
  const [whoopConnected, setWhoopConnected] = useState<boolean | null>(null)

  function reload() {
    setLogs(getActivityLogs())
    setWeekLogs(getThisWeekLogs())
  }

  useEffect(() => {
    reload()
    window.addEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, reload)

    fetch('/api/integrations/whoop/sync')
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setWhoopConnected(d.connected))
      .catch(() => setWhoopConnected(false))

    return () => window.removeEventListener(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED, reload)
  }, [])

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-6 lg:px-10 border-b border-white/[0.05] overflow-hidden mb-3">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(34,211,238,0.07) 0%, rgba(236,72,153,0.03) 50%, transparent 70%)' }} />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Performance</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">Fitness</h1>
          <p className="text-[13px] text-zinc-600 mt-2 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <RecoveryCard />
      <WeekSummary logs={weekLogs} />
      <LogActivityForm onSaved={reload} />
      <ProgressiveOverload logs={logs} />
      <ActivityHistory logs={logs} />

      {/* Integrations */}
      <div className="mx-4 mt-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-2 px-1">Integrations</p>
        <div className="rounded-2xl bg-[#181818] border border-white/[0.06] p-4 card-elevated space-y-2">
          <IntegrationCard
            name="WHOOP"
            tagline="OAuth 2.0"
            dataPoints={['Recovery %', 'HRV', 'Resting HR', 'Sleep stages', 'Strain', 'Workouts']}
            setupPath="WHOOP Developer API v2. Syncs recovery, HRV, sleep, strain, and workouts. Manage connection in Settings."
            accentClass="text-green-500/70 border-green-500/20 bg-green-500/5"
            connected={whoopConnected}
            connectHref="/settings"
          />
          <IntegrationCard
            name="Strava"
            tagline="OAuth 2.0"
            dataPoints={['Runs', 'Rides', 'GPS route', 'Pace', 'HR avg/max', 'Calories']}
            setupPath="Will use Strava API v3. Activity imports auto-create ActivityLog entries with source: strava."
            accentClass="text-orange-500/70 border-orange-500/20 bg-orange-500/5"
          />
          <IntegrationCard
            name="Apple Health"
            tagline="Export / Shortcut"
            dataPoints={['Steps', 'Active cal', 'Weight', 'Sleep', 'Workouts']}
            setupPath="No web API — use iOS Health Export XML or an iOS Shortcut that POSTs daily JSON to /api/health/apple."
            accentClass="text-pink-500/70 border-pink-500/20 bg-pink-500/5"
          />
        </div>
      </div>
    </div>
  )
}

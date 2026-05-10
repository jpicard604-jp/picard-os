'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Mic, Square, CheckCircle2,
  Dumbbell, Activity, Footprints, Bike, Waves,
  CalendarDays, AlertCircle, Type, FolderKanban,
} from 'lucide-react'
import {
  getStorage, setStorage, STORAGE_KEYS, STORAGE_EVENTS,
  getTodayLog, saveTodayLog, emptyLog, getTodayKey,
} from '@/lib/storage'
import type { VoiceLog, DailyLog } from '@/lib/storage'
import { parseTrainingFromVoiceLog, parseDailyFromVoiceLog } from '@/lib/voice-parser'
import type { ParsedTraining, DailyParseResult, ParsedDailyFields } from '@/lib/voice-parser'
import { parseProjectsFromVoiceLog } from '@/lib/project-parser'
import type { ProjectParseResult, ProjectMatch } from '@/lib/project-parser'
import { applyProjectUpdate } from '@/lib/projects'
import { addActivityLog, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from '@/lib/fitness'
import type { ActivityType } from '@/lib/fitness'

function getSpeechCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  const ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
  return (ctor as (new () => SpeechRecognition)) ?? null
}

type State = 'idle' | 'recording' | 'done' | 'saved' | 'manual'

const WAVE = Array.from({ length: 36 }, (_, i) => {
  const v = 20 + Math.sin(i * 0.45) * 18 + Math.sin(i * 0.9 + 1.2) * 12
  return Math.max(8, Math.min(92, v))
})

const CONFIDENCE_COLORS = { high: 'text-green-400', medium: 'text-amber-400', low: 'text-zinc-500' }
const CONFIDENCE_LABELS = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' }

const TYPE_ICONS: Partial<Record<ActivityType, React.ElementType>> = {
  strength: Dumbbell, run: Activity, walk: Footprints, row: Waves, bike: Bike, swim: Waves,
}
function ActivityTypeIcon({ type }: { type: ActivityType }) {
  const Icon = TYPE_ICONS[type] ?? Activity
  return <Icon size={13} className="text-sky-400" />
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function DailyFieldRows({ fields }: { fields: ParsedDailyFields }) {
  const rows: { label: string; value: string }[] = []
  if (fields.calories !== undefined)      rows.push({ label: 'Calories',   value: `${fields.calories.toLocaleString()} kcal` })
  if (fields.protein !== undefined)       rows.push({ label: 'Protein',    value: `${fields.protein}g` })
  if (fields.water !== undefined)         rows.push({ label: 'Water',      value: `${fields.water} glasses` })
  if (fields.weight !== undefined)        rows.push({ label: 'Weight',     value: `${fields.weight} lb` })
  if (fields.sleepHours !== undefined)    rows.push({ label: 'Sleep',      value: `${fields.sleepHours} hrs` })
  if (fields.steps !== undefined)         rows.push({ label: 'Steps',      value: fields.steps.toLocaleString() })
  if (fields.screenTime !== undefined)    rows.push({ label: 'Screen',     value: `${fields.screenTime}h` })
  if (fields.instagramTime !== undefined) rows.push({ label: 'Instagram',  value: `${fields.instagramTime}h` })
  if (fields.smokedToday !== undefined)   rows.push({ label: 'Smoked',     value: fields.smokedToday ? 'Yes' : 'No' })
  if (fields.drankToday !== undefined)    rows.push({ label: 'Alcohol',    value: fields.drankToday ? 'Yes' : 'No' })
  if (fields.mood !== undefined)          rows.push({ label: 'Mood',       value: `${fields.mood}/5` })
  if (rows.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-white/[0.06]">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-600">{label}</span>
          <span className="text-[11px] font-mono text-zinc-300 font-medium">{value}</span>
        </div>
      ))}
    </div>
  )
}

function ProjectCard({
  match,
  saved,
  onSave,
}: {
  match: ProjectMatch
  saved: boolean
  onSave: (m: ProjectMatch) => void
}) {
  return (
    <div className="rounded-xl border bg-emerald-500/[0.06] border-emerald-500/20 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <FolderKanban size={12} className="text-emerald-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
            Project Update
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono ${CONFIDENCE_COLORS[match.confidence]}`}>
            {CONFIDENCE_LABELS[match.confidence]}
          </span>
          {match.progressBump > 0 && (
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
              +{match.progressBump}%
            </span>
          )}
        </div>
      </div>

      <p className="text-[13px] font-semibold text-white mb-2">{match.projectTitle}</p>

      <p className="text-[12px] text-zinc-400 leading-relaxed italic mb-2">
        &ldquo;{match.updateText.length > 140
          ? match.updateText.slice(0, 140) + '…'
          : match.updateText}&rdquo;
      </p>

      {match.nextAction && (
        <p className="text-[11px] font-mono text-zinc-600 mb-3">
          <span className="text-zinc-700">Next: </span>
          {match.nextAction}
        </p>
      )}

      {!match.nextAction && <div className="mb-1" />}

      <div className="flex items-center justify-end pt-2 border-t border-white/[0.06]">
        {match.projectId ? (
          saved ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <CheckCircle2 size={12} /> Saved to project
            </span>
          ) : (
            <button
              onClick={() => onSave(match)}
              className="flex items-center gap-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-emerald-600/30 transition-colors"
            >
              <FolderKanban size={11} /> Save to Project
            </button>
          )
        ) : (
          <Link
            href="/projects"
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono"
          >
            Not in system — view projects →
          </Link>
        )}
      </div>
    </div>
  )
}

export default function VoiceCapture() {
  const [isSupported] = useState<boolean>(() => getSpeechCtor() !== null)

  const [state, setState] = useState<State>('idle')
  const [transcript, setTranscript] = useState('')
  const [manualText, setManualText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [training, setTraining] = useState<ParsedTraining | null>(null)
  const [daily, setDaily] = useState<DailyParseResult | null>(null)
  const [projects, setProjects] = useState<ProjectParseResult | null>(null)
  const [workoutSaved, setWorkoutSaved] = useState(false)
  const [dailyLogSaved, setDailyLogSaved] = useState(false)
  const [savedProjectIds, setSavedProjectIds] = useState<Set<string>>(new Set())

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const latestFinalRef = useRef('')
  const activeRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      activeRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      }
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startRecording() {
    const SpeechCtor = getSpeechCtor()
    if (!SpeechCtor) return

    setMicError(null)
    setFinalText('')
    setInterimText('')
    setTraining(null)
    setDaily(null)
    setProjects(null)
    setWorkoutSaved(false)
    setDailyLogSaved(false)
    setSavedProjectIds(new Set())
    latestFinalRef.current = ''

    const recognition = new SpeechCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let allFinal = ''
      let currentInterim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          allFinal += event.results[i][0].transcript
        } else {
          currentInterim += event.results[i][0].transcript
        }
      }
      latestFinalRef.current = allFinal
      setFinalText(allFinal)
      setInterimText(currentInterim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const err = event.error
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setMicError('Microphone access denied. Allow mic access in browser settings, then reload.')
      } else if (err !== 'no-speech' && err !== 'aborted') {
        setMicError(`Recognition error: ${err}. Try the "Type instead" option.`)
      }
    }

    recognition.onend = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (!activeRef.current) return
      activeRef.current = false
      setTranscript(latestFinalRef.current.trim())
      setState('done')
    }

    try {
      activeRef.current = true
      recognition.start()
      setState('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch {
      activeRef.current = false
      setMicError('Could not start speech recognition. Try "Type instead".')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    recognitionRef.current?.stop()
  }

  function reset() {
    activeRef.current = false
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    setState('idle')
    setTranscript('')
    setManualText('')
    setFinalText('')
    setInterimText('')
    setElapsed(0)
    setMicError(null)
    setTraining(null)
    setDaily(null)
    setProjects(null)
    setWorkoutSaved(false)
    setDailyLogSaved(false)
    setSavedProjectIds(new Set())
    latestFinalRef.current = ''
  }

  function runSaveAndAnalyze(text: string) {
    const entry: VoiceLog = {
      id: `vl-${Date.now()}`,
      timestamp: new Date().toISOString(),
      transcript: text,
      duration: elapsed,
    }
    const existing = getStorage<VoiceLog[]>(STORAGE_KEYS.VOICE_LOGS, [])
    setStorage(STORAGE_KEYS.VOICE_LOGS, [entry, ...existing])
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.VOICE_LOG_SAVED))

    const trainingResult = parseTrainingFromVoiceLog(text)
    const dailyResult    = parseDailyFromVoiceLog(text)
    const projectResult  = parseProjectsFromVoiceLog(text)

    setTraining(trainingResult)
    setDaily(dailyResult)
    setProjects(projectResult)
    setState('saved')

    if (!trainingResult.detected && !dailyResult.detected && !projectResult.detected) {
      setTimeout(reset, 3000)
    }
  }

  function saveLog()       { runSaveAndAnalyze(transcript) }
  function saveManualLog() { if (manualText.trim()) { setTranscript(manualText); runSaveAndAnalyze(manualText) } }

  function saveAsActivity() {
    if (!training?.detected) return
    addActivityLog({
      id: `al-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      type: training.type,
      label: training.label,
      duration: training.duration,
      distance: training.distance,
      distanceUnit: 'miles',
      steps: training.steps,
      exercises: training.exercises.length > 0 ? training.exercises : undefined,
      notes: transcript.slice(0, 200),
      source: 'voice',
      createdAt: new Date().toISOString(),
    })
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.ACTIVITY_LOG_UPDATED))
    setWorkoutSaved(true)
  }

  function saveToDailyLog() {
    if (!daily?.detected) return
    const f = daily.fields
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    const updated: DailyLog = {
      ...existing,
      calories:      f.calories      ?? existing.calories,
      protein:       f.protein       ?? existing.protein,
      water:         f.water         ?? existing.water,
      weight:        f.weight        ?? existing.weight,
      sleepHours:    f.sleepHours    ?? existing.sleepHours,
      steps:         f.steps         ?? existing.steps,
      screenTime:    f.screenTime    ?? existing.screenTime,
      instagramTime: f.instagramTime ?? existing.instagramTime,
      smokedToday:   f.smokedToday   ?? existing.smokedToday,
      drankToday:    f.drankToday    ?? existing.drankToday,
      mood:          f.mood          ?? existing.mood,
      savedAt: new Date().toISOString(),
    }
    saveTodayLog(updated)
    setDailyLogSaved(true)
  }

  function saveProjectUpdate(match: ProjectMatch) {
    if (!match.projectId) return
    applyProjectUpdate(match.projectId, match.updateText, match.progressBump, 'voice')
    setSavedProjectIds((prev) => new Set([...prev, match.projectId!]))
  }

  const tc = training?.detected ? ACTIVITY_TYPE_COLORS[training.type] : null

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-[--surface] border border-white/[0.06] overflow-hidden card-elevated">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-600">Voice Log</span>
        {state === 'recording' && (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-red-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        )}
        {state === 'done' && (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2.5 py-1 uppercase tracking-wider">
            <CheckCircle2 size={9} /> Ready to Save
          </span>
        )}
        {state === 'saved' && (
          <span className="flex items-center gap-1.5 text-[9px] font-mono text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded-full px-2.5 py-1 uppercase tracking-wider">
            <CheckCircle2 size={9} /> Saved
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        {micError && (
          <div className="mb-3 flex items-start gap-2.5 bg-red-500/[0.07] border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-300 leading-snug">{micError}</p>
          </div>
        )}

        {/* ── IDLE ──────────────────────────────────────────────────── */}
        {state === 'idle' && (
          <div className="space-y-2.5">
            {isSupported ? (
              <button
                onClick={startRecording}
                className="w-full flex items-center gap-4 bg-[--surface-raised] rounded-xl border border-white/[0.09] px-5 py-4 active:scale-[0.98] hover:border-white/[0.14] transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-full bg-pink-500/10 border border-pink-500/25 flex items-center justify-center flex-shrink-0">
                  <Mic size={17} className="text-pink-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Start Recording</p>
                  <p className="text-xs text-zinc-600 mt-0.5 font-mono">Live transcription · Chrome / Edge / Android</p>
                </div>
              </button>
            ) : (
              <div className="flex items-start gap-3 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3.5">
                <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-amber-300">Live dictation not available</p>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono leading-relaxed">
                    Use Chrome or Edge on desktop / Android. Type your log below instead.
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={() => setState('manual')}
              className="w-full flex items-center gap-3 rounded-xl border border-white/[0.06] px-4 py-3 text-zinc-500 hover:text-zinc-200 hover:border-white/[0.12] transition-all duration-150"
            >
              <Type size={13} />
              <span className="text-[13px]">Type or paste instead</span>
            </button>
          </div>
        )}

        {/* ── MANUAL ────────────────────────────────────────────────── */}
        {state === 'manual' && (
          <div>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Type or paste your log — calories, workouts, sleep, projects…"
              rows={6}
              autoFocus
              className="w-full bg-[--surface-raised] border border-white/[0.09] rounded-xl p-4 text-sm text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-sky-500/30 transition-colors placeholder-zinc-700"
            />
            <div className="flex items-center justify-between mt-3">
              <button onClick={reset} className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">Cancel</button>
              <button
                onClick={saveManualLog}
                disabled={!manualText.trim()}
                className="bg-gradient-to-r from-pink-500 to-cyan-400 text-white text-xs font-semibold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                Save &amp; Analyze
              </button>
            </div>
          </div>
        )}

        {/* ── RECORDING ─────────────────────────────────────────────── */}
        {state === 'recording' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0 w-2.5 h-2.5">
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50" />
                  <div className="relative w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <span className="text-[11px] font-mono text-red-400 uppercase tracking-wider">REC</span>
                <span className="text-[11px] font-mono text-zinc-500">{fmt(elapsed)}</span>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-1.5 bg-white/[0.07] hover:bg-white/[0.11] rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <Square size={10} className="fill-white" /> Stop
              </button>
            </div>

            <div className="flex items-center gap-px h-7 mb-3 overflow-hidden">
              {WAVE.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-red-500 rounded-[1px] animate-pulse opacity-70"
                  style={{ height: `${h}%`, animationDelay: `${(i * 60) % 800}ms`, animationDuration: `${700 + (i % 4) * 150}ms` }}
                />
              ))}
            </div>

            <div className="bg-[--surface-raised] rounded-xl border border-white/[0.07] px-4 py-3 min-h-[56px]">
              {finalText || interimText ? (
                <p className="text-sm leading-relaxed">
                  <span className="text-zinc-200">{finalText}</span>
                  <span className="text-zinc-600 italic">{interimText}</span>
                </p>
              ) : (
                <p className="text-sm text-zinc-700 italic font-mono">Listening… speak now</p>
              )}
            </div>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────── */}
        {state === 'done' && (
          <div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full bg-[--surface-raised] border border-white/[0.09] rounded-xl p-4 text-sm text-zinc-300 leading-relaxed resize-none focus:outline-none focus:border-sky-500/30 transition-colors"
              rows={5}
            />
            {!transcript.trim() && (
              <p className="text-[11px] text-amber-400/80 font-mono mt-1.5">
                No speech captured — edit above or{' '}
                <button className="underline hover:text-amber-300 transition-colors" onClick={reset}>try again</button>.
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <button onClick={reset} className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">Discard</button>
              <button
                onClick={saveLog}
                disabled={!transcript.trim()}
                className="bg-gradient-to-r from-pink-500 to-cyan-400 text-white text-xs font-semibold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                Save to Log
              </button>
            </div>
          </div>
        )}

        {/* ── SAVED ─────────────────────────────────────────────────── */}
        {state === 'saved' && (
          <div className="space-y-3">
            {/* Daily fields */}
            {daily?.detected && (
              <div className="rounded-xl border bg-indigo-500/[0.06] border-indigo-500/20 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">Daily Fields</span>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-600">
                    {Object.keys(daily.fields).length} field{Object.keys(daily.fields).length !== 1 ? 's' : ''} detected
                  </span>
                </div>
                <DailyFieldRows fields={daily.fields} />
                {daily.projectHints.length > 0 && (
                  <p className="text-[9px] font-mono text-zinc-600 mt-2 pt-2 border-t border-white/[0.06]">
                    Projects: {daily.projectHints.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Activity */}
            {training?.detected && (
              <div className={`rounded-xl border p-4 ${tc ? 'bg-sky-500/[0.06] border-sky-500/20' : 'bg-[--surface-raised] border-white/[0.09]'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ActivityTypeIcon type={training.type} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">Activity Detected</span>
                  </div>
                  <span className={`text-[9px] font-mono ${CONFIDENCE_COLORS[training.confidence]}`}>
                    {CONFIDENCE_LABELS[training.confidence]}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${tc?.bg ?? 'bg-white/5'} ${tc?.border ?? 'border-white/10'} ${tc?.text ?? 'text-zinc-400'}`}>
                    {ACTIVITY_TYPE_LABELS[training.type]}
                  </span>
                  {training.distance !== undefined && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/[0.07] px-2 py-0.5 rounded-full">{training.distance} mi</span>
                  )}
                  {training.duration !== undefined && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/[0.07] px-2 py-0.5 rounded-full">{training.duration} min</span>
                  )}
                  {training.steps !== undefined && (
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/[0.07] px-2 py-0.5 rounded-full">{training.steps.toLocaleString()} steps</span>
                  )}
                </div>
                {training.exercises.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                    {training.exercises.slice(0, 5).map((ex, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300">{ex.exercise}</span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {ex.sets !== undefined && `${ex.sets}×`}
                          {ex.reps !== undefined && String(ex.reps)}
                          {ex.weight !== undefined && ` @ ${ex.weight}${ex.weightUnit ?? 'lb'}`}
                        </span>
                      </div>
                    ))}
                    {training.exercises.length > 5 && (
                      <p className="text-[9px] text-zinc-700 font-mono">+{training.exercises.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Project cards */}
            {projects?.detected && projects.matches.map((match, i) => (
              <ProjectCard
                key={`${match.projectId ?? match.projectTitle}-${i}`}
                match={match}
                saved={!!match.projectId && savedProjectIds.has(match.projectId)}
                onSave={saveProjectUpdate}
              />
            ))}

            {/* Nothing detected */}
            {!daily?.detected && !training?.detected && !projects?.detected && (
              <div className="flex items-center justify-center gap-2.5 py-5">
                <CheckCircle2 size={16} className="text-sky-400" />
                <span className="text-sm text-zinc-400">Log saved — no structured data detected</span>
              </div>
            )}

            {/* Common action row */}
            <div className="flex items-center justify-between pt-1">
              <button onClick={reset} className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors">
                Dismiss
              </button>
              <div className="flex items-center gap-2">
                {daily?.detected && (
                  dailyLogSaved ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 size={12} /> Daily saved
                    </span>
                  ) : (
                    <button
                      onClick={saveToDailyLog}
                      className="flex items-center gap-1.5 bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-pink-500/25 transition-colors"
                    >
                      <CalendarDays size={11} /> Save to Daily
                    </button>
                  )
                )}
                {training?.detected && (
                  workoutSaved ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 size={12} /> Activity saved
                    </span>
                  ) : (
                    <button
                      onClick={saveAsActivity}
                      className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-cyan-500/25 transition-colors"
                    >
                      <Dumbbell size={11} /> Save Activity
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

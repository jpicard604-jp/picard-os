'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Mic, MicOff, Paperclip, Send, Check, X, ChevronDown,
  CalendarDays, Dumbbell, FolderKanban, Image as ImageIcon, Clock,
  CheckCircle2, SkipForward, Pencil, Plus,
} from 'lucide-react'
import {
  getTodayLog, saveTodayLog, emptyLog, getTodayKey,
  getStorage, setStorage, getTodayDateLabel, STORAGE_KEYS,
  saveVoiceLog,
} from '@/lib/storage'
import { addActivityLog } from '@/lib/fitness'
import { applyProjectUpdate, addProjectTask } from '@/lib/projects'
import {
  parseCommandInput,
  IMAGE_CATEGORY_LABELS,
  COMMAND_HISTORY_KEY,
} from '@/lib/command-parser'
import type { AttachedImage, ImageCategory, ParsedCommand, HistoryEntry } from '@/lib/command-parser'
import type { ParsedDailyFields } from '@/lib/voice-parser'
import type { DailyLog, VoiceLog } from '@/lib/storage'
import type { ActivityLog } from '@/lib/fitness'

// ─── Speech helper ────────────────────────────────────────────────────────────

function getSpeechCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => SpeechRecognition) | null
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

const CARD_COLORS = {
  indigo:  { border: 'border-indigo-500/20',  bg: 'bg-indigo-500/[0.04]',  badge: 'text-indigo-400/60'  },
  sky:     { border: 'border-sky-500/20',     bg: 'bg-sky-500/[0.04]',     badge: 'text-sky-400/60'     },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.04]', badge: 'text-emerald-400/60' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.04]',   badge: 'text-amber-400/60'   },
}

function CardShell({
  color, icon, title, badge,
  approved, skipped, saved,
  onApprove, onSkip, onSave,
  editing, onEdit,
  children,
}: {
  color: keyof typeof CARD_COLORS
  icon: React.ReactNode
  title: string
  badge: string
  approved: boolean
  skipped: boolean
  saved: boolean
  onApprove: () => void
  onSkip: () => void
  onSave: () => void
  editing: boolean
  onEdit: () => void
  children?: React.ReactNode
}) {
  const c = CARD_COLORS[color]
  return (
    <div className={`rounded-xl border p-3 transition-all duration-200 ${c.border} ${c.bg} ${skipped ? 'opacity-30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <span className="text-[11px] font-semibold text-white">{title}</span>
          <span className={`text-[9px] font-mono truncate ${c.badge}`}>{badge}</span>
        </div>
        {saved ? (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <CheckCircle2 size={13} className="text-green-400" />
            <span className="text-[10px] font-mono text-green-400">Saved</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              title="Edit"
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                editing
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'border border-white/[0.08] text-zinc-600 hover:border-white/20 hover:text-zinc-300'
              }`}
            >
              <Pencil size={9} />
            </button>
            <button
              onClick={onApprove}
              title="Approve"
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                approved && !skipped
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                  : 'border border-white/[0.08] text-zinc-600 hover:border-green-500/30 hover:text-green-500'
              }`}
            >
              <Check size={10} />
            </button>
            <button
              onClick={onSkip}
              title="Skip"
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                skipped
                  ? 'bg-zinc-700/40 border border-zinc-600/40 text-zinc-400'
                  : 'border border-white/[0.08] text-zinc-600 hover:border-red-500/30 hover:text-red-500'
              }`}
            >
              <SkipForward size={10} />
            </button>
            <button
              onClick={onSave}
              className="h-6 px-2 rounded-full text-[9px] font-mono font-semibold border border-white/[0.1] text-zinc-400 hover:text-white hover:border-white/25 transition-all"
            >
              Save
            </button>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

// ─── Daily card ───────────────────────────────────────────────────────────────

const DAILY_FIELD_LABELS: Record<string, { label: string; unit: string; type: 'number' | 'bool' }> = {
  calories:     { label: 'Calories',     unit: 'kcal', type: 'number' },
  protein:      { label: 'Protein',      unit: 'g',    type: 'number' },
  water:        { label: 'Water',        unit: 'gl',   type: 'number' },
  weight:       { label: 'Weight',       unit: 'lb',   type: 'number' },
  sleepHours:   { label: 'Sleep',        unit: 'hrs',  type: 'number' },
  steps:        { label: 'Steps',        unit: '',     type: 'number' },
  screenTime:   { label: 'Screen',       unit: 'hrs',  type: 'number' },
  instagramTime:{ label: 'Instagram',    unit: 'hrs',  type: 'number' },
  smokedToday:  { label: 'Smoked',       unit: '',     type: 'bool'   },
  drankToday:   { label: 'Drank',        unit: '',     type: 'bool'   },
  mood:         { label: 'Mood',         unit: '/5',   type: 'number' },
}

function DailyCard({
  fields, editedFields, editing, approved, skipped, saved,
  onApprove, onSkip, onSave, onEdit, onFieldChange,
}: {
  fields: ParsedDailyFields
  editedFields: ParsedDailyFields
  editing: boolean
  approved: boolean
  skipped: boolean
  saved: boolean
  onApprove: () => void
  onSkip: () => void
  onSave: () => void
  onEdit: () => void
  onFieldChange: (k: keyof ParsedDailyFields, v: number | boolean | undefined) => void
}) {
  const entries = Object.keys(fields)
  return (
    <CardShell
      color="indigo"
      icon={<CalendarDays size={13} className="text-indigo-400" />}
      title="Daily Log"
      badge={`${entries.length} field${entries.length !== 1 ? 's' : ''}`}
      approved={approved} skipped={skipped} saved={saved}
      onApprove={onApprove} onSkip={onSkip} onSave={onSave}
      editing={editing} onEdit={onEdit}
    >
      <div className={`mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 ${editing ? '' : ''}`}>
        {entries.map((k) => {
          const meta = DAILY_FIELD_LABELS[k]
          const val = (editedFields as Record<string, unknown>)[k]
          if (meta?.type === 'bool') {
            return (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-zinc-600 font-mono">{meta.label}</span>
                {editing ? (
                  <select
                    value={val === true ? 'yes' : val === false ? 'no' : 'no'}
                    onChange={(e) => onFieldChange(k as keyof ParsedDailyFields, e.target.value === 'yes')}
                    className="text-[10px] font-mono bg-[--surface-raised] border border-white/[0.08] rounded-md px-1.5 py-0.5 text-white focus:outline-none"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                ) : (
                  <span className="text-[10px] font-mono text-white font-medium">
                    {val === true ? 'Yes' : 'No'}
                  </span>
                )}
              </div>
            )
          }
          return (
            <div key={k} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-600 font-mono">{meta?.label ?? k}</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={typeof val === 'number' ? String(val) : ''}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value)
                      onFieldChange(k as keyof ParsedDailyFields, isNaN(n) ? undefined : n)
                    }}
                    className="w-14 text-[10px] font-mono bg-[--surface-raised] border border-white/[0.1] rounded-md px-1.5 py-0.5 text-white focus:outline-none focus:border-indigo-500/40 text-right"
                  />
                  {meta?.unit && <span className="text-[9px] text-zinc-600 font-mono">{meta.unit}</span>}
                </div>
              ) : (
                <span className="text-[10px] font-mono text-white font-medium">
                  {typeof val === 'number' ? `${k === 'steps' ? val.toLocaleString() : val}${meta?.unit ? ` ${meta.unit}` : ''}` : '—'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </CardShell>
  )
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity, editedDuration, editedDistance, editing, approved, skipped, saved,
  onApprove, onSkip, onSave, onEdit, onDurationChange, onDistanceChange,
}: {
  activity: ParsedCommand['activityUpdate']
  editedDuration: number | undefined
  editedDistance: number | undefined
  editing: boolean
  approved: boolean
  skipped: boolean
  saved: boolean
  onApprove: () => void
  onSkip: () => void
  onSave: () => void
  onEdit: () => void
  onDurationChange: (v: number | undefined) => void
  onDistanceChange: (v: number | undefined) => void
}) {
  return (
    <CardShell
      color="sky"
      icon={<Dumbbell size={13} className="text-sky-400" />}
      title={activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
      badge={`${activity.confidence} confidence`}
      approved={approved} skipped={skipped} saved={saved}
      onApprove={onApprove} onSkip={onSkip} onSave={onSave}
      editing={editing} onEdit={onEdit}
    >
      {editing ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-600 font-mono">Duration</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={editedDuration ?? ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  onDurationChange(isNaN(n) ? undefined : n)
                }}
                className="w-14 text-[10px] font-mono bg-[--surface-raised] border border-white/[0.1] rounded-md px-1.5 py-0.5 text-white focus:outline-none focus:border-sky-500/40 text-right"
              />
              <span className="text-[9px] text-zinc-600 font-mono">min</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-600 font-mono">Distance</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={editedDistance ?? ''}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  onDistanceChange(isNaN(n) ? undefined : n)
                }}
                className="w-14 text-[10px] font-mono bg-[--surface-raised] border border-white/[0.1] rounded-md px-1.5 py-0.5 text-white focus:outline-none focus:border-sky-500/40 text-right"
              />
              <span className="text-[9px] text-zinc-600 font-mono">mi</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activity.exercises && activity.exercises.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {activity.exercises.slice(0, 4).map((ex, i) => (
                <p key={i} className="text-[10px] font-mono text-zinc-400">
                  {ex.exercise}{ex.weight ? ` · ${ex.weight}lb` : ''}{ex.reps ? ` × ${ex.reps}` : ''}
                </p>
              ))}
              {activity.exercises.length > 4 && (
                <p className="text-[10px] font-mono text-zinc-600">+{activity.exercises.length - 4} more</p>
              )}
            </div>
          )}
          <div className="flex gap-3 mt-1.5">
            {editedDuration && <span className="text-[10px] font-mono text-zinc-500">{editedDuration} min</span>}
            {editedDistance && <span className="text-[10px] font-mono text-zinc-500">{editedDistance} mi</span>}
            {activity.steps  && <span className="text-[10px] font-mono text-zinc-500">{activity.steps.toLocaleString()} steps</span>}
          </div>
        </>
      )}
    </CardShell>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  match, editedText, editing, createTask, approved, skipped, saved,
  onApprove, onSkip, onSave, onEdit, onTextChange, onToggleTask,
}: {
  match: ParsedCommand['projectUpdate']['matches'][0]
  editedText: string
  editing: boolean
  createTask: boolean
  approved: boolean
  skipped: boolean
  saved: boolean
  onApprove: () => void
  onSkip: () => void
  onSave: () => void
  onEdit: () => void
  onTextChange: (v: string) => void
  onToggleTask: () => void
}) {
  const bumpLabel = match.progressBump === 0 ? 'no change'
    : match.progressBump >= 5 ? `+${match.progressBump}% completed`
    : match.progressBump >= 3 ? `+${match.progressBump}% progress`
    : `+${match.progressBump}%`

  return (
    <CardShell
      color="emerald"
      icon={<FolderKanban size={13} className="text-emerald-400" />}
      title={match.projectTitle}
      badge={`${match.confidence} · ${bumpLabel}`}
      approved={approved} skipped={skipped} saved={saved}
      onApprove={onApprove} onSkip={onSkip} onSave={onSave}
      editing={editing} onEdit={onEdit}
    >
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editedText}
            onChange={(e) => onTextChange(e.target.value)}
            rows={3}
            className="w-full text-[11px] bg-[--surface-raised] border border-white/[0.1] rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500/40 resize-none leading-relaxed"
          />
          {match.nextAction && (
            <button
              onClick={onToggleTask}
              className={`flex items-center gap-2 text-[10px] font-mono transition-colors ${
                createTask ? 'text-emerald-400' : 'text-zinc-600'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                createTask
                  ? 'bg-emerald-500/20 border-emerald-500/40'
                  : 'border-white/20'
              }`}>
                {createTask && <Check size={8} className="text-emerald-400" />}
              </div>
              Create task: "{match.nextAction}"
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-[11px] text-zinc-400 line-clamp-2">{editedText}</p>
          {match.nextAction && (
            <p className={`text-[10px] font-mono mt-1 ${createTask ? 'text-emerald-500/70' : 'text-zinc-700'}`}>
              {createTask ? <span className="flex items-center gap-1"><Plus size={8} /> {match.nextAction}</span> : null}
            </p>
          )}
        </div>
      )}
    </CardShell>
  )
}

// ─── Image card ───────────────────────────────────────────────────────────────

function ImageCard({ image, onCategoryChange, onRemove }: {
  image: AttachedImage
  onCategoryChange: (cat: ImageCategory) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ImageIcon size={12} className="text-amber-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80">Attachment</span>
          <span className="text-[9px] font-mono text-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            Needs AI review
          </span>
        </div>
        <button onClick={onRemove} className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        {image.dataUrl && (
          <img src={image.dataUrl} alt={image.name}
            className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-300 truncate">{image.name}</p>
          <select
            value={image.category}
            onChange={(e) => onCategoryChange(e.target.value as ImageCategory)}
            className="mt-1 w-full text-[10px] font-mono bg-[--surface-raised] border border-white/[0.08] rounded-lg px-2 py-1 text-zinc-400 focus:outline-none focus:border-amber-500/30"
          >
            {(Object.keys(IMAGE_CATEGORY_LABELS) as ImageCategory[]).map((cat) => (
              <option key={cat} value={cat}>{IMAGE_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const [open, setOpen] = useState(false)
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Clock size={11} className="text-zinc-700 flex-shrink-0" />
        <span className="flex-1 text-[11px] text-zinc-500 truncate">{entry.preview}</span>
        <span className="text-[9px] font-mono text-zinc-700 flex-shrink-0">{time}</span>
        <ChevronDown size={11} className={`text-zinc-700 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-zinc-600 font-mono">{entry.summary}</p>
          <p className="text-[9px] text-zinc-700 font-mono mt-0.5">{entry.savedCount} update{entry.savedCount !== 1 ? 's' : ''} saved</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommandInbox() {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParsedCommand | null>(null)
  const [images, setImages] = useState<AttachedImage[]>([])
  const [phase, setPhase] = useState<'input' | 'review' | 'saved'>('input')
  const [recording, setRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Approval state
  const [dailyApproved, setDailyApproved] = useState(true)
  const [dailySkipped, setDailySkipped] = useState(false)
  const [activityApproved, setActivityApproved] = useState(true)
  const [activitySkipped, setActivitySkipped] = useState(false)
  const [approvedProjects, setApprovedProjects] = useState<Set<string>>(new Set())
  const [skippedProjects, setSkippedProjects] = useState<Set<string>>(new Set())

  // Edited values (lifted from cards)
  const [editedDailyFields, setEditedDailyFields] = useState<ParsedDailyFields>({})
  const [editedDuration, setEditedDuration] = useState<number | undefined>()
  const [editedDistance, setEditedDistance] = useState<number | undefined>()
  const [editedProjectTexts, setEditedProjectTexts] = useState<Map<string, string>>(new Map())
  const [createTaskFor, setCreateTaskFor] = useState<Set<string>>(new Set())

  // Per-card edit mode (one at a time)
  const [cardEditing, setCardEditing] = useState<string | null>(null)

  // Track individually saved cards to avoid double-save
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set())

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const activeRef = useRef(false)
  const usedVoiceRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = getStorage<HistoryEntry[]>(COMMAND_HISTORY_KEY, [])
    setHistory(saved.slice(0, 20))
  }, [])

  // ── Speech ──────────────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    const Ctor = getSpeechCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    recognitionRef.current = rec
    activeRef.current = true
    usedVoiceRef.current = true

    let finalAccum = ''

    rec.onstart = () => setRecording(true)

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) finalAccum += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setInterimText(interim)
      if (finalAccum) {
        const committed = finalAccum
        finalAccum = ''
        setInput((prev) => prev + committed)
      }
    }

    rec.onerror = (_ev: SpeechRecognitionErrorEvent) => {
      activeRef.current = false
      setRecording(false)
      setInterimText('')
    }

    rec.onend = () => {
      setInterimText('')
      if (!activeRef.current) return
      activeRef.current = false
      setRecording(false)
    }

    rec.start()
  }, [])

  const stopRecording = useCallback(() => {
    activeRef.current = false
    setRecording(false)
    setInterimText('')
    recognitionRef.current?.stop()
  }, [])

  // ── Images ──────────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImages((prev) => [...prev, {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl: ev.target?.result as string,
          name: file.name,
          size: file.size,
          category: 'other',
          needsAiReview: true,
        }])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateImageCategory(id: string, cat: ImageCategory) {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, category: cat } : img))
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  // ── Analyze ─────────────────────────────────────────────────────────────────

  function handleAnalyze() {
    const text = input.trim()
    if (!text && images.length === 0) return

    // Persist input as voice log (command history feeds into voice log)
    if (text) {
      const vl: VoiceLog = {
        id: `vl-cmd-${Date.now()}`,
        timestamp: new Date().toISOString(),
        transcript: text,
        duration: 0,
      }
      saveVoiceLog(vl)
    }

    const result = parseCommandInput(text, images)
    setParsed(result)
    setPhase('review')

    // Initialize edited state from parsed results
    setEditedDailyFields({ ...result.dailyUpdate.fields })
    setEditedDuration(result.activityUpdate.duration)
    setEditedDistance(result.activityUpdate.distance)

    const textMap = new Map<string, string>()
    for (const m of result.projectUpdate.matches) {
      textMap.set(m.projectId ?? m.projectTitle, m.updateText)
    }
    setEditedProjectTexts(textMap)

    // Default task creation for matches with nextAction + known projectId
    const taskSet = new Set<string>()
    for (const m of result.projectUpdate.matches) {
      if (m.nextAction && m.projectId) taskSet.add(m.projectId)
    }
    setCreateTaskFor(taskSet)

    // Approval defaults
    setDailyApproved(true)
    setDailySkipped(false)
    setActivityApproved(true)
    setActivitySkipped(false)
    const allProjKeys = new Set(result.projectUpdate.matches.map((m) => m.projectId ?? m.projectTitle))
    setApprovedProjects(allProjKeys)
    setSkippedProjects(new Set())
    setSavedCards(new Set())
    setCardEditing(null)
    usedVoiceRef.current = false
  }

  // ── Individual saves ─────────────────────────────────────────────────────────

  function saveDaily() {
    if (!parsed || savedCards.has('daily')) return
    const existing = getTodayLog() ?? emptyLog(getTodayKey())
    const f = editedDailyFields
    const updated: DailyLog = {
      ...existing,
      ...(f.calories      !== undefined ? { calories:      f.calories      } : {}),
      ...(f.protein       !== undefined ? { protein:       f.protein       } : {}),
      ...(f.water         !== undefined ? { water:         f.water         } : {}),
      ...(f.weight        !== undefined ? { weight:        f.weight        } : {}),
      ...(f.sleepHours    !== undefined ? { sleepHours:    f.sleepHours    } : {}),
      ...(f.steps         !== undefined ? { steps:         f.steps         } : {}),
      ...(f.screenTime    !== undefined ? { screenTime:    f.screenTime    } : {}),
      ...(f.instagramTime !== undefined ? { instagramTime: f.instagramTime } : {}),
      ...(f.smokedToday   !== undefined ? { smokedToday:   f.smokedToday   } : {}),
      ...(f.drankToday    !== undefined ? { drankToday:    f.drankToday    } : {}),
      ...(f.mood          !== undefined ? { mood:          f.mood          } : {}),
      savedAt: new Date().toISOString(),
    }
    saveTodayLog(updated)
    setSavedCards((s) => new Set([...s, 'daily']))
    setDailySkipped(false)
  }

  function saveActivity() {
    if (!parsed || savedCards.has('activity')) return
    const now = new Date()
    const entry: ActivityLog = {
      id: `act-${Date.now()}`,
      date: now.toISOString().slice(0, 10),
      type: parsed.activityUpdate.type,
      label: parsed.activityUpdate.label,
      duration: editedDuration,
      distance: editedDistance,
      steps: parsed.activityUpdate.steps,
      exercises: parsed.activityUpdate.exercises,
      source: 'voice',
      createdAt: now.toISOString(),
    }
    addActivityLog(entry)
    setSavedCards((s) => new Set([...s, 'activity']))
    setActivitySkipped(false)
  }

  function saveProject(match: ParsedCommand['projectUpdate']['matches'][0]) {
    const key = match.projectId ?? match.projectTitle
    if (!match.projectId || savedCards.has(key)) return
    const text = editedProjectTexts.get(key) ?? match.updateText
    applyProjectUpdate(match.projectId, text, match.progressBump, 'voice')
    if (createTaskFor.has(match.projectId) && match.nextAction) {
      addProjectTask(match.projectId, match.nextAction)
    }
    setSavedCards((s) => new Set([...s, key]))
    setSkippedProjects((s) => { const n = new Set(s); n.delete(key); return n })
  }

  // ── Save All ─────────────────────────────────────────────────────────────────

  function handleSaveAll() {
    if (!parsed) return
    let savedCount = savedCards.size

    if (parsed.dailyUpdate.detected && dailyApproved && !dailySkipped && !savedCards.has('daily')) {
      saveDaily()
      savedCount++
    }

    if (parsed.activityUpdate.detected && activityApproved && !activitySkipped && !savedCards.has('activity')) {
      saveActivity()
      savedCount++
    }

    for (const match of parsed.projectUpdate.matches) {
      const key = match.projectId ?? match.projectTitle
      if (!approvedProjects.has(key) || skippedProjects.has(key) || savedCards.has(key)) continue
      if (!match.projectId) continue
      saveProject(match)
      savedCount++
    }

    // Images
    if (images.length > 0) {
      interface StoredImage {
        id: string; name: string; type: string; size: string; uploadedAt: string;
        category: string; previewDataUrl?: string
      }
      const existing = getStorage<StoredImage[]>(STORAGE_KEYS.UPLOAD_HISTORY, [])
      const dateLabel = getTodayDateLabel()
      const newEntries: StoredImage[] = images.map((img) => ({
        id: img.id,
        name: img.name,
        type: 'image',
        size: img.size > 1_000_000
          ? `${(img.size / 1_048_576).toFixed(1)} MB`
          : `${Math.round(img.size / 1024)} KB`,
        uploadedAt: dateLabel,
        category: IMAGE_CATEGORY_LABELS[img.category] ?? img.category,
        previewDataUrl: img.dataUrl,
      }))
      setStorage(STORAGE_KEYS.UPLOAD_HISTORY, [...existing, ...newEntries])
      savedCount += images.length
    }

    // Command history entry
    const entry: HistoryEntry = {
      id: `cmd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      preview: parsed.rawInput.slice(0, 80) || `${images.length} image${images.length !== 1 ? 's' : ''}`,
      summary: parsed.summary,
      savedCount,
    }
    const updated = [entry, ...history].slice(0, 20)
    setHistory(updated)
    setStorage(COMMAND_HISTORY_KEY, updated)

    setPhase('saved')
    setTimeout(() => {
      setPhase('input')
      setParsed(null)
      setInput('')
      setImages([])
      setInterimText('')
    }, 2200)
  }

  function handleReset() {
    if (recording) stopRecording()
    setPhase('input')
    setParsed(null)
    setCardEditing(null)
  }

  function handleCancel() {
    if (recording) stopRecording()
    setPhase('input')
    setParsed(null)
    setInput('')
    setImages([])
    setInterimText('')
    setCardEditing(null)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const hasDetected = parsed
    ? (parsed.dailyUpdate.detected || parsed.activityUpdate.detected || parsed.projectUpdate.detected || images.length > 0)
    : false

  const pendingApprovedCount =
    (parsed?.dailyUpdate.detected && dailyApproved && !dailySkipped && !savedCards.has('daily') ? 1 : 0) +
    (parsed?.activityUpdate.detected && activityApproved && !activitySkipped && !savedCards.has('activity') ? 1 : 0) +
    (parsed ? [...approvedProjects].filter((k) => !skippedProjects.has(k) && !savedCards.has(k)).length : 0) +
    (images.length > 0 ? 1 : 0)

  const speechSupported = typeof window !== 'undefined' && getSpeechCtor() !== null

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* History */}
      {history.length > 0 && phase === 'input' && (
        <div className="rounded-xl bg-[--surface] border border-white/[0.06] overflow-hidden mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-700 px-4 py-2.5 border-b border-white/[0.04]">
            Recent Commands
          </p>
          <div className="max-h-36 overflow-y-auto">
            {history.map((h) => <HistoryRow key={h.id} entry={h} />)}
          </div>
        </div>
      )}

      {/* Review: detected cards */}
      {phase === 'review' && parsed && (
        <div className="space-y-2 mb-3">
          {!hasDetected && (
            <div className="rounded-xl border border-white/[0.06] bg-[--surface] px-4 py-3">
              <p className="text-[12px] text-zinc-500">No structured updates detected.</p>
              <p className="text-[10px] text-zinc-700 font-mono mt-0.5">
                Try: "I had 2400 calories and benched 225 for 5 on PLAY Productions shoot"
              </p>
            </div>
          )}

          {parsed.dailyUpdate.detected && (
            <DailyCard
              fields={parsed.dailyUpdate.fields}
              editedFields={editedDailyFields}
              editing={cardEditing === 'daily'}
              approved={dailyApproved} skipped={dailySkipped}
              saved={savedCards.has('daily')}
              onApprove={() => { setDailyApproved(true); setDailySkipped(false) }}
              onSkip={() => { setDailySkipped(true); setDailyApproved(false) }}
              onSave={saveDaily}
              onEdit={() => setCardEditing(cardEditing === 'daily' ? null : 'daily')}
              onFieldChange={(k, v) => setEditedDailyFields((prev) => ({ ...prev, [k]: v }))}
            />
          )}

          {parsed.activityUpdate.detected && (
            <ActivityCard
              activity={parsed.activityUpdate}
              editedDuration={editedDuration}
              editedDistance={editedDistance}
              editing={cardEditing === 'activity'}
              approved={activityApproved} skipped={activitySkipped}
              saved={savedCards.has('activity')}
              onApprove={() => { setActivityApproved(true); setActivitySkipped(false) }}
              onSkip={() => { setActivitySkipped(true); setActivityApproved(false) }}
              onSave={saveActivity}
              onEdit={() => setCardEditing(cardEditing === 'activity' ? null : 'activity')}
              onDurationChange={setEditedDuration}
              onDistanceChange={setEditedDistance}
            />
          )}

          {parsed.projectUpdate.matches.map((match) => {
            const key = match.projectId ?? match.projectTitle
            return (
              <ProjectCard
                key={key}
                match={match}
                editedText={editedProjectTexts.get(key) ?? match.updateText}
                editing={cardEditing === key}
                createTask={createTaskFor.has(match.projectId ?? '')}
                approved={approvedProjects.has(key)} skipped={skippedProjects.has(key)}
                saved={savedCards.has(key)}
                onApprove={() => {
                  setApprovedProjects((s) => new Set([...s, key]))
                  setSkippedProjects((s) => { const n = new Set(s); n.delete(key); return n })
                }}
                onSkip={() => {
                  setSkippedProjects((s) => new Set([...s, key]))
                  setApprovedProjects((s) => { const n = new Set(s); n.delete(key); return n })
                }}
                onSave={() => saveProject(match)}
                onEdit={() => setCardEditing(cardEditing === key ? null : key)}
                onTextChange={(v) => setEditedProjectTexts((m) => new Map(m).set(key, v))}
                onToggleTask={() => setCreateTaskFor((s) => {
                  const n = new Set(s)
                  const id = match.projectId ?? ''
                  n.has(id) ? n.delete(id) : n.add(id)
                  return n
                })}
              />
            )
          })}

          {images.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onCategoryChange={(cat) => updateImageCategory(img.id, cat)}
              onRemove={() => removeImage(img.id)}
            />
          ))}
        </div>
      )}

      {/* Save confirmation */}
      {phase === 'saved' && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] px-4 py-4 mb-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-green-400">Saved to Picard OS</p>
            <p className="text-[10px] font-mono text-green-500/60 mt-0.5">{parsed?.summary}</p>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="rounded-2xl bg-[--surface] border border-white/[0.07] overflow-hidden card-elevated">
        <div className="px-4 pt-4 pb-1">
          <textarea
            value={input}
            onChange={(e) => { if (!recording) setInput(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                phase === 'review' ? handleSaveAll() : handleAnalyze()
              }
              if (e.key === 'Escape' && phase === 'review') handleReset()
            }}
            disabled={phase === 'saved'}
            readOnly={recording}
            rows={4}
            placeholder={
              recording
                ? 'Listening…'
                : phase === 'review'
                ? 'Edit your command, then re-analyze…'
                : 'Tell XODUS what happened — workouts, meals, project updates, how you\'re feeling…'
            }
            className={`w-full bg-transparent text-[13px] text-white placeholder-zinc-700 focus:outline-none resize-none leading-relaxed ${
              recording ? 'text-zinc-300' : ''
            }`}
          />
          {interimText && (
            <p className="text-[13px] text-zinc-500 italic pb-1">{interimText}</p>
          )}
        </div>

        {/* Image thumbnail strip (input phase) */}
        {images.length > 0 && phase === 'input' && (
          <div className="px-4 pb-3 flex gap-2 flex-wrap">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img src={img.dataUrl} alt={img.name}
                  className="w-12 h-12 object-cover rounded-lg border border-white/10" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.05]">
          {speechSupported && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={phase === 'saved'}
              title={recording ? 'Stop recording' : 'Dictate'}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                recording
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse'
                  : 'border border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300'
              }`}
            >
              {recording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === 'saved'}
            title="Attach image"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition-all"
          >
            <Paperclip size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex-1" />

          <span className="text-[9px] font-mono text-zinc-700 hidden sm:block">
            {phase === 'review'
              ? `⌘↵ save · Esc back · ${pendingApprovedCount} pending`
              : '⌘↵ analyze'}
          </span>

          {phase === 'review' ? (
            <div className="flex gap-1.5">
              <button
                onClick={handleCancel}
                title="Cancel and clear"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] text-zinc-500 hover:border-red-500/30 hover:text-red-400 transition-all"
              >
                <X size={14} />
              </button>
              <button
                onClick={handleReset}
                title="Back to input"
                className="h-8 px-2.5 rounded-lg text-[11px] font-medium border border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300 transition-all"
              >
                Edit
              </button>
              <button
                onClick={handleSaveAll}
                disabled={pendingApprovedCount === 0}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-pink-500 to-cyan-400 text-white hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                <Check size={12} />
                Save {pendingApprovedCount > 0 ? pendingApprovedCount : ''}
              </button>
            </div>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={(!input.trim() && images.length === 0) || phase === 'saved'}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold bg-gradient-to-r from-pink-500 to-cyan-400 text-white hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <Send size={12} />
              Analyze
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

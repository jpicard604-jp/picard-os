'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ShoppingCart, FileText, Dumbbell, FolderOpen, User, Car, DollarSign, MoreHorizontal } from 'lucide-react'
import {
  getAllNotes,
  deleteNote,
  updateNoteStatus,
  NOTES_UPDATED_EVENT,
  type XodusNote,
  type XodusNoteCategory,
} from '@/lib/xodus/notes'

// ── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<XodusNoteCategory, {
  label:  string
  icon:   React.ReactNode
  color:  string
  border: string
  dot:    string
}> = {
  grocery: {
    label:  'Groceries',
    icon:   <ShoppingCart className="w-3 h-3" />,
    color:  'text-emerald-400',
    border: 'border-emerald-500/20',
    dot:    'bg-emerald-400',
  },
  fitness: {
    label:  'Fitness',
    icon:   <Dumbbell className="w-3 h-3" />,
    color:  'text-cyan-400',
    border: 'border-cyan-500/20',
    dot:    'bg-cyan-400',
  },
  project: {
    label:  'Projects',
    icon:   <FolderOpen className="w-3 h-3" />,
    color:  'text-blue-400',
    border: 'border-blue-500/20',
    dot:    'bg-blue-400',
  },
  school: {
    label:  'School',
    icon:   <FileText className="w-3 h-3" />,
    color:  'text-violet-400',
    border: 'border-violet-500/20',
    dot:    'bg-violet-400',
  },
  personal: {
    label:  'Personal',
    icon:   <User className="w-3 h-3" />,
    color:  'text-pink-400',
    border: 'border-pink-500/20',
    dot:    'bg-pink-400',
  },
  car: {
    label:  'Car',
    icon:   <Car className="w-3 h-3" />,
    color:  'text-amber-400',
    border: 'border-amber-500/20',
    dot:    'bg-amber-400',
  },
  money: {
    label:  'Money',
    icon:   <DollarSign className="w-3 h-3" />,
    color:  'text-yellow-400',
    border: 'border-yellow-500/20',
    dot:    'bg-yellow-400',
  },
  other: {
    label:  'Notes',
    icon:   <MoreHorizontal className="w-3 h-3" />,
    color:  'text-zinc-400',
    border: 'border-zinc-500/20',
    dot:    'bg-zinc-400',
  },
}

const CATEGORY_ORDER: XodusNoteCategory[] = [
  'grocery', 'fitness', 'project', 'personal', 'school', 'money', 'car', 'other',
]

// ── Grocery checklist item ────────────────────────────────────────────────────

function GroceryItem({ note, onDelete }: { note: XodusNote; onDelete: () => void }) {
  const done = note.status === 'done'

  function toggle() {
    updateNoteStatus(note.id, done ? 'open' : 'done')
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
      done ? 'opacity-40' : 'hover:bg-white/[0.03]'
    }`}>
      <button
        onClick={toggle}
        className={`flex-none w-4 h-4 rounded-full border transition-colors ${
          done
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-emerald-500/40 hover:border-emerald-400'
        }`}
        aria-label={done ? 'Mark open' : 'Mark done'}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="w-full h-full text-white" fill="none">
            <path d="M4 8.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-[12px] ${done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>
        {note.body}
      </span>
      <button
        onClick={onDelete}
        className="flex-none opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-400 transition-opacity"
        aria-label="Delete"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Generic note card ─────────────────────────────────────────────────────────

function NoteCard({ note, meta, onDelete }: {
  note:     XodusNote
  meta:     typeof CATEGORY_META[XodusNoteCategory]
  onDelete: () => void
}) {
  return (
    <div className="group flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
      <div className={`flex-none mt-0.5 w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        {note.title && (
          <p className={`text-[11px] font-medium ${meta.color} mb-0.5`}>{note.title}</p>
        )}
        <p className="text-[12px] text-zinc-300 leading-relaxed break-words">{note.body}</p>
      </div>
      <button
        onClick={onDelete}
        className="flex-none mt-0.5 opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-400 transition-opacity"
        aria-label="Delete"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({ category, notes, onDelete }: {
  category: XodusNoteCategory
  notes:    XodusNote[]
  onDelete: (id: string) => void
}) {
  const meta = CATEGORY_META[category]
  const isGrocery = category === 'grocery'
  const open  = notes.filter(n => n.status !== 'done').length
  const done  = notes.filter(n => n.status === 'done').length

  return (
    <div className={`rounded-xl bg-[--surface] border ${meta.border} overflow-hidden`}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.04]">
        <span className={`${meta.color}`}>{meta.icon}</span>
        <span className={`text-[10px] font-mono uppercase tracking-[0.14em] ${meta.color}`}>
          {meta.label}
        </span>
        <span className="ml-auto text-[9px] font-mono text-zinc-700">
          {isGrocery ? `${open} open · ${done} done` : `${notes.length}`}
        </span>
      </div>

      {/* Items */}
      <div className={isGrocery ? 'py-1' : 'py-1 space-y-0.5'}>
        {isGrocery
          ? notes.map(n => (
              <GroceryItem
                key={n.id}
                note={n}
                onDelete={() => onDelete(n.id)}
              />
            ))
          : notes.map(n => (
              <NoteCard
                key={n.id}
                note={n}
                meta={meta}
                onDelete={() => onDelete(n.id)}
              />
            ))
        }
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function NotesPanel() {
  const [notes, setNotes] = useState<XodusNote[]>([])

  const load = useCallback(() => {
    setNotes(getAllNotes())
  }, [])

  useEffect(() => {
    load()
    window.addEventListener(NOTES_UPDATED_EVENT, load)
    return () => window.removeEventListener(NOTES_UPDATED_EVENT, load)
  }, [load])

  function handleDelete(id: string) {
    deleteNote(id)
    // deleteNote dispatches NOTES_UPDATED_EVENT → load() fires automatically
  }

  // Group by category, preserve CATEGORY_ORDER
  const grouped = CATEGORY_ORDER.reduce<Record<XodusNoteCategory, XodusNote[]>>(
    (acc, cat) => {
      acc[cat] = notes.filter(n => n.category === cat)
      return acc
    },
    {} as Record<XodusNoteCategory, XodusNote[]>,
  )

  const populated = CATEGORY_ORDER.filter(cat => grouped[cat].length > 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-600">
          XODUS Notes
        </span>
        {notes.length > 0 && (
          <span className="text-[9px] font-mono text-zinc-700">{notes.length} total</span>
        )}
      </div>

      {populated.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] bg-[--surface] px-5 py-8 text-center">
          <p className="text-[12px] text-zinc-600 leading-relaxed">
            Tell XODUS what to remember.
          </p>
          <p className="text-[11px] text-zinc-700 mt-1 leading-relaxed">
            "Add eggs to groceries" · "Note for Picard OS" · "Log that I had a rough day"
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {populated.map(cat => (
            <CategorySection
              key={cat}
              category={cat}
              notes={grouped[cat]}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

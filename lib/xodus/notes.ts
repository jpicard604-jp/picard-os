// XODUS Notes — simple localStorage-backed note store.
// Supports groceries as category 'grocery'. Designed to feed Obsidian export later.

export type XodusNoteCategory =
  | 'grocery' | 'fitness' | 'school' | 'project'
  | 'personal' | 'car' | 'money' | 'other'

export interface XodusNote {
  id:        string
  title?:    string
  body:      string
  category:  XodusNoteCategory
  date:      string                       // YYYY-MM-DD — the day the note refers to
  source:    'xodus' | 'manual' | 'imported'
  createdAt: string                       // ISO timestamp
}

const KEY = 'picard_xodus_notes_v1'
export const NOTES_UPDATED_EVENT = 'picard:notes-updated'

function loadAll(): XodusNote[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as XodusNote[]) : []
  } catch { return [] }
}

function saveAll(notes: XodusNote[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(notes))
    window.dispatchEvent(new CustomEvent(NOTES_UPDATED_EVENT))
  } catch {}
}

export function getAllNotes(): XodusNote[] {
  return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getNotesByCategory(category: XodusNoteCategory): XodusNote[] {
  return getAllNotes().filter(n => n.category === category)
}

export function getRecentNotes(limit = 5): XodusNote[] {
  return getAllNotes().slice(0, limit)
}

export function addNote(input: Omit<XodusNote, 'id' | 'createdAt'>): XodusNote {
  const note: XodusNote = {
    ...input,
    id:        `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  const all = loadAll()
  all.push(note)
  saveAll(all)
  return note
}

export function addNotes(notes: Omit<XodusNote, 'id' | 'createdAt'>[]): XodusNote[] {
  const created: XodusNote[] = notes.map((n, i) => ({
    ...n,
    id:        `note_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    createdAt: new Date().toISOString(),
  }))
  const all = loadAll()
  all.push(...created)
  saveAll(all)
  return created
}

export function deleteNote(id: string): void {
  saveAll(loadAll().filter(n => n.id !== id))
}

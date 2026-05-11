// Client-side applier for XodusAction[].
//
// Runs in the browser only — talks to localStorage via existing lib/ modules.
// Returns a per-action result so the UI can show "applied" vs "pending" chips.
//
// Server-side application (Telegram inbox, Supabase sync) is a separate path.
// See docs/xodus-agent-router.md § Server-side application strategy.

import { addGoals, getGoalsForDate, toggleGoal } from '../daily-goals'
import { saveNutritionProfile } from '../nutrition-profile'
import { getTodayLog, saveTodayLog, emptyLog, getTodayKey } from '../storage'
import { addNote, getAllNotes, updateNoteStatus } from './notes'
import { addActivityLog } from '../fitness'
import type { ActivityType, ActivityLog } from '../fitness'
import type { XodusAction } from './action-types'

export interface AppliedActionResult {
  type:    XodusAction['type']
  status:  'applied' | 'pending' | 'failed'
  message: string
}

export interface ApplyXodusActionsResult {
  applied: number
  pending: number
  failed:  number
  results: AppliedActionResult[]
}

// ─── Fuzzy match helper ───────────────────────────────────────────────────────

function fuzzyMatch(query: string, candidate: string): boolean {
  const q = query.toLowerCase().trim()
  const c = candidate.toLowerCase()
  if (c.includes(q)) return true
  const words = q.split(/\s+/).filter(w => w.length > 3)
  return words.length > 0 && words.every(w => c.includes(w))
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function applyXodusActionsClient(actions: XodusAction[]): ApplyXodusActionsResult {
  if (typeof window === 'undefined') {
    return { applied: 0, pending: actions.length, failed: 0, results: [] }
  }

  const results: AppliedActionResult[] = []

  for (const action of actions) {
    try {
      results.push(applyOne(action))
    } catch (err) {
      console.error('[xodus action failed]', action.type, err)
      results.push({
        type:    action.type,
        status:  'failed',
        message: `${action.type} failed`,
      })
    }
  }

  return {
    applied: results.filter(r => r.status === 'applied').length,
    pending: results.filter(r => r.status === 'pending').length,
    failed:  results.filter(r => r.status === 'failed').length,
    results,
  }
}

// ─── Per-action handlers ──────────────────────────────────────────────────────

function applyOne(action: XodusAction): AppliedActionResult {
  const today = new Date().toISOString().slice(0, 10)

  switch (action.type) {
    case 'create_note': {
      addNote({
        title:    action.title,
        body:     action.body,
        category: action.category ?? 'personal',
        date:     action.date ?? today,
        source:   'xodus',
      })
      const preview = action.body.length > 40 ? action.body.slice(0, 40) + '…' : action.body
      const tag = action.category === 'grocery' ? 'Grocery' : 'Note'
      return { type: 'create_note', status: 'applied', message: `${tag}: ${preview}` }
    }

    case 'update_note': {
      const notes = getAllNotes()
      const match = notes.find(n => fuzzyMatch(action.noteQuery, `${n.title ?? ''} ${n.body}`))
      if (!match) {
        return { type: 'update_note', status: 'pending', message: `No note matching "${action.noteQuery}"` }
      }
      if (action.updates.status) updateNoteStatus(match.id, action.updates.status)
      // Body/title/category updates aren't supported by notes.ts yet — fall back to a new note.
      if (action.updates.body || action.updates.title || action.updates.category) {
        addNote({
          title:    action.updates.title ?? match.title,
          body:     action.updates.body  ?? match.body,
          category: action.updates.category ?? match.category,
          date:     match.date,
          source:   'xodus',
        })
      }
      return { type: 'update_note', status: 'applied', message: `Note updated: ${match.title ?? match.body.slice(0, 30)}` }
    }

    case 'create_goal': {
      addGoals(action.date, [{
        text:     action.title,
        category: action.category ?? 'personal',
      }])
      return { type: 'create_goal', status: 'applied', message: `Goal: ${action.title}` }
    }

    case 'complete_goal': {
      const date = action.date ?? today
      const goals = getGoalsForDate(date)
      const match = goals.find(g => fuzzyMatch(action.goalQuery, g.text))
      if (!match) {
        return { type: 'complete_goal', status: 'pending', message: `No goal matching "${action.goalQuery}" today` }
      }
      if (!match.done) toggleGoal(date, match.id)
      return { type: 'complete_goal', status: 'applied', message: `Completed: ${match.text}` }
    }

    case 'update_goal': {
      const date = action.updates.date ?? today
      const goals = getGoalsForDate(date)
      const match = goals.find(g => fuzzyMatch(action.goalQuery, g.text))
      if (!match) {
        return { type: 'update_goal', status: 'pending', message: `No goal matching "${action.goalQuery}"` }
      }
      if (action.updates.status === 'done' && !match.done) toggleGoal(date, match.id)
      if (action.updates.status === 'open' &&  match.done) toggleGoal(date, match.id)
      return { type: 'update_goal', status: 'applied', message: `Updated: ${match.text}` }
    }

    case 'create_grocery': {
      const body = action.items.join(', ')
      addNote({
        title:    'Grocery list',
        body,
        category: 'grocery',
        date:     action.date ?? today,
        source:   'xodus',
      })
      return { type: 'create_grocery', status: 'applied', message: `🛒 ${body.slice(0, 50)}${body.length > 50 ? '…' : ''}` }
    }

    case 'update_nutrition_profile': {
      saveNutritionProfile(action.updates)
      const bits: string[] = []
      if (action.updates.proteinTarget) bits.push(`${action.updates.proteinTarget}g protein`)
      if (action.updates.calorieTarget) bits.push(`${action.updates.calorieTarget} cal`)
      if (action.updates.phase)         bits.push(action.updates.phase)
      return { type: 'update_nutrition_profile', status: 'applied', message: `Nutrition: ${bits.join(' · ') || 'updated'}` }
    }

    case 'log_food': {
      const existing = getTodayLog() ?? emptyLog(getTodayKey())
      const updated = {
        ...existing,
        ...(action.calories !== undefined ? { calories: action.calories } : {}),
        ...(action.protein  !== undefined ? { protein:  action.protein  } : {}),
        savedAt: new Date().toISOString(),
      }
      saveTodayLog(updated)
      const bits: string[] = []
      if (action.calories) bits.push(`${action.calories} cal`)
      if (action.protein)  bits.push(`${action.protein}g protein`)
      return { type: 'log_food', status: 'applied', message: `Logged: ${bits.join(' · ')}` }
    }

    case 'log_manual_health': {
      const existing = getTodayLog() ?? emptyLog(getTodayKey())
      const patch: Record<string, number> = {}
      if (action.steps      !== undefined) patch.steps      = action.steps
      if (action.sleepHours !== undefined) patch.sleepHours = action.sleepHours
      if (action.weightLb   !== undefined) patch.weight     = action.weightLb
      if (Object.keys(patch).length === 0) {
        return { type: 'log_manual_health', status: 'pending', message: 'Health data not mapped to a daily-log column yet' }
      }
      saveTodayLog({ ...existing, ...patch, savedAt: new Date().toISOString() })
      const bits = Object.entries(patch).map(([k, v]) => `${k} ${v}`).join(' · ')
      return { type: 'log_manual_health', status: 'applied', message: `Health: ${bits}` }
    }

    case 'create_workout_log': {
      const validTypes: ActivityType[] = ['strength','run','row','walk','swim','bike','recovery','mobility','hiit','custom']
      const type: ActivityType = validTypes.includes(action.activityType as ActivityType)
        ? action.activityType as ActivityType
        : 'custom'
      const entry: ActivityLog = {
        id:        `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date:      action.date ?? today,
        type,
        label:     action.title,
        duration:  action.durationMinutes,
        exercises: action.exercises?.map(e => ({
          exercise: e.name,
          sets:     e.sets,
          reps:     e.reps,
          weight:   e.weight,
          notes:    e.notes,
        })),
        notes:     action.notes,
        source:    'manual',
        createdAt: new Date().toISOString(),
      }
      addActivityLog(entry)
      const summary = action.exercises && action.exercises.length > 0
        ? `${action.exercises.length} exercise${action.exercises.length > 1 ? 's' : ''}`
        : (action.title ?? type)
      return { type: 'create_workout_log', status: 'applied', message: `💪 Workout: ${summary}` }
    }

    case 'create_project_update': {
      // Server-side project mutation is not wired yet — surface as a note + pending.
      addNote({
        title:    action.projectName ? `${action.projectName} update` : 'Project update',
        body:     action.update + (action.nextAction ? `\nNext: ${action.nextAction}` : ''),
        category: 'project',
        date:     today,
        source:   'xodus',
      })
      return { type: 'create_project_update', status: 'pending', message: `Project note saved — confirm to apply to ${action.projectName ?? 'project'}` }
    }

    case 'create_memory_candidate': {
      // Memory records are static in lib/xodus/memory.ts. Save as a note for review.
      addNote({
        title:    `Memory: ${action.title}`,
        body:     `${action.summary}\n\nCategory: ${action.category} · Status: ${action.status ?? 'needs_confirmation'}`,
        category: 'personal',
        date:     today,
        source:   'xodus',
      })
      return { type: 'create_memory_candidate', status: 'pending', message: `🧠 Memory candidate saved for review: ${action.title}` }
    }

    case 'add_open_loop': {
      addNote({
        title:    action.title,
        body:     action.body ?? action.title,
        category: 'personal',
        date:     today,
        source:   'xodus',
      })
      return { type: 'add_open_loop', status: 'applied', message: `Open loop: ${action.title}` }
    }

    case 'training_recommendation':
      // Informational — surfaced in the message itself; no mutation.
      return { type: 'training_recommendation', status: 'applied', message: `Training: ${action.intensity ?? 'recommendation'}` }

    case 'save_pending_review':
      return { type: 'save_pending_review', status: 'pending', message: `Pending review: ${action.reason}` }

    case 'no_op':
      return { type: 'no_op', status: 'applied', message: action.reason }
  }
}

// ─── Backwards-compat shim for callers still using XodusChatAction ────────────

import type { XodusChatAction } from './chat-types'

export function legacyToXodusActions(legacy: XodusChatAction[]): XodusAction[] {
  const out: XodusAction[] = []
  for (const a of legacy) {
    switch (a.type) {
      case 'create_goal':  out.push({ type: 'create_goal',  title: a.title, date: a.date, category: a.category, confidence: 0.9 }); break
      case 'create_note':  out.push({ type: 'create_note',  title: a.title, body: a.body, category: a.category, confidence: 0.9 }); break
      case 'update_nutrition': out.push({ type: 'update_nutrition_profile', updates: a.updates, confidence: 0.9 }); break
      case 'log_food':     out.push({ type: 'log_food', calories: a.calories, protein: a.protein, carbs: a.carbs, fat: a.fat, confidence: 0.9 }); break
      case 'training_recommendation': out.push({ type: 'training_recommendation', summary: a.summary, intensity: a.intensity, confidence: 0.9 }); break
    }
  }
  return out
}

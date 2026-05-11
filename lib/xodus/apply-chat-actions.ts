// Client-only — applies XodusChatAction[] to localStorage.
// Returns one human-readable label per action so the UI can show a chip.

import { addGoals } from '../daily-goals'
import { saveNutritionProfile } from '../nutrition-profile'
import { getTodayLog, saveTodayLog, emptyLog, getTodayKey } from '../storage'
import { addNote } from './notes'
import type { XodusChatAction } from './chat-types'

export interface AppliedAction {
  label: string
  ok:    boolean
}

export function applyChatActions(actions: XodusChatAction[]): AppliedAction[] {
  if (typeof window === 'undefined') return []
  const out: AppliedAction[] = []

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_goal': {
          addGoals(action.date, [{
            text:     action.title,
            category: action.category ?? 'personal',
          }])
          out.push({ ok: true, label: `Goal: ${action.title}` })
          break
        }
        case 'create_note': {
          const today = new Date().toISOString().slice(0, 10)
          addNote({
            title:    action.title,
            body:     action.body,
            category: action.category ?? 'personal',
            date:     today,
            source:   'xodus',
          })
          const tag = action.category === 'grocery' ? 'Grocery' : 'Note'
          out.push({ ok: true, label: `${tag}: ${action.body.slice(0, 40)}${action.body.length > 40 ? '…' : ''}` })
          break
        }
        case 'update_nutrition': {
          saveNutritionProfile(action.updates)
          const bits: string[] = []
          if (action.updates.proteinTarget) bits.push(`${action.updates.proteinTarget}g protein`)
          if (action.updates.calorieTarget) bits.push(`${action.updates.calorieTarget} cal`)
          if (action.updates.phase) bits.push(action.updates.phase)
          out.push({ ok: true, label: `Nutrition: ${bits.join(' · ') || 'updated'}` })
          break
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
          out.push({ ok: true, label: `Food logged: ${bits.join(' · ')}` })
          break
        }
        case 'training_recommendation': {
          // Informational only — no mutation. Shown in the message itself.
          out.push({ ok: true, label: `Training: ${action.intensity ?? 'recommendation'}` })
          break
        }
      }
    } catch {
      out.push({ ok: false, label: `Failed: ${action.type}` })
    }
  }

  return out
}

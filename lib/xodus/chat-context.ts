// Client-side context gatherer for the XODUS chat route.
// Picks the smallest set of fields needed for guidance — kept compact to control token cost.

import { getTodayLog } from '../storage'
import { getNutritionProfile } from '../nutrition-profile'
import { getTodayGoals } from '../daily-goals'
import { getActivityLogs, getThisWeekLogs } from '../fitness'
import { getRecentNotes } from './notes'
import type { XodusChatContext } from './chat-types'

export function gatherChatContext(): XodusChatContext {
  const todayDate = new Date().toISOString().slice(0, 10)

  if (typeof window === 'undefined') {
    return {
      todayDate,
      dailyLog: null,
      nutritionProfile: {
        phase: 'cutting', proteinTarget: 210, calorieTarget: 2200,
        carbTarget: 210, fatTarget: 58,
      },
      todayGoals: [],
      recentActivities: [],
      recentNotes: [],
      weekActivityCount: 0,
    }
  }

  const log     = getTodayLog()
  const profile = getNutritionProfile()
  const goals   = getTodayGoals()
  const recent  = getActivityLogs().slice(0, 3)
  const week    = getThisWeekLogs()
  const notes   = getRecentNotes(3)

  return {
    todayDate,
    dailyLog: log ? {
      recoveryScore: log.recoveryScore,
      hrv:           log.hrv,
      restingHR:     log.restingHR,
      strain:        log.strain,
      sleepHours:    log.sleepHours,
      sleepQuality:  log.sleepQuality,
      protein:       log.protein,
      calories:      log.calories,
      weight:        log.weight,
      mood:          log.mood,
    } : null,
    nutritionProfile: {
      phase:         profile.phase,
      proteinTarget: profile.proteinTarget ?? null,
      calorieTarget: profile.calorieTarget ?? null,
      carbTarget:    profile.carbTarget    ?? null,
      fatTarget:     profile.fatTarget     ?? null,
    },
    todayGoals: goals.map(g => ({ text: g.text, category: g.category, done: g.done })),
    recentActivities: recent.map(a => ({
      date:     a.date,
      type:     a.type,
      label:    a.label,
      duration: a.duration,
    })),
    recentNotes: notes.map(n => ({
      category: n.category,
      body:     n.body.length > 100 ? n.body.slice(0, 100) + '…' : n.body,
      date:     n.date,
    })),
    weekActivityCount: week.length,
  }
}

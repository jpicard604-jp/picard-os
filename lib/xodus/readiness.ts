// Wellness / readiness signal — pure function, transparent inputs.
// NEVER a medical or mental-health diagnosis. Just a directional cue
// derived from self-reported metrics. Always lists the inputs used.

import type { XodusChatContext, ReadinessAssessment } from './chat-types'

export function computeReadiness(ctx: XodusChatContext): ReadinessAssessment {
  const inputs: string[] = []
  const log = ctx.dailyLog

  let score = 0     // -3 .. +3 directional
  let evidence = 0  // count of usable inputs

  if (log?.recoveryScore !== null && log?.recoveryScore !== undefined) {
    inputs.push(`recovery ${log.recoveryScore}`)
    evidence++
    if (log.recoveryScore >= 70) score += 2
    else if (log.recoveryScore >= 50) score += 0
    else score -= 2
  }

  if (log?.sleepHours !== null && log?.sleepHours !== undefined) {
    inputs.push(`sleep ${log.sleepHours}h`)
    evidence++
    if (log.sleepHours >= 7.5) score += 1
    else if (log.sleepHours >= 6) score += 0
    else score -= 1
  }

  if (log?.hrv !== null && log?.hrv !== undefined) {
    inputs.push(`HRV ${log.hrv}ms`)
    evidence++
  }

  if (log?.strain !== null && log?.strain !== undefined) {
    inputs.push(`strain ${log.strain}`)
    evidence++
    if (log.strain >= 18) score -= 1
  }

  if (log?.mood !== null && log?.mood !== undefined) {
    inputs.push(`mood ${log.mood}/5`)
    evidence++
    if (log.mood <= 2) score -= 1
    else if (log.mood >= 4) score += 1
  }

  // Goal workload pressure
  const openGoals = ctx.todayGoals.filter(g => !g.done).length
  if (openGoals >= 6) {
    inputs.push(`${openGoals} open goals`)
    score -= 1
  }

  if (evidence < 2) {
    return {
      signal: 'unknown',
      inputs,
      note: inputs.length === 0
        ? 'Not enough check-in data yet — log recovery, sleep, or mood for a readiness signal.'
        : 'Based on limited data today.',
    }
  }

  let signal: ReadinessAssessment['signal']
  if (score >= 2) signal = 'green'
  else if (score >= 0) signal = 'amber'
  else signal = 'red'

  const note =
    signal === 'green' ? 'Body looks ready. Inputs used: ' + inputs.join(', ') + '.'
    : signal === 'amber' ? 'Mixed signal — moderate today. Inputs used: ' + inputs.join(', ') + '.'
    : 'Low readiness today. Inputs used: ' + inputs.join(', ') + '.'

  return { signal, inputs, note }
}

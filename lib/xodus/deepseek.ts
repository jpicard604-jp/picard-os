// XODUS DeepSeek processor — PLACEHOLDER.
//
// Future role:
//   - read pending xodus_inbox rows (raw intake items)
//   - send each through DeepSeek to extract structured fields
//   - convert into XodusActions (goals, tasks, log_food, etc.)
//   - update memory nodes for Obsidian/brain graph
//   - mark the inbox row processed
//
// Today: does nothing unless explicitly enabled. Safe to import anywhere.

import type { NormalizedIntake } from './universal-intake'

export interface DeepSeekResult {
  processed: boolean
  reason?:   string
  // Future: structured extraction fields land here
}

/**
 * Returns true only when:
 *   - DEEPSEEK_API_KEY is set
 *   - XODUS_AI_PROCESSING_ENABLED === "true"
 *
 * Until both are present, this stays disabled. No accidental API spend.
 */
export function isDeepSeekEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
      && process.env.XODUS_AI_PROCESSING_ENABLED === 'true'
}

/**
 * Future implementation will:
 *   1. Build a DeepSeek prompt with the message + tags + recent context
 *   2. Request structured JSON output (goals, tasks, food, health, project updates)
 *   3. Map results into the existing XodusAction schema
 *   4. Pass through routeXodusInput() for shared validation
 *   5. Return DeepSeekResult with extracted fields
 *
 * For now: returns { processed: false, reason: 'disabled' } when the
 * feature flag is off. No network calls.
 */
export async function processIntakeWithDeepSeek(_item: NormalizedIntake): Promise<DeepSeekResult> {
  if (!isDeepSeekEnabled()) {
    return { processed: false, reason: 'disabled' }
  }
  // Live processing path — to be implemented.
  return { processed: false, reason: 'not_implemented' }
}

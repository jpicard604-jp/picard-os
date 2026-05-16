'use client'

// useWhoopAutoSync — fire WHOOP sync in the background when a page mounts,
// guarded by a localStorage timestamp so we don't spam the API.
//
// Behaviour:
//   - On mount, read picard_whoop_last_auto_sync_at.
//   - If older than the interval, GET /api/integrations/whoop/sync to check
//     connection; if connected, POST to trigger a sync.
//   - Always update the timestamp after an *attempt* (success or graceful
//     fail) so we never tight-loop.
//   - Failures (no env, not connected, refresh_failed, etc.) are swallowed —
//     manual "Sync Now" remains the source of truth for status.
//
// Does not modify OAuth, env, or Supabase schema.

import { useEffect, useRef, useState } from 'react'

const TIMESTAMP_KEY = 'picard_whoop_last_auto_sync_at'
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

export interface WhoopAutoSyncOptions {
  /** Minimum ms between auto-syncs. Defaults to 30 minutes. */
  intervalMs?: number
  /** When true, skip the auto-sync entirely (e.g. user paused integrations). */
  disabled?: boolean
}

export interface WhoopAutoSyncState {
  /** ISO timestamp of the last auto-sync *attempt* (success or graceful fail). */
  lastAttemptAt: string | null
  /** Last attempt status — null until first run on this page mount. */
  lastStatus: 'synced' | 'skipped' | 'not_connected' | 'error' | null
}

function readTimestamp(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(TIMESTAMP_KEY)
  if (!raw) return 0
  const n = Date.parse(raw)
  return Number.isFinite(n) ? n : 0
}

function writeTimestamp(): string {
  const iso = new Date().toISOString()
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(TIMESTAMP_KEY, iso) } catch {}
  }
  return iso
}

export function useWhoopAutoSync(options: WhoopAutoSyncOptions = {}): WhoopAutoSyncState {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  const ranThisMount = useRef(false)
  const [state, setState] = useState<WhoopAutoSyncState>({ lastAttemptAt: null, lastStatus: null })

  useEffect(() => {
    if (options.disabled) return
    if (ranThisMount.current) return
    ranThisMount.current = true

    const last = readTimestamp()
    if (Date.now() - last < intervalMs) {
      setState({ lastAttemptAt: last ? new Date(last).toISOString() : null, lastStatus: 'skipped' })
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    void (async () => {
      try {
        const statusRes = await fetch('/api/integrations/whoop/sync', { signal: controller.signal })
        const status = await statusRes.json() as { connected?: boolean; reason?: string }
        if (cancelled) return
        if (!status.connected) {
          const iso = writeTimestamp()
          setState({ lastAttemptAt: iso, lastStatus: 'not_connected' })
          return
        }

        const syncRes = await fetch('/api/integrations/whoop/sync', { method: 'POST' })
        const syncBody = await syncRes.json().catch(() => ({})) as { synced?: boolean; reason?: string }
        if (cancelled) return

        const iso = writeTimestamp()
        setState({
          lastAttemptAt: iso,
          lastStatus: syncBody.synced ? 'synced' : 'error',
        })
      } catch {
        if (cancelled) return
        const iso = writeTimestamp()
        setState({ lastAttemptAt: iso, lastStatus: 'error' })
      } finally {
        clearTimeout(timeout)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [intervalMs, options.disabled])

  return state
}

export const WHOOP_AUTO_SYNC_TIMESTAMP_KEY = TIMESTAMP_KEY

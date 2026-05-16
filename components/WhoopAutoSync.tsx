'use client'

// Headless mount for the WHOOP auto-sync hook. Renders nothing.
// Drop this into a page (dashboard / fitness / settings) to trigger one
// guarded auto-sync attempt per app-session interval. Manual Sync Now is
// untouched.

import { useWhoopAutoSync } from '@/hooks/useWhoopAutoSync'

export default function WhoopAutoSync() {
  useWhoopAutoSync()
  return null
}

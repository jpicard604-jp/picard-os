// SERVER-ONLY — never import from 'use client' components.
import type {
  WhoopTokenResponse,
  WhoopRecoveryRecord,
  WhoopCycleRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
  WhoopCollection,
  WhoopBodyMeasurement,
} from './types'

const BASE = 'https://api.prod.whoop.com'
const API = `${BASE}/developer/v2`
const TOKEN_URL = `${BASE}/oauth/oauth2/token`

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
}

export async function exchangeCode(code: string): Promise<WhoopTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${res.status}`)
  return res.json() as Promise<WhoopTokenResponse>
}

export async function refreshWhoopToken(refreshToken: string): Promise<WhoopTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
      scope: 'offline',
    }),
  })
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${res.status}`)
  return res.json() as Promise<WhoopTokenResponse>
}

export async function fetchLatestRecovery(accessToken: string): Promise<WhoopRecoveryRecord | null> {
  const res = await fetch(`${API}/recovery?limit=1`, { headers: authHeaders(accessToken) })
  if (!res.ok) return null
  const data = (await res.json()) as WhoopCollection<WhoopRecoveryRecord>
  return data.records[0] ?? null
}

export async function fetchLatestCycle(accessToken: string): Promise<WhoopCycleRecord | null> {
  const res = await fetch(`${API}/cycle?limit=1`, { headers: authHeaders(accessToken) })
  if (!res.ok) return null
  const data = (await res.json()) as WhoopCollection<WhoopCycleRecord>
  return data.records[0] ?? null
}

export async function fetchLatestSleep(accessToken: string): Promise<WhoopSleepRecord | null> {
  const res = await fetch(`${API}/activity/sleep?limit=3`, { headers: authHeaders(accessToken) })
  if (!res.ok) return null
  const data = (await res.json()) as WhoopCollection<WhoopSleepRecord>
  return data.records.find((r) => !r.nap && r.score_state === 'SCORED') ?? null
}

export async function fetchTodayWorkouts(accessToken: string): Promise<WhoopWorkoutRecord[]> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const url = `${API}/activity/workout?limit=10&start=${encodeURIComponent(start.toISOString())}`
  const res = await fetch(url, { headers: authHeaders(accessToken) })
  if (!res.ok) return []
  const data = (await res.json()) as WhoopCollection<WhoopWorkoutRecord>
  return data.records
}

export async function fetchBodyMeasurements(accessToken: string): Promise<WhoopBodyMeasurement | null> {
  const res = await fetch(`${API}/user/measurement/body`, { headers: authHeaders(accessToken) })
  if (!res.ok) return null
  return res.json() as Promise<WhoopBodyMeasurement>
}

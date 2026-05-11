import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/supabase-test
// Server-side connection test. Reports env var presence (never values) for diagnosing
// production misconfigurations. Remove or gate this route before shipping to end users.
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
  }
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null

  try {
    const admin = createAdminClient()

    // listUsers requires a valid service-role key — confirms connectivity and key validity.
    const { error } = await admin.auth.admin.listUsers({ perPage: 1 })

    if (error) {
      return NextResponse.json({ ok: false, env, project, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, env, project, message: 'Admin client connected.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, env, project, error: message }, { status: 500 })
  }
}

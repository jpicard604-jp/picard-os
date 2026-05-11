import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/whoop/client'

const USER_ID = process.env.PICARD_USER_ID || '00000000-0000-0000-0000-000000000001'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const origin = request.nextUrl.origin

  console.log('[whoop/callback] start', {
    code_present: !!code,
    state_present: !!state,
    error_param: error ?? null,
  })

  if (error) {
    return NextResponse.redirect(`${origin}/settings?whoop=denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?whoop=error`)
  }

  // CSRF validation via httpOnly state cookie
  const stateCookie = request.cookies.get('whoop_oauth_state')?.value
  const stateMatches = !!stateCookie && stateCookie === state
  console.log('[whoop/callback] csrf', {
    cookie_present: !!stateCookie,
    state_matches: stateMatches,
  })

  if (!stateMatches) {
    // State mismatch — could be expired cookie or CSRF attempt.
    // Redirect gracefully instead of 400 so users see a useful message.
    return NextResponse.redirect(`${origin}/settings?whoop=state_mismatch`)
  }

  let tokens
  try {
    tokens = await exchangeCode(code)
    console.log('[whoop/callback] exchange', {
      status: 200,
      has_access: !!tokens.access_token,
      has_refresh: !!tokens.refresh_token,
      expires_in: tokens.expires_in,
    })
  } catch (err) {
    console.error('[whoop/callback] exchange failed', { error: String(err) })
    return NextResponse.redirect(`${origin}/settings?whoop=error`)
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const now = new Date().toISOString()

  try {
    const supabase = createAdminClient()
    console.log('[whoop/callback] upsert', { user_id_present: !!USER_ID })

    const { error: dbError } = await supabase.from('whoop_tokens').upsert(
      {
        user_id: USER_ID,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    )

    console.log('[whoop/callback] upsert result', {
      success: !dbError,
      error_code: dbError?.code ?? null,
      error_message: dbError?.message ?? null,
    })

    if (dbError) {
      if (dbError.code === '42P01') {
        // Table doesn't exist — redirect so settings page can show the setup message
        return NextResponse.redirect(`${origin}/settings?whoop=table_missing`)
      }
      return NextResponse.redirect(`${origin}/settings?whoop=error`)
    }
  } catch (err) {
    console.error('[whoop/callback] supabase threw', { error: String(err) })
    return NextResponse.redirect(`${origin}/settings?whoop=error`)
  }

  const response = NextResponse.redirect(`${origin}/settings?whoop=connected`)
  response.cookies.delete('whoop_oauth_state')
  return response
}

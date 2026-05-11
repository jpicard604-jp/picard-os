import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.WHOOP_CLIENT_ID
  const redirectUri = process.env.WHOOP_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: 'WHOOP credentials not configured',
        missing: {
          WHOOP_CLIENT_ID: !clientId,
          WHOOP_CLIENT_SECRET: !process.env.WHOOP_CLIENT_SECRET,
          WHOOP_REDIRECT_URI: !redirectUri,
        },
        help: 'Add these vars to .env.local — see docs/whoop-integration-plan.md § 2',
      },
      { status: 503 }
    )
  }

  const state = crypto.randomUUID()
  const url = new URL('https://api.prod.whoop.com/oauth/oauth2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set(
    'scope',
    'read:recovery read:cycles read:workout read:sleep read:profile offline'
  )
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  const response = NextResponse.redirect(url.toString())
  response.cookies.set('whoop_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return response
}

// SERVER-ONLY — never import this file in 'use client' components or client-callable modules.
// All AI model calls go through this abstraction. API keys live in server-only env vars.
//
// Environment variables (set in .env.local and Vercel env settings):
//   AI_PROVIDER=deepseek | openai | anthropic | mock
//   AI_MODEL=<provider-specific model id>        (optional override)
//   DEEPSEEK_API_KEY=<key>
//   OPENAI_API_KEY=<key>
//   ANTHROPIC_API_KEY=<key>
//
// Auto-selection: if AI_PROVIDER is unset, the first available key wins (DeepSeek preferred).
// Mock fallback: used when no key is configured — returns a deterministic no_op response.

export type AIProvider = 'anthropic' | 'deepseek' | 'openai' | 'mock'

export interface AIRequest {
  systemPrompt: string
  userMessage: string
  responseFormat?: 'text' | 'json'  // 'json' requests JSON-mode where supported
  maxTokens?: number
  temperature?: number
}

export interface AIResponse {
  text: string
  provider: AIProvider
  model: string
  inputTokens?: number
  outputTokens?: number
}

// ─── Provider selection ───────────────────────────────────────────────────────

function resolveProvider(): AIProvider {
  const explicit = (process.env.AI_PROVIDER ?? '').toLowerCase()

  if (explicit === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (explicit === 'openai'    && process.env.OPENAI_API_KEY)    return 'openai'
  if (explicit === 'deepseek'  && process.env.DEEPSEEK_API_KEY)  return 'deepseek'
  if (explicit === 'mock') return 'mock'

  // Auto-select first available key. DeepSeek is cheapest so checked first.
  if (process.env.DEEPSEEK_API_KEY)  return 'deepseek'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY)    return 'openai'

  return 'mock'
}

// ─── OpenAI-compatible handler (used for both DeepSeek and OpenAI) ────────────
// DeepSeek uses the same chat completions API format as OpenAI with a different base URL.

interface OpenAICompatResponse {
  choices: Array<{ message: { content: string } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

async function callOpenAICompat(
  req: AIRequest,
  apiKey: string,
  baseUrl: string,
  model: string,
  provider: AIProvider,
): Promise<AIResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user',   content: req.userMessage   },
    ],
    max_tokens:  req.maxTokens  ?? 1024,
    temperature: req.temperature ?? 0.1,
  }

  if (req.responseFormat === 'json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`${provider} API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as OpenAICompatResponse
  return {
    text:         data.choices[0]?.message?.content ?? '',
    provider,
    model,
    inputTokens:  data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  }
}

// ─── Anthropic handler ────────────────────────────────────────────────────────

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

async function callAnthropic(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!
  const model  = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001'

  const body: Record<string, unknown> = {
    model,
    max_tokens:  req.maxTokens  ?? 1024,
    temperature: req.temperature ?? 0.1,
    system:      req.systemPrompt,
    messages:    [{ role: 'user', content: req.userMessage }],
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = (await res.json()) as AnthropicResponse
  return {
    text:         data.content.find((c) => c.type === 'text')?.text ?? '',
    provider:     'anthropic',
    model,
    inputTokens:  data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  }
}

// ─── Mock provider ────────────────────────────────────────────────────────────
// Returns a deterministic no_op so the agent pipeline can be tested end-to-end
// without a real API key. CommandInbox regex parsing still handles real extraction.

function callMock(_req: AIRequest): AIResponse {
  // Produce a JSON envelope that satisfies BOTH consumer shapes:
  //   - brain-router (xodus chat) reads `.reply` + `.actions`
  //   - agent route reads `.actions` + `.summary`
  // The reply is intentionally conversational so the fallback path still
  // sounds like XODUS instead of "no_op classification".
  const reply = "Heads up — XODUS AI provider isn't configured yet, so I'm running on the local rule-based fallback. Workouts, food, groceries, and goal phrases still work; full conversational mode needs a DeepSeek / Anthropic / OpenAI key in env."
  const text = JSON.stringify({
    reply,
    actions: [
      {
        type:                'no_op',
        confidence:          1.0,
        source:              'text',
        summary:             'Mock provider active — no AI key configured.',
        requiresConfirmation: false,
        warnings:            ['No AI provider key configured — set AI_PROVIDER and the matching *_API_KEY.'],
        timestamp:           new Date().toISOString(),
        payload: {
          reason: 'No AI provider is configured.',
        },
      },
    ],
    confidence: 0.5,
    warnings: ['mock_provider'],
    summary: 'Mock provider — configure an AI provider key to enable full extraction.',
  })

  return { text, provider: 'mock', model: 'mock' }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function callAI(req: AIRequest): Promise<AIResponse> {
  const provider = resolveProvider()

  switch (provider) {
    case 'deepseek':
      return callOpenAICompat(
        req,
        process.env.DEEPSEEK_API_KEY!,
        'https://api.deepseek.com/v1',
        process.env.AI_MODEL ?? 'deepseek-chat',
        'deepseek',
      )

    case 'openai':
      return callOpenAICompat(
        req,
        process.env.OPENAI_API_KEY!,
        'https://api.openai.com/v1',
        process.env.AI_MODEL ?? 'gpt-4o-mini',
        'openai',
      )

    case 'anthropic':
      return callAnthropic(req)

    default:
      return callMock(req)
  }
}

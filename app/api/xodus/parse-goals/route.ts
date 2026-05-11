// POST /api/xodus/intake
//
// Lightweight intake route for the DailyGoals card.
// Accepts raw user text, returns XodusIntakeResult.
// Falls back to rule-based parser when AI is unavailable or returns unrecognised JSON.
//
// Body:  { text: string, date?: string /* YYYY-MM-DD, optional */ }
// Response: { ok: true, result: XodusIntakeResult }

import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai/provider'
import { intakeFromRuleParser } from '@/lib/xodus/intake'
import type { XodusIntakeResult } from '@/lib/xodus/intake'

// ─── System prompt ────────────────────────────────────────────────────────────
// Kept stable so Anthropic prompt cache can hit on repeat calls.

const SYSTEM_PROMPT = `You are XODUS, the intake parser for Picard OS — a personal life operating system.

Parse the user's free-text input and return structured JSON. Return ONLY valid JSON with no markdown fences, no explanation, no extra keys.

Required shape:
{
  "summary": "one sentence describing what was extracted",
  "intent": "daily_planning" | "nutrition_update" | "project_update" | "note" | "task" | "mixed" | "unknown",
  "targetDate": "YYYY-MM-DD",
  "goals": [{ "text": "string", "category": "fitness" | "nutrition" | "project" | "school" | "errand" | "personal" | "other" }],
  "nutritionUpdates": { "calorieTarget"?: number, "proteinTarget"?: number, "carbTarget"?: number, "fatTarget"?: number, "phase"?: "cutting" | "maintenance" | "bulking" } | null,
  "notes": [{ "title"?: "string", "body": "string", "category"?: "fitness" | "school" | "project" | "car" | "money" | "personal" | "other" }] | null,
  "projectUpdates": [{ "projectName"?: "string", "update": "string", "nextAction"?: "string" }] | null,
  "confidence": 0.0,
  "source": "ai"
}

Goal category rules:
- fitness: train, gym, run, workout, lift, cardio, yoga, swim, bike, hike, walk, chest, back, legs, shoulders, arms, push, pull, squat, deadlift, bench
- project: build, ship, code, fix, deploy, write, design, finish, launch, commit, pr, bug, feature
- school: study, homework, assignment, class, exam, quiz, review, notes, lecture
- errand: buy, pick up, drop off, call, schedule, book, email, pay, order, grocery, groceries
- nutrition: eat, calories, protein, carbs, fat, meal, food, diet, macro, macros
- personal: everything else (default)

Temporal resolution (use today's date from the user message):
- "tomorrow" → next calendar day
- day name ("monday"/"tuesday" etc.) → nearest upcoming instance of that weekday
- no day mentioned → use today's date

Rules:
- goals: split comma-separated items; each distinct task → separate goal entry
- nutritionUpdates: ONLY if user explicitly sets a new target or changes phase; NOT for logging what was eaten
- notes: use when input is a reflection or insight, not a to-do list
- projectUpdates: use when input describes progress on a named project
- confidence: 1.0 = clear task list; 0.7 = ambiguous; 0.5 = unclear
- goals must always be an array (use [] if none detected)
- source must always be "ai"`

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseIntakeResult(text: string, today: string): XodusIntakeResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/gm, '').replace(/\n?```$/gm, '').trim()
    const json = JSON.parse(cleaned) as Record<string, unknown>

    if (typeof json.summary !== 'string') return null
    if (typeof json.intent  !== 'string') return null
    if (!Array.isArray(json.goals))       return null

    const targetDate = typeof json.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(json.targetDate)
      ? json.targetDate
      : today

    return {
      summary:    json.summary,
      intent:     json.intent as XodusIntakeResult['intent'],
      targetDate,
      goals: (json.goals as unknown[])
        .filter((g): g is { text: string; category: string } =>
          typeof g === 'object' && g !== null &&
          typeof (g as Record<string, unknown>).text === 'string'
        )
        .map(g => ({
          text:     g.text,
          category: g.category as XodusIntakeResult['goals'][number]['category'],
        })),
      nutritionUpdates:
        json.nutritionUpdates && typeof json.nutritionUpdates === 'object' && !Array.isArray(json.nutritionUpdates)
          ? (json.nutritionUpdates as XodusIntakeResult['nutritionUpdates'])
          : undefined,
      notes: Array.isArray(json.notes)
        ? (json.notes as XodusIntakeResult['notes'])
        : undefined,
      projectUpdates: Array.isArray(json.projectUpdates)
        ? (json.projectUpdates as XodusIntakeResult['projectUpdates'])
        : undefined,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.7,
      source: 'ai',
    }
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let text: string
  let today: string

  try {
    const body = (await request.json()) as { text?: unknown; date?: unknown }
    text  = typeof body.text === 'string' ? body.text.trim() : ''
    today = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10)
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!text) {
    return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 })
  }

  // Try AI provider — fall through to rule-based on any failure or unrecognised response shape
  let result: XodusIntakeResult | null = null

  try {
    const aiResponse = await callAI({
      systemPrompt:   SYSTEM_PROMPT,
      userMessage:    `Today: ${today}\n\nInput: "${text}"`,
      responseFormat: 'json',
      maxTokens:      600,
      temperature:    0.1,
    })

    result = parseIntakeResult(aiResponse.text, today)
  } catch {
    // AI unavailable — fall through
  }

  const finalResult = result ?? intakeFromRuleParser(text)

  return NextResponse.json({ ok: true, result: finalResult })
}

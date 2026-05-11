'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, MicOff, Loader2, Sparkles } from 'lucide-react'
import { gatherChatContext } from '@/lib/xodus/chat-context'
import { applyChatActions } from '@/lib/xodus/apply-chat-actions'
import type { ChatMessage, XodusChatResponse, XodusChatAction } from '@/lib/xodus/chat-types'

// ─── Speech helper ────────────────────────────────────────────────────────────

function getSpeechCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => SpeechRecognition) | null
}

// ─── Action chip ──────────────────────────────────────────────────────────────

function ActionChip({ action }: { action: XodusChatAction }) {
  let label = ''
  let tone = 'text-cyan-300 border-cyan-500/25 bg-cyan-500/[0.06]'

  switch (action.type) {
    case 'create_goal':
      label = `✓ Goal · ${action.title}${action.date && action.date !== new Date().toISOString().slice(0, 10) ? ` (${action.date.slice(5)})` : ''}`
      tone  = 'text-blue-300 border-blue-500/25 bg-blue-500/[0.06]'
      break
    case 'create_note':
      label = action.category === 'grocery'
        ? `🛒 ${action.body.length > 40 ? action.body.slice(0, 40) + '…' : action.body}`
        : `📝 ${action.body.length > 40 ? action.body.slice(0, 40) + '…' : action.body}`
      tone  = 'text-pink-300 border-pink-500/25 bg-pink-500/[0.06]'
      break
    case 'update_nutrition': {
      const bits: string[] = []
      if (action.updates.proteinTarget) bits.push(`${action.updates.proteinTarget}g protein`)
      if (action.updates.calorieTarget) bits.push(`${action.updates.calorieTarget} cal`)
      if (action.updates.phase) bits.push(action.updates.phase)
      label = `🎯 Nutrition · ${bits.join(' · ') || 'updated'}`
      tone  = 'text-amber-300 border-amber-500/25 bg-amber-500/[0.06]'
      break
    }
    case 'log_food': {
      const bits: string[] = []
      if (action.calories) bits.push(`${action.calories} cal`)
      if (action.protein)  bits.push(`${action.protein}g protein`)
      label = `🍽 Logged · ${bits.join(' · ')}`
      tone  = 'text-amber-300 border-amber-500/25 bg-amber-500/[0.06]'
      break
    }
    case 'training_recommendation':
      label = `💪 ${action.intensity ? action.intensity.toUpperCase() + ' · ' : ''}${action.summary.length > 60 ? action.summary.slice(0, 60) + '…' : action.summary}`
      tone  = 'text-green-300 border-green-500/25 bg-green-500/[0.06]'
      break
  }

  return (
    <span className={`inline-block text-[10px] font-mono px-2 py-1 rounded-md border ${tone}`}>
      {label}
    </span>
  )
}

// ─── Readiness pill ───────────────────────────────────────────────────────────

function ReadinessPill({ readiness }: { readiness: NonNullable<ChatMessage['readiness']> }) {
  if (readiness.signal === 'unknown') return null
  const color =
    readiness.signal === 'green'  ? 'text-green-300 bg-green-500/[0.08] border-green-500/30'
    : readiness.signal === 'amber' ? 'text-amber-300 bg-amber-500/[0.08] border-amber-500/30'
    : 'text-pink-300 bg-pink-500/[0.08] border-pink-500/30'
  return (
    <span className={`text-[9px] font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border ${color}`}>
      readiness · {readiness.signal}
    </span>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 px-1">
            <Sparkles size={9} className="text-cyan-400/70" />
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-cyan-400/70">
              XODUS{msg.source === 'rule_based' ? ' · local' : ''}
            </span>
            {msg.readiness && <ReadinessPill readiness={msg.readiness} />}
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? 'bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-cyan-500/20 text-white'
              : 'bg-[#101018] border border-white/[0.07] text-zinc-200'
          }`}
        >
          {msg.text}
        </div>
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {msg.actions.map((a, i) => <ActionChip key={i} action={a} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const GREETING: ChatMessage = {
  id:        'greeting',
  role:      'assistant',
  text:      "I'm here. Talk to me — log food, set goals, ask about today's training, or just think out loud.",
  createdAt: new Date().toISOString(),
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [interimText, setInterimText] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const activeRef      = useRef(false)
  const scrollRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // ── Speech ────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const Ctor = getSpeechCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    recognitionRef.current = rec
    activeRef.current = true

    let finalAccum = ''
    rec.onstart = () => setRecording(true)
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) finalAccum += res[0].transcript + ' '
        else interim += res[0].transcript
      }
      setInterimText(interim)
      if (finalAccum) {
        const committed = finalAccum
        finalAccum = ''
        setInput((prev) => (prev + ' ' + committed).trim())
      }
    }
    rec.onerror = () => { activeRef.current = false; setRecording(false); setInterimText('') }
    rec.onend = () => {
      setInterimText('')
      if (!activeRef.current) return
      activeRef.current = false
      setRecording(false)
    }
    rec.start()
  }, [])

  const stopRecording = useCallback(() => {
    activeRef.current = false
    setRecording(false)
    setInterimText('')
    recognitionRef.current?.stop()
  }, [])

  // ── Send ──────────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim()
    if (!text || loading) return
    if (recording) stopRecording()

    const userMsg: ChatMessage = {
      id:        `m_${Date.now()}_u`,
      role:      'user',
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const context = gatherChatContext()

    let response: XodusChatResponse | null = null
    try {
      const res = await fetch('/api/xodus/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, context }),
      })
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; result: XodusChatResponse }
        if (data.ok && data.result) response = data.result
      }
    } catch {
      // network or server down — leave response null and use local fallback below
    }

    if (!response) {
      // Last-ditch local fallback message (server unreachable)
      response = {
        message: 'Chat service is offline — try again. Your message wasn\'t lost.',
        source:  'rule_based',
        confidence: 0.0,
      }
    }

    // Apply actions client-side (mutates localStorage)
    if (response.actions && response.actions.length > 0) {
      applyChatActions(response.actions)
    }

    const assistantMsg: ChatMessage = {
      id:        `m_${Date.now()}_a`,
      role:      'assistant',
      text:      response.message,
      createdAt: new Date().toISOString(),
      actions:   response.actions,
      source:    response.source,
      readiness: response.readiness,
    }
    setMessages((prev) => [...prev, assistantMsg])
    setLoading(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault()
      send()
    }
  }

  const speechSupported = typeof window !== 'undefined' && getSpeechCtor() !== null

  return (
    <div className="flex flex-col rounded-2xl bg-[--surface] border border-white/[0.07] overflow-hidden h-[560px] max-h-[70vh] card-elevated">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        {loading && (
          <div className="flex items-center gap-2 px-1">
            <Loader2 size={12} className="animate-spin text-cyan-400/70" />
            <span className="text-[10px] font-mono text-zinc-600">XODUS is thinking…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.05] p-3 space-y-2">
        {interimText && (
          <p className="text-[11px] text-zinc-500 italic px-1">{interimText}</p>
        )}
        <div className="flex items-end gap-2">
          {speechSupported && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              title={recording ? 'Stop recording' : 'Voice input'}
              className={`flex-shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                recording
                  ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
                  : 'border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300'
              }`}
            >
              {recording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => { if (!recording) setInput(e.target.value) }}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={loading}
            placeholder={
              recording
                ? 'Listening…'
                : 'Tell XODUS — train chest tomorrow, add eggs to groceries, how should I train today…'
            }
            className="flex-1 min-w-0 bg-[#0f0f15] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white placeholder-zinc-700 focus:outline-none focus:border-cyan-500/40 resize-none leading-snug"
            style={{ maxHeight: 100 }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-cyan-400 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[8px] font-mono text-zinc-700 px-1">
          Enter to send · Shift+Enter for newline · actions apply automatically
        </p>
      </div>
    </div>
  )
}

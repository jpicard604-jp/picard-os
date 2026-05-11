'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { STORAGE_EVENTS } from '@/lib/storage'
import { gatherBrainInput, runXodusBrain } from '@/lib/xodus/brain'
import type { XodusBrainOutput } from '@/lib/xodus/brain'
import CommandInbox from '@/components/xodus/CommandInbox'
import ChatPanel from '@/components/xodus/ChatPanel'
import NotesPanel from '@/components/xodus/NotesPanel'
import InboxPanel from '@/components/xodus/InboxPanel'
import { fetchInboxItems } from '@/lib/xodus/inbox-client'

const URGENCY_COLOR = {
  LOW:      { pill: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',      dot: 'bg-cyan-400'   },
  MODERATE: { pill: 'text-purple-400 bg-purple-400/10 border-purple-400/20', dot: 'bg-purple-400' },
  HIGH:     { pill: 'text-pink-400 bg-pink-400/10 border-pink-400/20',       dot: 'bg-pink-400'   },
  CRITICAL: { pill: 'text-pink-300 bg-pink-500/15 border-pink-500/30',       dot: 'bg-pink-400 shadow-[0_0_6px_rgba(236,72,153,0.6)]' },
}

function DomainCard({
  label, text, accent = 'text-zinc-400',
}: {
  label: string
  text: string
  accent?: string
}) {
  return (
    <div className="rounded-xl bg-[--surface-raised] border border-white/[0.05] px-4 py-3">
      <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-1">{label}</p>
      <p className={`text-[12px] leading-relaxed ${accent}`}>{text}</p>
    </div>
  )
}

function DailyBriefPanel({ brain }: { brain: XodusBrainOutput }) {
  const { executionScore, urgency, brief, nextAction, recovery, nutrition, fitness, projects, stack, loggedToday } = brain
  const style = URGENCY_COLOR[urgency]

  const recoveryAccent = recovery.state === 'ADAPTED'
    ? 'text-cyan-300'
    : recovery.state === 'STRAINED'
    ? 'text-pink-300'
    : 'text-zinc-400'

  const nutritionAccent = nutrition.proteinGap !== null && nutrition.proteinGap <= 0
    ? 'text-cyan-300'
    : nutrition.calorieStatus === 'under'
    ? 'text-pink-300'
    : 'text-zinc-400'

  return (
    <div className="space-y-3">
      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap px-1">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono uppercase tracking-wider ${style.pill}`}>
          <span className={`w-1 h-1 rounded-full ${style.dot}`} />
          {urgency}
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          Score <span className="text-white font-semibold">{executionScore}/100</span>
        </span>
        <span className="text-zinc-700 text-[10px]">·</span>
        <span className="text-[10px] font-mono text-zinc-600">
          Recovery <span className={`font-semibold ${recoveryAccent}`}>{recovery.state}</span>
        </span>
      </div>

      {/* Brief card */}
      <div className="rounded-2xl bg-[--surface] border border-white/[0.07] overflow-hidden card-elevated">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_rgba(236,72,153,0.6)]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-pink-400/80">
              Daily Brief
            </span>
          </div>
          {!loggedToday && (
            <span className="text-[9px] font-mono text-amber-400/70">estimated</span>
          )}
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {brief.map((para, i) => (
            <p
              key={i}
              className={`leading-relaxed ${
                i === 0 ? 'text-white text-[13px] font-medium' : 'text-zinc-400 text-[13px]'
              }`}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Next action */}
        <div className="px-5 py-3.5 border-t border-white/[0.05] bg-white/[0.015]">
          <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-zinc-700 mb-1.5">Next Action</p>
          <Link href={nextAction.href} className="text-[12px] text-cyan-300 hover:text-cyan-200 transition-colors">
            → {nextAction.text}
          </Link>
        </div>
      </div>

      {/* Domain cards */}
      <div className="space-y-2">
        <DomainCard label="Recovery" text={recovery.recommendation} accent={recoveryAccent} />
        <DomainCard label="Nutrition" text={nutrition.recommendation} accent={nutritionAccent} />
        <DomainCard label="Fitness" text={fitness.recommendation} />
        <DomainCard label="Projects" text={projects.recommendation} />
        {stack.totalCount > 0 && (
          <DomainCard label="Stack" text={stack.recommendation}
            accent={stack.completionPct === 100 ? 'text-cyan-300' : 'text-zinc-400'} />
        )}
      </div>

      {/* Log CTA */}
      <Link
        href="/daily"
        className="flex items-center justify-center w-full py-3 rounded-xl bg-pink-500/[0.08] border border-pink-500/25 text-[12px] font-medium text-pink-400 hover:bg-pink-500/[0.14] transition-colors"
      >
        {loggedToday ? 'Update Today\'s Log →' : 'Log Today for Full Brief →'}
      </Link>
    </div>
  )
}

type LeftTab = 'chat' | 'structured' | 'inbox'

export default function XodusPage() {
  const [tab, setTab] = useState<LeftTab>('chat')
  const [inboxCount, setInboxCount] = useState(0)
  const [brain, setBrain] = useState<XodusBrainOutput>(() =>
    runXodusBrain(gatherBrainInput())
  )

  function refresh() {
    setBrain(runXodusBrain(gatherBrainInput()))
  }

  // One-shot inbox pending count for the tab badge (panel does its own polling when mounted).
  useEffect(() => {
    let cancelled = false
    fetchInboxItems({ status: 'pending', limit: 25 }).then(res => {
      if (!cancelled && res.status === 'ok') setInboxCount(res.items.length)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    refresh()
    const events = [
      STORAGE_EVENTS.DAILY_LOG_UPDATED,
      STORAGE_EVENTS.VOICE_LOG_SAVED,
      STORAGE_EVENTS.PROJECTS_UPDATED,
      STORAGE_EVENTS.ACTIVITY_LOG_UPDATED,
      STORAGE_EVENTS.STACK_UPDATED,
    ]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => events.forEach((e) => window.removeEventListener(e, refresh))
  }, [])

  const style = URGENCY_COLOR[brain.urgency]

  return (
    <div className="pb-8">
      {/* Hero header */}
      <div className="relative px-5 pt-10 pb-7 lg:px-10 border-b border-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 15% 0%, rgba(236,72,153,0.08) 0%, rgba(34,211,238,0.03) 55%, transparent 80%)',
          }}
        />
        <div className="relative flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
                Command Inbox
              </span>
            </div>
            <h1 className="font-display font-light text-4xl lg:text-5xl text-white tracking-tight leading-none">
              XODUS
            </h1>
          </div>
          <p className="text-[11px] font-mono text-zinc-700 pb-1 hidden lg:block">
            Tell XODUS what happened. It handles the rest.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 lg:px-6 lg:grid lg:grid-cols-[1fr_300px_280px] lg:gap-5 pt-4">
        {/* Left: Chat / Structured tabs */}
        <div>
          <div className="flex items-center gap-1 mb-3 p-1 rounded-xl bg-[--surface] border border-white/[0.06] w-fit">
            <button
              onClick={() => setTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.12em] transition-colors ${
                tab === 'chat'
                  ? 'bg-gradient-to-br from-pink-500/20 to-cyan-500/15 text-white border border-cyan-500/25'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setTab('structured')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.12em] transition-colors ${
                tab === 'structured'
                  ? 'bg-gradient-to-br from-pink-500/20 to-cyan-500/15 text-white border border-cyan-500/25'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              Structured
            </button>
            <button
              onClick={() => setTab('inbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.12em] transition-colors ${
                tab === 'inbox'
                  ? 'bg-gradient-to-br from-pink-500/20 to-cyan-500/15 text-white border border-cyan-500/25'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              Inbox
              {inboxCount > 0 && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/[0.18] border border-amber-500/40 text-amber-300 normal-case tracking-normal">
                  {inboxCount}
                </span>
              )}
            </button>
          </div>
          {tab === 'chat'
            ? <ChatPanel />
            : tab === 'structured'
              ? <CommandInbox />
              : <InboxPanel onCountChange={setInboxCount} />}
        </div>

        {/* Center: XODUS Notes */}
        <div className="mt-5 lg:mt-0">
          <NotesPanel />
        </div>

        {/* Right: Daily Brief */}
        <div className="mt-5 lg:mt-0">
          <DailyBriefPanel brain={brain} />
        </div>
      </div>
    </div>
  )
}

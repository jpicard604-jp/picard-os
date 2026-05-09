'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getProjects, daysUntil } from '@/lib/projects'
import type { Project } from '@/lib/projects'
import { STORAGE_EVENTS } from '@/lib/storage'

const URGENCY_DOT: Record<string, string> = {
  LOW:      'bg-green-400',
  MODERATE: 'bg-blue-400',
  HIGH:     'bg-amber-400',
  CRITICAL: 'bg-red-400',
}

function ProjectRow({ project }: { project: Project }) {
  const pct  = project.progress
  const days = project.targetDate ? daysUntil(project.targetDate) : null
  const overdue = days !== null && days < 0

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${URGENCY_DOT[project.urgency] ?? 'bg-zinc-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-zinc-200 truncate">{project.title}</p>
        {days !== null && (
          <p className={`text-[9px] font-mono mt-0.5 ${overdue ? 'text-red-400' : 'text-zinc-600'}`}>
            {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-14 h-0.5 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-zinc-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-zinc-600 w-7 text-right">{pct}%</span>
      </div>
    </div>
  )
}

export default function ProjectSummary() {
  const [projects, setProjects] = useState<Project[]>([])

  function refresh() {
    const all = getProjects()
    setProjects(all.filter((p) => p.status === 'active').slice(0, 4))
  }

  useEffect(() => {
    refresh()
    window.addEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
    return () => window.removeEventListener(STORAGE_EVENTS.PROJECTS_UPDATED, refresh)
  }, [])

  return (
    <div className="mx-4 mt-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-zinc-700">Projects</span>
        <Link href="/projects" className="text-[9px] font-mono text-blue-400 hover:text-blue-300 transition-colors">
          All →
        </Link>
      </div>
      <div className="rounded-xl bg-[#0f0f0f] border border-white/[0.06] overflow-hidden">
        {projects.length > 0 ? (
          projects.map((p) => <ProjectRow key={p.id} project={p} />)
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-zinc-700">No active projects</p>
          </div>
        )}
      </div>
    </div>
  )
}

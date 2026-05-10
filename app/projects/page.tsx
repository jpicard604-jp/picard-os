'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Circle, CheckCircle2 } from 'lucide-react'
import { getProjects, saveProjects, daysUntil } from '@/lib/projects'
import type { Project, Task } from '@/lib/projects'

const URGENCY_STYLES = {
  LOW:      { badge: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',     dot: 'bg-cyan-400'   },
  MODERATE: { badge: 'text-purple-400 bg-purple-400/10 border-purple-400/20', dot: 'bg-purple-400' },
  HIGH:     { badge: 'text-pink-400 bg-pink-400/10 border-pink-400/20',     dot: 'bg-pink-400'   },
  CRITICAL: { badge: 'text-pink-300 bg-pink-500/15 border-pink-500/30',     dot: 'bg-pink-400 shadow-[0_0_6px_rgba(236,72,153,0.5)]' },
}

const STATUS_STYLES = {
  active:   { text: 'text-cyan-400',   bg: 'bg-cyan-400/10 border-cyan-400/20'     },
  paused:   { text: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
  complete: { text: 'text-zinc-500',   bg: 'bg-zinc-500/10 border-zinc-500/20'     },
}

const PRIORITY_LABEL = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5' }

function TaskRow({
  task,
  onToggle,
}: {
  task: Task
  onToggle: (id: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(task.id)}
      className="flex items-start gap-3 w-full text-left py-2.5 px-5 border-b border-white/[0.04] last:border-0 active:bg-white/5 transition-colors"
    >
      {task.done ? (
        <CheckCircle2 size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <Circle size={15} className="text-zinc-700 flex-shrink-0 mt-0.5" />
      )}
      <span className={`text-xs leading-relaxed ${task.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
        {task.text}
      </span>
    </button>
  )
}

function ProjectCard({
  project,
  onTaskToggle,
}: {
  project: Project
  onTaskToggle: (projectId: string, taskId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const urgencyStyle = URGENCY_STYLES[project.urgency]
  const statusStyle = STATUS_STYLES[project.status]
  const doneTasks = project.tasks.filter((t) => t.done).length
  const totalTasks = project.tasks.length
  const days = project.targetDate ? daysUntil(project.targetDate) : null
  const overdue = days !== null && days < 0
  const nextTask = project.tasks.find((t) => !t.done)

  return (
    <div className="rounded-2xl bg-[#181818] border border-white/[0.06] overflow-hidden card-elevated mb-3">
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 pt-4 pb-3.5"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyStyle.dot}`} />
              <h3 className="text-sm font-semibold text-white">{project.title}</h3>
              <span className="text-[8px] font-mono text-zinc-700">
                {PRIORITY_LABEL[project.priority]}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed ml-3.5">{project.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`inline-block text-[8px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${urgencyStyle.badge}`}>
              {project.urgency}
            </span>
            <span className={`text-[8px] font-mono uppercase tracking-wider ${statusStyle.text}`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${project.progress}%`, background: 'linear-gradient(to right, #22d3ee, #ec4899)' }}
            />
          </div>
          <span className="text-[9px] font-mono text-zinc-600 flex-shrink-0">{project.progress}%</span>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-zinc-600">{doneTasks}/{totalTasks} tasks</span>
            {days !== null && (
              <span className={`text-[9px] font-mono ${overdue ? 'text-red-400' : days <= 14 ? 'text-amber-400' : 'text-zinc-600'}`}>
                {overdue ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp size={13} className="text-zinc-600" />
          ) : (
            <ChevronDown size={13} className="text-zinc-600" />
          )}
        </div>

        {/* Next action */}
        {!expanded && nextTask && (
          <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
            <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-wider mb-1">Next</p>
            <p className="text-xs text-zinc-400 truncate">{nextTask.text}</p>
          </div>
        )}
      </button>

      {/* Tasks */}
      {expanded && (
        <div className="border-t border-white/[0.06]">
          <p className="px-5 pt-3 pb-1 text-[9px] font-mono uppercase tracking-wider text-zinc-600">Tasks</p>
          {project.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(id) => onTaskToggle(project.id, id)}
            />
          ))}
          {project.notes && (
            <div className="px-5 py-3 border-t border-white/[0.04]">
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{project.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'complete'>('active')

  useEffect(() => {
    setProjects(getProjects())
  }, [])

  function toggleTask(projectId: string, taskId: string) {
    setProjects((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== projectId) return p
        const tasks = p.tasks.map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        )
        const donePct = Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
        return { ...p, tasks, progress: donePct, updatedAt: new Date().toISOString() }
      })
      saveProjects(updated)
      return updated
    })
  }

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter)
  const activeCount = projects.filter((p) => p.status === 'active').length
  const avgProgress = projects.length > 0
    ? Math.round(projects.filter((p) => p.status === 'active').reduce((s, p) => s + p.progress, 0) / Math.max(activeCount, 1))
    : 0

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="relative px-5 pt-10 pb-6 lg:px-10 border-b border-white/[0.05] overflow-hidden mb-3">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(236,72,153,0.07) 0%, rgba(34,211,238,0.02) 50%, transparent 70%)' }} />
        <div className="relative">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 mb-2">Command</p>
          <h1 className="font-display font-light text-3xl lg:text-4xl text-white tracking-tight leading-none">Projects</h1>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Active', value: activeCount },
          { label: 'Avg Progress', value: `${avgProgress}%` },
          { label: 'Total Tasks', value: projects.reduce((s, p) => s + p.tasks.length, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-[#181818] border border-white/[0.06] px-3 py-3 text-center card-elevated">
            <p className="text-base font-mono font-bold text-white">{value}</p>
            <p className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mx-4 mb-3 flex gap-1.5">
        {(['active', 'all', 'paused', 'complete'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition-all duration-150 ${
              filter === f
                ? 'border-pink-500/40 text-pink-400 bg-pink-500/10'
                : 'border-white/[0.08] text-zinc-600 bg-[#181818]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Project list */}
      <div className="mx-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#181818] border border-white/[0.06] px-4 py-8 text-center">
            <p className="text-sm text-zinc-600">No {filter} projects</p>
          </div>
        ) : (
          filtered
            .sort((a, b) => a.priority - b.priority || (b.urgency > a.urgency ? 1 : -1))
            .map((p) => (
              <ProjectCard key={p.id} project={p} onTaskToggle={toggleTask} />
            ))
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Circle, CheckCircle2 } from 'lucide-react'
import { getProjects, saveProjects, daysUntil } from '@/lib/projects'
import type { Project, Task } from '@/lib/projects'

const URGENCY_STYLES = {
  LOW: { badge: 'text-green-400 bg-green-400/10 border-green-400/20', dot: 'bg-green-400' },
  MODERATE: { badge: 'text-blue-400 bg-blue-400/10 border-blue-400/20', dot: 'bg-blue-400' },
  HIGH: { badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400' },
  CRITICAL: { badge: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
}

const STATUS_STYLES = {
  active: { text: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  paused: { text: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  complete: { text: 'text-zinc-500', bg: 'bg-zinc-500/10 border-zinc-500/20' },
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
    <div className="rounded-2xl bg-[#111] border border-white/[0.08] overflow-hidden card-elevated mb-3">
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
              className={`h-full rounded-full transition-all duration-500 ${
                project.progress >= 80 ? 'bg-green-500' : project.progress >= 50 ? 'bg-blue-500' : 'bg-zinc-500'
              }`}
              style={{ width: `${project.progress}%` }}
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
      <div className="px-4 pt-7 pb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-600">Command</p>
        <h1 className="text-2xl font-semibold text-white mt-1 tracking-tight">Projects</h1>
      </div>

      {/* Summary bar */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Active', value: activeCount },
          { label: 'Avg Progress', value: `${avgProgress}%` },
          { label: 'Total Tasks', value: projects.reduce((s, p) => s + p.tasks.length, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-[#111] border border-white/[0.08] px-3 py-3 text-center card-elevated">
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
                ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                : 'border-white/10 text-zinc-600 bg-[#111]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Project list */}
      <div className="mx-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#111] border border-white/[0.08] px-4 py-8 text-center">
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

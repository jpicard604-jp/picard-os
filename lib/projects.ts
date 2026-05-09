import { getStorage, setStorage, STORAGE_KEYS, STORAGE_EVENTS } from './storage'

export interface Task {
  id: string
  text: string
  done: boolean
  createdAt: string
}

export interface ProjectUpdate {
  id: string
  timestamp: string
  text: string
  source: 'voice' | 'manual'
  progressBefore: number
  progressAfter: number
}

export interface Project {
  id: string
  title: string
  description: string
  status: 'active' | 'paused' | 'complete'
  priority: 1 | 2 | 3 | 4 | 5
  progress: number
  targetDate?: string
  notes: string
  tasks: Task[]
  urgency: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  updates?: ProjectUpdate[]
  createdAt: string
  updatedAt: string
}

export const SEED_PROJECTS: Project[] = [
  {
    id: 'play-productions',
    title: 'PLAY Productions',
    description: 'Production company operations, content pipeline, and talent development',
    status: 'active',
    priority: 1,
    progress: 35,
    targetDate: '2026-06-30',
    urgency: 'HIGH',
    notes: '',
    tasks: [
      { id: 'pp-1', text: 'Finalize Q2 content calendar', done: false, createdAt: '2026-05-01' },
      { id: 'pp-2', text: 'Sign new talent contract', done: false, createdAt: '2026-05-01' },
      { id: 'pp-3', text: 'Launch brand identity v2', done: true, createdAt: '2026-04-15' },
      { id: 'pp-4', text: 'Set up accounting system', done: false, createdAt: '2026-05-01' },
      { id: 'pp-5', text: 'Schedule first production shoot', done: false, createdAt: '2026-05-05' },
    ],
    createdAt: '2026-04-01',
    updatedAt: '2026-05-07',
  },
  {
    id: 'wine-room',
    title: 'Wine Room',
    description: 'Design and build a premium home wine cellar and tasting room',
    status: 'active',
    priority: 2,
    progress: 20,
    targetDate: '2026-08-01',
    urgency: 'MODERATE',
    notes: '',
    tasks: [
      { id: 'wr-1', text: 'Source temperature control unit', done: false, createdAt: '2026-05-01' },
      { id: 'wr-2', text: 'Finalize floor plan layout', done: true, createdAt: '2026-04-20' },
      { id: 'wr-3', text: 'Order custom racking system', done: false, createdAt: '2026-05-01' },
      { id: 'wr-4', text: 'Select lighting fixtures', done: false, createdAt: '2026-05-03' },
    ],
    createdAt: '2026-04-15',
    updatedAt: '2026-05-06',
  },
  {
    id: 'ashes-and-snow',
    title: 'Ashes and Snow',
    description: 'Photography series, editorial writing, and book production',
    status: 'active',
    priority: 2,
    progress: 55,
    targetDate: '2026-07-01',
    urgency: 'MODERATE',
    notes: '',
    tasks: [
      { id: 'as-1', text: 'Complete first chapter edit', done: true, createdAt: '2026-04-01' },
      { id: 'as-2', text: 'Select final 40 images', done: true, createdAt: '2026-04-15' },
      { id: 'as-3', text: 'Write artist statement', done: false, createdAt: '2026-05-01' },
      { id: 'as-4', text: 'Design book layout', done: false, createdAt: '2026-05-01' },
      { id: 'as-5', text: 'Find printing partner', done: false, createdAt: '2026-05-05' },
    ],
    createdAt: '2026-03-01',
    updatedAt: '2026-05-04',
  },
  {
    id: 'personal-training',
    title: 'Personal Training',
    description: 'Q2 strength program — 235lb bench, 300lb squat, 180lb bodyweight',
    status: 'active',
    priority: 1,
    progress: 60,
    targetDate: '2026-06-30',
    urgency: 'LOW',
    notes: '',
    tasks: [
      { id: 'pt-1', text: 'Hit 235lb bench (current: 225lb)', done: false, createdAt: '2026-04-01' },
      { id: 'pt-2', text: 'Hit 300lb squat (current: 275lb)', done: false, createdAt: '2026-04-01' },
      { id: 'pt-3', text: 'Reach 180lb bodyweight', done: true, createdAt: '2026-04-01' },
      { id: 'pt-4', text: '5 sessions/week for 4 consecutive weeks', done: false, createdAt: '2026-05-01' },
      { id: 'pt-5', text: 'Weighted pull-up +50lb for 5 reps', done: false, createdAt: '2026-05-01' },
    ],
    createdAt: '2026-04-01',
    updatedAt: '2026-05-07',
  },
  {
    id: 'instagram-confidence',
    title: 'Instagram Confidence',
    description: 'Build authentic presence, reduce anxiety around visibility, grow audience',
    status: 'active',
    priority: 3,
    progress: 25,
    targetDate: '2026-09-01',
    urgency: 'MODERATE',
    notes: '',
    tasks: [
      { id: 'ic-1', text: 'Post 3× per week for 30 days', done: false, createdAt: '2026-05-01' },
      { id: 'ic-2', text: 'Create content system (templates, schedule)', done: false, createdAt: '2026-05-01' },
      { id: 'ic-3', text: 'Define content pillars', done: true, createdAt: '2026-04-20' },
      { id: 'ic-4', text: 'Schedule first collaboration', done: false, createdAt: '2026-05-05' },
      { id: 'ic-5', text: 'Reach 1,000 followers', done: false, createdAt: '2026-05-01' },
    ],
    createdAt: '2026-05-01',
    updatedAt: '2026-05-06',
  },
]

export function getProjects(): Project[] {
  const saved = getStorage<Project[]>(STORAGE_KEYS.PROJECTS, [])
  return saved.length > 0 ? saved : SEED_PROJECTS
}

export function saveProjects(projects: Project[]): void {
  setStorage(STORAGE_KEYS.PROJECTS, projects)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENTS.PROJECTS_UPDATED))
  }
}

export function applyProjectUpdate(
  projectId: string,
  text: string,
  progressBump = 0,
  source: 'voice' | 'manual' = 'voice',
): void {
  const projects = getProjects()
  const idx = projects.findIndex((p) => p.id === projectId)
  if (idx === -1) return

  const p = { ...projects[idx] }
  const progressBefore = p.progress
  const progressAfter = Math.min(100, p.progress + progressBump)

  const update: ProjectUpdate = {
    id: `upd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    text,
    source,
    progressBefore,
    progressAfter,
  }

  p.progress = progressAfter
  p.updatedAt = new Date().toISOString()
  p.updates = [...(p.updates ?? []), update]
  projects[idx] = p
  saveProjects(projects)
}

export function addProjectTask(projectId: string, taskText: string): void {
  const projects = getProjects()
  const idx = projects.findIndex((p) => p.id === projectId)
  if (idx === -1) return
  const p = { ...projects[idx] }
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: taskText,
    done: false,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  p.tasks = [...p.tasks, task]
  p.updatedAt = new Date().toISOString()
  projects[idx] = p
  saveProjects(projects)
}

export function getOverdueCount(projects: Project[]): number {
  const today = new Date().toISOString().slice(0, 10)
  return projects.filter(
    (p) => p.status === 'active' && p.targetDate && p.targetDate < today
  ).length
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

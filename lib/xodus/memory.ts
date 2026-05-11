// XODUS Memory Records — structured memory nodes for the /brain graph.
// Source of truth: memory/ node files in the Claude project.
// This module is the in-app mirror: update when memory files change.
//
// TODO (future):
//   - AI chat import pipeline: ChatGPT/Claude/Gemini conversations → memory records
//   - memory review/approve queue: XODUS surfaces unvetted records for confirmation
//   - Supabase memories table: persist records with vector embeddings
//   - Obsidian markdown export/sync: two-way sync with vault files
//   - memory graph search/filter: semantic search across records in /brain
//   - historical/archive handling: collapse status:'historical' into archived cluster

export type XodusMemoryCategory =
  | 'identity'
  | 'goals'
  | 'active_project'
  | 'historical_project'
  | 'fitness'
  | 'nutrition'
  | 'daily_routine'
  | 'work'
  | 'school'
  | 'design_preference'
  | 'development_workflow'
  | 'important_people'
  | 'car_porsche'
  | 'decision'
  | 'open_loop'
  | 'do_not_track'
  | 'needs_confirmation'

export type XodusMemoryRecord = {
  id:               string
  title:            string
  category:         XodusMemoryCategory
  summary:          string
  source:           'user_stated' | 'chat_summary' | 'imported' | 'system'
  status:           'current' | 'historical' | 'needs_confirmation'
  confidence:       'high' | 'medium' | 'low'
  relatedProjects?: string[]
  relatedGoals?:    string[]
  relatedPeople?:   string[]
  graphLinks?:      string[]  // brain-graph domain node IDs to connect to
  filePath?:        string    // source memory file (relative path)
  updatedAt?:       string    // YYYY-MM-DD
}

// ── Curated records (one per memory node file) ────────────────────────────────

const RECORDS: XodusMemoryRecord[] = [
  {
    id:         'mem-identity',
    title:      'Identity & Profile',
    category:   'identity',
    summary:    'Jackson. LMU junior, Entrepreneurship & Marketing. Top identities: athlete, entrepreneur, creative. Personal trainer / F45 instructor through summer. Hybrid athlete.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedProjects: ['Picard OS / XODUS'],
    graphLinks: ['hub-xodus', 'picard-os'],
    filePath:   'memory/user_jackson_identity.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-goals',
    title:      'Current Goals',
    category:   'goals',
    summary:    '30-day: peak cut, make money, have fun. 6-month: save $10k, hybrid athlete peak, potentially dunk, NeuroBuild for dad, succeed at work.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedProjects: ['Picard OS / XODUS', 'NeuroBuild'],
    graphLinks: ['hub-daily-goals', 'hub-xodus'],
    filePath:   'memory/user_jackson_goals.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-fitness',
    title:      'Fitness & Nutrition',
    category:   'fitness',
    summary:    '184 lb → 180 lb cut. 2200 cal / 210g protein / 210g carbs / 60g fat. 3-on/1-rest split. Bench 345 lb. MyFitnessPal for food logging.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedGoals: ['Reach peak cut', 'Be in best shape as hybrid athlete'],
    graphLinks: ['hub-fitness', 'hub-whoop', 'hub-nutrition'],
    filePath:   'memory/user_jackson_fitness.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-projects',
    title:      'Active Projects',
    category:   'active_project',
    summary:    'Picard OS, PLAY / Graton Casino, The Flying Elephants (Santa Monica), Porsche 981 brakes, Apartment search, NeuroBuild (dad\'s Obsidian brain).',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedProjects: ['Picard OS / XODUS', 'PLAY / Graton', 'Flying Elephants', 'NeuroBuild'],
    graphLinks: ['hub-projects', 'picard-os'],
    filePath:   'memory/user_jackson_projects.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-people',
    title:      'Important People',
    category:   'important_people',
    summary:    'John Picard (dad / NeuroBuild), Jack Melly (best friend / Kimble), D\'anthony Yates (best friend). Family: Ryan, Lane, Naomi, Alexis.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedPeople:   ['John Picard', 'Jack Melly', 'D\'anthony Yates'],
    relatedProjects: ['NeuroBuild'],
    graphLinks: ['hub-xodus', 'hub-projects'],
    filePath:   'memory/user_jackson_people.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-workflow',
    title:      'Design & Dev Workflow',
    category:   'development_workflow',
    summary:    'More animation + lively feel. WHOOP/Oura simplicity + neon black + Miami Vice pink. No npm audit fix. Inspect files before coding. Build-verify every change.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedProjects: ['Picard OS / XODUS'],
    graphLinks: ['picard-os', 'hub-xodus'],
    filePath:   'memory/user_jackson_design_workflow.md',
    updatedAt:  '2026-05-10',
  },
  {
    id:         'mem-open-loops',
    title:      'Open Loops',
    category:   'open_loop',
    summary:    'Finals this week. Apartment search. Porsche brakes/rotors. iOS Notes replacement via XODUS. More animation in Picard OS UI. MFP integration path.',
    source:     'user_stated',
    status:     'current',
    confidence: 'high',
    relatedProjects: ['Picard OS / XODUS'],
    graphLinks: ['hub-daily-goals', 'hub-xodus'],
    filePath:   'memory/user_jackson_open_loops.md',
    updatedAt:  '2026-05-10',
  },
]

export function getXodusMemoryRecords(): XodusMemoryRecord[] {
  return RECORDS
}

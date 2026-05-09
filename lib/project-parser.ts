import { getProjects } from './projects'

export interface ProjectMatch {
  projectId: string | null   // null = detected name but not in project list
  projectTitle: string
  updateText: string
  nextAction?: string
  progressBump: number       // points to add to project.progress
  confidence: 'high' | 'medium' | 'low'
}

export interface ProjectParseResult {
  detected: boolean
  matches: ProjectMatch[]
}

// ─── Static alias table ───────────────────────────────────────────────────────
// Maps known project keywords to their expected storage IDs.
// If the ID is not found in getProjects(), projectId becomes null in the result.

const ALIAS_TABLE: Array<{
  candidateId: string
  displayTitle: string
  highConfidence: RegExp
  aliases: RegExp[]
}> = [
  {
    candidateId: 'play-productions',
    displayTitle: 'PLAY Productions',
    highConfidence: /\bplay\s+productions?\b/i,
    aliases: [
      /\bplay\s+productions?\b/i,
      /\bplay\s+(?:prompt|content|shoot|video|photo|brand|episode|post|company|campaign)\b/i,
      /\bproduction\s+(?:company|shoot|pipeline)\b/i,
      /\btalent\s+(?:contract|development|signing)\b/i,
      /\bcontent\s+(?:calendar|pipeline)\b/i,
    ],
  },
  {
    candidateId: 'wine-room',
    displayTitle: 'Wine Room',
    highConfidence: /\bwine\s+room\b/i,
    aliases: [
      /\bwine\s+room\b/i,
      /\bwine\s+cellar\b/i,
      /\bwine\s+rack(?:ing)?\b/i,
      /\btemperature\s+control\s+unit\b/i,
      /\bwine\s+tasting\s+room\b/i,
    ],
  },
  {
    candidateId: 'ashes-and-snow',
    displayTitle: 'Ashes and Snow',
    highConfidence: /\bashes\s+and\s+snow\b/i,
    aliases: [
      /\bashes\s+and\s+snow\b/i,
      /\bash(?:es)?\s+(?:and\s+)?snow\b/i,
      /\bartist\s+statement\b/i,
      /\bbook\s+layout\b/i,
      /\bprinting\s+partner\b/i,
      /\bphotography\s+(?:series|book)\b/i,
    ],
  },
  {
    candidateId: 'personal-training',
    displayTitle: 'Personal Training',
    highConfidence: /\bpersonal\s+training\b/i,
    aliases: [
      /\bpersonal\s+training\b/i,
      /\bpersonal\s+trainer?\b/i,
      /\bnew\s+(?:training\s+)?(?:lead|client)\b/i,
      /\btraining\s+(?:lead|client|program|schedule)\b/i,
      /\bstrength\s+program\b/i,
    ],
  },
  {
    candidateId: 'instagram-confidence',
    displayTitle: 'Instagram Confidence',
    highConfidence: /\b(?:instagram\s+confidence|social\s+confidence)\b/i,
    aliases: [
      /\binstagram\s+confidence\b/i,
      /\bsocial\s+confidence\b/i,
      /\btook\s+(?:photos?|pictures?)\s+for\s+(?:instagram|ig)\b/i,
      /\b(?:instagram|ig)\s+(?:post|story|reel|content|strategy|schedule|growth)\b/i,
      /\bcontent\s+pillar\b/i,
      /\bposting\s+(?:plan|schedule|strategy|routine)\b/i,
    ],
  },
  {
    candidateId: 'graton',
    displayTitle: 'Graton',
    highConfidence: /\bgraton(?:\s+casino)?\b/i,
    aliases: [
      /\bgraton(?:\s+casino)?\b/i,
    ],
  },
]

// ─── Verb / intent patterns ───────────────────────────────────────────────────

const ACTION_VERB_RE = /\b(?:worked?\s+on|made?\s+progress(?:\s+on)?|finished?|completed?|started?|updated?|reviewed?|finalized?|signed?|launched?|posted?\s+(?:for|about|on)?|took\s+photos?|scheduled?|wrapped\s+up|closed\s+out|got\s+a\s+new|need\s+to|planning\s+to|blocked\s+(?:by|on))\b/i

const NEXT_ACTION_RE = /\b(?:need\s+to|going\s+to|plan(?:ning)?\s+to|will|should|have\s+to|gotta|next\s+(?:step\s+is|up))\s+([^.!?,;]{8,80}?)(?:[.!?,;]|$)/i

function detectProgressBump(text: string): number {
  if (/\b(?:finished?|completed?|wrapped\s+up|closed\s+out|done\s+with|shipped?)\b/i.test(text)) return 5
  if (/\b(?:made\s+(?:good\s+)?progress|moved\s+(?:forward|along)|got\s+(?:further|closer))\b/i.test(text)) return 3
  if (/\b(?:worked?\s+on|updated?|reviewed?|progressed?|finalized?)\b/i.test(text)) return 1
  if (/\b(?:started?|kicked\s+off|began|beginning|launching)\b/i.test(text)) return 1
  return 0
}

function extractUpdateText(transcript: string, pattern: RegExp): string {
  const m = pattern.exec(transcript)
  if (!m) return transcript.slice(0, 120).trim()

  const idx = m.index
  const before = transcript.slice(0, idx)

  // Walk back to the nearest sentence start
  const sentStart = Math.max(
    before.lastIndexOf('. ') + 2,
    before.lastIndexOf('! ') + 2,
    before.lastIndexOf('? ') + 2,
    before.lastIndexOf('\n') + 1,
    0,
  )

  // Walk forward to the nearest sentence end
  const afterText = transcript.slice(idx + m[0].length)
  let relEnd = afterText.length
  for (const delim of ['. ', '! ', '? ', '\n']) {
    const pos = afterText.indexOf(delim)
    if (pos !== -1 && pos < relEnd) relEnd = pos + 1
  }
  const sentEnd = idx + m[0].length + relEnd

  return transcript.slice(sentStart, sentEnd).trim()
}

function extractNextAction(transcript: string): string | undefined {
  const m = transcript.match(NEXT_ACTION_RE)
  return m ? m[1].trim().replace(/\s+/g, ' ') : undefined
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseProjectsFromVoiceLog(transcript: string): ProjectParseResult {
  if (!transcript || transcript.trim().length < 8) return { detected: false, matches: [] }

  const liveProjects = getProjects()
  const liveIdSet = new Set(liveProjects.map((p) => p.id))
  const matches: ProjectMatch[] = []
  const seenIds = new Set<string>()

  // Check static alias table
  for (const entry of ALIAS_TABLE) {
    const matched = entry.aliases.find((re) => re.test(transcript))
    if (!matched) continue
    if (seenIds.has(entry.candidateId)) continue
    seenIds.add(entry.candidateId)

    const projectId = liveIdSet.has(entry.candidateId) ? entry.candidateId : null
    const hasActionVerb = ACTION_VERB_RE.test(transcript)
    const isHighConfidence = entry.highConfidence.test(transcript)

    const confidence: 'high' | 'medium' | 'low' =
      isHighConfidence && hasActionVerb ? 'high' :
      isHighConfidence || hasActionVerb ? 'medium' :
      'low'

    const liveTitle = projectId
      ? (liveProjects.find((p) => p.id === projectId)?.title ?? entry.displayTitle)
      : entry.displayTitle

    matches.push({
      projectId,
      projectTitle: liveTitle,
      updateText: extractUpdateText(transcript, matched),
      nextAction: extractNextAction(transcript),
      progressBump: detectProgressBump(transcript),
      confidence,
    })
  }

  // Also scan any user-added projects not in the static table
  const staticIdSet = new Set(ALIAS_TABLE.map((a) => a.candidateId))
  for (const project of liveProjects) {
    if (staticIdSet.has(project.id) || seenIds.has(project.id)) continue
    const re = new RegExp(`\\b${project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (!re.test(transcript)) continue
    seenIds.add(project.id)

    matches.push({
      projectId: project.id,
      projectTitle: project.title,
      updateText: extractUpdateText(transcript, re),
      nextAction: extractNextAction(transcript),
      progressBump: detectProgressBump(transcript),
      confidence: ACTION_VERB_RE.test(transcript) ? 'medium' : 'low',
    })
  }

  return { detected: matches.length > 0, matches }
}

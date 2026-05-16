import path from "node:path";
import type { Category } from "./types.ts";

export const ZIP_PATH =
  "C:\\Users\\jpica\\OneDrive\\Desktop\\3cd5c79596ff5dee9f6b0d08590c5792ad7dacdb94bec191801d663f19f863a0-2026-05-13-00-10-52-3573d9dcee3d47a981746eeee1919727.zip";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
export const OUT_ROOT = path.join(REPO_ROOT, "exports", "chatgpt-memory-import");
export const CHUNKS_DIR = path.join(OUT_ROOT, "chunks");
export const OBSIDIAN_DIR = path.join(OUT_ROOT, "obsidian-staging");

// Per-message text cap (chars). Anything longer is truncated with a marker —
// keeps chunk files bounded and prevents pasting huge essays into Obsidian.
export const MAX_MESSAGE_CHARS = 1800;

// Per-category Markdown file cap (excerpts). Overflow is summarised as a count
// and the overflow excerpts remain available in chunks/*.jsonl.
export const MAX_EXCERPTS_PER_CATEGORY = 250;

// ----- Keyword universe -----------------------------------------------------
// Keep lowercase, match case-insensitive on word boundaries where practical.
export const KEYWORDS: string[] = [
  "jackson picard","picard os","picardos","picard-os",
  "xodus","exodus",
  "obsidian","obsidian brain","obsidian graph","obsidian vault",
  "claude code","claude os","claude design",
  "deepseek",
  "supabase",
  "whoop","apple health","healthkit","strava",
  "fitness","bench","cutting","cut","hybrid athlete","dunk","four plate","4 plate","pull up","pull-up",
  "porsche","981","boxster",
  "play","graton",
  "kimble","kimble advisors",
  "lmu","loyola marymount","entrepreneurship","marketing",
  "goals","preferences","memory","projects","tasks","dashboard",
  "mental health slider","productivity graph","ai chat imports",
  "ruflo","rooflow",
  "neural graph","neural memory","xodus chatbot","xodus chat",
  "daily goals","daily logs","voice logs","voice log","groceries","mood","routines",
  "current projects","life goals",
  "f45","trainer",
  "myfitnesspal","mfp",
  "john picard","neurobuild","jack melly","d'anthony","yates",
  "flying elephants",
  "apartment",
  "x-pose","xpose",
];

// Pattern → category mapping. First match wins, but a message can be tagged
// with multiple categories; we apply all patterns that match.
export const CATEGORY_PATTERNS: { category: Category; patterns: RegExp[] }[] = [
  { category: "picard_os", patterns: [/\bpicard\s*os\b/i, /\bpicardos\b/i, /\bpicard-os\b/i] },
  { category: "xodus", patterns: [/\bxodus\b/i, /\bexodus\b/i] },
  { category: "obsidian_claude_os", patterns: [/\bobsidian\b/i, /\bclaude\s*os\b/i, /\bclaude\s*code\b/i, /\bclaude\s*design\b/i] },
  { category: "porsche_cars", patterns: [/\bporsche\b/i, /\b981\b/, /\bboxster\b/i] },
  { category: "play_graton", patterns: [/\bplay\s+graton\b/i, /\bgraton\b/i, /\bflying\s+elephants?\b/i] },
  { category: "kimble", patterns: [/\bkimble\b/i] },
  { category: "school", patterns: [/\blmu\b/i, /\bloyola\s+marymount\b/i, /\bcourse\b/i, /\bsemester\b/i, /\bfinals?\b/i] },
  { category: "fitness", patterns: [/\bbench\b/i, /\bcut(ting)?\b/i, /\bhybrid\s+athlete\b/i, /\bdunk\b/i, /\bwhoop\b/i, /\bhrv\b/i, /\bworkout\b/i, /\bcalorie/i, /\bprotein\b/i, /\bmyfitnesspal\b/i, /\bmfp\b/i, /\bf45\b/i, /\bdeadlift\b/i, /\bsquat\b/i, /\bpull[- ]up\b/i] },
  { category: "goals", patterns: [/\bgoal\b/i, /\blife goals?\b/i, /\bdaily goals?\b/i, /\b30[- ]day\b/i, /\b6[- ]month\b/i] },
  { category: "projects_active", patterns: [/\bcurrent projects?\b/i, /\bactive projects?\b/i] },
  { category: "projects_paused", patterns: [/\bx-?pose\b/i, /\bpaused\b/i, /\bshelved\b/i] },
  { category: "people", patterns: [/\bjohn picard\b/i, /\bneurobuild\b/i, /\bjack melly\b/i, /\bd['’]anthony\b/i, /\byates\b/i] },
  { category: "design_dev", patterns: [/\btailwind\b/i, /\bnext\.?js\b/i, /\bframer[- ]?motion\b/i, /\baesthetic\b/i, /\bui[/\\]?ux\b/i, /\bminiami vice\b/i, /\bmiami vice\b/i, /\bneon\b/i, /\bdark mode\b/i] },
  { category: "preferences", patterns: [/\bprefer/i, /\bi (don'?t|do not) (like|want)\b/i, /\balways\b/i, /\bnever\b/i] },
  { category: "workflow", patterns: [/\bworkflow\b/i, /\broutine\b/i, /\bprocess\b/i, /\bvoice log\b/i] },
  { category: "architecture", patterns: [/\barchitect/i, /\bdata layer\b/i, /\blocalstorage\b/i, /\bsupabase\b/i] },
  { category: "work_career", patterns: [/\binternship\b/i, /\bjob\b/i, /\bcareer\b/i, /\bclient\b/i, /\bbusiness\b/i] },
  { category: "profile", patterns: [/\bmy name is\b/i, /\bi am\b/i, /\bi'm\b/i, /\babout me\b/i] },
];

// ----- Current-truth facts used for outdated/conflict detection -------------
// Each rule: if a message contains a contradiction of the canonical truth,
// flag it. Patterns are lowercase regex tested against text.toLowerCase().
export interface ConflictRule {
  id: string;
  description: string;
  triggers: RegExp[]; // any match flags the excerpt
  reason: string;
}

export const CONFLICT_RULES: ConflictRule[] = [
  {
    id: "bench-old",
    description: "Old bench numbers below current 345 lb max",
    triggers: [/\bbench (?:max(?:imum)?|press)?\s*(?:is|of|at|:)?\s*(?:1\d{2}|2[0-9]{2}|3[0-3]\d|340|342)\s*(?:lb|lbs|pounds)?\b/i],
    reason: "Current bench max ~345 lb. Lower numbers are likely historical baselines.",
  },
  {
    id: "navy-seal",
    description: "Navy SEAL focus is no longer current",
    triggers: [/\bnavy\s*seal\b/i, /\bbuds\b/i, /\bspecial\s*operations?\b/i],
    reason: "User no longer wants Navy SEAL training overemphasized.",
  },
  {
    id: "xpose-active",
    description: "X-POSE listed as current/active project",
    triggers: [/\bx-?pose\b/i],
    reason: "X-POSE is paused; current focus is Picard OS / XODUS / DeepSeek / Obsidian.",
  },
  {
    id: "deterministic-router",
    description: "XODUS described as deterministic/rule-based router",
    triggers: [/\bdeterministic\s+router\b/i, /\brule[- ]based\s+(?:router|xodus)\b/i, /\bif[- ]then\s+router\b/i],
    reason: "XODUS should be DeepSeek-powered, not a deterministic router.",
  },
  {
    id: "manual-logging",
    description: "Reliance on heavy manual logging",
    triggers: [/\bmanual(?:ly)?\s+log\b/i, /\bmanual(?:ly)?\s+enter\b/i, /\bcopy[- ]paste\s+(?:from\s+)?(?:apple\s*health|whoop)\b/i],
    reason: "User wants low-friction AI/API/voice intake, not manual logging.",
  },
  {
    id: "old-bw",
    description: "Old bodyweight far from current ~184 lb cutting to ~180",
    triggers: [/\bbody\s*weight\s*(?:is|:)?\s*(1[5-7]\d|19[5-9]|2\d{2})\b/i, /\bweigh(?:s|ing)?\s*(1[5-7]\d|19[5-9]|2\d{2})\s*(?:lb|lbs|pounds)\b/i],
    reason: "Current bodyweight ~184 lb. Other values may be old baselines.",
  },
];

export const CANONICAL_TRUTHS: string[] = [
  "User is Jackson Picard.",
  "LMU junior — Entrepreneurship & Marketing.",
  "Identifies as athlete, entrepreneur, creative.",
  "Bodyweight ~184 lb cutting toward ~180 lb. 2200 kcal / 210 g protein target.",
  "Bench max ~345 lb.",
  "XODUS = DeepSeek-powered AI operator (not deterministic router).",
  "Picard OS = interface/control center. Obsidian = long-term brain. Supabase/local = operational memory.",
  "Wants low-friction AI/API/voice/screenshot intake. Avoid manual logging.",
  "Wants WHOOP / Apple Health integrations (not repeated manual exports).",
  "X-POSE is paused. Active focus: Picard OS, XODUS, DeepSeek chatbot, Obsidian brain, daily goals, fitness, productivity.",
  "Drives a Porsche 981 Boxster.",
  "Wants a 0–100 mental health / mood slider.",
  "Wants productivity graphs driven by workouts, stimulants, recovery, calendar, workload, health.",
  "AI chat history imports: ChatGPT now; Claude/Gemini later, processed separately.",
  "De-emphasize Navy SEAL training in long-term memory.",
];

// Output Markdown filenames (kept in lockstep with the user's requested list).
export const OUTPUT_FILES = {
  index: "ChatGPT_Memory_Index.md",
  archiveMap: "Full_Archive_Map.md",
  profile: "Current_Profile_Updates.md",
  goals: "Current_Goals_Updates.md",
  projects: "Project_Memory_Updates.md",
  fitness: "Fitness_Memory_Updates.md",
  preferences: "Preferences_Updates.md",
  people: "People_And_Relationships.md",
  work: "Work_Career_Updates.md",
  picardOS: "Picard_OS_XODUS_Memory.md",
  obsidian: "Obsidian_And_Claude_OS_Memory.md",
  porsche: "Porsche_And_Car_Projects.md",
  play: "PLAY_Graton_Memory.md",
  kimble: "Kimble_Advisors_Memory.md",
  school: "School_And_Courses_Current.md",
  outdated: "Possible_Outdated_Info.md",
  conflicts: "Conflicts_To_Review.md",
  rawIndex: "Raw_Relevant_Excerpts_Index.md",
  integration: "Picard_OS_Integration_Plan.md",
} as const;

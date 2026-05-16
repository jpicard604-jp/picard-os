// Phase 3+4+5: Read JSONL chunks, classify into the canonical category set,
// run conflict/outdated detection, and write per-category Markdown into
// exports/chatgpt-memory-import/.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  CHUNKS_DIR, OUT_ROOT, OUTPUT_FILES, CONFLICT_RULES, CANONICAL_TRUTHS,
  MAX_EXCERPTS_PER_CATEGORY,
} from "./config.ts";
import type { Category, Excerpt } from "./types.ts";

interface FlaggedExcerpt extends Excerpt {
  conflictIds: string[];
}

const CATEGORY_TO_FILE: Record<Category, keyof typeof OUTPUT_FILES | null> = {
  profile: "profile",
  goals: "goals",
  projects_active: "projects",
  projects_paused: "projects",
  fitness: "fitness",
  preferences: "preferences",
  people: "people",
  work_career: "work",
  picard_os: "picardOS",
  xodus: "picardOS",
  obsidian_claude_os: "obsidian",
  porsche_cars: "porsche",
  play_graton: "play",
  kimble: "kimble",
  school: "school",
  design_dev: "preferences",
  workflow: "preferences",
  architecture: "picardOS",
  backlog: null,
  outdated: "outdated",
  conflict: "conflicts",
  raw_misc: null,
};

interface Bucket {
  title: string;
  fileKey: keyof typeof OUTPUT_FILES;
  excerpts: FlaggedExcerpt[];
  description: string;
}

function makeBuckets(): Record<keyof typeof OUTPUT_FILES, Bucket> {
  const titles: Record<keyof typeof OUTPUT_FILES, { title: string; description: string }> = {
    index:       { title: "ChatGPT Memory Index", description: "" },
    archiveMap:  { title: "Full Archive Map", description: "" },
    profile:     { title: "Current Profile Updates", description: "Identity, role, and self-description signals from the export." },
    goals:       { title: "Current Goals Updates", description: "Goal statements (30-day, 6-month, life-long) found across conversations." },
    projects:    { title: "Project Memory Updates", description: "Project mentions — active and paused. Cross-check against the current projects list." },
    fitness:     { title: "Fitness Memory Updates", description: "Bench, cut, hybrid athlete, WHOOP/HealthKit, training, nutrition signals." },
    preferences: { title: "Preferences Updates", description: "Stated preferences, workflows, design taste, and routines." },
    people:      { title: "People and Relationships", description: "Family, advisors, collaborators mentioned by name." },
    work:        { title: "Work / Career Updates", description: "Internships, clients, advisors, business mentions." },
    picardOS:    { title: "Picard OS / XODUS Memory", description: "Picard OS architecture, XODUS behavior, data layer, integrations." },
    obsidian:    { title: "Obsidian and Claude OS Memory", description: "Obsidian brain, Claude Code/OS/Design references." },
    porsche:     { title: "Porsche and Car Projects", description: "Porsche 981 Boxster + related car-project mentions." },
    play:        { title: "PLAY / Graton Memory", description: "PLAY Graton + Flying Elephants mentions." },
    kimble:      { title: "Kimble Advisors Memory", description: "Kimble Advisors mentions." },
    school:      { title: "School and Current Courses", description: "LMU coursework, semesters, finals, assignments." },
    outdated:    { title: "Possible Outdated Info", description: "Excerpts that look stale vs. current truth. Review before importing." },
    conflicts:   { title: "Conflicts to Review", description: "Excerpts that contradict a canonical-truth rule. Resolve before importing." },
    rawIndex:    { title: "Raw Relevant Excerpts Index", description: "" },
    integration: { title: "Picard OS Integration Plan", description: "" },
  };
  const out = {} as Record<keyof typeof OUTPUT_FILES, Bucket>;
  for (const key of Object.keys(titles) as (keyof typeof OUTPUT_FILES)[]) {
    out[key] = { title: titles[key].title, fileKey: key, excerpts: [], description: titles[key].description };
  }
  return out;
}

function detectConflicts(text: string): string[] {
  const hits: string[] = [];
  for (const r of CONFLICT_RULES) {
    if (r.triggers.some(p => p.test(text))) hits.push(r.id);
  }
  return hits;
}

function safeAnchor(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 120);
}

function frontmatter(o: Record<string, string | string[] | number | boolean | null>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (v === null) {
      lines.push(`${k}: null`);
    } else if (typeof v === "string") {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function renderExcerpt(e: FlaggedExcerpt, i: number): string {
  const date = e.createdISO?.slice(0, 10) ?? e.conversationCreatedISO?.slice(0, 10) ?? "unknown";
  const role = e.role;
  const lines: string[] = [];
  lines.push(`### ${i + 1}. ${safeAnchor(e.conversationTitle)} — ${date}`);
  lines.push("");
  lines.push(`- **Conversation:** \`${e.conversationId}\``);
  lines.push(`- **Role:** ${role}`);
  lines.push(`- **Date:** ${date}`);
  lines.push(`- **Matched keywords:** ${e.matchedKeywords.slice(0, 8).join(", ") || "_(none)_"}`);
  lines.push(`- **Categories:** ${e.categories.join(", ")}`);
  if (e.conflictIds.length > 0) lines.push(`- **Conflicts:** ${e.conflictIds.join(", ")}`);
  lines.push(`- **Source shard:** \`${e.shard}\``);
  lines.push("");
  lines.push("> " + e.text.split("\n").join("\n> "));
  lines.push("");
  return lines.join("\n");
}

function bucketHeader(b: Bucket): string {
  const backlinks = [
    "[[Picard OS]]","[[XODUS]]","[[Jackson Profile]]","[[Current Goals]]",
    "[[Fitness Baselines]]","[[Obsidian Brain]]","[[DeepSeek]]","[[Claude Code]]",
    "[[Porsche 981]]","[[PLAY Graton]]","[[Kimble Advisors]]",
  ];
  return [
    frontmatter({
      title: b.title,
      source: "ChatGPT export (local processing)",
      generated_at: new Date().toISOString(),
      status: "needs_review",
      confidence: "medium",
      backlinks,
    }),
    "",
    `# ${b.title}`,
    "",
    b.description,
    "",
    `_Total excerpts: ${b.excerpts.length}_`,
    "",
  ].join("\n");
}

async function readChunks(): Promise<FlaggedExcerpt[]> {
  const files = fs.readdirSync(CHUNKS_DIR).filter(f => f.endsWith(".jsonl")).sort();
  const all: FlaggedExcerpt[] = [];
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(CHUNKS_DIR, f), "utf8"), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as Excerpt;
        const conflictIds = detectConflicts(e.text);
        all.push({ ...e, conflictIds });
      } catch { /* ignore malformed line */ }
    }
  }
  return all;
}

function routeToBuckets(excerpts: FlaggedExcerpt[], buckets: Record<keyof typeof OUTPUT_FILES, Bucket>): void {
  for (const e of excerpts) {
    const fileKeys = new Set<keyof typeof OUTPUT_FILES>();
    for (const cat of e.categories) {
      const fk = CATEGORY_TO_FILE[cat];
      if (fk) fileKeys.add(fk);
    }
    if (e.conflictIds.length > 0) {
      fileKeys.add("conflicts");
      if (e.conflictIds.includes("bench-old") || e.conflictIds.includes("navy-seal") || e.conflictIds.includes("xpose-active") || e.conflictIds.includes("manual-logging") || e.conflictIds.includes("old-bw") || e.conflictIds.includes("deterministic-router")) {
        fileKeys.add("outdated");
      }
    }
    if (fileKeys.size === 0) continue; // raw_misc with no conflicts → drop
    for (const fk of fileKeys) buckets[fk].excerpts.push(e);
  }
}

function writeBucket(b: Bucket): void {
  const outFile = path.join(OUT_ROOT, OUTPUT_FILES[b.fileKey]);
  const sorted = [...b.excerpts].sort((a, c) => {
    const da = a.createdISO ?? a.conversationCreatedISO ?? "";
    const dc = c.createdISO ?? c.conversationCreatedISO ?? "";
    return dc.localeCompare(da);
  });
  const head = sorted.slice(0, MAX_EXCERPTS_PER_CATEGORY);
  const overflow = sorted.length - head.length;
  const body: string[] = [bucketHeader({ ...b, excerpts: sorted })];
  head.forEach((e, i) => body.push(renderExcerpt(e, i)));
  if (overflow > 0) {
    body.push(`\n---\n\n_${overflow} additional excerpts were truncated from this file. They remain available in \`chunks/\`._`);
  }
  fs.writeFileSync(outFile, body.join("\n"), "utf8");
  console.log(`[summarize] ${OUTPUT_FILES[b.fileKey]}: ${sorted.length} excerpts (showing ${head.length})`);
}

function writeRawIndex(all: FlaggedExcerpt[]): void {
  // Index of conversation titles + counts only — never the body text.
  const byConv = new Map<string, { title: string; count: number; date: string }>();
  for (const e of all) {
    const k = e.conversationId;
    const cur = byConv.get(k);
    if (cur) cur.count++;
    else byConv.set(k, { title: e.conversationTitle, count: 1, date: e.conversationCreatedISO?.slice(0, 10) ?? "unknown" });
  }
  const rows = [...byConv.entries()].sort((a, b) => b[1].count - a[1].count);
  const lines: string[] = [
    "# Raw Relevant Excerpts Index",
    "",
    `Total relevant conversations: **${rows.length}**.`,
    "",
    "| Conversation | Date | Excerpts |",
    "|---|---|---|",
  ];
  for (const [id, v] of rows) {
    lines.push(`| ${safeAnchor(v.title)} | ${v.date} | ${v.count} \`(${id})\` |`);
  }
  fs.writeFileSync(path.join(OUT_ROOT, OUTPUT_FILES.rawIndex), lines.join("\n"), "utf8");
  console.log(`[summarize] Wrote ${OUTPUT_FILES.rawIndex}`);
}

function writeIntegrationPlan(): void {
  const lines: string[] = [];
  lines.push("# Picard OS Integration Plan — ChatGPT Memory Import");
  lines.push("");
  lines.push("_Generated by `scripts/chatgpt-memory-import/summarize-memory.ts`._");
  lines.push("");
  lines.push("## Canonical truths used for conflict resolution");
  lines.push("");
  for (const t of CANONICAL_TRUTHS) lines.push(`- ${t}`);
  lines.push("");
  lines.push("## What goes where");
  lines.push("");
  lines.push("### → Obsidian (long-term brain)");
  lines.push("Copy from `obsidian-staging/` into the real vault **after manual review**:");
  lines.push("- `Picard_OS_XODUS_Memory.md`, `Obsidian_And_Claude_OS_Memory.md` → `Picard OS/` vault folder");
  lines.push("- `People_And_Relationships.md` → `People/`");
  lines.push("- `Porsche_And_Car_Projects.md` → `Projects/Cars/`");
  lines.push("- `PLAY_Graton_Memory.md`, `Kimble_Advisors_Memory.md` → `Projects/Business/`");
  lines.push("- `Fitness_Memory_Updates.md` → `Health/`");
  lines.push("- `School_And_Courses_Current.md` → `LMU/` (only items confirmed current — strip the rest)");
  lines.push("");
  lines.push("### → XODUS memory (operational, hot context)");
  lines.push("Only **canonical-truth-aligned** facts. Source files:");
  lines.push("- `Current_Profile_Updates.md` → Jackson identity block");
  lines.push("- `Current_Goals_Updates.md` → active 30-day / 6-month goals");
  lines.push("- `Preferences_Updates.md` → tone / workflow / design preferences");
  lines.push("- `Fitness_Memory_Updates.md` → fitness baselines (cross-check against current truth)");
  lines.push("");
  lines.push("### → Picard OS app data (localStorage / Supabase later)");
  lines.push("- Project list seeds from `Project_Memory_Updates.md` filtered to **active** projects only");
  lines.push("- Fitness baselines (bench 345, weight 184→180) seed `lib/nutrition-profile.ts` / fitness module defaults");
  lines.push("- Stack items — none auto-extracted (manual entry preferred)");
  lines.push("");
  lines.push("### → Stays as raw archive only");
  lines.push("- The full ZIP at its current path");
  lines.push("- `chat.html` (redundant with JSON shards)");
  lines.push("- All media files inside the ZIP (PNG/JPEG/WAV/PDF)");
  lines.push("- Anything in `chunks/` beyond what made it into the curated category files");
  lines.push("");
  lines.push("### Manual review required");
  lines.push("- Everything in `Conflicts_To_Review.md` and `Possible_Outdated_Info.md`");
  lines.push("- Anything tagged `projects_paused` (e.g. X-POSE) — confirm before persisting");
  lines.push("- School/course material from prior semesters — only persist what's still current");
  lines.push("");
  lines.push("## Connection to existing systems");
  lines.push("");
  lines.push("- **Existing Obsidian Vault ZIP export pipeline** (do not touch in this run) lives alongside this one — both can write into `obsidian-staging/` separately, then a future merger reconciles into one vault.");
  lines.push("- **XODUS memory system** can consume the curated category files at `exports/chatgpt-memory-import/*.md` via a future loader; nothing in this pipeline writes to runtime memory automatically.");
  lines.push("- **DeepSeek chat surface** is unaffected by this run.");
  lines.push("");
  lines.push("## Future Claude + Gemini exports");
  lines.push("");
  lines.push("- Create sibling folders `scripts/claude-memory-import/` and `scripts/gemini-memory-import/` mirroring this layout.");
  lines.push("- Each writes to `exports/<source>-memory-import/` with the same file naming convention.");
  lines.push("- A future merge step reads all three category sets, deduplicates by conversation+timestamp, and writes a unified `obsidian-staging/`.");
  lines.push("- Conflict resolution priority: most-recent canonical truth wins, with explicit overrides in `config.ts → CANONICAL_TRUTHS`.");
  lines.push("");
  fs.writeFileSync(path.join(OUT_ROOT, OUTPUT_FILES.integration), lines.join("\n"), "utf8");
  console.log(`[summarize] Wrote ${OUTPUT_FILES.integration}`);
}

async function main(): Promise<void> {
  const all = await readChunks();
  console.log(`[summarize] Loaded ${all.length} excerpts from chunks/`);

  const buckets = makeBuckets();
  routeToBuckets(all, buckets);

  const writableKeys: (keyof typeof OUTPUT_FILES)[] = [
    "profile","goals","projects","fitness","preferences","people","work",
    "picardOS","obsidian","porsche","play","kimble","school","outdated","conflicts",
  ];
  for (const k of writableKeys) writeBucket(buckets[k]);
  writeRawIndex(all);
  writeIntegrationPlan();
  console.log("[summarize] Done.");
}

main().catch((err) => {
  console.error("[summarize] FAILED", err);
  process.exit(1);
});

# Obsidian Brain Guide
# XODUS Persistent Knowledge Architecture for Picard OS

*Last updated: 2026-05-10*

---

## 1. What the Obsidian Brain Is

Obsidian is a Markdown-based personal knowledge management system built around linked notes (a "second brain" or "vault"). Unlike a database of rows, it stores knowledge as linked text files — each note can reference others via `[[wiki-links]]`, creating a navigable graph of connected ideas.

The key insight: **knowledge compounds over time through links**. A voice log from Monday that mentions "bench press" links to the exercise history node, which links to the Personal Training project, which links to the Q2 goal. When XODUS has access to this network, it understands context that would otherwise be lost between AI sessions.

Core properties:
- Persistent — survives across AI chat sessions, app reloads, and device changes
- Linked — nodes reference each other semantically (`[[bench-press]]`, `[[play-productions]]`)
- Flat-file — plain Markdown, readable without any app
- Searchable — full-text and graph-traversal search
- Compounding — new knowledge automatically links to old knowledge

---

## 2. Why It Matters for XODUS

The fundamental problem with current AI assistants (including XODUS today): **they forget everything between sessions**. Each conversation starts cold. XODUS has no memory of last week's workout, last month's project update, or the insight Jackson noted about sleep patterns and recovery.

The Obsidian brain solves this by giving XODUS a persistent knowledge base it can read from at the start of every session. Instead of "I don't have context from our previous conversations," XODUS can say "I see from your brain that you've been tracking bench press progression since April, and your last three updates to PLAY Productions mentioned delays on talent contracts."

Practical XODUS use cases enabled by the brain:
- Weekly summaries that reference historical patterns, not just this week
- Proactive suggestions grounded in past decisions ("you skipped recovery when strain was above 16 — it's at 17 today")
- Project continuity ("last time you mentioned PLAY Productions you said...") 
- Nutrition trends ("your protein has been 40g below target for 5 of the last 7 days")
- Cross-domain insights ("your best workout weeks correlate with 7.5h+ sleep — you're at 6h this week")

---

## 3. Difference Between Current `lib/obsidian-export.ts` and the Desired Interactive Brain

| Dimension | Current `lib/obsidian-export.ts` | Target interactive brain |
|-----------|----------------------------------|--------------------------|
| **Output** | Single flat Markdown file, downloaded | Persistent Markdown vault (Supabase + local) |
| **Structure** | Sequential sections (Daily Logs, Activities, Projects...) | Linked nodes: each record is its own file with `[[links]]` |
| **Maintenance** | Manual export — user initiates | Auto-maintained by XODUS agent on every save |
| **AI access** | Not queryable by AI | XODUS reads node summaries and links as context |
| **Graph** | None | Interactive force-directed graph at `/brain` |
| **Links** | None — flat sections | Explicit `[[wiki-links]]` between nodes |
| **Hot cache** | None | Weekly summaries pre-generated per domain |
| **Search** | None | Full-text + tag + project filter |

`lib/obsidian-export.ts` is a good **data dump for manual Obsidian import**, but it is not the living brain. Keep it as a backup/export feature. The interactive brain is built separately.

---

## 4. Markdown Vault Architecture

The brain vault stores knowledge as a directory of Markdown files (in Supabase Storage or a local directory for later sync).

```
vault/
├── _index.md                    ← root node: current state summary
├── _hot-cache.md                ← weekly pre-generated XODUS context
├── daily/
│   ├── 2026-05-10.md            ← one file per day
│   ├── 2026-05-09.md
│   └── ...
├── workouts/
│   ├── 2026-05-07-upper.md      ← one file per workout
│   └── ...
├── projects/
│   ├── play-productions.md      ← one file per project
│   ├── wine-room.md
│   └── ...
├── voice/
│   ├── 2026-05-10T14-22.md      ← one file per voice/text log
│   └── ...
├── nutrition/
│   ├── 2026-05-10.md            ← one file per day (merged with daily or separate)
│   └── ...
├── uploads/
│   ├── 2026-05-08-lab-results.md
│   └── ...
├── themes/
│   ├── sleep-quality.md         ← emergent pattern nodes
│   ├── bench-press-progression.md
│   └── ...
└── inbox/
    └── 2026-05-10-unprocessed.md  ← unlinked new entries, processed weekly
```

Each file follows a standard YAML frontmatter + Markdown body:
```markdown
---
id: workout-2026-05-07
type: workout
date: 2026-05-07
tags: [strength, upper-body, bench-press]
links: [2026-05-07, projects/personal-training, themes/bench-press-progression]
---

# Upper — Chest & Back (2026-05-07)

**Duration:** 62 min · **RPE:** 8

## Exercises
- Flat Bench Press: 4×5 @ 225lb
- Weighted Pull-Up: 4×6 @ +45lb *(PR)*
- Cable Row: 3×12 @ 160lb

## Links
[[2026-05-07]] · [[projects/personal-training]] · [[themes/bench-press-progression]]
```

---

## 5. Node and Link Strategy

### Node creation rules
Every significant event becomes a node:
- Daily log saved → create/update `daily/YYYY-MM-DD.md`
- Workout logged → create `workouts/YYYY-MM-DD-{type}.md`
- Voice log saved → create `voice/{timestamp}.md`
- Project saved → create/update `projects/{id}.md`
- Upload processed → create `uploads/{timestamp}-{name}.md`
- XODUS conversation with insight → create or append to relevant node

### Link rules (how nodes connect)
| Link type | Example | Logic |
|-----------|---------|-------|
| Date | `[[2026-05-07]]` | Every node links to its date node |
| Project | `[[projects/play-productions]]` | Voice/task/update mentioning a project |
| Exercise | `[[themes/bench-press-progression]]` | Workout logs containing that exercise |
| Pattern | `[[themes/sleep-quality]]` | Daily log sleepHours field |
| Upload | `[[uploads/...]]` | Voice log referencing an upload |
| Nutrition | `[[nutrition/2026-05-10]]` | Daily log when nutrition fields are set |

### Auto-linking strategy
Links are generated by the XODUS agent as part of the `brain_note.create` action:
1. Node text is scanned for project names, exercise names, recurring themes
2. Matching vault files are identified
3. `[[wiki-link]]` references are added to both nodes (bidirectional)
4. Theme nodes are created or updated when a pattern appears 3+ times

---

## 6. Hot Cache / Agent Summary Strategy

The hot cache is a pre-generated summary file (`vault/_hot-cache.md`) that XODUS injects at the start of every conversation. It contains the most relevant compressed context — not raw data.

### Hot cache structure
```markdown
---
generated: 2026-05-10T06:00:00Z
valid_until: 2026-05-17T06:00:00Z
---

# XODUS Context Cache — Week of May 5–11, 2026

## Recovery & Health (last 7 days)
- Avg recovery: 68 (range 52–84)
- Avg sleep: 6.9h (below 7.5h target on 5/7 days)
- Resting HR trend: stable at 52–54 bpm
- HRV trend: slight decline — 72ms → 61ms Mon–Sat

## Training
- Sessions: 5/5 target (Mon, Wed, Thu, Fri, Sat)
- Bench press this week: 225lb (unchanged from last 2 weeks — plateau warning)
- Personal Training project: 60% — on track for Jun 30 target

## Projects (priority 1-2 only)
- PLAY Productions (P1): 35% progress, target Jun 30. Last update May 9: "talent contract delayed"
- Personal Training (P1): 60%, on track.

## Habits
- Alcohol-free: 12 days
- Smoke-free: 18 days

## Open items XODUS should follow up
- Sleep below target 5 of last 7 days
- Bench press plateau for 2 weeks
- PLAY Productions talent contract unresolved
```

### Hot cache generation
- Runs via Vercel Cron: `0 6 * * 1` (Monday 6am) for weekly cache
- Also runs after a significant input (WHOOP sync, major project update)
- Server reads from Supabase (all tables in date range), generates cache via AI model (Haiku/DeepSeek chat — cheap)
- Result stored in Supabase as `brain_notes` record with tag `hot-cache`
- Injected into XODUS system prompt context on each `/api/agent` call

---

## 7. Weekly Self-Maintenance Strategy

Every week, the XODUS maintenance job runs automatically:

1. **Inbox processing** — unlinked notes in `vault/inbox/` are classified and moved to the right directory with proper links
2. **Theme detection** — scan last 7 days of nodes for patterns (same exercise 3+ times, project mentioned in 3+ voice logs, sleep below target 4+ days) → create or update `themes/` nodes
3. **Hot cache regeneration** — new summary written and stored
4. **Stale link cleanup** — removed projects/exercises no longer referenced get tagged as `archived`
5. **Weekly digest** — prose summary saved to `vault/weekly/YYYY-WW.md` for XODUS to reference

This runs server-side via a Vercel Cron job at `app/api/cron/brain-maintenance/route.ts`.

---

## 8. How Each Record Type Becomes a Brain Node

| Record type | Source | Vault location | Key links generated |
|-------------|--------|----------------|---------------------|
| Daily log | `/daily` form, XODUS voice input | `daily/YYYY-MM-DD.md` | date node, nutrition node if set, recovery theme |
| Workout | `/fitness` form, XODUS voice input | `workouts/YYYY-MM-DD-{type}.md` | date node, exercise theme nodes, project (if mentioned) |
| Voice log | `/voice` record, CommandInbox | `voice/{timestamp}.md` | date node, mentioned projects, mentioned exercises |
| Project update | XODUS voice/text input | `projects/{id}.md` (appended) | date node, any linked tasks |
| Upload / screenshot | Upload Center | `uploads/{timestamp}-{name}.md` | date node, extracted topics |
| WHOOP sync | `/api/integrations/whoop` | appended to `daily/YYYY-MM-DD.md` | recovery theme, sleep theme |
| Nutrition screenshot | XODUS vision pipeline | appended to `daily/YYYY-MM-DD.md` + `nutrition/{date}.md` | date node, meal tag |
| Gmail / Drive doc | Future integration | `inbox/{timestamp}-gmail.md` | extracted projects, topics |
| AI conversation | XODUS command history | `voice/{timestamp}.md` (same as voice log) | same as voice log |
| Brain note (insight) | XODUS `brain_note.create` action | `themes/{topic}.md` or `inbox/` | detected project/exercise links |

---

## 9. How `/brain` Should Visualize This

The `/brain` page renders the vault as an interactive force-directed graph:

- **Nodes** = vault Markdown files (colored by type)
- **Edges** = `[[wiki-link]]` references between nodes
- **Node size** = connection count (more links = larger node)
- **Node color** by type:
  - Blue = daily logs
  - Green = workouts
  - Purple = voice logs
  - Amber = projects
  - Pink = uploads
  - Cyan = themes/insights
  - White = brain notes

User interactions:
- Click node → side panel opens with full Markdown content preview
- Filter by domain, date range, project, or tag
- Hover edge → shows relationship type
- Zoom/pan — standard graph navigation

Graph library decision: deferred to implementation (d3-force, Cytoscape.js, or vis-network). Bundle size and SSR compatibility are the selection criteria. No library installed yet.

**Important:** The graph reads from the Supabase `brain_notes` table (or a flat files index) — it does NOT re-parse localStorage on every render. The vault structure is the source of truth for the graph.

---

## 10. What NOT to Build Yet

| Feature | Reason |
|---------|--------|
| Vault file system sync | Supabase Storage needed; schema deferred |
| Graph visualization | Graph library not selected; nodes don't exist yet |
| WHOOP-triggered brain update | WHOOP OAuth not built |
| Gmail / Drive ingestion | Not in Phase 1–3 scope |
| Hot cache cron job | Depends on brain_notes Supabase table |
| Weekly maintenance job | Depends on vault nodes existing |
| Bidirectional link resolution | Depends on vault file system |
| Obsidian plugin / vault sync | Not the goal — build internal graph first |

**Build order (from xodus-automation-roadmap.md § 9):**
1. XODUS agent pipeline (`/api/agent`) ← built
2. Trends page (`/trends`)
3. WHOOP OAuth
4. Brain graph nodes at `/brain` (Phase E — read local records)
5. Brain vault write path (brain_notes Supabase table)

---

## Appendix: Relationship to Current `lib/obsidian-export.ts`

`lib/obsidian-export.ts` generates a **one-time flat export** of all local records as a single Markdown document, formatted for manual import into a user-managed Obsidian vault. It is useful as:
- A backup/export tool
- A way to bootstrap an initial Obsidian vault manually
- An interim solution until the internal brain graph is built

It should be kept and maintained. The internal brain graph is built alongside it, not as a replacement.

See also: `docs/xodus-automation-roadmap.md` § 7 (Obsidian Brain / Neural Graph Page) for the implementation plan.

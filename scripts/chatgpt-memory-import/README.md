# ChatGPT Memory Import — Picard OS / XODUS / Obsidian

Local-only pipeline that ingests a ChatGPT data-export ZIP, extracts durable
memory candidates, classifies them, flags outdated / conflicting facts, and
stages clean Obsidian-ready Markdown.

**The raw ZIP is never copied into the repo and never extracted in full.** Only
metadata, classifications, and curated excerpts land in `exports/`.

## Inputs

- Source ZIP path is set in `config.ts → ZIP_PATH`. Currently:
  `C:\Users\jpica\OneDrive\Desktop\3cd5c79596ff5dee9f6b0d08590c5792ad7dacdb94bec191801d663f19f863a0-2026-05-13-00-10-52-3573d9dcee3d47a981746eeee1919727.zip`
- Edit `config.ts` to retarget — nothing else hard-codes the path.

## Outputs

Everything is written under `exports/chatgpt-memory-import/`:

```
exports/chatgpt-memory-import/
├─ ChatGPT_Memory_Index.md
├─ Full_Archive_Map.md
├─ Current_Profile_Updates.md
├─ Current_Goals_Updates.md
├─ Project_Memory_Updates.md
├─ Fitness_Memory_Updates.md
├─ Preferences_Updates.md
├─ People_And_Relationships.md
├─ Work_Career_Updates.md
├─ Picard_OS_XODUS_Memory.md
├─ Obsidian_And_Claude_OS_Memory.md
├─ Porsche_And_Car_Projects.md
├─ PLAY_Graton_Memory.md
├─ Kimble_Advisors_Memory.md
├─ School_And_Courses_Current.md
├─ Possible_Outdated_Info.md
├─ Conflicts_To_Review.md
├─ Raw_Relevant_Excerpts_Index.md
├─ Picard_OS_Integration_Plan.md
├─ chunks/                 ← per-shard JSONL of all kept excerpts
└─ obsidian-staging/       ← review → copy into real vault manually
```

## Running

Node 23.6+ runs `.ts` files natively. Picard OS is on Node 26.

```powershell
# Phase 1 — scan ZIP, write archive map + index skeleton
node scripts/chatgpt-memory-import/scan-export.ts

# Phase 2 — extract relevant excerpts to chunks/*.jsonl
node scripts/chatgpt-memory-import/extract-relevant.ts

# Phase 3/4/5 — classify, detect conflicts, write category Markdown
node scripts/chatgpt-memory-import/summarize-memory.ts

# Phase 6 — stage cleaned versions for Obsidian
node scripts/chatgpt-memory-import/build-obsidian-import.ts
```

Or run them all in sequence:

```powershell
node scripts/chatgpt-memory-import/scan-export.ts ; `
node scripts/chatgpt-memory-import/extract-relevant.ts ; `
node scripts/chatgpt-memory-import/summarize-memory.ts ; `
node scripts/chatgpt-memory-import/build-obsidian-import.ts
```

## Files

| File | Purpose |
|---|---|
| `config.ts` | ZIP path, keyword universe, category patterns, conflict rules, canonical truths. |
| `types.ts` | Excerpt / RawConversation / Category type definitions. |
| `scan-export.ts` | Phase 1 — enumerate ZIP entries without unpacking. |
| `extract-relevant.ts` | Phase 2 — stream conversation shards, write JSONL chunks. |
| `summarize-memory.ts` | Phases 3–5 — classify, conflict-detect, write category Markdown. |
| `build-obsidian-import.ts` | Phase 6 — copy curated Markdown to `obsidian-staging/` with backlinks. |

## Privacy rules

- Terminal output only ever prints **counts, filenames, and shard names**.
- Raw chat content only goes into local files inside `exports/`.
- The full ZIP stays at its original Desktop path.
- `chat.html` is intentionally skipped — JSON shards are authoritative.
- No network calls.

## What is **not** done here

- No writes to the real Obsidian vault.
- No DeepSeek / WHOOP / Anthropic API calls.
- No automatic merge with the existing Obsidian Vault ZIP export pipeline.
- No automatic seeding of `localStorage` / Supabase — that's the integration
  step in `Picard_OS_Integration_Plan.md`, performed manually after review.

## Future work

- Sibling `claude-memory-import/` and `gemini-memory-import/` pipelines.
- Unifier step that merges all three category sets into a single staged vault.
- XODUS-side loader that reads the curated category Markdown into hot context.

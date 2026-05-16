// Phase 6: Build a clean Obsidian-ready staging copy of the curated Markdown.
// Adds normalized frontmatter + standardized backlinks. Writes to
// exports/chatgpt-memory-import/obsidian-staging/ — never into the real vault.

import fs from "node:fs";
import path from "node:path";
import { OUT_ROOT, OBSIDIAN_DIR, OUTPUT_FILES } from "./config.ts";

const STAGED: (keyof typeof OUTPUT_FILES)[] = [
  "profile","goals","projects","fitness","preferences","people","work",
  "picardOS","obsidian","porsche","play","kimble","school","outdated","conflicts",
];

const BACKLINKS_BY_FILE: Partial<Record<keyof typeof OUTPUT_FILES, string[]>> = {
  profile:     ["[[Jackson Profile]]","[[XODUS]]","[[Picard OS]]"],
  goals:       ["[[Current Goals]]","[[Jackson Profile]]","[[Picard OS]]"],
  projects:    ["[[Current Projects]]","[[Picard OS]]","[[PLAY Graton]]","[[Porsche 981]]"],
  fitness:     ["[[Fitness Baselines]]","[[WHOOP]]","[[Apple Health]]","[[Jackson Profile]]"],
  preferences: ["[[Preferences]]","[[XODUS]]","[[Picard OS]]"],
  people:      ["[[People]]","[[John Picard]]","[[NeuroBuild]]"],
  work:        ["[[Work & Career]]","[[NeuroBuild]]","[[Kimble Advisors]]"],
  picardOS:    ["[[Picard OS]]","[[XODUS]]","[[DeepSeek]]","[[Obsidian Brain]]"],
  obsidian:    ["[[Obsidian Brain]]","[[Claude Code]]","[[Claude Design]]"],
  porsche:     ["[[Porsche 981]]"],
  play:        ["[[PLAY Graton]]","[[Flying Elephants]]"],
  kimble:      ["[[Kimble Advisors]]"],
  school:      ["[[LMU]]","[[Jackson Profile]]"],
  outdated:    ["[[Outdated Info]]"],
  conflicts:   ["[[Conflicts]]"],
};

function rewriteBacklinks(md: string, backlinks: string[]): string {
  // Replace the `backlinks:` block inside the leading frontmatter, if present.
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return md;
  const fm = m[1];
  const newBlock = ["backlinks:", ...backlinks.map(b => `  - ${JSON.stringify(b)}`)].join("\n");
  const replaced = fm.replace(/backlinks:[\s\S]*?(?=\n[a-zA-Z_]+:|$)/, newBlock + "\n");
  return md.replace(m[0], `---\n${replaced}\n---`);
}

function main(): void {
  fs.mkdirSync(OBSIDIAN_DIR, { recursive: true });
  let written = 0;
  for (const key of STAGED) {
    const fname = OUTPUT_FILES[key];
    const srcPath = path.join(OUT_ROOT, fname);
    if (!fs.existsSync(srcPath)) {
      console.log(`[obsidian] Skipping ${fname} — not generated yet`);
      continue;
    }
    let md = fs.readFileSync(srcPath, "utf8");
    const backlinks = BACKLINKS_BY_FILE[key] ?? [];
    if (backlinks.length > 0) md = rewriteBacklinks(md, backlinks);
    // Prefix filename with "ChatGPT — " so vault import is obvious.
    const dest = path.join(OBSIDIAN_DIR, `ChatGPT — ${fname}`);
    fs.writeFileSync(dest, md, "utf8");
    written++;
    console.log(`[obsidian] Staged ${dest}`);
  }

  const readme = [
    "# Obsidian Staging — ChatGPT Memory Import",
    "",
    "_Do not move these into your real Obsidian vault until each file has been reviewed._",
    "",
    `Files in this folder: ${written}`,
    "",
    "## Suggested vault destinations",
    "",
    "- `ChatGPT — Picard_OS_XODUS_Memory.md` → `Picard OS/`",
    "- `ChatGPT — Obsidian_And_Claude_OS_Memory.md` → `Picard OS/`",
    "- `ChatGPT — People_And_Relationships.md` → `People/`",
    "- `ChatGPT — Porsche_And_Car_Projects.md` → `Projects/Cars/`",
    "- `ChatGPT — PLAY_Graton_Memory.md` → `Projects/Business/`",
    "- `ChatGPT — Kimble_Advisors_Memory.md` → `Projects/Business/`",
    "- `ChatGPT — Fitness_Memory_Updates.md` → `Health/`",
    "- `ChatGPT — School_And_Courses_Current.md` → `LMU/` (current term only)",
    "",
    "## Review-first files",
    "",
    "- `ChatGPT — Possible_Outdated_Info.md` — resolve before importing.",
    "- `ChatGPT — Conflicts_To_Review.md` — resolve before importing.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OBSIDIAN_DIR, "README.md"), readme, "utf8");
  console.log(`[obsidian] Done. Files staged: ${written}`);
}

main();

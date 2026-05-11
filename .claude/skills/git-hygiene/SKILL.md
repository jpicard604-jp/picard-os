# Skill: Git Hygiene — Picard OS

**When to use:** Deciding what to commit vs ignore, cleaning up untracked runtime artifacts, or resolving git noise from daemon processes.

## Runtime Artifacts (never commit)

| File/Pattern | Source | Status |
|-------------|--------|--------|
| `.claude-flow/daemon-state.json` | Claude Flow daemon | Gitignored |
| `.claude-flow/daemon.pid` | Claude Flow daemon | Gitignored |
| `.claude-flow/metrics/*.json` | Claude Flow daemon (~10 min interval) | Gitignored |
| `.claude-flow/security/` | Claude Flow security scans | Gitignored |
| `.claude/settings.local.json` | Local overrides | Gitignored |
| `.swarm/` | Swarm runtime DB | Gitignored |
| `.playwright-mcp/` | Browser session logs | Gitignored |
| `ruvector.db` | Vector DB runtime | Gitignored |
| `.env.local` | Secrets | Already gitignored |

Note: `.claude-flow/.gitignore` covers `logs/` and `data/` but NOT `metrics/` — add to root `.gitignore`.

## Safe to Commit

| Path | Purpose |
|------|---------|
| `tasks/todo.md` | Project task tracking |
| `tasks/lessons.md` | Lessons learned |
| `.claude/skills/*/SKILL.md` | Project skills |
| `.claude-flow/claude-flow.json` | Claude Flow project config |
| `.claude-flow/workflows/` | Workflow definitions (if any) |
| `CLAUDE.md`, `AGENTS.md` | Project instructions |

## Untrack a Tracked File

```bash
# Standard untrack:
git rm --cached path/to/file

# When staged content differs from HEAD (requires force):
git rm --cached -f path/to/file

# Untrack a directory:
git rm -r --cached path/to/dir/
```

Always add the path to `.gitignore` immediately after untracking.

## Junk File Cleanup

Zero-byte files with TypeScript code-fragment names (e.g., `mondayStr`, `p.status`, `mapTask(t`) are accidentally created by shell redirects. They are not imports. Safe to delete. Check with `Get-Item -LiteralPath "filename"` on Windows (use `-LiteralPath` for special chars).

## What NOT to do

- Never commit `.env.local` or any file containing `SUPABASE_SECRET_KEY`
- Never run `git add -A` or `git add .` without reviewing what's staged
- Never `git reset --hard` without user confirmation
- Never `git push --force` to main

## Files to inspect first

- `.gitignore` (root) — current ignore rules
- `.claude-flow/.gitignore` — Claude Flow internal rules
- `git status --short` — current state

## Verification

After adding ignores and untracking: `git status --short` should show no runtime artifact files. Commit only task/skill/config files.

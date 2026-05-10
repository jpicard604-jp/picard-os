# Ruflo Workflow — Picard OS

Ruflo (claude-flow v3) is connected as a local MCP server.
Binary: `npx @claude-flow/cli@latest`
Runtime data: `.claude-flow/` (do not edit manually)

---

## MCP Tools Available This Session

| Tool | When to use |
|---|---|
| `TeamCreate` | Spawn a named multi-agent team for parallel work |
| `SendMessage` | Route a message to a named teammate by name |
| `TeamDelete` | Clean up after the team completes its work |

---

## When to Use Ruflo

### Project memory
Store decisions, patterns, and context that should survive across sessions:
```bash
npx @claude-flow/cli@latest memory store --key "auth-decision" --value "supabase-jwt" --namespace decisions
npx @claude-flow/cli@latest memory search --query "authentication approach"
```
Use this before re-analyzing a problem you've already solved. Check memory first — avoid re-spending tokens on things already decided.

### Multi-agent planning
For tasks that span multiple files or require parallel work (e.g., adding WHOOP OAuth + updating the fitness page + updating storage at the same time):
```bash
# Via MCP in-session:
TeamCreate → name the team, then spawn typed agents via Agent tool
# Via CLI:
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 5 --strategy specialized
```
Agents available for this project: `planner`, `coder`, `reviewer`, `researcher`, `tester`

### Debugging
Before spending turns tracing a bug manually:
```bash
npx @claude-flow/cli@latest hooks pre-task --description "debug storage event not firing"
npx @claude-flow/cli@latest doctor --fix
```
The `pre-task` hook retrieves relevant past patterns from memory. `doctor` checks system health.

### Code review
For a standalone review pass without consuming main context:
```bash
npx @claude-flow/cli@latest agent spawn -t reviewer --name pr-reviewer
```
Or use the `code-review-swarm` agent type for a full swarm pass on a feature branch.

### Architecture decisions
When choosing between approaches (e.g., Supabase vs local for a new module, streaming vs polling for XODUS):
```bash
npx @claude-flow/cli@latest hive-mind init --queen-type strategic
npx @claude-flow/cli@latest hive-mind consensus --propose "WHOOP sync: polling vs webhooks"
```
The consensus mechanism surfaces tradeoffs without a single agent anchoring too early.

---

## Avoiding Unnecessary Token Usage

- **Search memory before asking Claude to re-analyze** — if a decision was made in a prior session, retrieve it: `memory search --query "..."`.
- **Use specialized agents for narrow tasks** — spawning a `reviewer` for a code review costs fewer tokens than asking the main session to do it mid-implementation.
- **Store post-task learnings** — after resolving a non-obvious bug or making an architecture call, store the outcome: `memory store --key "..." --value "..."`.
- **Don't spawn a swarm for single-file edits** — Ruflo adds value on multi-file, multi-concern tasks. Simple edits go straight to Claude Code.
- **Session hooks auto-run** — `pre-task` and `post-task` hooks are configured to fire automatically (`autoExecute: true`). You don't need to call them manually.

---

## Do Not

- Add `@claude-flow/cli` as a dependency in `package.json` — Ruflo runs via `npx`, outside the Next.js app.
- Commit `.claude-flow/data/` or `.claude-flow/sessions/` — these are ephemeral runtime files (`.claude-flow/.gitignore` already covers this).
- Use Ruflo to modify UI components or app logic — it coordinates agents, it does not write code directly.

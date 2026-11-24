/**
 * INFRA — the adapters of runtime.
 *
 * Everything of its infrastructure it lets the composition root, the entry
 * points and the other modules' adapters reach (`.dependency-cruiser.cjs`).
 */
export { AgentCli } from "./infra/agent-cli.base.js";
export { ClaudeCli } from "./infra/claude/claude-cli.adapter.js";
export { CodexCli } from "./infra/codex/codex-cli.adapter.js";
export { FileSessionAnalysisRepository } from "./infra/file-session-analysis.repository.js";
export { GitWorktrees } from "./infra/git-worktrees.adapter.js";
export { Promptfoo } from "./infra/promptfoo.adapter.js";
export { Shell } from "./infra/shell.adapter.js";

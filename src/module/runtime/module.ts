/**
 * MODULE — runtime: running what the charter built.
 *
 * Everything of its engine it lets the code outside it reach; its adapters
 * are reached through `infra.ts` (`.dependency-cruiser.cjs`).
 */

export type { ForRunningCharter, RuntimeSettings } from "./app/port/in/running-charter.port.js";
export { RuntimeDTOs } from "./app/port/in/runtime.dto.js";
export type { ForKeepingWorktrees } from "./app/port/out/keeping-worktrees.port.js";
export type { ForLoadingSessionAnalysis } from "./app/port/out/loading-session-analysis.port.js";
export {
  AdapterFault,
  type Answer,
  type ForCheckingAgentCli,
  type ForRunningAgentCli,
  type PromptUsage,
} from "./app/port/out/running-agent-cli.port.js";
export type {
  ForRunningPromptfoo,
  PromptfooAssertion,
  PromptfooLog,
  PromptfooTest,
  PromptfooTestResult,
} from "./app/port/out/running-promptfoo.port.js";
export type { ForRunningShellCommands, ShellCommandResult } from "./app/port/out/running-shell-commands.port.js";
export { RunningCharter } from "./app/running-charter.use-case.js";
export { SessionLogs } from "./domain/models/session/session-logs.js";

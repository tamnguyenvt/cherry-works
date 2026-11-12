import type { AgentProviderName } from "../../../../charter/module.js";
import type { FaultDTOs } from "../../../../shared/module.js";
import type { RuntimeDTOs } from "./runtime.dto.js";

/** What a repository configured itself with that runtime runs by, handed by
 *  whoever composes it, which keeps it (CORE-FR-231). */
export interface RuntimeSettings {
  /** Which agents the repository compiles for: what an evaluation picks its
   *  agent among (EVAL-FR-020). */
  readonly agents: readonly string[];
}

/**
 * DRIVER PORT — running what the charter built: the sensors of a signal, the
 * calls forwarded to the mcp origins, the evaluations against the real agent
 * and their log, the main context counted exactly, and the agents' sessions
 * kept on this machine (CORE-FR-222). What it needs of the charter it asks
 * charter's applications, in DTOs (CORE-FR-229).
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
export interface ForRunningCharter {
  /** The sensors of one signal, run as one hook, each to its end whatever the
   *  others do (CORE-FR-176 – CORE-FR-179), for the agent named: the engine
   *  assumes none (CORE-FR-233). */
  runSensors(
    signal: string,
    stdin: string,
    agentProviderName: AgentProviderName,
  ): Promise<RuntimeDTOs.SensorRunOutcome | FaultDTOs.Fault>;

  /** One call forwarded to the mcp origin serving it, reached for this call
   *  alone and let go once it has answered (EVAL-FR-031, FR-154). */
  callTool(
    servedToolName: string,
    toolArguments: Readonly<Record<string, unknown>>,
  ): Promise<RuntimeDTOs.ToolAnswer | FaultDTOs.Fault>;

  /** What each agent the repository compiles for is sent of the charter when a
   *  session opens, counted exactly by its own command line (EVAL-FR-004). */
  countMainContext(): Promise<RuntimeDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * Select an explicitly requested configured agent, or the sole configured
   * agent. Several agents require a choice from the driver before execution.
   *
   * Every case kept beside the charter as the store holds it now, committed or
   * not, each handed once to promptfoo, which puts it to the agent, run
   * headless in a worktree of the last commit kept under the log with the
   * charter as it stands built into it, and grades it; and
   * how each came out (EVAL-FR-020). promptfoo is installed first where it is
   * not on the machine yet, saying so (EVAL-FR-032). Every worktree is removed,
   * and the working tree is left as it was (EVAL-FR-021). A charter with an
   * error, an evaluation file that does not read, and a case naming what the
   * charter does not hold are given back as faults, with no case run
   * (EVAL-FR-026).
   */
  evaluateCharter(
    requestedAgentProviderName?: string,
  ): Promise<RuntimeDTOs.EvalRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /** What promptfoo logged of an evaluation, the last one where no log is
   *  named, read back. */
  analyzeEvalLog(logFilePath?: string): Promise<RuntimeDTOs.EvalLogAnalysis | FaultDTOs.Fault>;

  /**
   * The sessions kept, summed up by day and by session, in tokens, over the
   * days from `since` to `until`, both counted in and each `YYYY-MM-DD`: the
   * last 31 days where neither is given (EVAL-FR-030). No session kept is an
   * answer rather than a failure.
   */
  summarizeSessions(since?: string, until?: string): Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault>;
}

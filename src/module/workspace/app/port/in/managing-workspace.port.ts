import type { FaultDTOs } from "../../../../shared/module.js";
import type { WorkspaceDTOs } from "./workspace.dto.js";

/**
 * DRIVER PORT — managing the workspace: what a repository configured itself
 * with, kept in its settings, and setting it up (CORE-FR-231). Whoever
 * composes the engine reads them here and hands them to the applications that
 * run by them; neither the charter nor runtime reads them.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018). Settings that do not read are
 * an `InvalidSettingsFault`, saying what to correct (FR-037).
 */
export interface ForManagingWorkspace {
  /** The agents a repository may name in its settings: the ones the engine
   *  was composed to compile for (CORE-FR-221). */
  readonly agentProviderNames: readonly string[];

  /** The settings the repository keeps; none is a repository never set up,
   *  which chose no agent (CORE-FR-031). */
  readWorkspaceSettings(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;

  /**
   * The repository set up for these agents (CORE-FR-054 – CORE-FR-058): its settings
   * kept, the ceiling kept where one was set now or before and written only
   * where it is not the 20,000 none means, and version control told to ignore
   * the log, once, every other line of its ignore file kept (CORE-FR-225), and a
   * README written where it has none, naming the `cw` that set it up.
   * No agent, an agent this engine compiles for none of, and a ceiling that
   * is no whole number above 0 are refused, nothing kept (CORE-FR-055).
   */
  setUpWorkspace(
    agents: readonly string[],
    cwVersion: string,
    mainContextCeiling?: number,
  ): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;
}

import {
  type ComposedApplications,
  composeApplications as composeApplicationsOverPlugin,
  type ReplaceableAdapters,
} from "./module/composition.js";

export {
  CharterDTOs,
  type ForAuthoringCharter,
  type ForAuthorizingMcpOrigins,
  type ForBuildingCharter,
  type ForCountingTokens,
  type ForFetchingCharterSources,
  type ForStoringCredentials,
  McpClientRegistration,
  McpCredential,
  type OAuthGrant,
} from "./module/charter/module.js";
/**
 * What `cherry-works` lets a tool import, and nothing more (SDK-FR-002,
 * SDK-FR-005, SDK-FR-020): how to compose the engine and the applications it
 * answers through, with the DTOs they answer; and the ports of every adapter a
 * tool may hand in place of the engine's own, with the values they cross.
 */
export type { ComposedApplications, ComposedEngine, ReplaceableAdapters } from "./module/composition.js";
export {
  type ForKeepingWorktrees,
  type ForRunningCharter,
  type ForRunningPromptfoo,
  type ForRunningShellCommands,
  type PromptfooAssertion,
  type PromptfooLog,
  type PromptfooTest,
  type PromptfooTestResult,
  RuntimeDTOs,
  type ShellCommandResult,
} from "./module/runtime/module.js";
export {
  AdapterFault,
  FaultDTOs,
  type ForCallingMcpServers,
  type ForReadingFiles,
  type ForReportingProgress,
  type ForTellingTime,
  type ForWritingFiles,
  type ListedFile,
  type McpServerAddress,
  type McpServerConnection,
  type ReadFile,
  type ToolAnswer,
  UnauthorizedMcpFault,
  type UpstreamTool,
} from "./module/shared/module.js";
export { type ForManagingWorkspace, WorkspaceDTOs } from "./module/workspace/module.js";

/**
 * The workspace module and the engine, each adapter handed replacing the
 * engine's own and every other one the engine's own (CORE-FR-230,
 * SDK-FR-020): the charter's store and the agents' projections are the
 * engine's, set up over the file adapters handed.
 */
export const composeApplications: (
  repoFolder: URL,
  homeFolder: URL,
  plugin?: Partial<ReplaceableAdapters>,
) => Promise<ComposedApplications> = composeApplicationsOverPlugin;

/** Replaced at build time with the version shared with cw. */
declare const ENGINE_VERSION: string;
export const VERSION: string = ENGINE_VERSION;

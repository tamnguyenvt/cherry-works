/**
 * What `cherry-works` lets a tool import, and nothing more (SDK-FR-002,
 * SDK-FR-005, SDK-FR-020): how to compose the engine and the applications it
 * answers through, with the DTOs they answer; the ports of every adapter a
 * tool may hand in place of the engine's own, with the values they cross; and
 * the engine's own adapters, for a tool to extend; and the layout of the
 * store `cw` keeps the charter in and of the output, each one value
 * (CORE-FR-215) — no constant or helper beside them.
 */

export {
  AgentProjection,
  ClaudeProjection,
  CodexProjection,
  FileCharterRepository,
  GitSources,
  KeychainCredentialsRepository,
  LocalRepoManipulator,
  OAuth,
  Tiktoken,
} from "./module/charter/infra.js";
export {
  AgentPrimitive,
  AgentProvider,
  type AgentProviderName,
  AssetFile,
  BasePrimitive,
  BuiltSensors,
  Catalogue,
  CharterDTOs,
  CharterInstall,
  CharterMd,
  type CharterOutput,
  CharterOutputItem,
  CharterPath,
  type CharterRoot,
  CharterSource,
  CharterSourceOrigin,
  type CompiledPrimitive,
  CopyPlan,
  charterPath,
  DocumentBasedComponent,
  EvalSuite,
  type ForAuthoringCharter,
  type ForAuthorizingOAuthClients,
  type ForBuildingCharter,
  type ForCountingTokens,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForManagingLocalAgentOutput,
  type ForManagingLocalOutput,
  type ForStoringCredentials,
  GuidePrimitive,
  InstalledCharterRecord,
  type MainContextText,
  McpAuthMethod,
  type McpAuthMethodName,
  McpClientRegistration,
  McpCredential,
  type McpOriginAddress,
  McpOrigins,
  McpPrimitive,
  type OAuthClientRegistration,
  type OAuthGrant,
  OutputPath,
  outputPath,
  PlaybookPrimitive,
  PosturePrimitive,
  type Primitive,
  PrimitiveLayer,
  Primitives,
  ProjectionPlan,
  ProviderComponent,
  RawCharterMetadata,
  RawEvalSuite,
  RawPrimitive,
  RawTestSuite,
  SensorPrimitive,
  SettingBasedComponent,
  SkillPrimitive,
  StampedDocument,
  TestSuite,
  type UnparsedHeaders,
  WritePlan,
} from "./module/charter/module.js";
export {
  type ComposedApplications,
  type ComposedEngine,
  composeApplications,
  type EngineAdapters,
} from "./module/composition.js";
export {
  AgentCli,
  ClaudeCli,
  CodexCli,
  FileSessionAnalysisRepository,
  GitWorktrees,
  Promptfoo,
  Shell,
} from "./module/runtime/infra.js";
export {
  type Answer,
  type ForCheckingAgentCli,
  type ForKeepingWorktrees,
  type ForLoadingSessionAnalysis,
  type ForRunningAgentCli,
  type ForRunningCharter,
  type ForRunningPromptfoo,
  type ForRunningShellCommands,
  type PromptfooAssertion,
  type PromptfooLog,
  type PromptfooTest,
  type PromptfooTestResult,
  type PromptUsage,
  RuntimeDTOs,
  SessionLogs,
  type ShellCommandResult,
} from "./module/runtime/module.js";
export {
  ConsoleReporter,
  FileOutput,
  FileReaders,
  McpClients,
  SystemClock,
} from "./module/shared/infra.js";
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
export { FileWorkspaceSettingsRepository } from "./module/workspace/infra.js";
export {
  type ForManagingWorkspace,
  type ForStoringWorkspaceSettings,
  RawWorkspaceSettings,
  WorkspaceDTOs,
  WorkspaceSettings,
} from "./module/workspace/module.js";

/** Replaced at build time with the version shared with cw. */
declare const ENGINE_VERSION: string;
export const VERSION: string = ENGINE_VERSION;

/** The engine contract: use cases, their ports and the values crossing them. */
export { CharterAuthoring } from "../../src/hexagon/application/CharterAuthoring.js";
export { CharterEvaluating } from "../../src/hexagon/application/CharterEvaluating.js";
export { CharterVendoring } from "../../src/hexagon/application/CharterVendoring.js";
export { McpConnecting } from "../../src/hexagon/application/McpConnecting.js";
export { SensorRunning } from "../../src/hexagon/application/SensorRunning.js";
export { SessionReviewing } from "../../src/hexagon/application/SessionReviewing.js";
export { TestAuthoring } from "../../src/hexagon/application/TestAuthoring.js";
export { DataDTOs, OutcomeDTOs } from "../../src/hexagon/port/driver/dtos/index.js";
export { type ForAuthoringTests } from "../../src/hexagon/port/driver/ForAuthoringTests.js";
export { type ForConnectingMcps } from "../../src/hexagon/port/driver/ForConnectingMcps.js";
export { type ForEvaluatingCharter, EVAL_DIRECTORY } from "../../src/hexagon/port/driver/ForEvaluatingCharter.js";
export { type ForManagingCharter, type SettingsOptions, type UnparsedHeaders, DomainFault, AGENT_PROVIDERS, isAgentProvider, type AgentProvider, BUILTIN_LAYER, REPO_LAYER, VENDOR_LAYER, type LayerName, TEST_DIRECTORY } from "../../src/hexagon/port/driver/ForManagingCharter.js";
export { type ForReviewingSessions } from "../../src/hexagon/port/driver/ForReviewingSessions.js";
export { type ForRunningSensors } from "../../src/hexagon/port/driver/ForRunningSensors.js";
export { type ForVendoringCharters } from "../../src/hexagon/port/driver/ForVendoringCharters.js";
export { type OAuthGrant, type ForAuthorizing, AdapterFault } from "../../src/hexagon/port/zdriven/ForAuthorizing.js";
export { UnauthorizedMcpFault, type McpServerAddress, type UpstreamTool, type ToolAnswer, type McpServerConnection, type ForCallingMcpServers } from "../../src/hexagon/port/zdriven/ForCallingMcpServers.js";
export { type ForCountingTokens } from "../../src/hexagon/port/zdriven/ForCountingTokens.js";
export { type ForFetchingSources } from "../../src/hexagon/port/zdriven/ForFetchingSources.js";
export { type ForKeepingSecrets } from "../../src/hexagon/port/zdriven/ForKeepingSecrets.js";
export { type ForKeepingWorktrees } from "../../src/hexagon/port/zdriven/ForKeepingWorktrees.js";
export { type ForParsingToml } from "../../src/hexagon/port/zdriven/ForParsingToml.js";
export { type ForParsingYaml, CharterPrimitiveFault } from "../../src/hexagon/port/zdriven/ForParsingYaml.js";
export { type ForReadingFiles, type ListedFile, type ReadFile } from "../../src/hexagon/port/zdriven/ForReadingFiles.js";
export { type ForReportingProgress } from "../../src/hexagon/port/zdriven/ForReportingProgress.js";
export { type ForCheckingAgentCli, type ForRunningAgentCli, type Answer, type PromptUsage } from "../../src/hexagon/port/zdriven/ForRunningAgentCli.js";
export { type ForRunningPromptfoo, type PromptfooTest, type PromptfooAssertion, type PromptfooTestResult, type PromptfooLog } from "../../src/hexagon/port/zdriven/ForRunningPromptfoo.js";
export { type ForRunningShellCommands, type ShellCommandResult } from "../../src/hexagon/port/zdriven/ForRunningShellCommands.js";
export { type ForTellingTime } from "../../src/hexagon/port/zdriven/ForTellingTime.js";
export { type ForWritingFiles } from "../../src/hexagon/port/zdriven/ForWritingFiles.js";

/** Replaced at build time with the version shared with cw. */
declare const ENGINE_VERSION: string;
export const VERSION: string = ENGINE_VERSION;

/**
 * MODULE — the kernel every module shares.
 *
 * Everything of its engine it lets the code outside it reach; its adapters
 * are reached through `infra.ts` (`.dependency-cruiser.cjs`).
 */
export { ApplicationService, INTERNAL_FAULT_DTO } from "./app/application-service.base.js";
export { dto, groupByType, StringsSchema } from "./app/port/in/dto.schema.js";
export { FaultDTOs } from "./app/port/in/fault.dto.js";
export {
  type ForCallingMcpServers,
  type McpServerAddress,
  type McpServerConnection,
  type ToolAnswer,
  UnauthorizedMcpFault,
  type UpstreamTool,
} from "./app/port/out/calling-mcp-servers.port.js";
export { FolderAddress, type FolderURL } from "./app/port/out/folder-address.port.js";
export type { ForReadingFiles, ListedFile, ReadFile } from "./app/port/out/reading-files.port.js";
export type { ForReportingProgress } from "./app/port/out/reporting-progress.port.js";
export type { ForTellingTime } from "./app/port/out/telling-time.port.js";
export type { ForWritingFiles } from "./app/port/out/writing-files.port.js";
export { FaultHelper } from "./domain/helper.js";
export { GlobsLib } from "./domain/libs/globs.lib.js";
export { TomlLib } from "./domain/libs/toml.lib.js";
export { z } from "./domain/libs/validator.lib.js";
export { YamlLib } from "./domain/libs/yaml.lib.js";
export {
  AdapterFault,
  ErroredAgentAnswerFault,
  FailedAgentCliFault,
  FailedCheckoutFault,
  FailedEvaluationCaseFault,
  FailedPromptfooEvalFault,
  FailedPromptfooInstallFault,
  FailedRenewalFault,
  FailedSignInFault,
  FileOutsideFolderFault,
  InvalidEvaluationLogFault,
  LeftoverFolderFault,
  LinkedFolderFault,
  MissingFolderReaderFault,
  MissingGitFault,
  MissingHeldFileFault,
  MissingPromptfooResultFault,
  NoFolderAddressFault,
  OccupiedPrimitiveFileFault,
  OldLayoutFault,
  OrphanPrimitiveFault,
  OverlappingPrimitiveFoldersFault,
  PathOutsideFolderFault,
  RefusedSecretStoreFault,
  RefusedSignInFault,
  RefusedWorktreeFault,
  SignInTimedOutFault,
  UnansweringMcpOriginFault,
  UnbuiltCheckoutAdapterFault,
  UndeletableFolderFault,
  UnkeepableSecretKeyFault,
  UnreachableMcpOriginFault,
  UnreachableSourceFault,
  UnreadableEvaluationLogFault,
  UnreadableEvaluationRunsFault,
  UnreadableFetchedSourceFault,
  UnreadableFileFault,
  UnreadableFolderFault,
  UnreadableGitConfigFault,
  UnreadableSessionFolderFault,
  UnrestoredFolderFault,
  UnsupportedPlatformFault,
  UnwritableFileFault,
  UnwritableSourceStoreFault,
} from "./domain/models/adapter.fault.js";
export { AgentProvider, type AgentProviderName } from "./domain/models/agent/agent-provider.value-object.js";
export { ApplicationFault } from "./domain/models/application.fault.js";
export {
  DomainFault,
  UnfaultedRaiseFault,
  UnmappedYamlFault,
  UnreadableTomlFault,
  UnreadableYamlFault,
  UnsoundModelFault,
  UnwritableTomlFault,
} from "./domain/models/domain.fault.js";
export { Faults } from "./domain/models/fault/faults.js";
export { FaultsByFile } from "./domain/models/fault/faults-by-file.js";
export { RefusedByOtherModuleFault } from "./domain/models/shared.fault.js";
export { FlagSchema, GoodArraySchema, GoodLineSchema } from "./domain/schema.js";

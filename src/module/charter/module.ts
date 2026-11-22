/**
 * MODULE — the charter: authoring and projecting it.
 *
 * Everything it lets the code outside it reach, and the only file the code
 * outside it imports (`.dependency-cruiser.cjs`).
 */
export { AuthoringCharter } from "./app/authoring-charter.use-case.js";
export { BuildingCharter } from "./app/building-charter.use-case.js";
export {
  BUILTIN_LAYER_NAME,
  type ForAuthoringCharter,
  type LayerName,
  type McpOriginAddress,
  PACKAGE_LAYER_NAME,
  REPO_LAYER_NAME,
  type UnparsedHeaders,
} from "./app/port/in/authoring-charter.port.js";
export type { AgentProviderName, ForBuildingCharter, ProjectionSettings } from "./app/port/in/building-charter.port.js";
export { CharterDTOs } from "./app/port/in/charter.dto.js";
export {
  AdapterFault,
  type ForAuthorizingOAuthClients,
  type OAuthClientRegistration,
  type OAuthGrant,
} from "./app/port/out/authorizing-oauth-clients.port.js";
export type { ForCountingTokens } from "./app/port/out/counting-tokens.port.js";
export type { ForFetchingCharterSources } from "./app/port/out/fetching-charter-sources.port.js";
export {
  BasePrimitive,
  CharterPath,
  charterPath,
  type ForManagingCharter,
  Primitives,
  SkillPrimitive,
} from "./app/port/out/managing-charter.port.js";
export {
  AgentPrimitive,
  AgentProvider,
  BuiltSensors,
  Catalogue,
  CharterMd,
  type CharterRoot,
  type CompiledPrimitive,
  DocumentBasedComponent,
  type ForManagingLocalAgentOutput,
  GuidePrimitive,
  type MainContextText,
  McpPrimitive,
  PlaybookPrimitive,
  PosturePrimitive,
  ProviderComponent,
  SensorPrimitive,
  SettingBasedComponent,
} from "./app/port/out/managing-local-agent-output.port.js";
export {
  type CharterOutput,
  CharterOutputItem,
  type ForManagingLocalOutput,
  McpOrigins,
  OutputPath,
  outputPath,
  ProjectionPlan,
  StampedDocument,
  WritePlan,
} from "./app/port/out/managing-local-output.port.js";
export type { ForStoringCredentials } from "./app/port/out/storing-credentials.port.js";
export { BuildCharterService, buildCharterService } from "./app/services/build-charter.service.js";
export { LoadCharterService, loadCharterService } from "./app/services/load-charter.service.js";
export { LoadMcpOriginsService, loadMcpOriginsService } from "./app/services/load-mcp-origins.service.js";
export { InstalledCharterRecord } from "./domain/models/charter/installed-charter-record.value-object.js";
export { RawCharterMetadata } from "./domain/models/charter/raw-charter-metadata.js";
export { InvalidPrimitiveFault } from "./domain/models/charter.fault.js";
export { CopyPlan } from "./domain/models/charter-output/projection-plan.js";
export { CharterInstall } from "./domain/models/charter-source/charter-install.js";
export { CharterSource } from "./domain/models/charter-source/charter-source.js";
export { CharterSourceOrigin } from "./domain/models/charter-source/charter-source-origin.value-object.js";
export { EvalSuite } from "./domain/models/eval/eval-suite.js";
export { RawEvalSuite } from "./domain/models/eval/raw-eval-suite.js";
export { McpAuthMethod, type McpAuthMethodName } from "./domain/models/mcp/mcp-auth-method.value-object.js";
export { McpClientRegistration } from "./domain/models/mcp/mcp-client-registration.js";
export { McpCredential } from "./domain/models/mcp/mcp-credential.js";
export { AssetFile } from "./domain/models/primitive/asset-file.js";
export type { Primitive } from "./domain/models/primitive/primitive.js";
export { PrimitiveLayer } from "./domain/models/primitive/primitive-layer.value-object.js";
export { RawPrimitive } from "./domain/models/primitive/raw-primitive.js";
export { RawTestSuite } from "./domain/models/test/raw-test-suite.js";
export { TestSuite } from "./domain/models/test/test-suite.js";
export { AgentProjection } from "./infra/agent-projection.base.js";
export { ClaudeProjection } from "./infra/claude/claude-projection.adapter.js";
export { CodexProjection } from "./infra/codex/codex-projection.adapter.js";
export { FileCharterRepository } from "./infra/file-charter.repository.js";
export { GitSources } from "./infra/git-sources.adapter.js";
export { resolveLaidText } from "./infra/helper.js";
export { KeychainCredentialsRepository } from "./infra/keychain-credentials.repository.js";
export { LocalRepoManipulator } from "./infra/local-repo-manipulator.adapter.js";
export { OAuth } from "./infra/oauth.adapter.js";
export { Tiktoken } from "./infra/tiktoken.adapter.js";

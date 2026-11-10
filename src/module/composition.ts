import { fileURLToPath } from "node:url";
import {
  AuthoringCharter,
  buildCharterService,
  installCharterService,
  LocalRepoManipulator,
  FileCharterRepository,
  GitSources,
  loadCharterService,
  loadMcpOriginsService,
  OAuth,
  BuildingCharter,
  KeychainCredentialsRepository,
  Tiktoken,
  type AgentProviderName,
  type ForAuthoringCharter,
  type ForAuthorizingMcpOrigins,
  type ForCountingTokens,
  type ForFetchingCharterSources,
  type ForBuildingCharter,
  type ForManagingCharter,
  type ForManagingLocalAgentOutput,
  type ForStoringCredentials,
  type ForManagingLocalOutput,
} from "#module/charter/module.js";
import {
  FileSessionAnalysisRepository,
  GitWorktrees,
  Promptfoo,
  RunningCharter,
  Shell,
  type ForCheckingAgentCli,
  type ForKeepingWorktrees,
  type ForLoadingSessionAnalysis,
  type ForRunningAgentCli,
  type ForRunningCharter,
  type ForRunningPromptfoo,
  type ForRunningShellCommands,
} from "#module/runtime/module.js";
import { FileWorkspaceSettingsRepository, ManagingWorkspace, type ForManagingWorkspace, type ForStoringWorkspaceSettings } from "#module/workspace/module.js";
import {
  ConsoleReporter,
  FileOutput,
  FileReaders,
  McpClients,
  SystemClock,
  type ForCallingMcpServers,
  type ForReadingFiles,
  type ForReportingProgress,
  type ForTellingTime,
  type ForWritingFiles,
} from "#module/shared/module.js";
import { ClaudeCli } from "../plugin/claude/claude-cli.adapter.js";
import { ClaudeProjection } from "../plugin/claude/claude-projection.adapter.js";
import { CodexCli } from "../plugin/codex/codex-cli.adapter.js";
import { CodexProjection } from "../plugin/codex/codex-projection.adapter.js";

/** The agents the engine compiles for when no projection is handed: one
 *  projection each, over the repository's files (CORE-FR-221). */
export const AGENT_PROVIDERS = ["claude", "codex"] as const;

/** Every adapter the engine is composed with, each one the tool author may
 *  hand in place of the default (CORE-FR-230). */
export interface EngineAdapters {
  readonly fileReader: ForReadingFiles;
  readonly fileWriter: ForWritingFiles;
  readonly sourceFetcher: ForFetchingCharterSources;
  readonly worktrees: ForKeepingWorktrees;
  readonly authorizing: ForAuthorizingMcpOrigins;
  readonly mcpServers: ForCallingMcpServers;
  readonly tokenCounter: ForCountingTokens;
  readonly clock: ForTellingTime;
  readonly shell: ForRunningShellCommands;
  /** What the developer is told, internal faults among it (SDK-FR-017). */
  readonly progressReporter: ForReportingProgress;
  /** Each agent's own command line, under the agent it runs: a second host is
   *  one more entry here. */
  readonly agentCliByProvider: Readonly<Partial<Record<AgentProviderName, ForCheckingAgentCli | ForRunningAgentCli>>>;
  readonly promptfooRunner: ForRunningPromptfoo;
  /** The charter — its primitives, its vendors, its test and eval cases —
   *  kept by one store (CORE-FR-228). */
  readonly charterRepository: ForManagingCharter;
  /** What lays a build's output onto the repository, and writes every file
   *  a build planned (CORE-FR-221). */
  readonly localRepo: ForManagingLocalOutput;
  /** What each agent reads of a charter, and where, under the agent it
   *  projects onto: the agents the engine compiles for are these (FR-018,
   *  CORE-FR-221). */
  readonly agentProjectionByProvider: Readonly<Record<AgentProviderName, ForManagingLocalAgentOutput>>;
  readonly sessionAnalysisRepository: ForLoadingSessionAnalysis;
  readonly credentialsRepository: ForStoringCredentials;
}

/** What a repository configured itself with that the applications are
 *  composed for, as the workspace module answers it (CORE-FR-231). */
export interface EngineSettings {
  readonly agents: readonly string[];
  readonly mainContextCeiling?: number | undefined;
  readonly sessionAnalysisFolder?: string | undefined;
}

/** The engine's two modules' applications, as the drivers reach them
 *  (CORE-FR-222): the charter's two, and runtime's. */
export interface ComposedEngine {
  readonly charterAuthoringApp: ForAuthoringCharter;
  readonly charterBuildingApp: ForBuildingCharter;
  readonly charterRuntimeApp: ForRunningCharter;
}

/**
 * The engine composed of its two modules over the adapters it is handed, for
 * the settings it is handed: each adapter handed replaces the one it would use
 * otherwise, and each one not handed is the default, set up on the
 * repository's address and the developer's home's (CORE-FR-230, CORE-FR-217,
 * CORE-FR-218). The engine itself is the same whichever adapters it is handed.
 * A store not handed is built over the adapters that were.
 */
export function composeEngine(repoFolder: URL, homeFolder: URL, engineSettings: EngineSettings, handedAdapters: Partial<EngineAdapters> = {}): ComposedEngine {
  const fileReader = handedAdapters.fileReader ?? new FileReaders(repoFolder);
  const fileWriter = handedAdapters.fileWriter ?? new FileOutput(repoFolder);
  const clock = handedAdapters.clock ?? new SystemClock();
  const progressReporter = handedAdapters.progressReporter ?? new ConsoleReporter();
  const mcpServers = handedAdapters.mcpServers ?? new McpClients();
  const charterRepository = handedAdapters.charterRepository ?? new FileCharterRepository(fileReader, fileWriter, handedAdapters.sourceFetcher ?? new GitSources(repoFolder));
  const credentialsRepository = handedAdapters.credentialsRepository ?? new KeychainCredentialsRepository();
  const localRepo = handedAdapters.localRepo ?? new LocalRepoManipulator(fileReader, fileWriter);

  const charterAuthoringApp: ForAuthoringCharter = new AuthoringCharter(
    loadCharterService,
    installCharterService,
    charterRepository,
    credentialsRepository,
    handedAdapters.authorizing ?? new OAuth(),
    clock,
    progressReporter,
  );
  const charterBuildingApp: ForBuildingCharter = new BuildingCharter(
    buildCharterService,
    loadCharterService,
    loadMcpOriginsService,
    charterRepository,
    localRepo,
    // Each agent's projection over the repository's files, under the agent it
    // projects onto: a second host is one more entry here.
    handedAdapters.agentProjectionByProvider ?? ({ claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) } satisfies Readonly<Record<(typeof AGENT_PROVIDERS)[number], ForManagingLocalAgentOutput>>),
    handedAdapters.tokenCounter ?? new Tiktoken(),
    { agents: engineSettings.agents, ...(engineSettings.mainContextCeiling === undefined ? {} : { mainContextCeiling: engineSettings.mainContextCeiling }) },
    progressReporter,
    charterAuthoringApp,
    mcpServers,
  );
  const charterRuntimeApp: ForRunningCharter = new RunningCharter(
    charterAuthoringApp,
    charterBuildingApp,
    fileReader,
    handedAdapters.agentCliByProvider ?? { claude: new ClaudeCli(), codex: new CodexCli() },
    handedAdapters.shell ?? new Shell(repoFolder),
    handedAdapters.worktrees ?? new GitWorktrees(repoFolder),
    // promptfoo, installed once under this engine's own folder in the
    // developer's home, outside every repository (EVAL-FR-032).
    handedAdapters.promptfooRunner ?? new Promptfoo(repoFolder, fileURLToPath(new URL(".cherry-works", homeFolder))),
    // The sessions are read off the home's, wherever under it the
    // repository's settings keep them: the repository sets that reader up
    // itself.
    handedAdapters.sessionAnalysisRepository ?? new FileSessionAnalysisRepository((rootFolder) => new FileReaders(rootFolder), repoFolder, homeFolder),
    clock,
    { agents: engineSettings.agents, ...(engineSettings.sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder: engineSettings.sessionAnalysisFolder }) },
    progressReporter,
    mcpServers,
  );
  return { charterAuthoringApp, charterBuildingApp, charterRuntimeApp };
}

/** What the workspace module is composed with, each one the tool author may
 *  hand in place of the default (CORE-FR-230). */
export interface WorkspaceAdapters {
  readonly fileReader: ForReadingFiles;
  readonly fileWriter: ForWritingFiles;
  readonly progressReporter: ForReportingProgress;
  readonly workspaceSettingsRepository: ForStoringWorkspaceSettings;
  /** The agents a repository may be set up for: the ones the engine is
   *  handed a projection of (CORE-FR-221). */
  readonly agentProviders: readonly AgentProviderName[];
}

/** The workspace module's application over the adapters it is handed, set up
 *  on the repository's address, checking settings against the agents the
 *  engine compiles for (CORE-FR-231). */
export function composeWorkspace(repoFolder: URL, handedAdapters: Partial<WorkspaceAdapters> = {}): ForManagingWorkspace {
  const workspaceSettingsRepository =
    handedAdapters.workspaceSettingsRepository ??
    new FileWorkspaceSettingsRepository(handedAdapters.fileReader ?? new FileReaders(repoFolder), handedAdapters.fileWriter ?? new FileOutput(repoFolder));
  return new ManagingWorkspace(workspaceSettingsRepository, handedAdapters.agentProviders ?? AGENT_PROVIDERS, handedAdapters.progressReporter ?? new ConsoleReporter());
}

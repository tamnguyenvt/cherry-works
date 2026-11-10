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
  ClaudeProjection,
  CodexProjection,
  KeychainCredentialsRepository,
  Tiktoken,
  type ForAuthoringCharter,
  type ForAuthorizingMcpOrigins,
  type ForBuildingCharter,
  type ForCountingTokens,
  type ForManagingCharter,
  type ForManagingLocalAgentOutput,
  type ForStoringCredentials,
} from "#module/charter/module.js";
import {
  FileSessionAnalysisRepository,
  GitWorktrees,
  Promptfoo,
  RunningCharter,
  Shell,
  ClaudeCli,
  CodexCli,
  type ForCheckingAgentCli,
  type ForKeepingWorktrees,
  type ForRunningCharter,
  type ForRunningPromptfoo,
  type ForRunningShellCommands,
} from "#module/runtime/module.js";
import { FileWorkspaceSettingsRepository, ManagingWorkspace, type ForManagingWorkspace } from "#module/workspace/module.js";
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

/**
 * Everything plugged into the engine where it is composed: each agent's
 * projection and command line, under the agent it is for, the store that
 * keeps the charter, and every other adapter the engine reaches the outside
 * through. Each one may be the engine's own or written anew (CORE-FR-230).
 */
export interface EnginePlugin {
  readonly agentProvider: {
    readonly [provider: string]: {
      /** What the agent reads of a charter, and where (CORE-FR-221). */
      readonly projection: ForManagingLocalAgentOutput;
      /** The agent's own command line (EVAL-FR-004). */
      readonly cli: ForCheckingAgentCli;
    };
  };
  /** The charter — its primitives, its vendors, its test and eval cases —
   *  kept by one store (CORE-FR-228). */
  readonly charterRepository: ForManagingCharter;
  readonly fileReader: ForReadingFiles;
  readonly fileWriter: ForWritingFiles;
  readonly worktrees: ForKeepingWorktrees;
  readonly authorizing: ForAuthorizingMcpOrigins;
  readonly mcpServers: ForCallingMcpServers;
  readonly tokenCounter: ForCountingTokens;
  readonly clock: ForTellingTime;
  readonly shell: ForRunningShellCommands;
  /** What the developer is told, internal faults among it (SDK-FR-017). */
  readonly progressReporter: ForReportingProgress;
  readonly promptfooRunner: ForRunningPromptfoo;
  readonly credentialsRepository: ForStoringCredentials;
}

/** What a repository configured itself with that the applications are
 *  composed for, as the workspace module answers it (CORE-FR-231). */
export interface EngineSettings {
  readonly enabledAgents: readonly string[];
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
 * The engine composed of its two modules over the plugins it is handed, for
 * the settings it is handed. The engine itself is the same whichever it is
 * composed with (CORE-FR-230).
 */
export function composeEngine(
  repoFolder: URL,
  homeFolder: URL,
  engineSettings: EngineSettings,
  pluginAdapters: EnginePlugin,
): ComposedEngine {
  const { agentProvider, charterRepository, fileReader, fileWriter, clock, progressReporter, mcpServers } = pluginAdapters;

  const charterAuthoringApp: ForAuthoringCharter = new AuthoringCharter(
    loadCharterService,
    installCharterService,
    charterRepository,
    pluginAdapters.credentialsRepository,
    pluginAdapters.authorizing,
    clock,
    progressReporter,
  );
  const charterBuildingApp: ForBuildingCharter = new BuildingCharter(
    buildCharterService,
    loadCharterService,
    loadMcpOriginsService,
    charterRepository,
    new LocalRepoManipulator(fileReader, fileWriter),
    Object.fromEntries(Object.entries(agentProvider).map(([agentName, { projection }]) => [agentName, projection])),
    pluginAdapters.tokenCounter,
    { agents: engineSettings.enabledAgents, ...(engineSettings.mainContextCeiling === undefined ? {} : { mainContextCeiling: engineSettings.mainContextCeiling }) },
    progressReporter,
    charterAuthoringApp,
    mcpServers,
  );
  const charterRuntimeApp: ForRunningCharter = new RunningCharter(
    charterAuthoringApp,
    charterBuildingApp,
    fileReader,
    Object.fromEntries(Object.entries(agentProvider).map(([agentName, { cli }]) => [agentName, cli])),
    pluginAdapters.shell,
    pluginAdapters.worktrees,
    pluginAdapters.promptfooRunner,
    // The sessions are read off the home's, wherever under it the
    // repository's settings keep them: the repository sets that reader up
    // itself.
    new FileSessionAnalysisRepository((rootFolder) => new FileReaders(rootFolder), repoFolder, homeFolder),
    clock,
    { agents: engineSettings.enabledAgents, ...(engineSettings.sessionAnalysisFolder === undefined ? {} : { sessionAnalysisFolder: engineSettings.sessionAnalysisFolder }) },
    progressReporter,
    mcpServers,
  );
  return { charterAuthoringApp, charterBuildingApp, charterRuntimeApp };
}

/** The workspace module's application over the plugins handed, checking
 *  settings against the agents the engine is plugged into (CORE-FR-231). */
export function composeWorkspace(
  supportedAgentProviders: readonly string[],
  pluginAdapters: Pick<EnginePlugin, "fileReader" | "fileWriter" | "progressReporter">,
): ForManagingWorkspace {
  return new ManagingWorkspace(new FileWorkspaceSettingsRepository(pluginAdapters.fileReader, pluginAdapters.fileWriter), supportedAgentProviders, pluginAdapters.progressReporter);
}

/** The workspace module, which keeps a repository's settings, and the engine
 *  composed for the settings it held when they were composed. */
export interface ComposedApplications {
  readonly workspaceApp: ForManagingWorkspace;
  readonly engineApp: ComposedEngine;
}

/**
 * The workspace module and the engine over the plugins handed — by default
 * Claude's and Codex's, the charter kept as files, and every adapter over the
 * repository's address and the developer's home's (CORE-FR-217,
 * CORE-FR-218): the workspace first, then the engine for the settings it
 * reads, a repository being set up for exactly the agents a plugin is handed
 * for (CORE-FR-221, CORE-FR-231). Settings that do not read yet, as before
 * setup, compose an engine for no agent.
 */
export async function composeApplications(
  repoFolder: URL,
  homeFolder: URL,
  pluginAdapters: EnginePlugin = {
    agentProvider: {
      claude: { projection: new ClaudeProjection(new FileReaders(repoFolder)), cli: new ClaudeCli() },
      codex: { projection: new CodexProjection(new FileReaders(repoFolder)), cli: new CodexCli() },
    },
    charterRepository: new FileCharterRepository(new FileReaders(repoFolder), new FileOutput(repoFolder), new GitSources(repoFolder)),
    fileReader: new FileReaders(repoFolder),
    fileWriter: new FileOutput(repoFolder),
    worktrees: new GitWorktrees(repoFolder),
    authorizing: new OAuth(),
    mcpServers: new McpClients(),
    tokenCounter: new Tiktoken(),
    clock: new SystemClock(),
    shell: new Shell(repoFolder),
    progressReporter: new ConsoleReporter(),
    // promptfoo, installed once under this engine's own folder in the
    // developer's home, outside every repository (EVAL-FR-032).
    promptfooRunner: new Promptfoo(repoFolder, fileURLToPath(new URL(".cherry-works", homeFolder))),
    credentialsRepository: new KeychainCredentialsRepository(),
  },
): Promise<ComposedApplications> {
  const workspaceApp = composeWorkspace(Object.keys(pluginAdapters.agentProvider), pluginAdapters);
  const workspaceSettingsDTO = await workspaceApp.settings();
  const engineSettings: EngineSettings =
    workspaceSettingsDTO.type === "Fault"
      ? { enabledAgents: [] }
      : { enabledAgents: workspaceSettingsDTO.data.agents, mainContextCeiling: workspaceSettingsDTO.data.mainContextCeiling, sessionAnalysisFolder: workspaceSettingsDTO.data.sessionAnalysisFolder };
  return { workspaceApp, engineApp: composeEngine(repoFolder, homeFolder, engineSettings, pluginAdapters) };
}

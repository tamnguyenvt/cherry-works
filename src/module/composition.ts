import { fileURLToPath } from "node:url";
import {
  AuthoringCharter,
  BuildingCharter,
  buildCharterService,
  ClaudeProjection,
  CodexProjection,
  FileCharterRepository,
  type ForAuthoringCharter,
  type ForAuthorizingMcpOrigins,
  type ForBuildingCharter,
  type ForCountingTokens,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForManagingLocalAgentOutput,
  type ForStoringCredentials,
  GitSources,
  installCharterService,
  KeychainCredentialsRepository,
  LocalRepoManipulator,
  loadCharterService,
  loadMcpOriginsService,
  OAuth,
  Tiktoken,
} from "#module/charter/module.js";
import {
  ClaudeCli,
  CodexCli,
  FileSessionAnalysisRepository,
  type ForCheckingAgentCli,
  type ForKeepingWorktrees,
  type ForRunningCharter,
  type ForRunningPromptfoo,
  type ForRunningShellCommands,
  GitWorktrees,
  Promptfoo,
  RunningCharter,
  Shell,
} from "#module/runtime/module.js";
import {
  ConsoleReporter,
  FileOutput,
  FileReaders,
  type ForCallingMcpServers,
  type ForReadingFiles,
  type ForReportingProgress,
  type ForTellingTime,
  type ForWritingFiles,
  McpClients,
  SystemClock,
} from "#module/shared/module.js";
import {
  FileWorkspaceSettingsRepository,
  type ForManagingWorkspace,
  ManagingWorkspace,
} from "#module/workspace/module.js";

/**
 * Every adapter the engine reaches the outside through that a tool outside
 * this repository may hand `composeApplications` in place of the engine's
 * own, with the source fetcher the charter's store kept as files reaches
 * vendors through. The charter's store and the agents' projections and
 * command lines are not among them: their ports name the domain's models
 * (CORE-FR-230, SDK-FR-020).
 */
export interface ReplaceableAdapters {
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
  /** Where a vendor's source is fetched from (CORE-FR-205). */
  readonly sourceFetcher: ForFetchingCharterSources;
}

/**
 * Everything plugged into the engine where it is composed: each agent's
 * projection and command line, under the agent it is for, the store that
 * keeps the charter, and every other adapter the engine reaches the outside
 * through. Each one may be the engine's own or written anew (CORE-FR-230).
 */
export interface EnginePlugin extends Omit<ReplaceableAdapters, "sourceFetcher"> {
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
  const { agentProvider, charterRepository, fileReader, fileWriter, clock, progressReporter, mcpServers } =
    pluginAdapters;

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
    {
      agents: engineSettings.enabledAgents,
      ...(engineSettings.mainContextCeiling === undefined
        ? {}
        : { mainContextCeiling: engineSettings.mainContextCeiling }),
    },
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
    {
      agents: engineSettings.enabledAgents,
      ...(engineSettings.sessionAnalysisFolder === undefined
        ? {}
        : { sessionAnalysisFolder: engineSettings.sessionAnalysisFolder }),
    },
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
  return new ManagingWorkspace(
    new FileWorkspaceSettingsRepository(pluginAdapters.fileReader, pluginAdapters.fileWriter),
    supportedAgentProviders,
    pluginAdapters.progressReporter,
  );
}

/** The workspace module, which keeps a repository's settings, and the engine
 *  composed for the settings it held when they were composed. */
export interface ComposedApplications {
  readonly workspaceApp: ForManagingWorkspace;
  readonly engineApp: ComposedEngine;
}

/**
 * The workspace module and the engine over the plugins handed, each one not
 * handed being the engine's own — Claude's and Codex's, the charter kept as
 * files, and every adapter over the repository's address and the developer's
 * home's (CORE-FR-217, CORE-FR-218, CORE-FR-230). The charter's store and the
 * agents' projections are set up over the file adapters handed, so files kept
 * anywhere keep the charter there too (SDK-FR-020). The workspace first, then
 * the engine for the settings it reads, a repository being set up for exactly
 * the agents a plugin is handed for (CORE-FR-221, CORE-FR-231). Settings that
 * do not read yet, as before setup, compose an engine for no agent.
 */
export async function composeApplications(
  repoFolder: URL,
  homeFolder: URL,
  handedAdapters: Partial<EnginePlugin & ReplaceableAdapters> = {},
): Promise<ComposedApplications> {
  const fileReader = handedAdapters.fileReader ?? new FileReaders(repoFolder);
  const fileWriter = handedAdapters.fileWriter ?? new FileOutput(repoFolder);
  const pluginAdapters: EnginePlugin = {
    agentProvider: handedAdapters.agentProvider ?? {
      claude: { projection: new ClaudeProjection(fileReader), cli: new ClaudeCli() },
      codex: { projection: new CodexProjection(fileReader), cli: new CodexCli() },
    },
    charterRepository:
      handedAdapters.charterRepository ??
      new FileCharterRepository(fileReader, fileWriter, handedAdapters.sourceFetcher ?? new GitSources(repoFolder)),
    fileReader,
    fileWriter,
    worktrees: handedAdapters.worktrees ?? new GitWorktrees(repoFolder),
    authorizing: handedAdapters.authorizing ?? new OAuth(),
    mcpServers: handedAdapters.mcpServers ?? new McpClients(),
    tokenCounter: handedAdapters.tokenCounter ?? new Tiktoken(),
    clock: handedAdapters.clock ?? new SystemClock(),
    shell: handedAdapters.shell ?? new Shell(repoFolder),
    progressReporter: handedAdapters.progressReporter ?? new ConsoleReporter(),
    // promptfoo, installed once under this engine's own folder in the
    // developer's home, outside every repository (EVAL-FR-032).
    promptfooRunner:
      handedAdapters.promptfooRunner ?? new Promptfoo(repoFolder, fileURLToPath(new URL(".cherry-works", homeFolder))),
    credentialsRepository: handedAdapters.credentialsRepository ?? new KeychainCredentialsRepository(),
  };
  const workspaceApp = composeWorkspace(Object.keys(pluginAdapters.agentProvider), pluginAdapters);
  const workspaceSettingsDTO = await workspaceApp.settings();
  const engineSettings: EngineSettings =
    workspaceSettingsDTO.type === "Fault"
      ? { enabledAgents: [] }
      : {
          enabledAgents: workspaceSettingsDTO.data.agents,
          mainContextCeiling: workspaceSettingsDTO.data.mainContextCeiling,
          sessionAnalysisFolder: workspaceSettingsDTO.data.sessionAnalysisFolder,
        };
  return { workspaceApp, engineApp: composeEngine(repoFolder, homeFolder, engineSettings, pluginAdapters) };
}

import {
  AuthoringCharter,
  BuildingCharter,
  buildCharterService,
  ClaudeProjection,
  CodexProjection,
  FileCharterRepository,
  type ForAuthoringCharter,
  type ForAuthorizingOAuthClients,
  type ForBuildingCharter,
  type ForCountingTokens,
  type ForFetchingCharterSources,
  type ForManagingCharter,
  type ForManagingLocalAgentOutput,
  type ForManagingLocalOutput,
  type ForStoringCredentials,
  GitSources,
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
  type ForLoadingSessionAnalysis,
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
  FolderAddress,
  type ForCallingMcpServers,
  type ForReadingFiles,
  type ForReportingProgress,
  type ForTellingTime,
  type ForWritingFiles,
  McpClients,
  MissingFolderReaderFault,
  SystemClock,
} from "#module/shared/module.js";
import {
  FileWorkspaceSettingsRepository,
  type ForManagingWorkspace,
  type ForStoringWorkspaceSettings,
  ManagingWorkspace,
} from "#module/workspace/module.js";

/**
 * Every adapter the engine reaches the outside through, each the engine's own
 * or one a tool writes: each agent's projection and command line, under the
 * agent it is for, the store that keeps the charter, the source fetcher that
 * store reaches vendors through, the sessions, the settings, the local output,
 * and the rest (CORE-FR-230, SDK-FR-020).
 */
export interface EngineAdapters {
  readonly agentProvider: {
    readonly [provider: string]: {
      /** What the agent reads of a charter, and where (CORE-FR-221). */
      readonly projection: ForManagingLocalAgentOutput;
      /** The agent's own command line (EVAL-FR-004). */
      readonly agentCli: ForCheckingAgentCli;
    };
  };
  /** The charter — its primitives, its vendors, its test and eval cases —
   *  kept by one store (CORE-FR-228). */
  readonly charterRepository: ForManagingCharter;
  /** Where a vendor's source is fetched from, by the charter's store kept as
   *  files (CORE-FR-205). */
  readonly sourceFetcher: ForFetchingCharterSources;
  /** Where a repository's sessions are read from (EVAL-FR-009). */
  readonly sessionAnalysisRepository: ForLoadingSessionAnalysis;
  /** Where a repository keeps its settings (CORE-FR-231). */
  readonly workspaceSettingsRepository: ForStoringWorkspaceSettings;
  /** What lays the compiled output onto the repository (CORE-FR-221). */
  readonly localOutput: ForManagingLocalOutput;
  /** The files the charter's store, the settings', the local output and each
   *  agent's projection are set up over where none of them is handed, and,
   *  set up over the home by `createFolderReader`, the sessions' (SDK-FR-020). */
  readonly fileReader: ForReadingFiles & {
    /** The same files, every path from another folder: what `cw`'s own
     *  sessions store reads the developer's home through. Where the reader
     *  handed has none, a sessions store of the tool's own is handed beside
     *  it, or reading the sessions answers a fault saying so. */
    createFolderReader?(rootFolder: URL): ForReadingFiles;
  };
  readonly fileWriter: ForWritingFiles;
  readonly worktreeKeeper: ForKeepingWorktrees;
  readonly oauthAuthorizer: ForAuthorizingOAuthClients;
  readonly mcpServerCaller: ForCallingMcpServers;
  readonly tokenCounter: ForCountingTokens;
  readonly clock: ForTellingTime;
  readonly shell: ForRunningShellCommands;
  /** What the developer is told, internal faults among it (SDK-FR-017). */
  readonly progressReporter: ForReportingProgress;
  readonly promptfooRunner: ForRunningPromptfoo;
  readonly credentialsRepository: ForStoringCredentials;
}

/** What a repository chose that the applications are composed for — the
 *  agents it chose among them — as the workspace module answers it
 *  (CORE-FR-231). */
export interface EngineSettings {
  readonly agents: readonly string[];
  readonly mainContextCeiling?: number | undefined;
  readonly isVendor?: boolean | undefined;
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
 * the settings it is handed. The engine itself is the same whichever it is
 * composed with (CORE-FR-230).
 */
export function composeEngine(
  engineSettings: EngineSettings,
  engineAdapters: Omit<EngineAdapters, "sourceFetcher" | "workspaceSettingsRepository">,
): ComposedEngine {
  const { agentProvider, charterRepository, fileReader, clock, progressReporter, mcpServerCaller } = engineAdapters;

  const charterAuthoringApp: ForAuthoringCharter = new AuthoringCharter(
    loadCharterService,
    charterRepository,
    engineAdapters.credentialsRepository,
    engineAdapters.oauthAuthorizer,
    clock,
    progressReporter,
    engineSettings.isVendor === undefined ? {} : { isVendor: engineSettings.isVendor },
  );
  const charterBuildingApp: ForBuildingCharter = new BuildingCharter(
    buildCharterService,
    loadCharterService,
    loadMcpOriginsService,
    charterRepository,
    engineAdapters.localOutput,
    Object.fromEntries(Object.entries(agentProvider).map(([agentName, { projection }]) => [agentName, projection])),
    engineAdapters.tokenCounter,
    {
      agentNames: engineSettings.agents,
      ...(engineSettings.mainContextCeiling === undefined
        ? {}
        : { mainContextCeiling: engineSettings.mainContextCeiling }),
      ...(engineSettings.isVendor === undefined ? {} : { isVendor: engineSettings.isVendor }),
    },
    progressReporter,
    charterAuthoringApp,
    mcpServerCaller,
  );
  const charterRuntimeApp: ForRunningCharter = new RunningCharter(
    charterAuthoringApp,
    charterBuildingApp,
    fileReader,
    Object.fromEntries(Object.entries(agentProvider).map(([agentName, { agentCli }]) => [agentName, agentCli])),
    engineAdapters.shell,
    engineAdapters.worktreeKeeper,
    engineAdapters.promptfooRunner,
    engineAdapters.sessionAnalysisRepository,
    clock,
    { agents: engineSettings.agents },
    progressReporter,
    mcpServerCaller,
  );
  return { charterAuthoringApp, charterBuildingApp, charterRuntimeApp };
}

/** The workspace module's application over the adapters handed, checking
 *  settings against the agents the engine is plugged into (CORE-FR-231). */
export function composeWorkspace(
  supportedAgentProviders: readonly string[],
  engineAdapters: Pick<EngineAdapters, "workspaceSettingsRepository" | "progressReporter">,
): ForManagingWorkspace {
  return new ManagingWorkspace(
    engineAdapters.workspaceSettingsRepository,
    supportedAgentProviders,
    engineAdapters.progressReporter,
  );
}

/** The workspace module, which keeps a repository's settings, and the engine
 *  composed for the settings it holds when one of the engine's applications is
 *  first called. */
export interface ComposedApplications {
  readonly workspaceApp: ForManagingWorkspace;
  readonly engineApp: ComposedEngine;
}

/**
 * The workspace module and the engine over the adapters handed, each one not
 * handed being the engine's own — Claude's and Codex's, the charter kept as
 * files, and every adapter over the repository's address and the developer's
 * home's (CORE-FR-217, CORE-FR-218, CORE-FR-230). The charter's store, the
 * sessions' and the agents' projections are set up over the file adapters
 * handed, so files kept anywhere keep the charter and the sessions there too,
 * unless a store of the tool's own is handed (SDK-FR-020). The workspace
 * first, then the engine for the settings it reads, a repository being set up for exactly the agents a projection is
 * handed for (CORE-FR-221, CORE-FR-231). Settings that do not read yet, as
 * before setup, compose an engine for no agent. They are read when one of the
 * engine's applications is first called, so composing reaches no disk, at an
 * address of any scheme (SDK-FR-011).
 */
export async function composeApplications(
  repoFolder: URL,
  homeFolder: URL,
  engineAdapters: Partial<EngineAdapters> = {},
): Promise<ComposedApplications> {
  // A home naming no folder is refused when the engine is composed, as the
  // sessions store set up later would refuse it (SDK-FR-010).
  FolderAddress.parseFolderUrl(homeFolder);
  const fileReader = engineAdapters.fileReader ?? new FileReaders(repoFolder);
  const fileWriter = engineAdapters.fileWriter ?? new FileOutput(repoFolder);
  const defaultedEngineAdapters: Omit<EngineAdapters, "sourceFetcher" | "sessionAnalysisRepository"> = {
    agentProvider: engineAdapters.agentProvider ?? {
      claude: { projection: new ClaudeProjection(fileReader), agentCli: new ClaudeCli() },
      codex: { projection: new CodexProjection(fileReader), agentCli: new CodexCli() },
    },
    charterRepository:
      engineAdapters.charterRepository ??
      new FileCharterRepository(fileReader, fileWriter, engineAdapters.sourceFetcher ?? new GitSources(repoFolder)),
    workspaceSettingsRepository:
      engineAdapters.workspaceSettingsRepository ?? new FileWorkspaceSettingsRepository(fileReader, fileWriter),
    localOutput: engineAdapters.localOutput ?? new LocalRepoManipulator(fileReader, fileWriter),
    fileReader,
    fileWriter,
    worktreeKeeper: engineAdapters.worktreeKeeper ?? new GitWorktrees(repoFolder),
    oauthAuthorizer: engineAdapters.oauthAuthorizer ?? new OAuth(),
    mcpServerCaller: engineAdapters.mcpServerCaller ?? new McpClients(),
    tokenCounter: engineAdapters.tokenCounter ?? new Tiktoken(),
    clock: engineAdapters.clock ?? new SystemClock(),
    shell: engineAdapters.shell ?? new Shell(repoFolder),
    progressReporter: engineAdapters.progressReporter ?? new ConsoleReporter(),
    // promptfoo, installed once under this engine's own folder in the
    // developer's home, outside every repository (EVAL-FR-032).
    promptfooRunner: engineAdapters.promptfooRunner ?? new Promptfoo(repoFolder, new URL(".cherry-works/", homeFolder)),
    credentialsRepository: engineAdapters.credentialsRepository ?? new KeychainCredentialsRepository(),
  };
  const workspaceApp = composeWorkspace(Object.keys(defaultedEngineAdapters.agentProvider), defaultedEngineAdapters);
  // Kept once composed for settings naming an agent: settings naming none or
  // not reading, as before setup, are read again on the next call.
  let composedEngine: ComposedEngine | undefined;
  const composeEngineForSettings = async (): Promise<ComposedEngine> => {
    if (composedEngine !== undefined) return composedEngine;
    const workspaceSettingsDTO = await workspaceApp.readWorkspaceSettings();
    const engineSettings: EngineSettings =
      workspaceSettingsDTO.type === "Fault"
        ? { agents: [] }
        : {
            agents: workspaceSettingsDTO.data.agents,
            mainContextCeiling: workspaceSettingsDTO.data.mainContextCeiling,
            isVendor: workspaceSettingsDTO.data.isVendor,
          };
    // The sessions are read off the home's, wherever under it the
    // repository's settings keep them, which cw's own store is set up with,
    // through the file reader handed, as every other store of cw's is
    // (SDK-FR-020): a store handed in knows where it keeps them.
    const sessionAnalysisFolder =
      workspaceSettingsDTO.type === "Fault" ? undefined : workspaceSettingsDTO.data.sessionAnalysisFolder;
    const sessionAnalysisRepository =
      engineAdapters.sessionAnalysisRepository ??
      new FileSessionAnalysisRepository(
        (rootFolder) => {
          if (fileReader.createFolderReader === undefined)
            throw new MissingFolderReaderFault(
              "The fileReader handed sets up no reader over another folder, so cw's own sessions store cannot read the sessions kept under the home.",
              "Hand the engine a fileReader with createFolderReader(rootFolder), or a sessionAnalysisRepository of your own.",
              { internal: false },
            );
          return fileReader.createFolderReader(rootFolder);
        },
        repoFolder,
        homeFolder,
        sessionAnalysisFolder,
      );
    const settingsComposedEngine = composeEngine(engineSettings, {
      ...defaultedEngineAdapters,
      sessionAnalysisRepository,
    });
    if (engineSettings.agents.length > 0) composedEngine ??= settingsComposedEngine;
    return composedEngine ?? settingsComposedEngine;
  };
  // Each application answers the operations of its use case, all of them
  // asynchronous, through the engine once it is composed; it has nothing else.
  const composeEngineApp = <AppName extends keyof ComposedEngine>(
    appName: AppName,
    useCasePrototype: object,
  ): ComposedEngine[AppName] =>
    Object.fromEntries(
      Object.getOwnPropertyNames(useCasePrototype)
        .filter((operationName) => operationName !== "constructor")
        .map((operationName) => [
          operationName,
          async (...operationArguments: unknown[]) => {
            const engineApp = (await composeEngineForSettings())[appName] as unknown as Record<
              string,
              (...operationArguments: unknown[]) => unknown
            >;
            return engineApp[operationName]!.apply(engineApp, operationArguments);
          },
        ]),
    ) as unknown as ComposedEngine[AppName];
  return {
    workspaceApp,
    engineApp: {
      charterAuthoringApp: composeEngineApp("charterAuthoringApp", AuthoringCharter.prototype),
      charterBuildingApp: composeEngineApp("charterBuildingApp", BuildingCharter.prototype),
      charterRuntimeApp: composeEngineApp("charterRuntimeApp", RunningCharter.prototype),
    },
  };
}

// The library's declarations from composition, split from dist/index.d.ts for reading.

/**
 * Every adapter the engine reaches the outside through, each the engine's own
 * or one a tool writes: each agent's projection and command line, under the
 * agent it is for, the store that keeps the charter, the source fetcher that
 * store reaches vendors through, and the rest (CORE-FR-230).
 */
interface EngineAdapters {
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
  /** Where a vendor's source is fetched from, by the charter's store kept as
   *  files (CORE-FR-205). */
  readonly sourceFetcher: ForFetchingCharterSources;
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

/** The engine's two modules' applications, as the drivers reach them
 *  (CORE-FR-222): the charter's two, and runtime's. */
interface ComposedEngine {
  readonly charterAuthoringApp: ForAuthoringCharter;
  readonly charterBuildingApp: ForBuildingCharter;
  readonly charterRuntimeApp: ForRunningCharter;
}

/** The workspace module, which keeps a repository's settings, and the engine
 *  composed for the settings it held when they were composed. */
interface ComposedApplications {
  readonly workspaceApp: ForManagingWorkspace;
  readonly engineApp: ComposedEngine;
}

/**
 * The workspace module and the engine over the adapters handed, each one not
 * handed being the engine's own — Claude's and Codex's, the charter kept as
 * files, and every adapter over the repository's address and the developer's
 * home's (CORE-FR-217, CORE-FR-218, CORE-FR-230). The charter's store and the
 * agents' projections are set up over the file adapters handed, so files kept
 * anywhere keep the charter there too, unless a store of the tool's own is
 * handed (SDK-FR-020). The workspace first, then
 * the engine for the settings it reads, a repository being set up for exactly
 * the agents a projection is handed for (CORE-FR-221, CORE-FR-231). Settings that
 * do not read yet, as before setup, compose an engine for no agent.
 */
declare function composeApplications(
  repoFolder: URL,
  homeFolder: URL,
  engineAdapters?: Partial<EngineAdapters>,
): Promise<ComposedApplications>;

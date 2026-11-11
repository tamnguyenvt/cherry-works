// The library's declarations from composition, split from dist/index.d.ts for reading.

/**
 * Every adapter the engine reaches the outside through that a tool outside
 * this repository may hand `composeApplications` in place of the engine's
 * own, with the source fetcher the charter's store kept as files reaches
 * vendors through. The charter's store and the agents' projections and
 * command lines are not among them: their ports name the domain's models
 * (CORE-FR-230, SDK-FR-020).
 */
interface ReplaceableAdapters {
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
 * The workspace module and the engine, each adapter handed replacing the
 * engine's own and every other one the engine's own (CORE-FR-230,
 * SDK-FR-020): the charter's store and the agents' projections are the
 * engine's, set up over the file adapters handed.
 */
declare const composeApplications: (
  repoFolder: URL,
  homeFolder: URL,
  plugin?: Partial<ReplaceableAdapters>,
) => Promise<ComposedApplications>;

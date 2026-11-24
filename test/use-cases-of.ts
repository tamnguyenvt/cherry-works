import { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import { BuildingCharter } from "../src/module/charter/app/building-charter.use-case.js";
import type { ForAuthoringCharter } from "../src/module/charter/app/port/in/authoring-charter.port.js";
import type { AgentProviderName, ForBuildingCharter } from "../src/module/charter/app/port/in/building-charter.port.js";
import type { ForAuthorizingOAuthClients } from "../src/module/charter/app/port/out/authorizing-oauth-clients.port.js";
import type { ForCountingTokens } from "../src/module/charter/app/port/out/counting-tokens.port.js";
import type { ForFetchingCharterSources } from "../src/module/charter/app/port/out/fetching-charter-sources.port.js";
import type { ForManagingCharter } from "../src/module/charter/app/port/out/managing-charter.port.js";
import type { ForManagingLocalAgentOutput } from "../src/module/charter/app/port/out/managing-local-agent-output.port.js";
import type { ForManagingLocalOutput } from "../src/module/charter/app/port/out/managing-local-output.port.js";
import type { ForStoringCredentials } from "../src/module/charter/app/port/out/storing-credentials.port.js";
import { buildCharterService } from "../src/module/charter/app/services/build-charter.service.js";
import { loadCharterService } from "../src/module/charter/app/services/load-charter.service.js";
import { loadMcpOriginsService } from "../src/module/charter/app/services/load-mcp-origins.service.js";
import { charterPath } from "../src/module/charter/domain/constants.js";
import { CharterRoot } from "../src/module/charter/domain/models/charter/charter-root.js";
import { PrimitiveFactory } from "../src/module/charter/domain/models/primitive/primitive.factory.js";
import type { Primitive } from "../src/module/charter/domain/models/primitive/primitive.js";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import type { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import type { ForRunningCharter } from "../src/module/runtime/app/port/in/running-charter.port.js";
import type { ForKeepingWorktrees } from "../src/module/runtime/app/port/out/keeping-worktrees.port.js";
import type { ForLoadingSessionAnalysis } from "../src/module/runtime/app/port/out/loading-session-analysis.port.js";
import type {
  ForCheckingAgentCli,
  ForRunningAgentCli,
} from "../src/module/runtime/app/port/out/running-agent-cli.port.js";
import type { ForRunningPromptfoo } from "../src/module/runtime/app/port/out/running-promptfoo.port.js";
import type { ForRunningShellCommands } from "../src/module/runtime/app/port/out/running-shell-commands.port.js";
import { RunningCharter } from "../src/module/runtime/app/running-charter.use-case.js";
import { FileSessionAnalysisRepository } from "../src/module/runtime/infra/file-session-analysis.repository.js";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import type { ForCallingMcpServers } from "../src/module/shared/app/port/out/calling-mcp-servers.port.js";
import type { ForReadingFiles } from "../src/module/shared/app/port/out/reading-files.port.js";
import type { ForReportingProgress } from "../src/module/shared/app/port/out/reporting-progress.port.js";
import type { ForTellingTime } from "../src/module/shared/app/port/out/telling-time.port.js";
import type { ForWritingFiles } from "../src/module/shared/app/port/out/writing-files.port.js";
import { FaultsByFile } from "../src/module/shared/domain/models/fault/faults-by-file.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { SystemClock } from "../src/module/shared/infra/system-clock.adapter.js";
import type { ForManagingWorkspace } from "../src/module/workspace/app/port/in/managing-workspace.port.js";
import type { WorkspaceDTOs } from "../src/module/workspace/app/port/in/workspace.dto.js";
import { FileWorkspaceSettingsRepository } from "../src/module/workspace/infra.js";
import { ManagingWorkspace } from "../src/module/workspace/module.js";
import type {
  CommandLine,
  Context,
  EngineApps,
  WorkspaceSettings,
} from "../src/presentation/cli/commands/command.interface.js";
import { showPathsInApps } from "../src/presentation/cli/commands/helper.js";

/*
 * Each use case over the ports a test holds, as main.ts wires it: the real
 * repositories, built over those same ports, so a test still says the
 * repository's state as the files it keeps.
 */

/** A port no test handed the use case: whatever is asked of it is refused,
 *  naming what was not given. */
function portNotGiven<Port extends object>(portName: string): Port {
  return new Proxy({} as Port, {
    get: (_target, methodName) => () =>
      Promise.reject(new Error(`No ${portName} were given to ${String(methodName)}.`)),
  });
}

/** Files no test writes: a use case that only reads holds no writing port, and
 *  hands its repositories none. */
const unwritableFiles = portNotGiven<ForWritingFiles>("files");

/** The charter of a repository kept as files, its installed charters', its test cases
 *  and its eval cases among them, its sources fetched through `sourceFetcher`
 *  where a test gives one. */
export function charterRepositoryOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles = unwritableFiles,
  sourceFetcher = portNotGiven<ForFetchingCharterSources>("sources"),
): FileCharterRepository {
  return new FileCharterRepository(fileReader, fileWriter, sourceFetcher);
}

/** The build laid onto, and read back off, the files a test holds, as main.ts
 *  lays it. */
export function charterOutputWriterOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles = unwritableFiles,
): LocalRepoManipulator {
  return new LocalRepoManipulator(fileReader, fileWriter);
}

/** Each agent's projection onto the files a test holds, as main.ts projects
 *  it. */
export function agentProjectionByProviderOf(
  fileReader: ForReadingFiles,
): Readonly<Record<string, ForManagingLocalAgentOutput>> {
  return { claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) };
}

/** One repository's charter, read off the files a test holds as every use case reads it. */
export function loadCharterRoot(fileReader: ForReadingFiles): Promise<CharterRoot> {
  return loadCharterService.loadCharterRoot(charterRepositoryOf(fileReader));
}

/** Authoring the charter over the files a test holds: its sources fetched
 *  through `sourceFetcher`, its credentials kept in `credentialsRepository`, signed in
 *  through `oauthAuthorizer`, where a test gives them. */
export function authoringCharterOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
  progressReporter: ForReportingProgress,
  {
    sourceFetcher = portNotGiven<ForFetchingCharterSources>("sources"),
    oauthAuthorizer = portNotGiven<ForAuthorizingOAuthClients>("sign-ins"),
    clock = new SystemClock(),
    charterRepository = charterRepositoryOf(fileReader, fileWriter, sourceFetcher),
    credentialsRepository = new InMemoryCredentialsRepository(),
  }: {
    readonly sourceFetcher?: ForFetchingCharterSources;
    readonly oauthAuthorizer?: ForAuthorizingOAuthClients;
    readonly clock?: ForTellingTime;
    readonly charterRepository?: ForManagingCharter;
    readonly credentialsRepository?: ForStoringCredentials;
  } = {},
): AuthoringCharter {
  return new AuthoringCharter(
    loadCharterService,
    charterRepository,
    credentialsRepository,
    oauthAuthorizer,
    clock,
    progressReporter,
  );
}

/** What a test reaches the charter's projection and runtime through: one
 *  object answering both ports, each operation going to the application whose
 *  it is. */
export type CharterRuntimeApps = ForBuildingCharter & ForRunningCharter;

/** The workspace module over the files a test holds: its settings and ignore
 *  file, read and written as the command line has them read and written
 *  (CORE-FR-231). */
export function workspaceAppOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles = unwritableFiles,
): ForManagingWorkspace {
  return new ManagingWorkspace(
    new FileWorkspaceSettingsRepository(fileReader, fileWriter),
    ["claude", "codex"],
    new InMemoryReporter(),
  );
}

/** The command line over the files a test holds and the applications it
 *  hands, whatever settings it reads: each application of a test reads them
 *  itself, as the command line would compose it, at each call. */
export function commandLineOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
  engineApps: Partial<EngineApps> & Pick<EngineApps, "charterAuthoringApp">,
  cwd = "/repo",
  version = "0.0.0",
): CommandLine {
  const charterRuntimeApps = (engineApps.charterBuildingApp ?? engineApps.charterRuntimeApp) as
    | CharterRuntimeApps
    | undefined;
  return {
    cwd,
    version,
    composeApplications: async () => ({
      workspaceApp: workspaceAppOf(fileReader, fileWriter),
      engineApp: {
        charterAuthoringApp: engineApps.charterAuthoringApp,
        charterBuildingApp: engineApps.charterBuildingApp ?? (charterRuntimeApps as ForBuildingCharter),
        charterRuntimeApp: engineApps.charterRuntimeApp ?? (charterRuntimeApps as ForRunningCharter),
      },
    }),
  };
}

/** The charter's projection and runtime over the files a test holds, as the
 *  command line composes them: for the settings `workspaceSettings` names, or
 *  else for those the files hold when each operation is asked; over charter
 *  authoring's application; the mcp origins reached only where a test gives
 *  `mcpServerCaller`, the sensors run through `shell`, the cases evaluated in
 *  worktrees `worktreeKeeper` adds through `promptfooRunner`, and the sessions read
 *  through `sessionAnalysisRepository`, or the one `sessionAnalysisRepositoryOf`
 *  sets up on the folder the settings name, where it gives them. */
export function runningCharterOf(
  fileReader: ForReadingFiles,
  progressReporter: ForReportingProgress,
  {
    fileWriter = unwritableFiles,
    tokenCounter = portNotGiven<ForCountingTokens>("token counters"),
    agentCliByProvider = {},
    mcpServerCaller,
    credentialsRepository,
    oauthAuthorizer,
    shell = portNotGiven<ForRunningShellCommands>("shells"),
    worktreeKeeper = portNotGiven<ForKeepingWorktrees>("worktreeKeeper"),
    promptfooRunner = portNotGiven<ForRunningPromptfoo>("promptfoo runs"),
    sessionAnalysisRepository = portNotGiven<ForLoadingSessionAnalysis>("sessions"),
    sessionAnalysisRepositoryOf,
    clock = new SystemClock(),
    workspaceSettings,
    charterRepository = charterRepositoryOf(fileReader, fileWriter),
    localRepo = charterOutputWriterOf(fileReader, fileWriter),
    agentProjectionByProvider = agentProjectionByProviderOf(fileReader),
    charterAuthoringApp = authoringCharterOf(fileReader, fileWriter, progressReporter, {
      ...(credentialsRepository === undefined ? {} : { credentialsRepository }),
      ...(oauthAuthorizer === undefined ? {} : { oauthAuthorizer }),
      clock,
      charterRepository,
    }),
  }: {
    readonly fileWriter?: ForWritingFiles;
    readonly tokenCounter?: ForCountingTokens;
    readonly agentCliByProvider?: Readonly<
      Partial<Record<AgentProviderName, ForCheckingAgentCli | ForRunningAgentCli>>
    >;
    readonly mcpServerCaller?: ForCallingMcpServers;
    readonly credentialsRepository?: ForStoringCredentials;
    readonly oauthAuthorizer?: ForAuthorizingOAuthClients;
    readonly shell?: ForRunningShellCommands;
    readonly worktreeKeeper?: ForKeepingWorktrees;
    readonly promptfooRunner?: ForRunningPromptfoo;
    readonly sessionAnalysisRepository?: ForLoadingSessionAnalysis;
    readonly sessionAnalysisRepositoryOf?: (sessionAnalysisFolder: string | undefined) => ForLoadingSessionAnalysis;
    readonly clock?: ForTellingTime;
    readonly workspaceSettings?: WorkspaceSettings;
    readonly charterRepository?: ForManagingCharter;
    readonly localRepo?: ForManagingLocalOutput;
    readonly agentProjectionByProvider?: Readonly<Record<string, ForManagingLocalAgentOutput>>;
    readonly charterAuthoringApp?: ForAuthoringCharter;
  } = {},
): CharterRuntimeApps {
  const composeApps = (settings: WorkspaceSettings) => {
    const charterBuildingApp = new BuildingCharter(
      buildCharterService,
      loadCharterService,
      loadMcpOriginsService,
      charterRepository,
      localRepo,
      agentProjectionByProvider,
      tokenCounter,
      {
        agentNames: settings.agents,
        ...(settings.mainContextCeiling === undefined ? {} : { mainContextCeiling: settings.mainContextCeiling }),
      },
      progressReporter,
      charterAuthoringApp,
      mcpServerCaller,
    );
    const charterRuntimeApp = new RunningCharter(
      charterAuthoringApp,
      charterBuildingApp,
      fileReader,
      agentCliByProvider,
      shell,
      worktreeKeeper,
      promptfooRunner,
      sessionAnalysisRepositoryOf?.(settings.sessionAnalysisFolder) ?? sessionAnalysisRepository,
      clock,
      { agents: settings.agents },
      progressReporter,
      mcpServerCaller,
    );
    return { charterBuildingApp, charterRuntimeApp };
  };
  return new Proxy({} as CharterRuntimeApps, {
    get:
      (_target, operationName) =>
      async (...operationArguments: unknown[]) => {
        // Settings that do not read are refused as the command line refuses
        // them, before anything is composed (FR-037).
        const workspaceSettingsDTO =
          workspaceSettings === undefined ? await workspaceAppOf(fileReader).readWorkspaceSettings() : undefined;
        if (workspaceSettingsDTO?.type === "Fault") return workspaceSettingsDTO;
        const settings = workspaceSettings ?? workspaceSettingsDTO!.data;
        const { charterBuildingApp, charterRuntimeApp } = composeApps(settings);
        const charterApp =
          typeof (charterBuildingApp as unknown as Record<PropertyKey, unknown>)[operationName] === "function"
            ? charterBuildingApp
            : charterRuntimeApp;
        return (charterApp as unknown as Record<PropertyKey, (...args: unknown[]) => unknown>)[operationName]!(
          ...operationArguments,
        );
      },
  });
}

/** The charter's projection and runtime as projecting it was: the build, the
 *  health check, the context, the sensors and the mcp origins, over the files
 *  a test holds. */
export function buildingCharterOf(
  fileReader: ForReadingFiles,
  fileWriter: ForWritingFiles,
  tokenCounter: ForCountingTokens,
  agentCliByProvider: Readonly<Partial<Record<AgentProviderName, ForRunningAgentCli>>>,
  progressReporter: ForReportingProgress,
  runningOptions: Omit<
    Parameters<typeof runningCharterOf>[2],
    "fileWriter" | "tokenCounter" | "agentCliByProvider"
  > = {},
): CharterRuntimeApps {
  return runningCharterOf(fileReader, progressReporter, {
    ...runningOptions,
    fileWriter,
    tokenCounter,
    agentCliByProvider,
  });
}

/** The charter's projection and runtime as testing it was: the cases
 *  evaluated in worktrees `worktreeKeeper` adds, through `promptfooRunner`, where a
 *  test gives them. */
export function testingCharterOf(
  fileReader: ForReadingFiles,
  progressReporter: ForReportingProgress,
  runningOptions: Parameters<typeof runningCharterOf>[2] = {},
): CharterRuntimeApps {
  return runningCharterOf(fileReader, progressReporter, runningOptions);
}

/** The sessions of the repository `fileReader` is set up on, kept under the
 *  home, read through what `fileReaderAt` sets up, as main.ts sets it up. */
export function reviewingSessionsOf(
  repoFolder: URL,
  homeFolder: URL,
  fileReader: ForReadingFiles,
  fileReaderAt: (rootFolder: URL) => ForReadingFiles,
  clock: ForTellingTime,
  progressReporter: ForReportingProgress,
): CharterRuntimeApps {
  return runningCharterOf(fileReader, progressReporter, {
    clock,
    sessionAnalysisRepositoryOf: (sessionAnalysisFolder) =>
      new FileSessionAnalysisRepository(fileReaderAt, repoFolder, homeFolder, sessionAnalysisFolder),
  });
}

/** One primitive read as the engine reads what it is handed raw: an index.md
 *  as kept, or the headers and body an author answered. */
export function readPrimitive(contents: RawPrimitive["contents"]): Primitive {
  return PrimitiveFactory.create(new RawPrimitive(PrimitiveLayer.REPO, "", "", contents, [], ""));
}

/** These primitives held as one charter, nothing wrong with any file of it,
 *  kept where `cw` keeps its own: what a rule of the charter is asked of. */
export function charterRootOf(primitives: readonly Primitive[]): CharterRoot {
  return new CharterRoot(primitives, FaultsByFile.emptyFaultsByFile, {}, charterPath.charterFolderPath);
}

/** What the repository a test holds configured itself with, as the portal is
 *  handed it by the command line (CORE-FR-231). */
export function workspaceSettingsLoaderOf(
  fileReader: ForReadingFiles,
): () => Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> {
  return () => workspaceAppOf(fileReader).readWorkspaceSettings();
}

/** What a command is run with over these applications, as the command line
 *  hands it over: every address said as the path from where it runs, and the
 *  settings of an empty workspace. */
export function commandContextOf(
  engineApps: Partial<EngineApps> & Pick<EngineApps, "charterAuthoringApp">,
  cwd = "/repo",
): Context {
  const emptyFileReaders = new InMemoryFileReaders({});
  const commandLine = commandLineOf(emptyFileReaders, unwritableFiles, engineApps, cwd);
  const charterRuntimeApps = (engineApps.charterBuildingApp ?? engineApps.charterRuntimeApp) as
    | CharterRuntimeApps
    | undefined;
  const engineApp = {
    charterAuthoringApp: engineApps.charterAuthoringApp,
    charterBuildingApp: engineApps.charterBuildingApp ?? (charterRuntimeApps as ForBuildingCharter),
    charterRuntimeApp: engineApps.charterRuntimeApp ?? (charterRuntimeApps as ForRunningCharter),
  };
  return {
    ...commandLine,
    workspaceApp: workspaceAppOf(emptyFileReaders, unwritableFiles),
    ...showPathsInApps(engineApp, cwd),
    composeApplications: () => commandLine.composeApplications(false),
    workspaceSettings: { agents: [] },
    // Whoever is at the terminal when the command asks, as the command line
    // reads it with no `--json`.
    get isAtTerminal() {
      return process.stdin.isTTY === true;
    },
    isJsonAnswer: false,
  };
}

/** Every folder of a source put in the repository's charter root, leaving out
 *  those checked out aside first, before any charter is replaced. */
export const installedFoldersOf = (sourceFetcher: InMemorySources) =>
  sourceFetcher.checkedOutFolders.filter(
    ({ intoSubFolder }) => !intoSubFolder.startsWith(`${charterPath.installingFolderPath}/`),
  );

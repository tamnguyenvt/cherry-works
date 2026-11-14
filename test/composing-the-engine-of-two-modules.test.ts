import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import * as charterModule from "../src/module/charter/module.js";
import {
  type ComposedApplications,
  composeApplications,
  composeEngine,
  type EngineAdapters,
} from "../src/module/composition.js";
import { RunningCharter } from "../src/module/runtime/app/running-charter.use-case.js";
import { AgentCli } from "../src/module/runtime/infra/agent-cli.base.js";
import { FileSessionAnalysisRepository } from "../src/module/runtime/infra/file-session-analysis.repository.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { Promptfoo } from "../src/module/runtime/infra/promptfoo.adapter.js";
import * as runtimeModule from "../src/module/runtime/module.js";
import { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { FileReaders } from "../src/module/shared/infra/file-readers.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import * as sharedModule from "../src/module/shared/module.js";
import { FileWorkspaceSettingsRepository } from "../src/module/workspace/infra/file-workspace-settings.repository.js";
import * as workspaceModule from "../src/module/workspace/module.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { type CommandLine, EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf } from "./answer-of.js";

const repositoryUrl = new URL("../", import.meta.url);
const moduleFolderUrl = new URL("src/module/", repositoryUrl);
const repoFolder = new URL("file:///repo/");
const homeFolder = new URL("file:///home/");
const repoFileUrlOf = (path: string) => new URL(path, repoFolder).href;

const keptGuideText =
  '---\nkind: guide\nid: kept-guide\ndescription: A guide kept by its kind and id.\nglobs: ["src/**/*.ts"]\n---\nKeep it.\n';
const keptSkillText = '---\nkind: skill\nid: kept-skill\ndescription: Keep it.\ntriggers: ["keep it"]\n---\nKeep it.\n';
const publishedText = "---\nkind: guide\nid: published\ndescription: Published.\n---\n";
const testSuiteText = `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "kept-guide" } }] })}\n`;
const evalSuiteText = `${JSON.stringify({ cases: [{ prompt: "keep it", expect: { invoke: "kept-skill" } }] })}\n`;
const settingsText = `${JSON.stringify({ agents: ["claude"] })}\n`;

/** One repository laid out in three parts, as files. */
const filesInThreeParts = {
  [repoFileUrlOf(".cw/settings.json")]: settingsText,
  [repoFileUrlOf(".cw/charter/primitive/guide/kept-guide/index.md")]: keptGuideText,
  [repoFileUrlOf(".cw/charter/primitive/skill/kept-skill/index.md")]: keptSkillText,
  [repoFileUrlOf(".cw/charter/test/kept.json")]: testSuiteText,
  [repoFileUrlOf(".cw/charter/eval/skills.json")]: evalSuiteText,
};

/** The same repository laid out the old way. */
const filesLaidOutTheOldWay = {
  [repoFileUrlOf(".cw/settings.json")]: settingsText,
  [repoFileUrlOf(".cw/charter/guide/kept-guide/index.md")]: keptGuideText,
  [repoFileUrlOf(".cw/charter/skill/kept-skill/index.md")]: keptSkillText,
  [repoFileUrlOf(".cw/test/kept.json")]: testSuiteText,
  [repoFileUrlOf(".cw/eval/skills.json")]: evalSuiteText,
};

/** Where the mcp origin a repository signs in to by OAuth is reached. */
const billingEndpoint = "https://billing.example/mcp";

/** The same repository with a sensor on stopping and an mcp origin signed in
 *  to by OAuth: what reaches every adapter the engine is composed with, once
 *  each operation of `operationAnswersOf` has run. */
const filesReachingEveryAdapter = {
  ...filesInThreeParts,
  [repoFileUrlOf(".cw/charter/primitive/sensor/stopped/index.md")]:
    '---\nkind: sensor\nid: stopped\ndescription: Say the agent stopped.\nsignal: Stop\nrun: "echo stopped"\n---\nSay so.\n',
  [repoFileUrlOf(".cw/charter/primitive/mcp/billing/index.md")]:
    `---\nkind: mcp\nid: billing\ndescription: Billing.\nendpoint: ${billingEndpoint}\nauth: ["oauth"]\ntools: ["get_file_contents"]\n---\nBilling.\n`,
};

/** Every adapter that would reach past memory, held in memory, over `files`;
 *  the mcp origin at `billingEndpoint` answering. */
function adaptersInMemory(files: Readonly<Record<string, string>>) {
  const fileReader = new InMemoryFileReaders(files);
  const fileWriter = new InMemoryFileOutput(fileReader);
  const sourceFetcher = new InMemorySources(fileReader);
  const promptfooRunner = new InMemoryPromptfoo();
  promptfooRunner.folderFiles = fileReader;
  const mcpServerCaller = new InMemoryMcpServers();
  mcpServerCaller.servers.set(billingEndpoint, {
    tools: [{ name: "get_file_contents", inputSchema: { type: "object" } }],
  });
  return {
    fileReader,
    fileWriter,
    sourceFetcher,
    worktreeKeeper: new InMemoryWorktrees(fileReader),
    credentialsRepository: new InMemoryCredentialsRepository(),
    oauthAuthorizer: new InMemoryOAuthAuthorizer(),
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands({}),
    progressReporter: new InMemoryReporter(),
    mcpServerCaller,
    clock: new InMemoryClock(new Date("2026-11-10T00:00:00Z")),
    promptfooRunner,
  };
}

/** The engine's plugin over the adapters held in memory: each agent's
 *  projection as this engine ships it, but its command line held in memory,
 *  so no test runs an agent installed on the machine, and the charter kept as
 *  files over them. */
function pluginsInMemory(adapters: ReturnType<typeof adaptersInMemory>): EngineAdapters {
  return {
    ...adapters,
    agentProvider: {
      claude: { projection: new ClaudeProjection(adapters.fileReader), agentCli: new InMemoryAgentCli() },
      codex: { projection: new CodexProjection(adapters.fileReader), agentCli: new InMemoryAgentCli() },
    },
    charterRepository: new FileCharterRepository(adapters.fileReader, adapters.fileWriter, adapters.sourceFetcher),
    sessionAnalysisRepository: new FileSessionAnalysisRepository(
      (rootFolder) => new InMemoryFileReaders({}, rootFolder),
      repoFolder,
      homeFolder,
    ),
    workspaceSettingsRepository: new FileWorkspaceSettingsRepository(adapters.fileReader, adapters.fileWriter),
    localOutput: new LocalRepoManipulator(adapters.fileReader, adapters.fileWriter),
  };
}

/** Every file under `folderUrl`, by its path from there. */
const filePathsUnder = (folderUrl: URL) =>
  readdirSync(folderUrl, { recursive: true, encoding: "utf8" }).filter(
    (filePath) => filePath.endsWith(".ts") && !/\.probe\./.test(filePath),
  );

/** Each module specifier a source file imports or re-exports. */
function importedSpecifiersOf(fileUrl: URL): readonly string[] {
  const sourceFile = ts.createSourceFile(fileUrl.pathname, readFileSync(fileUrl, "utf8"), ts.ScriptTarget.Latest, true);
  return sourceFile.statements
    .filter(
      (statement): statement is ts.ImportDeclaration | ts.ExportDeclaration =>
        ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement),
    )
    .flatMap((statement) =>
      statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [],
    );
}

/** The command line over the adapters handed, as main.ts composes it: the
 *  workspace files it keeps itself over the same files, and the engine
 *  composed for the settings it reads. */
function commandLineOver(adapters: ReturnType<typeof adaptersInMemory>): CommandLine {
  return {
    cwd: "/repo",
    version: "0.0.0",
    composeApplications: () => composeApplications(repoFolder, homeFolder, pluginsInMemory(adapters)),
  };
}

/** What one command line run printed to each stream, and its exit status. */
async function printedBy(commandLine: CommandLine, argv: readonly string[]) {
  const stdoutTexts: string[] = [];
  const stderrTexts: string[] = [];
  const originalWriteByStream = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (stdoutTexts.push(String(text)), true)) as typeof originalWriteByStream.out;
  process.stderr.write = ((text: string) => (stderrTexts.push(String(text)), true)) as typeof originalWriteByStream.err;
  try {
    return {
      code: await new Commander(commandLine, COMMANDS).runCommandLine(argv),
      outputText: stdoutTexts.join(""),
      problem: stderrTexts.join(""),
    };
  } finally {
    process.stdout.write = originalWriteByStream.out;
    process.stderr.write = originalWriteByStream.err;
  }
}

const claudeSettings = { agents: ["claude"] };

/** Each operation that reaches an adapter, asked in turn of the applications
 *  composed over `filesReachingEveryAdapter`, under its name with what it
 *  answered or raised: signed in before the build, built before what runs it. */
async function operationAnswersOf(
  { workspaceApp, engineApp }: ComposedApplications,
  startOperation: (operationName: string) => void = () => {},
) {
  const { charterAuthoringApp, charterBuildingApp, charterRuntimeApp } = engineApp;
  const operationByName: Readonly<Record<string, () => Promise<unknown>>> = {
    readWorkspaceSettings: () => workspaceApp.readWorkspaceSettings(),
    listCatalogue: () => charterAuthoringApp.listCatalogue(),
    signInWithOAuth: () => charterAuthoringApp.signInWithOAuth(billingEndpoint, () => {}),
    listSignInStatuses: () => charterAuthoringApp.listSignInStatuses(),
    buildCharter: () => charterBuildingApp.buildCharter(),
    predictMainContext: () => charterBuildingApp.predictMainContext(),
    addVendor: () => charterAuthoringApp.addVendor("team/kept"),
    runSensors: () => charterRuntimeApp.runSensors("Stop", "", "claude"),
    // Called by the name the build served it under, so the call reaches the
    // mcp origin and the credential kept for it.
    callTool: async () =>
      charterRuntimeApp.callTool(
        answerOf(await charterBuildingApp.listDeclaredTools()).data.tools[0]!.data.servedName,
        {},
      ),
    evaluateCharter: () => charterRuntimeApp.evaluateCharter(),
    summarizeSessions: () => charterRuntimeApp.summarizeSessions(),
    analyzeEvalLog: () => charterRuntimeApp.analyzeEvalLog(),
    countMainContext: () => charterRuntimeApp.countMainContext("claude"),
  };
  const operationAnswers: { operationName: string; answer: unknown }[] = [];
  for (const [operationName, operation] of Object.entries(operationByName)) {
    startOperation(operationName);
    operationAnswers.push({ operationName, answer: await operation().catch((raisedValue: unknown) => raisedValue) });
  }
  return operationAnswers;
}

test("the engine's modules are charter, with its applications authoring and projection, runtime, and the workspace, each with an application, a domain and its adapters; composed, each part answers what CORE-FR-222 gives it, and no other (CORE Story 52 scenario 1)", async () => {
  assert.deepEqual(
    readdirSync(moduleFolderUrl, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort(),
    ["charter", "runtime", "shared", "workspace"],
  );
  for (const moduleName of ["charter", "runtime", "workspace"])
    for (const layerName of ["app", "app/port/in", "app/port/out", "domain", "infra"])
      assert.ok(
        existsSync(new URL(`${moduleName}/${layerName}/`, moduleFolderUrl)),
        `${moduleName} has no ${layerName}`,
      );
  assert.equal(existsSync(new URL("src/zdriven/", repositoryUrl)), false, "src/zdriven/ is still there");

  // What each part answers, read off the applications as a tool composes them.
  const { workspaceApp, engineApp } = await composeApplications(
    repoFolder,
    homeFolder,
    pluginsInMemory(adaptersInMemory(filesInThreeParts)),
  );
  const authoringOperationNames = Object.keys(engineApp.charterAuthoringApp);
  const buildingOperationNames = Object.keys(engineApp.charterBuildingApp);
  const runningOperationNames = Object.keys(engineApp.charterRuntimeApp);
  // Keeping and testing: its primitives, vendors, test and eval cases, signing
  // in to its mcp origins, and testing it.
  for (const operationName of [
    "addPrimitive",
    "rewritePrimitive",
    "removePrimitive",
    "addVendor",
    "removeVendor",
    "listTestSuites",
    "writeTestSuite",
    "listEvalSuites",
    "writeEvalSuite",
    "signInWithToken",
    "signInWithOAuth",
    "getAccessToken",
    "testCharter",
  ])
    assert.ok(authoringOperationNames.includes(operationName), `authoring answers no ${operationName}`);
  // Building onto each agent provider, with its preview, health check,
  // estimated main context and the tools its mcp origins serve; and what
  // running asks of it.
  assert.deepEqual([...buildingOperationNames].sort(), [
    "buildCharter",
    "buildCharterInto",
    "diagnoseCharter",
    "listDeclaredTools",
    "listEvalCases",
    "listSensorCommands",
    "listServedTools",
    "predictMainContext",
    "previewCharterBuild",
    "readMainContextTexts",
  ]);
  // Running: its sensors, the calls forwarded, its evaluations, the exact
  // count of the main context, and the sessions and logs.
  assert.deepEqual([...runningOperationNames].sort(), [
    "analyzeEvalLog",
    "callTool",
    "countMainContext",
    "evaluateCharter",
    "runSensors",
    "summarizeSessions",
  ]);
  for (const operationName of runningOperationNames)
    assert.ok(
      !authoringOperationNames.includes(operationName) && !buildingOperationNames.includes(operationName),
      `the charter's part answers ${operationName} too`,
    );
  assert.deepEqual(
    Object.getOwnPropertyNames(Object.getPrototypeOf(workspaceApp))
      .filter((operationName) => operationName !== "constructor")
      .sort(),
    ["readWorkspaceSettings", "setUpWorkspace"],
  );
});

test("runtime asks the charter only through charter's applications, in answers made for that, and charter asks nothing of runtime (CORE Story 52 scenario 2, CORE Story 56 scenario 9)", async () => {
  const adapters = adaptersInMemory(filesReachingEveryAdapter);
  const engineAdapters = pluginsInMemory(adapters);
  // The charter's part composed over runtime's own adapters made to fail if
  // reached: keeping, testing and building reach none of them.
  const runtimeReachedNames: string[] = [];
  const runtimeAdapterOf = <Adapter extends object>(adapterName: string, adapter: Adapter): Adapter =>
    new Proxy(adapter, {
      get(target, propertyName, receiver) {
        runtimeReachedNames.push(`${adapterName}.${String(propertyName)}`);
        return Reflect.get(target, propertyName, receiver);
      },
    });
  const { charterAuthoringApp, charterBuildingApp } = composeEngine(claudeSettings, {
    ...engineAdapters,
    shell: runtimeAdapterOf("shell", adapters.shell),
    worktreeKeeper: runtimeAdapterOf("worktreeKeeper", adapters.worktreeKeeper),
    promptfooRunner: runtimeAdapterOf("promptfooRunner", adapters.promptfooRunner),
    sessionAnalysisRepository: runtimeAdapterOf("sessionAnalysisRepository", engineAdapters.sessionAnalysisRepository),
    agentProvider: {
      claude: {
        projection: engineAdapters.agentProvider["claude"]!.projection,
        agentCli: runtimeAdapterOf("cli", new InMemoryAgentCli()),
      },
    },
  });
  answerOf(await charterAuthoringApp.signInWithOAuth(billingEndpoint, () => {}));
  answerOf(await charterBuildingApp.buildCharter());
  answerOf(await charterBuildingApp.previewCharterBuild());
  answerOf(await charterBuildingApp.diagnoseCharter());
  answerOf(await charterAuthoringApp.testCharter());
  answerOf(await charterBuildingApp.predictMainContext());
  answerOf(await charterBuildingApp.listSensorCommands("Stop", "claude"));
  answerOf(await charterBuildingApp.listDeclaredTools());
  assert.deepEqual(runtimeReachedNames, []);

  // Running composed over the charter's two applications, each operation it
  // asks of them recorded with what it was answered.
  const charterAnswers: { operationName: string; operationAnswer: unknown }[] = [];
  const recordedAppOf = <App extends object>(charterApp: App): App =>
    Object.fromEntries(
      Object.getOwnPropertyNames(Object.getPrototypeOf(charterApp))
        .filter((operationName) => operationName !== "constructor")
        .map((operationName) => [
          operationName,
          async (...operationArguments: unknown[]) => {
            const operationAnswer = await (charterApp as Record<string, (...operationArguments: unknown[]) => unknown>)[
              operationName
            ]!.apply(charterApp, operationArguments);
            charterAnswers.push({ operationName, operationAnswer });
            return operationAnswer;
          },
        ]),
    ) as App;
  const charterRuntimeApp = new RunningCharter(
    recordedAppOf(charterAuthoringApp),
    recordedAppOf(charterBuildingApp),
    adapters.fileReader,
    { claude: new InMemoryAgentCli() },
    adapters.shell,
    adapters.worktreeKeeper,
    adapters.promptfooRunner,
    engineAdapters.sessionAnalysisRepository,
    adapters.clock,
    { agents: ["claude"] },
    adapters.progressReporter,
    adapters.mcpServerCaller,
  );

  answerOf(await charterRuntimeApp.runSensors("Stop", "", "claude"));
  // Called by the name the build served it under, so the call reaches the mcp
  // origin and asks authoring for the credential kept for it.
  answerOf(
    await charterRuntimeApp.callTool(
      answerOf(await charterBuildingApp.listDeclaredTools()).data.tools[0]!.data.servedName,
      {},
    ),
  );
  answerOf(await charterRuntimeApp.evaluateCharter());
  await charterRuntimeApp.countMainContext("claude");

  assert.deepEqual([...new Set(charterAnswers.map(({ operationName }) => operationName))].sort(), [
    "buildCharterInto",
    "getAccessToken",
    "listDeclaredTools",
    "listEvalCases",
    "listEvalSuites",
    "listSensorCommands",
    // The estimate an exact count is put beside (EVAL-FR-004).
    "predictMainContext",
    "readMainContextTexts",
  ]);
  // Each operationAnswer is a DTO made for the caller: it reads back through its own
  // schema whole, plain data and nothing of the charter's own model.
  for (const { operationName, operationAnswer } of charterAnswers) {
    const answerType = (operationAnswer as { type: string }).type;
    const answerSchema =
      (CharterDTOs as Record<string, { parse(value: unknown): unknown }>)[answerType] ??
      (FaultDTOs as Record<string, { parse(value: unknown): unknown }>)[answerType];
    assert.ok(answerSchema !== undefined, `${operationName} answered a ${answerType}, which no DTO is`);
    assert.deepStrictEqual(answerSchema.parse(operationAnswer), operationAnswer, operationName);
  }

  // Nor can the charter's part reach running: none of its files imports it.
  for (const filePath of filePathsUnder(new URL("charter/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`charter/${filePath}`, moduleFolderUrl)))
      assert.doesNotMatch(specifier, /runtime\//, `charter/${filePath} imports ${specifier}`);
});

/** `cw`'s own adapter of each kind the engine is composed with, by the name
 *  it is handed under: what is composed in where a tool hands none. */
const OWN_ADAPTER_CLASS_NAMES_BY_KEY = {
  agentProvider: ["ClaudeProjection", "ClaudeCli"],
  charterRepository: ["FileCharterRepository"],
  sourceFetcher: ["GitSources"],
  sessionAnalysisRepository: ["FileSessionAnalysisRepository"],
  workspaceSettingsRepository: ["FileWorkspaceSettingsRepository"],
  localOutput: ["LocalRepoManipulator"],
  fileReader: ["FileReaders"],
  fileWriter: ["FileOutput"],
  worktreeKeeper: ["GitWorktrees"],
  oauthAuthorizer: ["OAuth"],
  mcpServerCaller: ["McpClients"],
  tokenCounter: ["Tiktoken"],
  clock: ["SystemClock"],
  shell: ["Shell"],
  progressReporter: ["ConsoleReporter"],
  promptfooRunner: ["Promptfoo"],
  credentialsRepository: ["KeychainCredentialsRepository"],
} as const satisfies Record<keyof EngineAdapters, readonly string[]>;

/** The stores the engine sets up over the file adapters it is handed, or
 *  fetches vendors through: left out along with what they are set up over, so
 *  that `cw`'s own of those is the one composed (SDK-FR-020). */
const ADAPTER_KEYS_SET_UP_OVER = {
  sourceFetcher: ["charterRepository"],
  fileReader: ["charterRepository", "workspaceSettingsRepository", "localOutput", "sessionAnalysisRepository"],
  fileWriter: ["charterRepository", "workspaceSettingsRepository", "localOutput"],
} as const satisfies Partial<Record<keyof EngineAdapters, readonly (keyof EngineAdapters)[]>>;

test("the published package composes the engine of its two parts, which hold no store or runner, and composes cw's own for every adapter a tool does not hand, each exported for a tool to extend; no command line or portal (CORE Story 52 scenario 3)", async () => {
  const libraryIndexText = readFileSync(new URL("src/index.ts", repositoryUrl), "utf8");
  const exportedPaths = [...libraryIndexText.matchAll(/^export [^;]* from "\.\/([^"]+)";$/gm)].map(
    (exportMatch) => exportMatch[1]!,
  );
  assert.ok(exportedPaths.length > 0);
  for (const exportedPath of exportedPaths)
    assert.match(exportedPath, /^module\/(?:(?:charter|runtime|shared|workspace)\/module|composition)\.js$/);
  // No use case is exported, nor how the engine is put together inside: a
  // tool composes it through composeApplications alone (CORE-FR-228, SDK-FR-020).
  for (const internalName of [
    "AuthoringCharter",
    "BuildingCharter",
    "RunningCharter",
    "composeEngine",
    "composeWorkspace",
  ])
    assert.doesNotMatch(libraryIndexText, new RegExp(`^export \\{[^}]*\\b${internalName}\\b`, "m"), internalName);
  // pnpm test builds first, so the library read is this working tree's.
  const builtLibraryText = readFileSync(new URL("dist/index.js", repositoryUrl), "utf8");
  assert.doesNotMatch(builtLibraryText, /^\/\/ (?:main\.ts|src\/presentation\/)/m);
  assert.match(builtLibraryText, /^\/\/ src\/module\/composition\.ts$/m);

  // The two parts hold no store and no runner: what their applications and
  // domains import is never an adapter.
  for (const moduleName of ["charter", "runtime"])
    for (const layerName of ["app", "domain"])
      for (const filePath of filePathsUnder(new URL(`${moduleName}/${layerName}/`, moduleFolderUrl)))
        for (const specifier of importedSpecifiersOf(
          new URL(`${moduleName}/${layerName}/${filePath}`, moduleFolderUrl),
        ))
          assert.doesNotMatch(specifier, /\/infra\//, `${moduleName}/${layerName}/${filePath} imports ${specifier}`);

  // Every adapter the engine is composed with has cw's own, exported by the
  // package and open to a tool to extend.
  const exportedNames = new Set(
    ts
      .createSourceFile("index.ts", libraryIndexText, ts.ScriptTarget.Latest, true)
      .statements.filter(ts.isExportDeclaration)
      .flatMap((exportDeclaration) =>
        exportDeclaration.exportClause !== undefined && ts.isNamedExports(exportDeclaration.exportClause)
          ? exportDeclaration.exportClause.elements.map((exportSpecifier) => exportSpecifier.name.text)
          : [],
      ),
  );
  const ownAdapterClassByName: Readonly<Record<string, abstract new (...constructorArguments: never[]) => object>> = {
    ...charterModule,
    ...runtimeModule,
    ...sharedModule,
    ...workspaceModule,
  } as never;
  const handedAdapterKeys = Object.keys(pluginsInMemory(adaptersInMemory(filesInThreeParts))).sort();
  assert.deepEqual(Object.keys(OWN_ADAPTER_CLASS_NAMES_BY_KEY).sort(), handedAdapterKeys);
  for (const ownAdapterClassName of Object.values(OWN_ADAPTER_CLASS_NAMES_BY_KEY).flat()) {
    assert.ok(exportedNames.has(ownAdapterClassName), `${ownAdapterClassName} is not exported`);
    const OwnAdapterClass = ownAdapterClassByName[ownAdapterClassName]!;
    class ExtendedAdapter extends OwnAdapterClass {}
    assert.equal(Object.getPrototypeOf(ExtendedAdapter.prototype), OwnAdapterClass.prototype, ownAdapterClassName);
  }

  // Each one a tool leaves out is cw's own: with every other handed, an
  // operation reaches cw's own, each of its operations made to record that
  // it was reached and fail, so nothing reaches past memory.
  for (const [adapterKey, ownAdapterClassNames] of Object.entries(OWN_ADAPTER_CLASS_NAMES_BY_KEY)) {
    const adapters = adaptersInMemory(filesReachingEveryAdapter);
    // Not yet installed, so the evaluation reports that it installs it.
    const promptfooRunner = new InMemoryPromptfoo(false);
    promptfooRunner.folderFiles = adapters.fileReader;
    const handedAdapters: Partial<EngineAdapters> = Object.fromEntries(
      Object.entries({ ...pluginsInMemory(adapters), promptfooRunner }).filter(
        ([handedAdapterKey]) =>
          handedAdapterKey !== adapterKey &&
          !(ADAPTER_KEYS_SET_UP_OVER[adapterKey as keyof typeof ADAPTER_KEYS_SET_UP_OVER] ?? []).includes(
            handedAdapterKey as never,
          ),
      ),
    );
    const reachedOperationNames: string[] = [];
    const originalOperationsByPrototype = new Map<object, Record<string, unknown>>();
    for (const ownAdapterClassName of ownAdapterClassNames) {
      const ownAdapterPrototype = ownAdapterClassByName[ownAdapterClassName]!.prototype as Record<string, unknown>;
      const originalOperationByName: Record<string, unknown> = {};
      for (const operationName of Object.getOwnPropertyNames(ownAdapterPrototype)) {
        const operation = Object.getOwnPropertyDescriptor(ownAdapterPrototype, operationName)?.value;
        if (operationName === "constructor" || typeof operation !== "function") continue;
        originalOperationByName[operationName] = operation;
        ownAdapterPrototype[operationName] = () => {
          reachedOperationNames.push(`${ownAdapterClassName}.${operationName}`);
          throw new Error(`${ownAdapterClassName}.${operationName} was reached`);
        };
      }
      originalOperationsByPrototype.set(ownAdapterPrototype, originalOperationByName);
    }
    try {
      await operationAnswersOf(await composeApplications(repoFolder, homeFolder, handedAdapters));
    } finally {
      for (const [ownAdapterPrototype, originalOperationByName] of originalOperationsByPrototype)
        Object.assign(ownAdapterPrototype, originalOperationByName);
    }
    assert.ok(reachedOperationNames.length > 0, `with no ${adapterKey} handed, cw's own was never reached`);
  }
});

/** `adapter`, each call of one of its operations counted under `adapterKey`,
 *  answered by the adapter itself. */
function countedAdapterOf<Adapter extends object>(
  adapter: Adapter,
  adapterKey: string,
  countCall: (adapterKey: string) => void,
): Adapter {
  return new Proxy(adapter, {
    get(targetAdapter, propertyKey) {
      const propertyValue = Reflect.get(targetAdapter, propertyKey, targetAdapter);
      if (typeof propertyValue !== "function" || propertyKey === "constructor") return propertyValue;
      return (...callArguments: unknown[]) => {
        countCall(adapterKey);
        return propertyValue.apply(targetAdapter, callArguments);
      };
    },
  });
}

/** The adapters each operation of `operationAnswersOf` uses, by the name each
 *  is handed under: what it reaches, whoever wrote the adapter. */
const ADAPTER_KEYS_BY_OPERATION_NAME: Readonly<Record<string, readonly string[]>> = {
  readWorkspaceSettings: ["fileReader", "workspaceSettingsRepository"],
  listCatalogue: ["charterRepository", "fileReader", "workspaceSettingsRepository"],
  signInWithOAuth: ["charterRepository", "credentialsRepository", "fileReader", "oauthAuthorizer"],
  listSignInStatuses: ["charterRepository", "credentialsRepository", "fileReader"],
  buildCharter: [
    "agentProvider",
    "charterRepository",
    "credentialsRepository",
    "fileReader",
    "fileWriter",
    "localOutput",
    "mcpServerCaller",
  ],
  predictMainContext: ["agentProvider", "charterRepository", "fileReader", "tokenCounter"],
  addVendor: ["charterRepository", "fileReader", "sourceFetcher"],
  runSensors: ["charterRepository", "fileReader", "shell"],
  callTool: ["charterRepository", "credentialsRepository", "fileReader", "mcpServerCaller"],
  evaluateCharter: [
    "agentProvider",
    "charterRepository",
    "fileReader",
    "fileWriter",
    "localOutput",
    "progressReporter",
    "promptfooRunner",
    "worktreeKeeper",
  ],
  summarizeSessions: ["clock", "sessionAnalysisRepository"],
  analyzeEvalLog: ["promptfooRunner"],
  countMainContext: ["agentProvider", "charterRepository", "fileReader", "tokenCounter"],
};

test("each adapter the engine is composed with, handed as a test's own, is what every use case using it answers through (CORE Story 55 scenario 28, SDK-SC-005)", async () => {
  // Each call counted under the driver-port operation that made it, and the
  // adapter it reached: what composing asks before any operation is under
  // `composeApplications`.
  const callCountByOperationName = new Map<string, Map<string, number>>();
  let runningOperationName = "composeApplications";
  const countCall = (adapterKey: string) => {
    const callCountByAdapterKey = callCountByOperationName.get(runningOperationName) ?? new Map<string, number>();
    callCountByAdapterKey.set(adapterKey, (callCountByAdapterKey.get(adapterKey) ?? 0) + 1);
    callCountByOperationName.set(runningOperationName, callCountByAdapterKey);
  };
  const adapters = adaptersInMemory(filesReachingEveryAdapter);
  // Not yet installed, so the evaluation reports that it installs it.
  adapters.promptfooRunner = new InMemoryPromptfoo(false);
  adapters.promptfooRunner.folderFiles = adapters.fileReader;
  const countedAdapters = Object.fromEntries(
    Object.entries(adapters).map(([adapterKey, adapter]) => [
      adapterKey,
      countedAdapterOf(adapter, adapterKey, countCall),
    ]),
  ) as typeof adapters;
  const handedPlugins = pluginsInMemory(countedAdapters);
  const countedPlugins: EngineAdapters = {
    ...handedPlugins,
    agentProvider: Object.fromEntries(
      Object.entries(handedPlugins.agentProvider).map(([agentName, { projection, agentCli }]) => [
        agentName,
        {
          projection: countedAdapterOf(projection, "agentProvider", countCall),
          agentCli: countedAdapterOf(agentCli, "agentProvider", countCall),
        },
      ]),
    ),
    charterRepository: countedAdapterOf(handedPlugins.charterRepository, "charterRepository", countCall),
    sessionAnalysisRepository: countedAdapterOf(
      handedPlugins.sessionAnalysisRepository,
      "sessionAnalysisRepository",
      countCall,
    ),
    workspaceSettingsRepository: countedAdapterOf(
      handedPlugins.workspaceSettingsRepository,
      "workspaceSettingsRepository",
      countCall,
    ),
    localOutput: countedAdapterOf(handedPlugins.localOutput, "localOutput", countCall),
  };

  const operationAnswers = await operationAnswersOf(
    await composeApplications(repoFolder, homeFolder, countedPlugins),
    (operationName) => {
      runningOperationName = operationName;
    },
  );

  // Every operation answered, none of them raising.
  for (const { operationName, answer } of operationAnswers)
    assert.ok(!(answer instanceof Error), `${operationName} raised ${String(answer)}`);
  // Each operation reached every adapter it uses through the one handed, the
  // composing itself none; and every adapter handed is used by one.
  assert.deepEqual(
    Object.fromEntries(
      [...callCountByOperationName].map(([operationName, callCountByAdapterKey]) => [
        operationName,
        [...callCountByAdapterKey.keys()].sort(),
      ]),
    ),
    ADAPTER_KEYS_BY_OPERATION_NAME,
  );
  assert.deepEqual(
    [...new Set(Object.values(ADAPTER_KEYS_BY_OPERATION_NAME).flat())].sort(),
    Object.keys(OWN_ADAPTER_CLASS_NAMES_BY_KEY).sort(),
  );
});

test("with in-memory file adapters handed and no sessions store, a session kept and the sessions summed go through the adapters handed, and the disk is never reached (CORE Story 55 scenario 26, SDK-FR-020)", async () => {
  const memoryRepoFolder = new URL("memory:/team/");
  const memoryHomeFolder = new URL("memory:/home/");
  const fileReader = new InMemoryFileReaders(
    { [new URL(".cw/settings.json", memoryRepoFolder).href]: settingsText },
    memoryRepoFolder,
  );
  const fileWriter = new InMemoryFileOutput(fileReader);
  const progressReporter = new InMemoryReporter();
  // A session kept as cw-session-tokens-counter keeps one, in the files handed,
  // under the home's folder named after the repository.
  const sessionLogUrl = new URL(".cherry-works/memory_3a_2fteam/session-a/session-analysis.jsonl", memoryHomeFolder);
  fileReader.writeFile(
    sessionLogUrl,
    `${JSON.stringify({
      time: "2026-11-09T12:00:00.000Z",
      sessionId: "session-a",
      repository: "memory:/team",
      model: "claude-opus-5-5",
      tokens: { input: 100, output: 100, cacheWrite: 100, cacheRead: 700 },
      total: 1000,
    })}\n`,
    new Date("2026-11-09T12:00:00.000Z"),
  );
  const diskReachedNames: string[] = [];
  const originalOperationByName = new Map<string, unknown>();
  const fileReadersPrototype = FileReaders.prototype as unknown as Record<string, unknown>;
  for (const operationName of Object.getOwnPropertyNames(fileReadersPrototype)) {
    if (operationName === "constructor") continue;
    originalOperationByName.set(operationName, fileReadersPrototype[operationName]);
    fileReadersPrototype[operationName] = () => {
      diskReachedNames.push(operationName);
      throw new Error(`FileReaders.${operationName} was reached`);
    };
  }
  try {
    const { engineApp } = await composeApplications(memoryRepoFolder, memoryHomeFolder, {
      fileReader,
      fileWriter,
      progressReporter,
      clock: new InMemoryClock(new Date("2026-11-10T00:00:00Z")),
    });
    const sessionReviewOutcome = answerOf(await engineApp.charterRuntimeApp.summarizeSessions());

    assert.equal(sessionReviewOutcome.data.sessionsFolder, "memory:/home/.cherry-works/memory_3a_2fteam/");
    assert.deepEqual(
      sessionReviewOutcome.data.sessionSummary.data.sessions.map((session) => session.sessionId),
      ["session-a"],
    );
    assert.ok(fileReader.calls.includes(`read ${sessionLogUrl.href}`), fileReader.calls.join("\n"));
    assert.deepEqual(diskReachedNames, []);
    assert.deepEqual(progressReporter.problems, []);
  } finally {
    for (const [operationName, operation] of originalOperationByName) fileReadersPrototype[operationName] = operation;
  }
});

test("composed at a scheme no adapter of cw's reads, with no file adapter handed, reading the charter answers a fault the caller corrects, naming the adapter to hand, and records no internal failure (CORE Story 55 scenario 27, SDK-FR-017, SDK-FR-018)", async () => {
  const progressReporter = new InMemoryReporter();
  const { engineApp } = await composeApplications(new URL("memory:/team/"), new URL("memory:/home/"), {
    progressReporter,
  });

  for (const readingAnswer of [
    await engineApp.charterAuthoringApp.listCatalogue(),
    await engineApp.charterBuildingApp.buildCharter(),
  ]) {
    assert.equal(readingAnswer.type, "Fault", JSON.stringify(readingAnswer));
    const { name, message, fix } = (readingAnswer as FaultDTOs.Fault).data;
    assert.notEqual(name, "InternalFault");
    assert.match(message, /memory:/);
    assert.match(fix, /fileReader/);
  }
  assert.deepEqual(progressReporter.problems, []);
});

test("an engine composed with a plugin of the author's own builds and evaluates for its agent through that plugin, and answers as it does with the plugin shipped (CORE Story 52 scenario 4)", async () => {
  const askedAgentNames: string[] = [];
  const projectedCheckoutPaths: (string | undefined)[] = [];
  class OwnClaudeProjection extends ClaudeProjection {
    // An extending class builds itself over a checkout (EVAL-FR-021).
    override createCheckoutProjection(checkoutFolder: string): OwnClaudeProjection {
      return new OwnClaudeProjection(this.fileReader, checkoutFolder);
    }

    override async createAgentProjectionPlan(
      ...projectionArguments: Parameters<ClaudeProjection["createAgentProjectionPlan"]>
    ) {
      projectedCheckoutPaths.push(this.checkoutFolder);
      return super.createAgentProjectionPlan(...projectionArguments);
    }
  }
  class OwnAgentCli extends AgentCli {
    async isInstalled(): Promise<boolean> {
      askedAgentNames.push("claude");
      return true;
    }
  }
  const ownAdapters = adaptersInMemory(filesInThreeParts);
  const ownEngine = composeEngine(claudeSettings, {
    ...pluginsInMemory(ownAdapters),
    agentProvider: {
      claude: { projection: new OwnClaudeProjection(ownAdapters.fileReader), agentCli: new OwnAgentCli() },
    },
  });
  const shippedAdapters = adaptersInMemory(filesInThreeParts);
  const shippedPlugins = pluginsInMemory(shippedAdapters);
  const shippedEngine = composeEngine(claudeSettings, {
    ...shippedPlugins,
    agentProvider: { claude: shippedPlugins.agentProvider["claude"]! },
  });

  assert.equal(
    JSON.stringify(await ownEngine.charterBuildingApp.buildCharter()),
    JSON.stringify(await shippedEngine.charterBuildingApp.buildCharter()),
  );
  // The build was laid by the author's own projection, onto the repository.
  assert.deepEqual(projectedCheckoutPaths, [""]);
  assert.equal(
    JSON.stringify(await ownEngine.charterRuntimeApp.evaluateCharter()),
    JSON.stringify(await shippedEngine.charterRuntimeApp.evaluateCharter()),
  );
  // Each case was built into its working copy by it, and run by its own command line.
  assert.deepEqual(projectedCheckoutPaths, ["", ".cw/log/eval/worktrees/1"]);
  assert.deepEqual(askedAgentNames, ["claude"]);
});

test("the eval cases are listed, added, rewritten and removed by the one store that keeps the charter, as the test cases are (CORE Story 52 scenario 5)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  const { charterAuthoringApp } = composeEngine(claudeSettings, pluginsInMemory(adapters));
  const evalFilePathsOf = async () =>
    (await adapters.fileReader.readFilesRecursively(".cw/charter/eval")).map(({ path }) => path).sort();

  assert.deepEqual(
    answerOf(await charterAuthoringApp.listEvalSuites()).data.evalSuites.map(({ data: evalSuite }) => evalSuite.name),
    ["skills.json"],
  );
  const addedName = answerOf(await charterAuthoringApp.addEvalSuite()).data.name;
  assert.deepEqual(await evalFilePathsOf(), [`.cw/charter/eval/${addedName}`, ".cw/charter/eval/skills.json"].sort());
  const rewrittenText = `${JSON.stringify({ cases: [{ prompt: "rewrite it", expect: { follow: "kept-guide" } }] })}\n`;
  answerOf(await charterAuthoringApp.writeEvalSuite(addedName, rewrittenText));
  assert.equal(await adapters.fileReader.readIfThere(`.cw/charter/eval/${addedName}`), rewrittenText);
  answerOf(await charterAuthoringApp.removeEvalSuite(addedName));
  assert.deepEqual(await evalFilePathsOf(), [".cw/charter/eval/skills.json"]);
});

test("every command and the portal are handed the applications of the modules and nothing else (CORE-FR-222)", () => {
  const contextText = readFileSync(
    new URL("src/presentation/cli/commands/command.interface.ts", repositoryUrl),
    "utf8",
  );
  assert.deepEqual(
    [...contextText.matchAll(/^ {2}readonly \w+App: (For\w+);$/gm)].map((appMatch) => appMatch[1]!).sort(),
    ["ForAuthoringCharter", "ForBuildingCharter", "ForManagingWorkspace", "ForRunningCharter"],
  );
  const portalRoutesText = readFileSync(new URL("src/presentation/portal/portal.routes.ts", repositoryUrl), "utf8");
  assert.deepEqual(
    [...portalRoutesText.matchAll(/^import (?:type )?\{ ([^}]+) \} from "#module\/[\w-]+\/module\.js";$/gm)]
      .flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, "")))
      .filter((importedName) => importedName.startsWith("For"))
      .sort(),
    ["ForAuthoringCharter", "ForBuildingCharter"],
  );
  const mainText = readFileSync(new URL("main.ts", repositoryUrl), "utf8");
  assert.match(mainText, /composeApplications\(/);
  assert.doesNotMatch(mainText, /new (?:AuthoringCharter|BuildingCharter|RunningCharter|ManagingWorkspace)\(/);
});

test("a repository set up holds the charter with its primitives, tests, eval cases and vendors under it, the output and the log (CORE Story 52 scenario 7)", async () => {
  const adapters = adaptersInMemory({});

  const { code } = await printedBy(commandLineOver(adapters), ["init", "--agent", "claude"]);

  assert.equal(code, EXIT_OK);
  const keptPaths = (await adapters.fileReader.readBytesRecursively(".cw")).map(({ path }) => path);
  assert.ok(keptPaths.includes(".cw/settings.json"));
  assert.ok(keptPaths.some((path) => path.startsWith(".cw/charter/primitive/guide/")));
  for (const partPath of [".cw/charter/test/", ".cw/charter/eval/", ".cw/charter/vendor/", ".cw/out/"])
    assert.ok(
      keptPaths.some((path) => path.startsWith(partPath)),
      `nothing under ${partPath}`,
    );
  assert.deepEqual(
    keptPaths.filter((path) => /^\.cw\/(?:test|eval|vendor)\//.test(path)),
    [],
  );
  assert.match((await adapters.fileReader.readIfThere(".cw/.gitignore")) ?? "", /^log\/$/m);
});

test("every command refuses a repository laid out the old way, naming the authoring skill (CORE Story 52 scenario 8)", async () => {
  // Every command, each argument it requires given a value: the refusal comes
  // before any of them is run.
  for (const argv of COMMANDS.map((command) =>
    command.name.split(" ").map((commandWord) => (commandWord.startsWith("<") ? "x" : commandWord)),
  )) {
    const { code, problem } = await printedBy(commandLineOver(adaptersInMemory(filesLaidOutTheOldWay)), argv);
    assert.equal(code, EXIT_FAILURE, argv.join(" "));
    assert.match(problem, /laid out the old way/, argv.join(" "));
    assert.match(problem, /cw-author/, argv.join(" "));
  }
  const oldWayAdapters = adaptersInMemory(filesLaidOutTheOldWay);
  const { charterBuildingApp } = composeEngine(claudeSettings, pluginsInMemory(oldWayAdapters));
  assert.match(JSON.stringify(await charterBuildingApp.buildCharter()), /laid out the old way/);
});

test("a vendor source laid out the old way is refused, naming the source and the authoring skill, and nothing is installed (CORE Story 52 scenario 9)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  adapters.sourceFetcher.sourceFilesBySource["team/old"] = { ".cw/charter/guide/published/index.md": publishedText };
  const { charterAuthoringApp } = composeEngine(claudeSettings, pluginsInMemory(adapters));

  const vendorAddAnswer = await charterAuthoringApp.addVendor("team/old");

  assert.equal(vendorAddAnswer.type, "Fault");
  const { message, fix } = (vendorAddAnswer as FaultDTOs.Fault).data;
  assert.match(message, /team\/old/);
  assert.match(message, /laid out the old way/);
  assert.match(fix ?? "", /cw-author/);
  assert.deepEqual(await adapters.fileReader.readBytesRecursively(".cw/charter/vendor"), []);
});

test("updating a vendor whose source has gone over to the old layout is refused, naming the source and the authoring skill, and the vendor installed is left as it was (CORE Story 52 scenario 9)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  adapters.sourceFetcher.sourceFilesBySource["team/kept"] = {
    ".cw/charter/primitive/guide/published/index.md": publishedText,
  };
  const { charterAuthoringApp } = composeEngine(claudeSettings, pluginsInMemory(adapters));
  answerOf(await charterAuthoringApp.addVendor("team/kept"));
  const installedVendorFiles = await adapters.fileReader.readBytesRecursively(".cw/charter/vendor");
  assert.ok(installedVendorFiles.length > 0);
  adapters.sourceFetcher.sourceFilesBySource["team/kept"] = {
    ".cw/charter/guide/published/index.md": publishedText.replace("Published.", "Published again."),
  };

  const vendorUpdateAnswer = await charterAuthoringApp.addVendor("team/kept");

  assert.equal(vendorUpdateAnswer.type, "Fault");
  const { message, fix } = (vendorUpdateAnswer as FaultDTOs.Fault).data;
  assert.match(message, /team\/kept/);
  assert.match(message, /laid out the old way/);
  assert.match(fix ?? "", /cw-author/);
  assert.deepEqual(await adapters.fileReader.readBytesRecursively(".cw/charter/vendor"), installedVendorFiles);
});

test("following the authoring skill moves a repository laid out the old way, and the build is the same byte for byte (CORE Story 52 scenario 10)", async () => {
  const skillBody = new CwAuthorSkill().body;
  const movedPathPairs = [...skillBody.matchAll(/^- `([^`]+)` → `([^`]+)`/gm)].flatMap(([, oldPath, newPath]) =>
    oldPath!.includes("<kind>")
      ? Primitives.kinds.map((kind) => [oldPath!.replace("<kind>", kind), newPath!.replace("<kind>", kind)] as const)
      : [[oldPath!, newPath!] as const],
  );
  assert.ok(movedPathPairs.length >= 4, skillBody);

  const movedFiles = Object.fromEntries(
    Object.entries(filesLaidOutTheOldWay).map(([fileUrl, contents]) => {
      const filePath = fileUrl.slice(repoFolder.href.length);
      const movedPathPair = movedPathPairs.find(([oldPath]) => filePath.startsWith(oldPath));
      return [
        repoFileUrlOf(
          movedPathPair === undefined ? filePath : `${movedPathPair[1]}${filePath.slice(movedPathPair[0].length)}`,
        ),
        contents,
      ];
    }),
  );
  assert.deepEqual(Object.keys(movedFiles).sort(), Object.keys(filesInThreeParts).sort());

  const builtFilesOf = async (files: Readonly<Record<string, string>>) => {
    const adapters = adaptersInMemory(files);
    answerOf(await composeEngine(claudeSettings, pluginsInMemory(adapters)).charterBuildingApp.buildCharter());
    return (await adapters.fileReader.readBytesRecursively("")).filter(
      ({ path }) => !path.startsWith(".cw/charter/") && path !== ".cw/settings.json",
    );
  };
  assert.deepEqual(await builtFilesOf(movedFiles), await builtFilesOf(filesInThreeParts));
});

/** promptfoo as it is installed, standing in for the real one: it writes the
 *  output it is asked for, a case passed, and exits. */
const FAKE_PROMPTFOO = `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify({results:{results:[{success:true,response:{output:"done",tokenUsage:{total:1}},gradingResult:{componentResults:[]}}]}}));
`;

test("an evaluation keeps each case's working copy and what its run leaves under the log, which version control ignores (CORE Story 52 scenario 11)", async () => {
  // The repository set up, its .gitignore as setting it up writes it.
  const setUpAdapters = adaptersInMemory({});
  assert.equal((await printedBy(commandLineOver(setUpAdapters), ["init", "--agent", "claude"])).code, EXIT_OK);
  const setUpGitignoreText = await setUpAdapters.fileReader.readIfThere(".cw/.gitignore");
  assert.ok(setUpGitignoreText !== undefined);

  const adapters = adaptersInMemory({ ...filesInThreeParts, [repoFileUrlOf(".cw/.gitignore")]: setUpGitignoreText });
  const { charterRuntimeApp } = composeEngine(claudeSettings, pluginsInMemory(adapters));
  answerOf(await charterRuntimeApp.evaluateCharter());
  const [evaluatedTest] = adapters.promptfooRunner.evaluatedTests;
  assert.match(evaluatedTest?.workingPath ?? "", /^\.cw\/log\/eval\/worktrees\//);

  // What a run of the real promptfoo adapter leaves, in a repository on disk.
  const temporaryFolderPath = await mkdtemp(join(tmpdir(), "cw-eval-log-"));
  try {
    const repoFolderPath = join(temporaryFolderPath, "repo");
    await mkdir(join(repoFolderPath, ".cw"), { recursive: true });
    await writeFile(join(repoFolderPath, ".cw/.gitignore"), setUpGitignoreText);
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd: repoFolderPath }).status, 0);
    const promptfooRunner = new Promptfoo(
      pathToFileURL(`${repoFolderPath}/`),
      pathToFileURL(`${join(temporaryFolderPath, "home")}/`),
      [],
    );
    const promptfooFilePath = join(promptfooRunner.installFolderPath, "node_modules", ".bin", "promptfoo");
    await mkdir(join(promptfooFilePath, ".."), { recursive: true });
    await writeFile(promptfooFilePath, FAKE_PROMPTFOO);
    await chmod(promptfooFilePath, 0o755);

    const promptfooTestResult = await promptfooRunner.evaluateTest({
      provider: "claude",
      description: "skills.json: keep it",
      prompt: "keep it",
      workingPath: "",
      assertions: [{ type: "skill-used", value: "kept-skill" }],
    });

    const logFilePath = relative(repoFolderPath, promptfooTestResult.logPath ?? "");
    assert.match(logFilePath, /^\.cw\/log\/eval\/runs\/run-[^/]+\/case\.json$/);
    assert.ok(readdirSync(join(repoFolderPath, ".cw/log"), { recursive: true }).length > 0);
    // All the run left is ignored: version control sees only the .gitignore.
    assert.equal(
      spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: repoFolderPath, encoding: "utf8" })
        .stdout,
      "?? .cw/.gitignore\n",
    );
    assert.equal(spawnSync("git", ["check-ignore", "--quiet", logFilePath], { cwd: repoFolderPath }).status, 0);
  } finally {
    await rm(temporaryFolderPath, { recursive: true, force: true });
  }
});

test("the workspace module keeps which agents a repository chose in .cw/settings.json, and the command line hands them to the applications it composes (CORE Story 52 scenario 12)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  const composedAgentNames: (readonly string[])[] = [];
  const commandLine = commandLineOver(adapters);
  const recordingCommandLine: CommandLine = {
    ...commandLine,
    composeApplications: async () => {
      const applications = await commandLine.composeApplications();
      const workspaceSettingsDTO = await applications.workspaceApp.readWorkspaceSettings();
      composedAgentNames.push(workspaceSettingsDTO.type === "Fault" ? [] : workspaceSettingsDTO.data.agents);
      return applications;
    },
  };

  assert.equal((await printedBy(recordingCommandLine, ["init", "--agent", "codex"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await adapters.fileReader.readIfThere(".cw/settings.json")) ?? "{}"), {
    agents: ["codex"],
  });
  const { code, outputText } = await printedBy(recordingCommandLine, ["doctor"]);
  assert.equal(code, EXIT_OK, outputText);
  assert.deepEqual(composedAgentNames.at(-1), ["codex"]);
  assert.match(outputText, /codex/);
});

test("neither the charter nor runtime reads or writes .cw/settings.json: run, each of their operations reaches other files, and only the workspace's store reads it (CORE Story 52 scenario 12)", async () => {
  const adapters = adaptersInMemory(filesReachingEveryAdapter);
  // Every path the engine's file adapters are asked of or answer with; the
  // workspace's store is handed the same files, unrecorded.
  const reachedFilePaths: string[] = [];
  const recordedFileAdapterOf = <FileAdapter extends object>(fileAdapter: FileAdapter): FileAdapter =>
    new Proxy(fileAdapter, {
      get(target, propertyName, receiver) {
        const adapterProperty = Reflect.get(target, propertyName, receiver);
        if (typeof adapterProperty !== "function") return adapterProperty;
        const recordReachedFilePaths = (operationArguments: readonly unknown[], operationAnswer: unknown) => {
          for (const reachedValue of [
            ...operationArguments,
            ...(Array.isArray(operationAnswer) ? operationAnswer : []),
          ])
            reachedFilePaths.push(
              typeof reachedValue === "string" || reachedValue instanceof URL
                ? String(reachedValue)
                : String((reachedValue as { path?: unknown } | undefined)?.path ?? ""),
            );
          return operationAnswer;
        };
        // Answered as the adapter answers, at once or later.
        return (...operationArguments: unknown[]) => {
          const operationAnswer = adapterProperty.apply(target, operationArguments);
          return operationAnswer instanceof Promise
            ? operationAnswer.then((settledOperationAnswer) =>
                recordReachedFilePaths(operationArguments, settledOperationAnswer),
              )
            : recordReachedFilePaths(operationArguments, operationAnswer);
        };
      },
    });
  const composedApplications = await composeApplications(repoFolder, homeFolder, {
    ...pluginsInMemory({
      ...adapters,
      fileReader: recordedFileAdapterOf(adapters.fileReader),
      fileWriter: recordedFileAdapterOf(adapters.fileWriter),
    }),
    workspaceSettingsRepository: new FileWorkspaceSettingsRepository(adapters.fileReader, adapters.fileWriter),
  });

  const operationAnswers = await operationAnswersOf(composedApplications);

  // The settings were read by the workspace's store and handed on: the build
  // was for the agent they name.
  assert.deepEqual(answerOf(await composedApplications.workspaceApp.readWorkspaceSettings()).data.agents, ["claude"]);
  const buildAnswer = operationAnswers.find(({ operationName }) => operationName === "buildCharter")?.answer;
  assert.equal((buildAnswer as { type?: string }).type, "ProjectionPlanSummary", JSON.stringify(buildAnswer));
  assert.ok(
    (buildAnswer as CharterDTOs.ProjectionPlanSummary).data.added.some((addedPath) => addedPath.startsWith(".claude/")),
  );
  assert.ok(reachedFilePaths.length > 0);
  assert.deepEqual(
    reachedFilePaths.filter((reachedFilePath) => /(?:^|\/)\.cw\/settings\.json$/.test(reachedFilePath)),
    [],
  );
});

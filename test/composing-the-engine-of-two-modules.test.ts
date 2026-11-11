import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { composeApplications, composeEngine, type EnginePlugin } from "../src/module/composition.js";
import { AgentCli } from "../src/module/runtime/infra/agent-cli.base.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
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

/** Every adapter that would reach past memory, held in memory, over `files`. */
function adaptersInMemory(files: Readonly<Record<string, string>>) {
  const fileReader = new InMemoryFileReaders(files);
  const fileWriter = new InMemoryFileOutput(fileReader);
  const sourceFetcher = new InMemorySources(fileReader);
  const promptfooRunner = new InMemoryPromptfoo();
  promptfooRunner.folderFiles = fileReader;
  return {
    fileReader,
    fileWriter,
    sourceFetcher,
    worktrees: new InMemoryWorktrees(fileReader),
    credentialsRepository: new InMemoryCredentialsRepository(),
    authorizing: new InMemoryAuthorizing(),
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands({}),
    progressReporter: new InMemoryReporter(),
    mcpServers: new InMemoryMcpServers(),
    clock: new InMemoryClock(new Date("2026-11-10T00:00:00Z")),
    promptfooRunner,
  };
}

/** The engine's plugin over the adapters held in memory: each agent's
 *  projection as this engine ships it, but its command line held in memory,
 *  so no test runs an agent installed on the machine, and the charter kept as
 *  files over them. */
function pluginsInMemory(adapters: ReturnType<typeof adaptersInMemory>): EnginePlugin {
  return {
    ...adapters,
    agentProvider: {
      claude: { projection: new ClaudeProjection(adapters.fileReader), cli: new InMemoryAgentCli() },
      codex: { projection: new CodexProjection(adapters.fileReader), cli: new InMemoryAgentCli() },
    },
    charterRepository: new FileCharterRepository(adapters.fileReader, adapters.fileWriter, adapters.sourceFetcher),
  };
}

/** Every file under `folderUrl`, by its path from there. */
const filePathsUnder = (folderUrl: URL) =>
  readdirSync(folderUrl, { recursive: true, encoding: "utf8" }).filter((filePath) => filePath.endsWith(".ts"));

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

/** What each module's driver port declares, by operation. */
function operationNamesOf(portFileUrl: URL, portName: string): readonly string[] {
  const sourceFile = ts.createSourceFile(
    portFileUrl.pathname,
    readFileSync(portFileUrl, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const portInterface = sourceFile.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === portName,
  );
  assert.ok(portInterface, `${portFileUrl.pathname} declares no ${portName}`);
  return portInterface.members
    .filter(ts.isMethodSignature)
    .map((methodSignature) => methodSignature.name.getText(sourceFile));
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
      code: await new Commander(commandLine, COMMANDS).run(argv),
      result: stdoutTexts.join(""),
      problem: stderrTexts.join(""),
    };
  } finally {
    process.stdout.write = originalWriteByStream.out;
    process.stderr.write = originalWriteByStream.err;
  }
}

const claudeSettings = { enabledAgents: ["claude"] };

test("the engine's modules are charter, with its applications authoring and projection, runtime, and the workspace, each with an application, a domain and its adapters (CORE Story 52 scenario 1)", () => {
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

  const authoringOperationNames = operationNamesOf(
    new URL("charter/app/port/in/authoring-charter.port.ts", moduleFolderUrl),
    "ForAuthoringCharter",
  );
  for (const operationName of ["add", "addVendor", "suites", "evalSuites", "signInWithToken", "test", "accessToken"])
    assert.ok(authoringOperationNames.includes(operationName), `ForAuthoringCharter declares no ${operationName}`);
  const projectingOperationNames = operationNamesOf(
    new URL("charter/app/port/in/building-charter.port.ts", moduleFolderUrl),
    "ForBuildingCharter",
  );
  for (const operationName of [
    "build",
    "preview",
    "doctor",
    "predictMainContext",
    "tools",
    "declaredTools",
    "sensorCommands",
  ])
    assert.ok(projectingOperationNames.includes(operationName), `ForBuildingCharter declares no ${operationName}`);
  const runningOperationNames = operationNamesOf(
    new URL("runtime/app/port/in/running-charter.port.ts", moduleFolderUrl),
    "ForRunningCharter",
  );
  assert.deepEqual([...runningOperationNames].sort(), [
    "analyze",
    "call",
    "countMainContext",
    "evaluate",
    "runSensors",
    "sessionSummary",
  ]);
  const managingOperationNames = operationNamesOf(
    new URL("workspace/app/port/in/managing-workspace.port.ts", moduleFolderUrl),
    "ForManagingWorkspace",
  );
  assert.deepEqual([...managingOperationNames].sort(), ["setUp", "settings"]);
});

test("runtime asks the charter only through charter's applications, and charter asks nothing of runtime (CORE Story 52 scenario 2)", () => {
  for (const filePath of filePathsUnder(new URL("charter/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`charter/${filePath}`, moduleFolderUrl)))
      assert.doesNotMatch(specifier, /runtime\//, `charter/${filePath} imports ${specifier}`);
  for (const filePath of filePathsUnder(new URL("runtime/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`runtime/${filePath}`, moduleFolderUrl)))
      assert.ok(
        !/\/charter\//.test(specifier) || /\/charter\/module\.js$/.test(specifier),
        `runtime/${filePath} imports ${specifier}`,
      );
  // What runtime takes of the charter's module.ts is its applications' ports and what they answer with.
  for (const filePath of filePathsUnder(new URL("runtime/", moduleFolderUrl)))
    for (const importMatch of readFileSync(new URL(`runtime/${filePath}`, moduleFolderUrl), "utf8").matchAll(
      /^import (?:type )?\{ ([^}]+) \} from "[^"]*\/charter\/module\.js";$/gm,
    ))
      for (const importedName of importMatch[1]!.split(", ").map((name) => name.replace(/^type /, "")))
        assert.ok(
          ["ForAuthoringCharter", "ForBuildingCharter", "CharterDTOs", "AgentProviderName"].includes(importedName),
          `runtime/${filePath} takes ${importedName} of the charter`,
        );
  for (const filePath of filePathsUnder(new URL("shared/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`shared/${filePath}`, moduleFolderUrl)))
      assert.doesNotMatch(specifier, /\/(charter|runtime)\//, `shared/${filePath} imports ${specifier}`);
  const runningCharterText = readFileSync(new URL("runtime/app/running-charter.use-case.ts", moduleFolderUrl), "utf8");
  assert.match(runningCharterText, /\bForBuildingCharter\b[^;]*from "\.\.\/\.\.\/charter\/module\.js";/);
  assert.match(runningCharterText, /\bForAuthoringCharter\b[^;]*from "\.\.\/\.\.\/charter\/module\.js";/);
});

test("the published package composes the engine of its modules and the adapters cw's plugin is built from, exporting only how to compose it and the ports a tool may replace, and no command line or portal (CORE Story 52 scenario 3)", () => {
  const libraryIndexText = readFileSync(new URL("src/index.ts", repositoryUrl), "utf8");
  const exportedPaths = [...libraryIndexText.matchAll(/^export .* from "\.\/([^"]+)";$/gm)].map(
    (exportMatch) => exportMatch[1]!,
  );
  assert.ok(exportedPaths.length > 0);
  for (const exportedPath of exportedPaths)
    assert.match(exportedPath, /^module\/(?:(?:charter|runtime|shared|workspace)\/module|composition)\.js$/);
  // No use case, store or runner is exported: the engine's own are composed
  // in where a tool hands none (CORE-FR-228, SDK-FR-020).
  for (const internalName of [
    "AuthoringCharter",
    "BuildingCharter",
    "RunningCharter",
    "FileCharterRepository",
    "ClaudeProjection",
    "CodexProjection",
    "ClaudeCli",
    "CodexCli",
    "FileReaders",
    "FileOutput",
    "composeEngine",
    "EnginePlugin",
  ])
    assert.doesNotMatch(libraryIndexText, new RegExp(`^export \\{[^}]*\\b${internalName}\\b`, "m"), internalName);
  // Read as one line, however the formatter wraps it.
  assert.match(
    libraryIndexText.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/,? \)/g, ")"),
    /export const composeApplications: \(repoFolder: URL, homeFolder: URL, plugin\?: Partial<ReplaceableAdapters>\) => Promise<ComposedApplications> = /,
  );
  // pnpm test builds first, so the library read is this working tree's.
  const builtLibraryText = readFileSync(new URL("dist/index.js", repositoryUrl), "utf8");
  assert.doesNotMatch(builtLibraryText, /^\/\/ (?:main\.ts|src\/presentation\/)/m);
  assert.match(builtLibraryText, /^\/\/ src\/module\/charter\/infra\/file-charter\.repository\.ts$/m);
  assert.match(builtLibraryText, /^\/\/ src\/module\/composition\.ts$/m);
});

test("an engine composed with a plugin of the author's own builds and evaluates for its agent as it does with the plugin shipped (CORE Story 52 scenario 4)", async () => {
  const askedAgentNames: string[] = [];
  class OwnClaudeProjection extends ClaudeProjection {}
  class OwnAgentCli extends AgentCli {
    async isInstalled(): Promise<boolean> {
      askedAgentNames.push("claude");
      return true;
    }
  }
  const ownAdapters = adaptersInMemory(filesInThreeParts);
  const ownEngine = composeEngine(repoFolder, homeFolder, claudeSettings, {
    ...pluginsInMemory(ownAdapters),
    agentProvider: { claude: { projection: new OwnClaudeProjection(ownAdapters.fileReader), cli: new OwnAgentCli() } },
  });
  const shippedAdapters = adaptersInMemory(filesInThreeParts);
  const shippedPlugins = pluginsInMemory(shippedAdapters);
  const shippedEngine = composeEngine(repoFolder, homeFolder, claudeSettings, {
    ...shippedPlugins,
    agentProvider: { claude: shippedPlugins.agentProvider["claude"]! },
  });

  assert.equal(
    JSON.stringify(await ownEngine.charterBuildingApp.build()),
    JSON.stringify(await shippedEngine.charterBuildingApp.build()),
  );
  assert.equal(
    JSON.stringify(await ownEngine.charterRuntimeApp.evaluate()),
    JSON.stringify(await shippedEngine.charterRuntimeApp.evaluate()),
  );
  assert.deepEqual(askedAgentNames, ["claude"]);
});

test("the eval cases are listed, added, rewritten and removed by the one store that keeps the charter, as the test cases are (CORE Story 52 scenario 5)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  const { charterAuthoringApp } = composeEngine(repoFolder, homeFolder, claudeSettings, pluginsInMemory(adapters));
  const evalFilePathsOf = async () =>
    (await adapters.fileReader.readFilesRecursively(".cw/charter/eval")).map(({ path }) => path).sort();

  assert.deepEqual(
    answerOf(await charterAuthoringApp.evalSuites()).data.evalSuites.map(({ data }) => data.name),
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

test("every command and the portal are handed the applications of the modules and nothing else (CORE Story 52 scenario 6)", () => {
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
  const { charterBuildingApp } = composeEngine(repoFolder, homeFolder, claudeSettings, pluginsInMemory(oldWayAdapters));
  assert.match(JSON.stringify(await charterBuildingApp.build()), /laid out the old way/);
});

test("a vendor source laid out the old way is refused, naming the source and the authoring skill, and nothing is installed (CORE Story 52 scenario 9)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  adapters.sourceFetcher.sourceFilesBySource["team/old"] = { ".cw/charter/guide/published/index.md": publishedText };
  const { charterAuthoringApp } = composeEngine(repoFolder, homeFolder, claudeSettings, pluginsInMemory(adapters));

  const vendorAddAnswer = await charterAuthoringApp.addVendor("team/old");

  assert.equal(vendorAddAnswer.type, "Fault");
  const { message, fix } = (vendorAddAnswer as FaultDTOs.Fault).data;
  assert.match(message, /team\/old/);
  assert.match(message, /laid out the old way/);
  assert.match(fix ?? "", /cw-author/);
  assert.deepEqual(await adapters.fileReader.readBytesRecursively(".cw/charter/vendor"), []);
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
    answerOf(
      await composeEngine(repoFolder, homeFolder, claudeSettings, pluginsInMemory(adapters)).charterBuildingApp.build(),
    );
    return (await adapters.fileReader.readBytesRecursively("")).filter(
      ({ path }) => !path.startsWith(".cw/charter/") && path !== ".cw/settings.json",
    );
  };
  assert.deepEqual(await builtFilesOf(movedFiles), await builtFilesOf(filesInThreeParts));
});

test("an evaluation keeps each case's working copy and what its run leaves under the log, which version control ignores (CORE Story 52 scenario 11)", async () => {
  const adapters = adaptersInMemory({ ...filesInThreeParts, [repoFileUrlOf(".cw/.gitignore")]: "log/\n" });
  const { charterRuntimeApp } = composeEngine(repoFolder, homeFolder, claudeSettings, pluginsInMemory(adapters));

  answerOf(await charterRuntimeApp.evaluate());

  const [evaluatedTest] = adapters.promptfooRunner.evaluatedTests;
  assert.match(evaluatedTest?.workingPath ?? "", /^\.cw\/log\/eval\/worktrees\//);
  assert.match((await adapters.fileReader.readIfThere(".cw/.gitignore")) ?? "", /^log\/$/m);
  const promptfooAdapterText = readFileSync(new URL("runtime/infra/promptfoo.adapter.ts", moduleFolderUrl), "utf8");
  assert.match(promptfooAdapterText, /"\.cw\/log\/eval\/runs"/);
});

test("the workspace module keeps which agents are enabled in .cw/settings.json, and the command line hands them to the applications it composes; neither the charter nor runtime reads them (CORE Story 52 scenario 12)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  const composedAgentNames: (readonly string[])[] = [];
  const commandLine = commandLineOver(adapters);
  const recordingCommandLine: CommandLine = {
    ...commandLine,
    composeApplications: async () => {
      const applications = await commandLine.composeApplications();
      const workspaceSettingsDTO = await applications.workspaceApp.settings();
      composedAgentNames.push(workspaceSettingsDTO.type === "Fault" ? [] : workspaceSettingsDTO.data.agents);
      return applications;
    },
  };

  assert.equal((await printedBy(recordingCommandLine, ["init", "--agent", "codex"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await adapters.fileReader.readIfThere(".cw/settings.json")) ?? "{}"), {
    agents: ["codex"],
  });
  const { code, result } = await printedBy(recordingCommandLine, ["doctor"]);
  assert.equal(code, EXIT_OK, result);
  assert.deepEqual(composedAgentNames.at(-1), ["codex"]);
  assert.match(result, /codex/);

  for (const filePath of readdirSync(moduleFolderUrl, { recursive: true, encoding: "utf8" }).filter(
    (path) =>
      /^(?:charter|runtime)\//.test(path) &&
      path.endsWith(".ts") &&
      !path.includes("/infra/") &&
      !path.includes("/builtin/"),
  ))
    assert.doesNotMatch(
      readFileSync(new URL(filePath, moduleFolderUrl), "utf8"),
      /settings\.json/,
      `${filePath} names the settings file`,
    );
});

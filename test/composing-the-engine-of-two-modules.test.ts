import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { composeEngine } from "../src/module/composition.js";
import type { ForManagingCharter } from "../src/module/charter/app/port/out/managing-charter.port.js";
import type { ForRunningPromptfoo } from "../src/module/runtime/app/port/out/running-promptfoo.port.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.js";
import { RawTestSuite } from "../src/module/charter/domain/models/test/raw-test-suite.js";
import { RawEvalSuite } from "../src/module/charter/domain/models/eval/raw-eval-suite.js";
import { SourceCharter } from "../src/module/charter/domain/models/vendor/vendor-source.js";
import { RawVendorSource } from "../src/module/charter/domain/models/vendor/raw-vendor-source.js";
import { CopyPlan } from "../src/module/charter/domain/models/projection/projection-plan.js";
import { VendorSourceOrigin } from "../src/module/charter/domain/models/vendor/vendor-source-origin.js";
import { VendorRoot } from "../src/module/charter/domain/models/vendor/vendor-root.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import type { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK, type CommandLine } from "../src/presentation/cli/commands/command.interface.js";
import type { WorkspaceSettings } from "../src/presentation/cli/commands/command.interface.js";
import { composeWorkspace } from "../src/module/composition.js";
import { answerOf } from "./answer-of.js";
import { OUT_FOLDER, placeOfPart } from "../src/module/charter/infra/helper.js";

const repositoryUrl = new URL("../", import.meta.url);
const moduleFolderUrl = new URL("src/module/", repositoryUrl);
const repoFolder = new URL("file:///repo/");
const homeFolder = new URL("file:///home/");
const repoFileUrlOf = (path: string) => new URL(path, repoFolder).href;

const keptGuideText = "---\nkind: guide\nid: kept-guide\ndescription: A guide kept by its kind and id.\nglobs: [\"src/**/*.ts\"]\n---\nKeep it.\n";
const keptSkillText = "---\nkind: skill\nid: kept-skill\ndescription: Keep it.\ntriggers: [\"keep it\"]\n---\nKeep it.\n";
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
  const agentCli = new InMemoryAgentCli();
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
    agentCliByProvider: { claude: agentCli, codex: agentCli },
    promptfooRunner,
  };
}

/** A charter kept by a tool author's own store, as a database would keep it:
 *  each primitive by its kind and id, each suite by its name, each vendor by
 *  its name, through the one port. */
function charterKeptInOwnStore() {
  const rawPrimitiveByKey = new Map<string, RawPrimitive>();
  const testSuiteTextByName = new Map<string, string>([["kept.json", testSuiteText]]);
  const evalSuiteTextByName = new Map<string, string>([["skills.json", evalSuiteText]]);
  const installedVendorNames = new Set<string>();
  const rawPrimitiveOf = (kind: string, id: string, text: string, assets: RawPrimitive["assets"] = []) => new RawPrimitive(PrimitiveLayer.REPO, kind, id, text, assets, `db://charter:${kind}/${id}`);
  rawPrimitiveByKey.set("guide/kept-guide", rawPrimitiveOf("guide", "kept-guide", keptGuideText));
  rawPrimitiveByKey.set("skill/kept-skill", rawPrimitiveOf("skill", "kept-skill", keptSkillText));
  const rawVendorSource = new RawVendorSource(new VendorSourceOrigin("team/source", "team/source"), "team/source", new SourceCharter("", true, false, [new RawPrimitive(PrimitiveLayer.REPO, "guide", "published", publishedText, [], "db://source:guide/published")], "", "", ".cw/charter/primitive"), [], []);
  const charterRepository: ForManagingCharter = {
    async loadLaidText() {
      // What a build laid is the output writer's, kept elsewhere: this store
      // has read none of it back.
      return undefined;
    },
    findPlace(outputPart) {
      // Laid where the files' output writer lays it, so a part is named the
      // same whichever store keeps the charter.
      return placeOfPart(outputPart);
    },
    findOutputFolder() {
      return OUT_FOLDER;
    },
    async loadCharter() {
      return [...rawPrimitiveByKey.values()];
    },
    async createCharter() {},
    async assertLayout() {},
    async addPrimitive({ kind, id, text, assets }) {
      const rawPrimitive = rawPrimitiveOf(kind, id, text, assets);
      rawPrimitiveByKey.set(`${kind}/${id}`, rawPrimitive);
      return rawPrimitive.uri;
    },
    async injectPrimitives(rawPrimitives) {
      return Promise.all(rawPrimitives.map((rawPrimitive) => this.addPrimitive(rawPrimitive)));
    },
    findCharterUri() {
      return "db://charter";
    },
    async rewritePrimitive(primitive) {
      rawPrimitiveByKey.set(`${primitive.kind}/${primitive.headers.id}`, rawPrimitiveOf(primitive.kind, primitive.headers.id, primitive.toMarkdown()));
    },
    async removePrimitive(primitive) {
      rawPrimitiveByKey.delete(`${primitive.kind}/${primitive.headers.id}`);
    },
    async fetchVendorSource() {
      return rawVendorSource;
    },
    async cleanupVendorSource() {},
    async loadVendorRoot() {
      const installedVendors = [...installedVendorNames].map((vendorName) => ({ name: vendorName, uri: `db://vendor:${vendorName}` }));
      return new VendorRoot(installedVendors);
    },
    async storeVendor(_vendorSource, { projectionPlan }) {
      // The vendor each folder copied lands in: `.cw/charter/vendor/<name>/primitive`.
      for (const copyPlan of projectionPlan) if (copyPlan instanceof CopyPlan) installedVendorNames.add(copyPlan.destinationPath.split("/").slice(3, 6).join("/"));
    },
    findVendorUri(vendorName) {
      return `db://vendor:${vendorName}`;
    },
    async removeVendor(vendorName) {
      installedVendorNames.delete(vendorName);
    },
    async loadTestSuites() {
      return [...testSuiteTextByName].map(([name, text]) => new RawTestSuite(name, text, `db://test:${name}`));
    },
    async writeTestSuite(name, testSuite) {
      testSuiteTextByName.set(name, testSuite.body);
    },
    async removeTestSuite(name) {
      testSuiteTextByName.delete(name);
    },
    async loadEvalSuites() {
      return [...evalSuiteTextByName].map(([name, text]) => new RawEvalSuite(name, text, `db://eval:${name}`));
    },
    async writeEvalSuite(name, evalSuiteText) {
      evalSuiteTextByName.set(name, evalSuiteText);
    },
    async removeEvalSuite(name) {
      evalSuiteTextByName.delete(name);
    },
  };
  return { charterRepository, rawPrimitiveByKey, evalSuiteTextByName, installedVendorNames };
}

/** A runner of a tool author's own: it answers every case as passed, and
 *  keeps each prompt it was handed. */
function promptfooRunnerOfOwn() {
  const evaluatedPrompts: string[] = [];
  const promptfooRunner: ForRunningPromptfoo = {
    installFolderPath: "own://promptfoo",
    async isInstalled() {
      return true;
    },
    async install() {},
    async readLogs() {
      return [];
    },
    async evaluate({ prompt }) {
      evaluatedPrompts.push(prompt);
      return { success: true, totalTokens: 7, componentResults: [] };
    },
  };
  return { promptfooRunner, evaluatedPrompts };
}

/** Answers said the same way whichever store answered: each place a store
 *  kept something said by what it is. */
const answerTextOf = (answer: unknown) =>
  JSON.stringify(answer)
    .replace(/file:\/\/\/repo\/\.cw\/charter\/primitive\/([a-z]+)\/([^"]+)\/index\.md/g, "kept:$1/$2")
    .replace(/db:\/\/charter:([a-z]+)\/([^"]+?)(?=["\s.,])/g, "kept:$1/$2")
    .replace(/file:\/\/\/repo\/\.cw\/charter\/test\/([^"]+)/g, "kept-test:$1")
    .replace(/db:\/\/test:([^"]+)/g, "kept-test:$1")
    .replace(/file:\/\/\/repo\/\.cw\/charter\/eval\/([^"]+)/g, "kept-eval:$1")
    .replace(/db:\/\/eval:([^"]+)/g, "kept-eval:$1");

/** Every file under `folderUrl`, by its path from there. */
const filePathsUnder = (folderUrl: URL) => readdirSync(folderUrl, { recursive: true, encoding: "utf8" }).filter((filePath) => filePath.endsWith(".ts"));

/** Each module specifier a source file imports or re-exports. */
function importedSpecifiersOf(fileUrl: URL): readonly string[] {
  const sourceFile = ts.createSourceFile(fileUrl.pathname, readFileSync(fileUrl, "utf8"), ts.ScriptTarget.Latest, true);
  return sourceFile.statements
    .filter((statement): statement is ts.ImportDeclaration | ts.ExportDeclaration => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    .flatMap((statement) => (statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : []));
}

/** What each module's driver port declares, by operation. */
function operationNamesOf(portFileUrl: URL, portName: string): readonly string[] {
  const sourceFile = ts.createSourceFile(portFileUrl.pathname, readFileSync(portFileUrl, "utf8"), ts.ScriptTarget.Latest, true);
  const portInterface = sourceFile.statements.find((statement): statement is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(statement) && statement.name.text === portName);
  assert.ok(portInterface, `${portFileUrl.pathname} declares no ${portName}`);
  return portInterface.members.filter(ts.isMethodSignature).map((methodSignature) => methodSignature.name.getText(sourceFile));
}

/** The command line over the adapters handed, as main.ts composes it: the
 *  workspace files it keeps itself over the same files, and the engine
 *  composed for the settings it reads. */
function commandLineOver(adapters: ReturnType<typeof adaptersInMemory>, handedAdapters: Parameters<typeof composeEngine>[3] = {}): CommandLine {
  return {
    cwd: "/repo",
    version: "0.0.0",
    workspaceApp: composeWorkspace(repoFolder, { fileReader: adapters.fileReader, fileWriter: adapters.fileWriter, progressReporter: adapters.progressReporter }),
    engineFactory: (workspaceSettings) => composeEngine(repoFolder, homeFolder, workspaceSettings, { ...adapters, ...handedAdapters }),
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
    return { code: await new Commander(commandLine, COMMANDS).run(argv), result: stdoutTexts.join(""), problem: stderrTexts.join("") };
  } finally {
    process.stdout.write = originalWriteByStream.out;
    process.stderr.write = originalWriteByStream.err;
  }
}

const claudeSettings = { agents: ["claude"] };

test("the engine's modules are charter, with its applications authoring and projection, runtime, and the workspace, each with an application, a domain and its adapters (CORE Story 52 scenario 1)", () => {
  assert.deepEqual(readdirSync(moduleFolderUrl, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(), ["charter", "runtime", "shared", "workspace"]);
  for (const moduleName of ["charter", "runtime", "workspace"])
    for (const layerName of ["app", "app/port/in", "app/port/out", "domain", "infra"]) assert.ok(existsSync(new URL(`${moduleName}/${layerName}/`, moduleFolderUrl)), `${moduleName} has no ${layerName}`);
  assert.equal(existsSync(new URL("src/zdriven/", repositoryUrl)), false, "src/zdriven/ is still there");

  const authoringOperationNames = operationNamesOf(new URL("charter/app/port/in/authoring-charter.port.ts", moduleFolderUrl), "ForAuthoringCharter");
  for (const operationName of ["add", "addVendor", "suites", "evalSuites", "signInWithToken", "test", "accessToken"]) assert.ok(authoringOperationNames.includes(operationName), `ForAuthoringCharter declares no ${operationName}`);
  const projectingOperationNames = operationNamesOf(new URL("charter/app/port/in/building-charter.port.ts", moduleFolderUrl), "ForBuildingCharter");
  for (const operationName of ["build", "preview", "doctor", "predictMainContext", "tools", "declaredTools", "sensorCommands"]) assert.ok(projectingOperationNames.includes(operationName), `ForBuildingCharter declares no ${operationName}`);
  const runningOperationNames = operationNamesOf(new URL("runtime/app/port/in/running-charter.port.ts", moduleFolderUrl), "ForRunningCharter");
  assert.deepEqual([...runningOperationNames].sort(), ["analyze", "call", "countMainContext", "evaluate", "runSensors", "sessionSummary"]);
  const managingOperationNames = operationNamesOf(new URL("workspace/app/port/in/managing-workspace.port.ts", moduleFolderUrl), "ForManagingWorkspace");
  assert.deepEqual([...managingOperationNames].sort(), ["setUp", "settings"]);
});

test("runtime asks the charter only through charter's applications, and charter asks nothing of runtime (CORE Story 52 scenario 2)", () => {
  for (const filePath of filePathsUnder(new URL("charter/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`charter/${filePath}`, moduleFolderUrl))) assert.doesNotMatch(specifier, /runtime\//, `charter/${filePath} imports ${specifier}`);
  for (const filePath of filePathsUnder(new URL("runtime/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`runtime/${filePath}`, moduleFolderUrl)))
      assert.ok(!/\/charter\//.test(specifier) || /\/charter\/module\.js$/.test(specifier), `runtime/${filePath} imports ${specifier}`);
  // What runtime takes of the charter's module.ts is its applications' ports and what they answer with.
  for (const filePath of filePathsUnder(new URL("runtime/", moduleFolderUrl)))
    for (const importMatch of readFileSync(new URL(`runtime/${filePath}`, moduleFolderUrl), "utf8").matchAll(/^import (?:type )?\{ ([^}]+) \} from "[^"]*\/charter\/module\.js";$/gm))
      for (const importedName of importMatch[1]!.split(", ").map((name) => name.replace(/^type /, "")))
        assert.ok(["ForAuthoringCharter", "ForBuildingCharter", "CharterDTOs", "AgentProviderName"].includes(importedName), `runtime/${filePath} takes ${importedName} of the charter`);
  for (const filePath of filePathsUnder(new URL("shared/", moduleFolderUrl)))
    for (const specifier of importedSpecifiersOf(new URL(`shared/${filePath}`, moduleFolderUrl))) assert.doesNotMatch(specifier, /\/(charter|runtime)\//, `shared/${filePath} imports ${specifier}`);
  const runningCharterText = readFileSync(new URL("runtime/app/running-charter.use-case.ts", moduleFolderUrl), "utf8");
  assert.match(runningCharterText, /\bForBuildingCharter\b[^;]*from "\.\.\/\.\.\/charter\/module\.js";/);
  assert.match(runningCharterText, /\bForAuthoringCharter\b[^;]*from "\.\.\/\.\.\/charter\/module\.js";/);
});

test("the published engine package holds the modules' applications and domains, and no adapter (CORE Story 52 scenario 3)", () => {
  const engineIndexText = readFileSync(new URL("packages/engine/index.ts", repositoryUrl), "utf8");
  const exportedPaths = [...engineIndexText.matchAll(/^export .* from "\.\.\/\.\.\/(src\/[^"]+)";$/gm)].map((exportMatch) => exportMatch[1]!);
  assert.ok(exportedPaths.length > 0);
  for (const exportedPath of exportedPaths) assert.match(exportedPath, /^src\/module\/(?:charter|runtime|shared)\/module\.js$/);
  for (const useCaseName of ["AuthoringCharter", "BuildingCharter", "RunningCharter"]) assert.match(engineIndexText, new RegExp(`export \\{ ${useCaseName} \\}`));
  assert.doesNotMatch(engineIndexText, /src\/module\/workspace\//);
  // Built here, into a folder of its own, so what is read is this source as it
  // stands, never a build left over, and no other test's build is touched.
  const builtEngineFolderPath = mkdtempSync(join(tmpdir(), "cw-engine-build-"));
  execFileSync(new URL("node_modules/.bin/tsup", repositoryUrl).pathname, ["--config", "packages/engine/tsup.config.ts", "--out-dir", builtEngineFolderPath], { cwd: new URL(".", repositoryUrl), stdio: "ignore" });
  const builtEngineText = readFileSync(join(builtEngineFolderPath, "index.js"), "utf8");
  assert.doesNotMatch(builtEngineText, /^\/\/ src\/(?:presentation\/|module\/composition\.ts|module\/[\w-]+\/infra\/)/m);
});

test("an engine composed with a charter store and a runner of the author's own answers as it does with the defaults (CORE Story 52 scenario 4)", async () => {
  const { charterRepository, rawPrimitiveByKey, installedVendorNames } = charterKeptInOwnStore();
  const { promptfooRunner, evaluatedPrompts } = promptfooRunnerOfOwn();
  const ownEngine = composeEngine(repoFolder, homeFolder, claudeSettings, { ...adaptersInMemory({ [repoFileUrlOf(".cw/settings.json")]: settingsText }), charterRepository, promptfooRunner });
  const filesAdapters = adaptersInMemory(filesInThreeParts);
  filesAdapters.sourceFetcher.sourceFilesBySource["team/source"] = { ".cw/charter/primitive/guide/published/index.md": publishedText };
  const filesEngine = composeEngine(repoFolder, homeFolder, claudeSettings, { ...filesAdapters, promptfooRunner: promptfooRunnerOfOwn().promptfooRunner });

  assert.equal(answerTextOf(await ownEngine.charterBuildingApp.doctor()), answerTextOf(await filesEngine.charterBuildingApp.doctor()));
  assert.equal(answerTextOf(await ownEngine.charterAuthoringApp.test()), answerTextOf(await filesEngine.charterAuthoringApp.test()));
  assert.equal(answerTextOf(await ownEngine.charterBuildingApp.preview()), answerTextOf(await filesEngine.charterBuildingApp.preview()));
  assert.equal(answerTextOf(await ownEngine.charterBuildingApp.build()), answerTextOf(await filesEngine.charterBuildingApp.build()));
  assert.equal(answerTextOf(await ownEngine.charterRuntimeApp.evaluate()), answerTextOf(await filesEngine.charterRuntimeApp.evaluate()));
  assert.deepEqual(evaluatedPrompts, ["keep it"]);
  const primitivesOf = (vendorAddAnswer: unknown) => answerOf(vendorAddAnswer as FaultDTOs.Fault | CharterDTOs.VendorAddOutcome).data.map(({ primitives }) => primitives);
  assert.deepEqual(primitivesOf(await ownEngine.charterAuthoringApp.addVendor("team/source")), primitivesOf(await filesEngine.charterAuthoringApp.addVendor("team/source")));
  assert.deepEqual([...installedVendorNames], ["team/source/root"]);
  assert.equal(rawPrimitiveByKey.has("guide/kept-guide"), true);
});

test("the eval cases are listed, added, rewritten and removed through the charter repository of the charter module (CORE Story 52 scenario 5)", async () => {
  const { charterRepository, evalSuiteTextByName } = charterKeptInOwnStore();
  const { charterAuthoringApp } = composeEngine(repoFolder, homeFolder, claudeSettings, { ...adaptersInMemory({}), charterRepository });

  assert.deepEqual(answerOf(await charterAuthoringApp.evalSuites()).data.evalSuites.map(({ data }) => data.name), ["skills.json"]);
  const addedName = answerOf(await charterAuthoringApp.addEvalSuite()).data.name;
  assert.ok(evalSuiteTextByName.has(addedName));
  const rewrittenText = `${JSON.stringify({ cases: [{ prompt: "rewrite it", expect: { follow: "kept-guide" } }] })}\n`;
  answerOf(await charterAuthoringApp.writeEvalSuite(addedName, rewrittenText));
  assert.equal(evalSuiteTextByName.get(addedName), rewrittenText);
  answerOf(await charterAuthoringApp.removeEvalSuite(addedName));
  assert.deepEqual([...evalSuiteTextByName.keys()], ["skills.json"]);

  const filesAdapters = adaptersInMemory({});
  const filesAuthoringApp = composeEngine(repoFolder, homeFolder, claudeSettings, filesAdapters).charterAuthoringApp;
  const filesAddedName = answerOf(await filesAuthoringApp.addEvalSuite()).data.name;
  assert.deepEqual((await filesAdapters.fileReader.readFilesRecursively(".cw/charter/eval")).map(({ path }) => path), [`.cw/charter/eval/${filesAddedName}`]);
});

test("every command and the portal are handed the applications of the modules and nothing else (CORE Story 52 scenario 6)", () => {
  const contextText = readFileSync(new URL("src/presentation/cli/commands/command.interface.ts", repositoryUrl), "utf8");
  assert.deepEqual([...contextText.matchAll(/^ {2}readonly \w+App: (For\w+);$/gm)].map((appMatch) => appMatch[1]!).sort(), ["ForAuthoringCharter", "ForBuildingCharter", "ForManagingWorkspace", "ForRunningCharter"]);
  const portalRoutesText = readFileSync(new URL("src/presentation/portal/portal.routes.ts", repositoryUrl), "utf8");
  assert.deepEqual(
    [...portalRoutesText.matchAll(/^import (?:type )?\{ ([^}]+) \} from "#module\/[\w-]+\/module\.js";$/gm)].flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, ""))).filter((importedName) => importedName.startsWith("For")).sort(),
    ["ForAuthoringCharter", "ForBuildingCharter"],
  );
  const mainText = readFileSync(new URL("main.ts", repositoryUrl), "utf8");
  assert.match(mainText, /composeEngine\(/);
  assert.match(mainText, /composeWorkspace\(/);
  assert.doesNotMatch(mainText, /new (?:AuthoringCharter|BuildingCharter|RunningCharter|ManagingWorkspace)\(/);
});

test("a repository set up holds the charter with its primitives, tests, eval cases and vendors under it, the output and the log (CORE Story 52 scenario 7)", async () => {
  const adapters = adaptersInMemory({});

  const { code } = await printedBy(commandLineOver(adapters), ["init", "--agent", "claude"]);

  assert.equal(code, EXIT_OK);
  const keptPaths = (await adapters.fileReader.readBytesRecursively(".cw")).map(({ path }) => path);
  assert.ok(keptPaths.includes(".cw/settings.json"));
  assert.ok(keptPaths.some((path) => path.startsWith(".cw/charter/primitive/guide/")));
  for (const partPath of [".cw/charter/test/", ".cw/charter/eval/", ".cw/charter/vendor/", ".cw/out/"]) assert.ok(keptPaths.some((path) => path.startsWith(partPath)), `nothing under ${partPath}`);
  assert.deepEqual(keptPaths.filter((path) => /^\.cw\/(?:test|eval|vendor)\//.test(path)), []);
  assert.match((await adapters.fileReader.readIfThere(".cw/.gitignore")) ?? "", /^log\/$/m);
});

test("every command refuses a repository laid out the old way, naming the authoring skill (CORE Story 52 scenario 8)", async () => {
  // Every command, each argument it requires given a value: the refusal comes
  // before any of them is run.
  for (const argv of COMMANDS.map((command) => command.name.split(" ").map((commandWord) => (commandWord.startsWith("<") ? "x" : commandWord)))) {
    const { code, problem } = await printedBy(commandLineOver(adaptersInMemory(filesLaidOutTheOldWay)), argv);
    assert.equal(code, EXIT_FAILURE, argv.join(" "));
    assert.match(problem, /laid out the old way/, argv.join(" "));
    assert.match(problem, /cw-author/, argv.join(" "));
  }
  const { charterBuildingApp } = composeEngine(repoFolder, homeFolder, claudeSettings, adaptersInMemory(filesLaidOutTheOldWay));
  assert.match(JSON.stringify(await charterBuildingApp.build()), /laid out the old way/);
});

test("a vendor source laid out the old way is refused, naming the source and the authoring skill, and nothing is installed (CORE Story 52 scenario 9)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  adapters.sourceFetcher.sourceFilesBySource["team/old"] = { ".cw/charter/guide/published/index.md": publishedText };
  const { charterAuthoringApp } = composeEngine(repoFolder, homeFolder, claudeSettings, adapters);

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
    oldPath!.includes("<kind>") ? Primitives.kinds.map((kind) => [oldPath!.replace("<kind>", kind), newPath!.replace("<kind>", kind)] as const) : [[oldPath!, newPath!] as const],
  );
  assert.ok(movedPathPairs.length >= 4, skillBody);

  const movedFiles = Object.fromEntries(
    Object.entries(filesLaidOutTheOldWay).map(([fileUrl, contents]) => {
      const filePath = fileUrl.slice(repoFolder.href.length);
      const movedPathPair = movedPathPairs.find(([oldPath]) => filePath.startsWith(oldPath));
      return [repoFileUrlOf(movedPathPair === undefined ? filePath : `${movedPathPair[1]}${filePath.slice(movedPathPair[0].length)}`), contents];
    }),
  );
  assert.deepEqual(Object.keys(movedFiles).sort(), Object.keys(filesInThreeParts).sort());

  const builtFilesOf = async (files: Readonly<Record<string, string>>) => {
    const adapters = adaptersInMemory(files);
    answerOf(await composeEngine(repoFolder, homeFolder, claudeSettings, adapters).charterBuildingApp.build());
    return (await adapters.fileReader.readBytesRecursively("")).filter(({ path }) => !path.startsWith(".cw/charter/") && path !== ".cw/settings.json");
  };
  assert.deepEqual(await builtFilesOf(movedFiles), await builtFilesOf(filesInThreeParts));
});

test("an evaluation keeps each case's working copy and what its run leaves under the log, which version control ignores (CORE Story 52 scenario 11)", async () => {
  const adapters = adaptersInMemory({ ...filesInThreeParts, [repoFileUrlOf(".cw/.gitignore")]: "log/\n" });
  const { charterRuntimeApp } = composeEngine(repoFolder, homeFolder, claudeSettings, adapters);

  answerOf(await charterRuntimeApp.evaluate());

  const [evaluatedTest] = adapters.promptfooRunner.evaluatedTests;
  assert.match(evaluatedTest?.workingPath ?? "", /^\.cw\/log\/eval\/worktrees\//);
  assert.match((await adapters.fileReader.readIfThere(".cw/.gitignore")) ?? "", /^log\/$/m);
  const promptfooAdapterText = readFileSync(new URL("runtime/infra/promptfoo.adapter.ts", moduleFolderUrl), "utf8");
  assert.match(promptfooAdapterText, /"\.cw\/log\/eval\/runs"/);
});

test("the workspace module keeps which agents are enabled in .cw/settings.json, and the command line hands them to the applications it composes; neither the charter nor runtime reads them (CORE Story 52 scenario 12)", async () => {
  const adapters = adaptersInMemory(filesInThreeParts);
  const composedSettings: WorkspaceSettings[] = [];
  const commandLine = commandLineOver(adapters);
  const recordingCommandLine: CommandLine = { ...commandLine, engineFactory: (workspaceSettings) => (composedSettings.push(workspaceSettings), commandLine.engineFactory(workspaceSettings)) };

  assert.equal((await printedBy(recordingCommandLine, ["init", "--agent", "codex"])).code, EXIT_OK);
  assert.deepEqual(JSON.parse((await adapters.fileReader.readIfThere(".cw/settings.json")) ?? "{}"), { agents: ["codex"] });
  const { code, result } = await printedBy(recordingCommandLine, ["doctor"]);
  assert.equal(code, EXIT_OK, result);
  assert.deepEqual(composedSettings.at(-1)?.agents, ["codex"]);
  assert.match(result, /codex/);

  for (const filePath of readdirSync(moduleFolderUrl, { recursive: true, encoding: "utf8" }).filter((path) => /^(?:charter|runtime)\//.test(path) && path.endsWith(".ts") && !path.includes("/infra/") && !path.includes("/builtin/")))
    assert.doesNotMatch(readFileSync(new URL(filePath, moduleFolderUrl), "utf8"), /settings\.json/, `${filePath} names the settings file`);
});

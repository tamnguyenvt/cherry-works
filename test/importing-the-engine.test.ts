import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { build as tsupBuild } from "tsup";
import packageJson from "../package.json" with { type: "json" };

const repositoryUrl = new URL("../", import.meta.url);
let consumerFolder: string;
let libraryPackageJson: { name: string; version: string; license: string; dependencies?: Record<string, string>; exports: Record<string, unknown> };

before(async () => {
  consumerFolder = await mkdtemp(join(tmpdir(), "cw-engine-consumer-"));
  const packRun = spawnSync("npm", ["pack", "--json", "--pack-destination", consumerFolder], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(packRun.status, 0, packRun.stderr || packRun.error?.message);
  const tarballName: string = JSON.parse(packRun.stdout)[0].filename;
  await writeFile(join(consumerFolder, "package.json"), '{"private":true,"type":"module"}\n');
  const installRun = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(consumerFolder, tarballName)], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(installRun.status, 0, installRun.stderr);
  libraryPackageJson = JSON.parse(await readFile(join(consumerFolder, "node_modules/cherry-works/package.json"), "utf8"));
  // The package hands a tool the adapters cw's plugin is built from, the
  // charter's store and each agent's projection among them (SDK-FR-005), but
  // not the one that lays a build as files, which the engine composes
  // itself, nor one keeping credentials in memory: a tool author brings
  // those, as these are, bundled on their own and taking of the engine only
  // its ports.
  const adapterEntryPath = join(consumerFolder, "own-adapters.ts");
  await writeFile(
    adapterEntryPath,
    ["module/charter/infra/local-repo-manipulator.adapter", "module/charter/infra/in-memory/in-memory-credentials.repository"]
      .map((adapterPath) => `export * from ${JSON.stringify(fileURLToPath(new URL(`src/${adapterPath}.ts`, repositoryUrl)))};\n`)
      .join(""),
  );
  await tsupBuild({
    entry: { "own-adapters": adapterEntryPath },
    outDir: consumerFolder,
    format: "esm",
    outExtension: () => ({ js: ".mjs" }),
    silent: true,
    config: false,
    clean: false,
    treeshake: true,
    // What an adapter takes of the engine — a module's application or domain,
    // through the port it answers — comes from the installed package.
    esbuildPlugins: [
      {
        name: "engine-port",
        setup: (pluginBuild) =>
          pluginBuild.onResolve({ filter: /^(#module\/|\.)/ }, ({ path: importedPath, resolveDir }) => {
            const resolvedPath = importedPath.startsWith("#module/") ? fileURLToPath(new URL(`src/module/${importedPath.slice("#module/".length)}`, repositoryUrl)) : resolve(resolveDir, importedPath);
            if (/\/src\/module\/[\w-]+\/(app|domain)\//.test(resolvedPath)) return { path: "cherry-works", external: true };
            // A module's module.ts names every adapter of it: what an adapter
            // does not use of it is left out.
            if (/\/src\/module\/[\w-]+\/(module|infra\/[\w.-]+)\.js$/.test(resolvedPath)) return { path: resolvedPath.replace(/\.js$/, ".ts"), sideEffects: false };
            return undefined;
          }),
      },
    ],
  });
  await writeFile(
    join(consumerFolder, "own-adapters.d.mts"),
    "import type { ForReadingFiles, ForStoringCredentials, ForManagingLocalOutput, ForWritingFiles } from 'cherry-works';\n" +
      "export interface LocalRepoManipulator extends ForManagingLocalOutput {}\nexport declare class LocalRepoManipulator {\n  constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles);\n}\n" +
      "export interface InMemoryCredentialsRepository extends ForStoringCredentials {}\nexport declare class InMemoryCredentialsRepository {\n  constructor();\n}\n",
  );
});

after(async () => {
  if (consumerFolder !== undefined) await rm(consumerFolder, { recursive: true, force: true });
});

/** A consumer runs only the installed package, without the source loader. */
function runConsumerCode(consumerCode: string): string {
  const consumerRun = spawnSync(process.execPath, ["--input-type=module", "--eval", consumerCode], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(consumerRun.status, 0, consumerRun.stderr);
  assert.equal(consumerRun.stderr, "");
  return consumerRun.stdout;
}

test("an installed engine supplies use cases, both ports and every crossing type (SDK Story 2 scenario 1)", async () => {
  const consumerSource = `
import { AuthoringCharter, BuildingCharter, RunningCharter, CharterDTOs, FaultDTOs, RuntimeDTOs, AdapterFault, CharterPrimitiveFault, UnauthorizedMcpFault, VERSION, buildCharterService, installCharterService, loadCharterService, loadMcpOriginsService } from 'cherry-works';
import { ClaudeProjection, CodexProjection, FileCharterRepository } from 'cherry-works';
import { LocalRepoManipulator, InMemoryCredentialsRepository } from './own-adapters.mjs';
import type { ForAuthoringCharter, ForBuildingCharter, ForRunningCharter, ProjectionSettings, UnparsedHeaders, AgentProviderName, LayerName, ForReadingFiles, ReadFile, ListedFile, ForWritingFiles, ForCountingTokens, ForCheckingAgentCli, ForRunningAgentCli, Answer, PromptUsage, ForCallingMcpServers, McpServerAddress, UpstreamTool, ToolAnswer, McpServerConnection, ForStoringCredentials, ForAuthorizingMcpOrigins, OAuthGrant, ForFetchingCharterSources, ForKeepingWorktrees, ForRunningPromptfoo, PromptfooTest, PromptfooAssertion, PromptfooTestResult, PromptfooLog, ForReportingProgress, ForTellingTime, ForRunningShellCommands, ShellCommandResult, ForLoadingSessionAnalysis, McpOriginAddress, ForManagingLocalAgentOutput, MainContextText } from 'cherry-works';
const fileReader: ForReadingFiles = {
  async readFilesRecursively(): Promise<readonly ReadFile[]> { return []; },
  async readBytesRecursively(): Promise<readonly ReadFile<Uint8Array>[]> { return [{path: 'a', contents: new Uint8Array([255])}]; },
  async listFolders() { return []; }, async readIfThere() { return undefined; },
  async readBytesIfThere() { return undefined; }, async listFiles(): Promise<readonly ListedFile[]> { return []; },
  findFileAddress(filePath) { return 'memory://r/' + filePath; }
};
const fileWriter: ForWritingFiles = { async write(file, contents, options) { const fileContents: string | Uint8Array = contents; }, async delete() {}, async deleteFolder() {}, async deleteEmptyFolder() {} };
const progressReporter: ForReportingProgress = { report() {}, problem() {} };
const shell: ForRunningShellCommands = { async runShellCommand(): Promise<ShellCommandResult> { return { exitCode: 0, stdout: '', stderr: '' }; } };
const localRepo = new LocalRepoManipulator(fileReader, fileWriter);
const clock: ForTellingTime = { now() { return new Date(); } };
const charterAuthoringApp: ForAuthoringCharter = new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, fileWriter, {} as ForFetchingCharterSources), new InMemoryCredentialsRepository(), {} as ForAuthorizingMcpOrigins, clock, progressReporter);
const agentProjectionByProvider = { claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) };
const charterBuildingApp: ForBuildingCharter = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, fileWriter, {} as ForFetchingCharterSources), localRepo, agentProjectionByProvider, {countTokens() {return 0;}}, { agents: ['claude'] }, progressReporter, charterAuthoringApp);
const mcpOriginAddress: McpOriginAddress = { address: 'https://mcp.example/mcp', mcpId: 'example' };
const accessTokenAnswer: Promise<CharterDTOs.AccessToken | FaultDTOs.Fault> = charterAuthoringApp.accessToken(mcpOriginAddress, false);
const charterRuntimeApp: ForRunningCharter = new RunningCharter(charterAuthoringApp, charterBuildingApp, fileReader, {}, shell, {} as ForKeepingWorktrees, {} as ForRunningPromptfoo, {} as ForLoadingSessionAnalysis, clock, { agents: ['claude'] }, progressReporter);
const projectionSettings: ProjectionSettings = { agents: ['claude'] };
const doctorOutcome: Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault> = charterBuildingApp.doctor();
const sessionReviewOutcome: Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault> = charterRuntimeApp.sessionSummary();
const faultSchema = FaultDTOs.Fault;
`;
  await writeFile(join(consumerFolder, "consumer.ts"), consumerSource);
  const typecheckRun = spawnSync(process.execPath, [new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname, "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--lib", "ES2023,DOM", "consumer.ts"], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(typecheckRun.status, 0, typecheckRun.stdout + typecheckRun.stderr);
  assert.equal(libraryPackageJson.name, "cherry-works");
  // Every library is bundled in, its types too: nothing else is installed.
  assert.equal(libraryPackageJson.dependencies, undefined);
  assert.deepEqual((await readdir(join(consumerFolder, "node_modules"))).filter((installedName) => !installedName.startsWith(".")), ["cherry-works"]);
  assert.equal(libraryPackageJson.license, packageJson.license);
  assert.match(await readFile(join(consumerFolder, "node_modules/cherry-works/LICENSE"), "utf8"), /^MIT License\n/);
});

test("the installed library holds the engine and the adapters cw is composed of, but no command line or portal, and imports no package (SDK Story 2 scenario 2)", async () => {
  const packageFiles = (await readdir(join(consumerFolder, "node_modules/cherry-works"), { recursive: true })).filter((packagePath) => !packagePath.startsWith("dist/zod/") && !packagePath.startsWith("dist/portal/"));
  assert.deepEqual(packageFiles.sort(), ["LICENSE", "README.md", "dist", "dist/cw.js", "dist/index.d.ts", "dist/index.js", "dist/main.js", "dist/portal", "dist/zod", "package.json"]);
  const libraryCode = await readFile(join(consumerFolder, "node_modules/cherry-works/dist/index.js"), "utf8");
  assert.doesNotMatch(libraryCode, /^\/\/ (?:main\.ts|src\/presentation\/)/m);
  for (const adapterPath of ["src/module/composition.ts", "src/module/charter/infra/file-charter.repository.ts", "src/module/charter/infra/claude/claude-projection.adapter.ts", "src/module/runtime/infra/codex/codex-cli.adapter.ts"]) assert.ok(libraryCode.includes(`\n// ${adapterPath}\n`), adapterPath);
  const librarySourceFile = ts.createSourceFile("index.js", libraryCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const importedPackages = librarySourceFile.statements.filter(ts.isImportDeclaration).map(importDeclaration => (importDeclaration.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual([...new Set(importedPackages)].filter((importedPackage) => !importedPackage.startsWith("node:") && !builtinModules.includes(importedPackage)), []);
});

test("the library refuses internal imports and exports only its public contract (SDK Story 2 scenario 3)", () => {
  assert.deepEqual(Object.keys(libraryPackageJson.exports), [".", "./package.json"]);
  runConsumerCode(`
import assert from 'node:assert/strict';
import * as engine from 'cherry-works';
assert.deepEqual(Object.keys(engine).sort(), ['AdapterFault', 'AgentPrimitive', 'AgentProvider', 'AuthoringCharter', 'BUILTIN_LAYER', 'BasePrimitive', 'BuildCharterService', 'InstallCharterService', 'ProjectionPlan', 'BuiltSensors', 'Catalogue', 'CharterDTOs', 'CharterFolder', 'CharterMd', 'CharterPrimitiveFault', 'CopyPlan', 'DocumentBasedComponent', 'EVAL_DIRECTORY', 'EvalFolder', 'FaultDTOs', 'VendorRoot', 'VendorRootFactory', 'VendorSource', 'VendorSourceOrigin', 'GuidePrimitive', 'LoadCharterService', 'LoadMcpOriginsService', 'McpClientRegistration', 'McpCredential', 'McpOrigins', 'McpPrimitive', 'ModelHelper', 'OutputPart', 'WritePlan', 'PlaybookPrimitive', 'PosturePrimitive', 'PrimitiveLayer', 'Primitives', 'PrimitivesFolder', 'ProviderComponent', 'BuildingCharter', 'REPO_LAYER', 'RawEvalSuite', 'RawPrimitive', 'RawSourceSkill', 'RawVendorSource', 'RawTestSuite', 'RunningCharter', 'RuntimeDTOs', 'SensorPrimitive', 'SessionLogs', 'SettingBasedComponent', 'SkillPrimitive', 'SourceCharter', 'SourceSkill', 'StampedDocument', 'TEST_DIRECTORY', 'TestFolder', 'TestSuite', 'UnauthorizedMcpFault', 'VENDOR_LAYER', 'VERSION', 'VendorsFolder', 'buildCharterService', 'installCharterService', 'loadCharterService', 'loadMcpOriginsService', 'mergedTomlText',
 'composeApplications', 'composeEngine', 'composeWorkspace', 'FileReaders', 'FileOutput', 'GitSources', 'GitWorktrees', 'OAuth', 'McpClients', 'Tiktoken', 'SystemClock', 'Shell', 'ConsoleReporter', 'Promptfoo', 'KeychainCredentialsRepository', 'FileCharterRepository', 'AgentProjection', 'ClaudeProjection', 'CodexProjection', 'AgentCli', 'ClaudeCli', 'CodexCli'].sort());
assert.deepEqual([engine.BUILTIN_LAYER, engine.REPO_LAYER, engine.VENDOR_LAYER], ['builtin', 'repo', 'vendor']);
assert.deepEqual([engine.TEST_DIRECTORY, engine.EVAL_DIRECTORY], ['.cw/charter/test', '.cw/charter/eval']);
for (const privateName of ['CharterRoot', 'WorkspaceSettingsSchema', 'folderURL', 'loadCharterRoot', 'RepoLayerPrimitive', 'BUILTIN_PRIMITIVES', 'FileSettingsRepository', 'LocalRepoManipulator', 'ManagingWorkspace', 'FileWorkspaceSettingsRepository', 'FileSessionAnalysisRepository', 'InMemoryFileReaders', 'Commander']) assert.equal(privateName in engine, false);
for (const privatePath of ['domain/models/DomainFault', 'storage/FileCharterRepository', 'index.js', 'dist/index.js', 'dist/main.js', 'src/module/charter/module.js', 'application/RunningCharter']) await assert.rejects(import('cherry-works/' + privatePath), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
`);
});

test("the library reports the version of its installed package, the one cw names (SDK Story 2 scenario 4)", () => {
  assert.equal(libraryPackageJson.version, packageJson.version);
  runConsumerCode(`import assert from 'node:assert/strict'; import { VERSION } from 'cherry-works'; assert.equal(VERSION, ${JSON.stringify(packageJson.version)});`);
  const versionRun = spawnSync(process.execPath, ["dist/cw.js", "--version"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(versionRun.status, 0, versionRun.stderr);
  assert.equal(versionRun.stdout, `${libraryPackageJson.version}\n`);
});

test("a consumer reads a use case's fault as a DTO, never as an exception (SDK Story 2 scenario 5)", () => {
  runConsumerCode(`
import assert from 'node:assert/strict';
import { AuthoringCharter, BuildingCharter, RunningCharter, buildCharterService, installCharterService, loadCharterService, loadMcpOriginsService } from 'cherry-works';
import { ClaudeProjection, CodexProjection, FileCharterRepository } from 'cherry-works';
import { LocalRepoManipulator, InMemoryCredentialsRepository } from './own-adapters.mjs';
const problems = [];
const progressReporter = {report() {}, problem(text) {problems.push(text);}};
const failingOutputWriter = new LocalRepoManipulator({async readIfThere() {throw new Error('Store unavailable.');}, async listFolders() {return [];}}, {});
const clock = {now() {return new Date();}};
const charterAuthoringApp = new AuthoringCharter(loadCharterService, installCharterService, {}, new InMemoryCredentialsRepository(), {}, clock, progressReporter);
const agentProjectionByProvider = { claude: new ClaudeProjection({}) };
const charterBuildingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, {}, failingOutputWriter, agentProjectionByProvider, {}, { agents: ['claude'] }, progressReporter, charterAuthoringApp);
const sensorRunAnswer = await charterBuildingApp.sensorCommands('Stop', 'claude');
assert.equal(sensorRunAnswer.type, 'Fault');
assert.equal(sensorRunAnswer.data.name, 'InternalFault');
assert.equal(problems.length, 1);
`);
});

/** A tool author's in-memory adapters over the installed engine, a reporter
 *  keeping what the operator is told, and a store that can be made to fail. */
const failureConsumerCode = String.raw`
import assert from 'node:assert/strict';
import { AuthoringCharter, BuildingCharter, RunningCharter, AdapterFault, CharterPrimitiveFault, buildCharterService, installCharterService, loadCharterService, loadMcpOriginsService } from 'cherry-works';
import { ClaudeProjection, CodexProjection, FileCharterRepository } from 'cherry-works';
import { LocalRepoManipulator, InMemoryCredentialsRepository } from './own-adapters.mjs';
const fileTextByAddress = new Map([['memory://r/.cw/settings.json', '{"agents":["claude"]}']]);
let storeFailure;
const fileReader = {
 async readIfThere(filePath) { if (storeFailure !== undefined) throw storeFailure; return fileTextByAddress.get('memory://r/' + filePath); },
 async readBytesIfThere(filePath) { const fileText = await this.readIfThere(filePath); return fileText === undefined ? undefined : new TextEncoder().encode(fileText); },
 async readFilesRecursively(folderPath) { if (storeFailure !== undefined) throw storeFailure; return [...fileTextByAddress].filter(([fileAddress]) => fileAddress.startsWith('memory://r/' + folderPath + '/')).map(([fileAddress, contents]) => ({ path: fileAddress.slice('memory://r/'.length), contents })); },
 async readBytesRecursively(folderPath) { return (await this.readFilesRecursively(folderPath)).map(({ path, contents }) => ({ path, contents: new TextEncoder().encode(contents) })); },
 async listFolders() { return []; }, async listFiles() { return []; },
 findFileAddress(filePath) { return 'memory://r/' + filePath; }
};
const progressReporter = { problems: [], report() {}, problem(text) { this.problems.push(text); } };
const charterAuthoringApp = new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, {}, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, progressReporter);
const agentProjectionByProvider = { claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) };
const charterBuildingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, {}, {}), new LocalRepoManipulator(fileReader, {}), agentProjectionByProvider, { countTokens() { return 0; } }, { agents: ['claude'] }, progressReporter, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, {}, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, progressReporter));
`;

test("a refusal the caller can correct is answered as a fault DTO with its next move, and not logged (SDK Story 5 scenario 1)", () => {
  runConsumerCode(failureConsumerCode + String.raw`
const listAnswer = await charterAuthoringApp.list('nonsense');
assert.equal(listAnswer.type, 'Fault');
assert.match(listAnswer.data.message, /"nonsense" is not a kind/);
assert.match(listAnswer.data.fix, /guide/);
assert.equal(listAnswer.data.name, 'UnknownKindFault');
const explainAnswer = await charterAuthoringApp.explain('nowhere');
assert.equal(explainAnswer.type, 'Fault');
assert.equal(explainAnswer.data.name, 'UnknownIdFault');
assert.match(explainAnswer.data.fix, /cw list/);
assert.deepEqual(progressReporter.problems, []);
`);
});

test("a driven adapter failing inside is logged with its cause and no secret, and answered as a generic fault DTO (SDK Story 5 scenario 2)", () => {
  runConsumerCode(failureConsumerCode + String.raw`
storeFailure = new Error('Store refused the read.', { cause: new Error('Socket closed at 10.0.0.7.') });
const doctorAnswer = await charterBuildingApp.doctor();
assert.equal(doctorAnswer.type, 'Fault');
assert.equal(doctorAnswer.data.name, 'InternalFault');
assert.doesNotMatch(JSON.stringify(doctorAnswer), /Store refused|10\.0\.0\.7/);
// Each module logs the fault it met, the health check among them, each with
// its cause (CORE-FR-229, SDK-FR-017).
assert.ok(progressReporter.problems.length >= 1);
assert.ok(progressReporter.problems.some((problemText) => /doctor/.test(problemText)));
assert.ok(progressReporter.problems.some((problemText) => /Store refused the read\./.test(problemText) && /Caused by: Error: Socket closed at 10\.0\.0\.7\./.test(problemText)));

// An adapter's own fault, unmarked, is the system's too; one marked as the
// person's reaches them as it is, and is not logged.
let problemCount = progressReporter.problems.length;
storeFailure = new AdapterFault('The store is read-only for this key.', 'Ask for write access.');
assert.equal((await charterBuildingApp.tools()).data.name, 'InternalFault');
assert.equal(progressReporter.problems.length, problemCount + 1);
problemCount = progressReporter.problems.length;
storeFailure = new AdapterFault('The store is offline.', 'Reconnect the store.', { internal: false });
const settingsAnswer = await charterBuildingApp.tools();
assert.deepEqual(settingsAnswer, { type: 'Fault', data: { name: 'AdapterFault', message: 'The store is offline.', fix: 'Reconnect the store.', severity: 'error' } });
assert.equal(progressReporter.problems.length, problemCount);

// What a call was made with is never logged: a token stays out of the log.
storeFailure = new Error('Store refused the read.');
assert.equal((await charterAuthoringApp.signInWithToken('https://mcp.example/mcp', 'tok-very-secret')).data.name, 'InternalFault');
assert.equal(progressReporter.problems.length, problemCount + 1);
assert.doesNotMatch(progressReporter.problems.join(''), /tok-very-secret/);

// A cause that leads back to itself is logged once, and still answered.
const loopingError = new Error('The store loops.');
loopingError.cause = loopingError;
storeFailure = loopingError;
assert.equal((await charterBuildingApp.tools()).data.name, 'InternalFault');
assert.equal(progressReporter.problems.at(-1).match(/Caused by:/g).length, 1);

// A reporter that fails is a driven adapter failing too: the caller is still
// answered, and nothing is thrown.
const failingReporterApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, {}, {}), new LocalRepoManipulator(fileReader, {}), agentProjectionByProvider, { countTokens() { return 0; } }, { agents: ['claude'] }, { report() {}, problem() { throw new Error('The log is full.'); } }, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, {}, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, { report() {}, problem() { throw new Error('The log is full.'); } }));
assert.equal((await failingReporterApp.doctor()).data.name, 'InternalFault');
`);
});

test("charter content that does not hold stays data grouped by file, not a fault (SDK Story 5 scenario 3)", () => {
  runConsumerCode(failureConsumerCode + String.raw`
fileTextByAddress.set('memory://r/.cw/charter/primitive/guide/broken/index.md', '---\nkind: guide\nid: broken\n---\nBody');
const buildAnswer = await charterBuildingApp.build();
assert.equal(buildAnswer.type, 'FaultsByFile');
assert.deepEqual(Object.keys(buildAnswer.data.files), ['memory://r/.cw/charter/primitive/guide/broken/index.md']);

// Frontmatter that is no set of named headers is a finding under its file
// too, in the engine's words.
fileTextByAddress.set('memory://r/.cw/charter/primitive/guide/unread/index.md', '---\nunreadable\n---\nBody');
const refusedBuildAnswer = await charterBuildingApp.build();
assert.equal(refusedBuildAnswer.type, 'FaultsByFile');
assert.deepEqual(refusedBuildAnswer.data.files['memory://r/.cw/charter/primitive/guide/unread/index.md'].map(({ data }) => data.message), ['The frontmatter must be a list of named headers, one per line — not a bare value or a list.']);
assert.deepEqual(progressReporter.problems, []);
`);
});

test("a calling adapter covers every answer by its type, with no fault class (SDK Story 5 scenario 4)", () => {
  const consumerSource = `
import type { FaultDTOs, ForAuthoringCharter, ForBuildingCharter, ForRunningCharter } from 'cherry-works';
type AnswerOf<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? Answer : never }[keyof Port];
type EveryAnswer = AnswerOf<ForAuthoringCharter> | AnswerOf<ForBuildingCharter> | AnswerOf<ForRunningCharter>;
// Every operation of every driver port may answer a fault DTO, read by its type.
type FaultAnswered<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? (FaultDTOs.Fault extends Answer ? true : Method) : true }[keyof Port];
const everyOperationAnswersFaults: [FaultAnswered<ForAuthoringCharter>, FaultAnswered<ForBuildingCharter>, FaultAnswered<ForRunningCharter>] = [true, true, true];
// And every answer is a DTO told apart by its type: no operation answers a bare value.
type BareAnswered<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? (Answer extends { readonly type: string } ? never : Method) : never }[keyof Port];
const noBareAnswer: [BareAnswered<ForAuthoringCharter>, BareAnswered<ForBuildingCharter>, BareAnswered<ForRunningCharter>] extends [never, never, never] ? true : false = true;
async function textOf(charterBuildingApp: ForBuildingCharter): Promise<string> {
  const buildAnswer = await charterBuildingApp.build();
  switch (buildAnswer.type) {
    case 'PlanSummary': return buildAnswer.data.added.join('\\n');
    case 'FaultsByFile': return Object.keys(buildAnswer.data.files).join('\\n');
    case 'Fault': return buildAnswer.data.name + ': ' + buildAnswer.data.message + ' ' + buildAnswer.data.fix;
  }
}
export { textOf, everyOperationAnswersFaults, noBareAnswer, type EveryAnswer };
`;
  return writeFile(join(consumerFolder, "calling-adapter.ts"), consumerSource).then(() => {
    const typecheckRun = spawnSync(process.execPath, [new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname, "--noEmit", "--strict", "--noImplicitReturns", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--lib", "ES2023,DOM", "calling-adapter.ts"], { cwd: consumerFolder, encoding: "utf8" });
    assert.equal(typecheckRun.status, 0, typecheckRun.stdout + typecheckRun.stderr);
  });
});

const charterConsumerCode = `
import assert from 'node:assert/strict';
import { AuthoringCharter, BuildingCharter, RunningCharter, buildCharterService, installCharterService, loadCharterService, loadMcpOriginsService } from 'cherry-works';
import { ClaudeProjection, CodexProjection, FileCharterRepository } from 'cherry-works';
import { LocalRepoManipulator, InMemoryCredentialsRepository } from './own-adapters.mjs';
const fileTextByAddress = new Map([['memory://r/.cw/settings.json', '{"agents":[]}']]);
const fileReader = {
 async readIfThere(filePath) {return fileTextByAddress.get('memory://r/' + filePath);},
 async readBytesIfThere(filePath) {const fileText = fileTextByAddress.get('memory://r/' + filePath); return fileText === undefined ? undefined : new TextEncoder().encode(fileText);},
 async readFilesRecursively(folderPath) {return [...fileTextByAddress].filter(([fileAddress]) => fileAddress.startsWith('memory://r/' + folderPath + '/')).map(([fileAddress, contents]) => ({path: fileAddress.slice('memory://r/'.length), contents}));},
 async readBytesRecursively(folderPath) {return (await this.readFilesRecursively(folderPath)).map(({path, contents}) => ({path, contents: new TextEncoder().encode(contents)}));},
 async listFolders() {return [];}, async listFiles() {return [];},
 findFileAddress(filePath) {return 'memory://r/' + filePath;}
};
const charterAuthoringApp = new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, {}, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, {report() {}, problem() {}});
const agentProjectionByProvider = { claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) };
const charterBuildingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, {}, {}), new LocalRepoManipulator(fileReader, {}), agentProjectionByProvider, {countTokens() {return 0;}}, { agents: [] }, {report() {}, problem() {}}, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, {}, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, {report() {}, problem() {}}));
`;

test("validation through the installed engine answers faults by file (SDK Story 2 scenario 6)", () => {
  runConsumerCode(charterConsumerCode + `
fileTextByAddress.set('memory://r/.cw/charter/primitive/guide/broken/index.md', '---\\nkind: guide\\nid: broken\\n---\\nBody');
const doctorOutcome = await charterBuildingApp.doctor();
assert.deepEqual(Object.keys(doctorOutcome.data.faultsByFile.data.files), ['memory://r/.cw/charter/primitive/guide/broken/index.md']);
assert.ok(doctorOutcome.data.errorCount > 0);
`);
});

test("builtin primitives and script bytes arrive inside the engine, without runtime disk reads (SDK Story 2 scenario 7)", () => {
  runConsumerCode(charterConsumerCode + `
import filesystem from 'node:fs';
import filesystemPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
for (const filesystemModule of [filesystem, filesystemPromises]) {
 for (const methodName of ['readFile', 'readFileSync', 'open', 'openSync', 'readdir', 'readdirSync', 'stat', 'statSync', 'access', 'accessSync']) {
  if (methodName in filesystemModule) filesystemModule[methodName] = () => assert.fail('Unexpected filesystem call: ' + methodName);
 }
}
syncBuiltinESMExports();
const primitiveList = await charterAuthoringApp.fullList();
assert.equal(primitiveList.type, 'Primitives', JSON.stringify(primitiveList));
for (const primitiveId of ['cw-author', 'cw-session-cost', 'cw-session-tokens-counter', 'cw-session-tokens-counter-on-stop']) assert.ok(primitiveList.data.primitives.some(primitive => primitive.data.id === primitiveId));
const counterPrimitive = await charterAuthoringApp.open('cw-session-tokens-counter');
assert.ok(counterPrimitive.data.body.includes('session-analysis.jsonl'));
const fileBytesByAddress = new Map();
const buildingWriter = {async write(filePath, contents) {fileBytesByAddress.set('memory://r/' + filePath, contents);}, async delete() {}, async deleteFolder() {}, async deleteEmptyFolder() {}};
const buildingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, buildingWriter, {}), new LocalRepoManipulator(fileReader, buildingWriter), agentProjectionByProvider, {countTokens() {return 0;}}, { agents: ['claude'] }, {report() {}, problem() {}}, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, buildingWriter, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, {report() {}, problem() {}}));
const buildOutcome = await buildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary');
const scriptBytes = fileBytesByAddress.get('memory://r/.cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs');
assert.ok(scriptBytes instanceof Uint8Array);
assert.ok(new TextDecoder().decode(scriptBytes).includes('appendFile'));
`);
});

test("installing cw adds its one package, the library within it, and depends on nothing (SDK Story 2 scenario 8)", () => {
  assert.equal("dependencies" in packageJson, false);
  const packRun = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(packRun.status, 0, packRun.stderr);
  const packedPaths: string[] = JSON.parse(packRun.stdout)[0].files.map(({ path }: { path: string }) => path);
  assert.deepEqual(packedPaths.filter(packagePath => !packagePath.startsWith("dist/")).sort(), ["LICENSE", "README.md", "package.json"]);
  assert.ok(packedPaths.every(packagePath => !packagePath.startsWith("packages/")));
});

test("a tool composes the engine as cw does, mixing the adapters the package ships with its own, type-checked against the package alone (SDK Story 2 scenario 9)", async () => {
  const repoFolderPath = await mkdtemp(join(tmpdir(), "cw-library-repo-"));
  try {
    await mkdir(join(repoFolderPath, ".cw"));
    await writeFile(join(repoFolderPath, ".cw/settings.json"), '{"agents":["claude"]}\n');
    const consumerSource = `
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { composeApplications, AgentCli, ClaudeProjection, FileCharterRepository, FileOutput, FileReaders, GitSources, GitWorktrees, KeychainCredentialsRepository, McpClients, OAuth, Promptfoo, Shell, SystemClock } from 'cherry-works';
import type { EnginePlugin, ComposedApplications, ForCountingTokens, ForReportingProgress } from 'cherry-works';
/** The tool's own agent command line, beside cw's projection for it. */
class OwnAgentCli extends AgentCli {
  async isInstalled(): Promise<boolean> { return true; }
}
const repoFolder: URL = pathToFileURL(${JSON.stringify(repoFolderPath)} + '/');
const problemTexts: string[] = [];
const progressReporter: ForReportingProgress = { report() {}, problem(problemText) { problemTexts.push(problemText); } };
let countedTextCount = 0;
const tokenCounter: ForCountingTokens = { countTokens(text) { countedTextCount++; return text.length; } };
const pluginAdapters: EnginePlugin = {
  agentProvider: { claude: { projection: new ClaudeProjection(new FileReaders(repoFolder)), cli: new OwnAgentCli() } },
  charterRepository: new FileCharterRepository(new FileReaders(repoFolder), new FileOutput(repoFolder), new GitSources(repoFolder)),
  fileReader: new FileReaders(repoFolder),
  fileWriter: new FileOutput(repoFolder),
  worktrees: new GitWorktrees(repoFolder),
  authorizing: new OAuth(),
  mcpServers: new McpClients(),
  tokenCounter,
  clock: new SystemClock(),
  shell: new Shell(repoFolder),
  progressReporter,
  promptfooRunner: new Promptfoo(repoFolder, ${JSON.stringify(join(repoFolderPath, ".cherry-works"))}),
  credentialsRepository: new KeychainCredentialsRepository(),
};
const { workspaceApp, engineApp }: ComposedApplications = await composeApplications(repoFolder, repoFolder, pluginAdapters);
const settingsAnswer = await workspaceApp.settings();
assert.equal(settingsAnswer.type, 'WorkspaceSettings', JSON.stringify(settingsAnswer));
assert.equal((await engineApp.charterAuthoringApp.setUpCharter()).type, 'CharterLayout');
const buildAnswer = await engineApp.charterBuildingApp.build();
assert.equal(buildAnswer.type, 'PlanSummary', JSON.stringify(buildAnswer));
const mainContextAnswer = await engineApp.charterBuildingApp.predictMainContext();
assert.equal(mainContextAnswer.type, 'MainContexts', JSON.stringify(mainContextAnswer));
assert.ok(countedTextCount > 0);
assert.deepEqual(problemTexts, []);
`;
    await writeFile(join(consumerFolder, "own-plugin.mts"), consumerSource);
    const compileRun = spawnSync(process.execPath, [new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname, "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--lib", "ES2023,DOM", "--types", "node", "--typeRoots", new URL("node_modules/@types", repositoryUrl).pathname, "own-plugin.mts"], { cwd: consumerFolder, encoding: "utf8" });
    assert.equal(compileRun.status, 0, compileRun.stdout + compileRun.stderr);
    const consumerRun = spawnSync(process.execPath, ["own-plugin.mjs"], { cwd: consumerFolder, encoding: "utf8" });
    assert.equal(consumerRun.status, 0, consumerRun.stdout + consumerRun.stderr);
    assert.ok((await readFile(join(repoFolderPath, "CLAUDE.md"), "utf8")).length > 0);
  } finally {
    await rm(repoFolderPath, { recursive: true, force: true });
  }
});

/** An integrator's adapters: no repository implementation is imported. The
 *  engine reads the headers itself. */
const memoryAuthoringConsumerCode = String.raw`
import assert from 'node:assert/strict';
import { AuthoringCharter, BuildingCharter, RunningCharter, buildCharterService, installCharterService, loadCharterService, loadMcpOriginsService } from 'cherry-works';
import { ClaudeProjection, CodexProjection, FileCharterRepository } from 'cherry-works';
import { LocalRepoManipulator, InMemoryCredentialsRepository } from './own-adapters.mjs';
import filesystem from 'node:fs';
import filesystemPromises from 'node:fs/promises';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
let forbiddenCallCount = 0;
for (const externalModule of [filesystem, filesystemPromises, childProcess]) {
 for (const methodName of Object.keys(externalModule)) {
  if (typeof externalModule[methodName] === 'function') externalModule[methodName] = () => {
   forbiddenCallCount++;
   throw new Error('Forbidden external call: ' + methodName);
  };
 }
}
syncBuiltinESMExports();
const repositoryAddress = new URL('memory:/team/');
const fileBytesByAddress = new Map();
// Set up on the repository's address: every path the engine hands them is from it.
const fileAddressOf = (filePath) => new URL(filePath.split('/').map(encodeURIComponent).join('/'), repositoryAddress);
const folderAddressOf = (folderPath) => folderPath === '' ? repositoryAddress : new URL(folderPath.split('/').map(encodeURIComponent).join('/') + '/', repositoryAddress);
const pathOf = (fileAddress) => decodeURIComponent(fileAddress.slice(repositoryAddress.href.length)).replace(/\/$/, '');
const fileReader = {
 findFileAddress(filePath) { return fileAddressOf(filePath).href; },
 async readBytesIfThere(filePath) { return fileBytesByAddress.get(fileAddressOf(filePath).href)?.slice(); },
 async readIfThere(filePath) {
  const fileBytes = await this.readBytesIfThere(filePath);
  return fileBytes === undefined ? undefined : new TextDecoder().decode(fileBytes);
 },
 async readBytesRecursively(folderPath) {
  return [...fileBytesByAddress].filter(([fileAddress]) => fileAddress.startsWith(folderAddressOf(folderPath).href))
   .map(([fileAddress, fileBytes]) => ({ path: pathOf(fileAddress), contents: fileBytes.slice() }));
 },
 async readFilesRecursively(folderPath) {
  return (await this.readBytesRecursively(folderPath)).map(({ path, contents }) => ({ path, contents: new TextDecoder().decode(contents) }));
 },
 async listFolders(folderPath) {
  const folder = folderAddressOf(folderPath);
  const folderNames = [...fileBytesByAddress.keys()].filter(fileAddress => fileAddress.startsWith(folder.href))
   .map(fileAddress => fileAddress.slice(folder.href.length)).filter(filePath => filePath.includes('/'))
   .map(filePath => filePath.split('/')[0]);
  return [...new Set(folderNames)].map(folderName => pathOf(new URL(folderName + '/', folder).href));
 },
 async listFiles(folderPath) {
  const folder = folderAddressOf(folderPath);
  return [...fileBytesByAddress.keys()].filter(fileAddress => fileAddress.startsWith(folder.href) && !fileAddress.slice(folder.href.length).includes('/'))
   .map(fileAddress => ({ path: pathOf(fileAddress), modifiedAt: new Date(0) }));
 }
};
const fileWriter = {
 async write(filePath, fileContents) {
  fileBytesByAddress.set(fileAddressOf(filePath).href, typeof fileContents === 'string' ? new TextEncoder().encode(fileContents) : fileContents.slice());
 },
 async delete(filePath) { fileBytesByAddress.delete(fileAddressOf(filePath).href); },
 async deleteFolder(folderPath) {
  for (const fileAddress of fileBytesByAddress.keys()) if (fileAddress.startsWith(folderAddressOf(folderPath).href)) fileBytesByAddress.delete(fileAddress);
 },
 async deleteEmptyFolder() {} // Empty folders have no map entry.
};
const tokenCounter = { countTokens(text) { return text.length; } };
const progressReporter = { problems: [], report() {}, problem(text) { this.problems.push(text); } };
const charterAuthoringApp = new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, fileWriter, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, progressReporter);
const agentProjectionByProvider = { claude: new ClaudeProjection(fileReader), codex: new CodexProjection(fileReader) };
const charterBuildingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, fileWriter, {}), new LocalRepoManipulator(fileReader, fileWriter), agentProjectionByProvider, tokenCounter, { agents: ['claude'] }, progressReporter, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, fileWriter, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, progressReporter));
const guideHeaders = { description: 'Keep a clear boundary.', globs: ['src/**'] };
// Setup is the tool's own: it keeps its settings, has the charter's folders
// laid out, and builds (CORE-FR-231).
async function setUp() {
 await fileWriter.write('.cw/settings.json', JSON.stringify({ agents: ['claude'] }));
 const charterLayout = await charterAuthoringApp.setUpCharter();
 assert.equal(charterLayout.type, 'CharterLayout', JSON.stringify(charterLayout));
 return charterBuildingApp.build();
}
`;

test("setup through the installed engine keeps settings, empty kind files and its first build in memory (SDK Story 3 scenario 1)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
const setupOutcome = await setUp();
assert.equal(setupOutcome.type, 'PlanSummary', JSON.stringify(setupOutcome));
assert.deepEqual(JSON.parse(await fileReader.readIfThere('.cw/settings.json')), { agents: ['claude'] });
const primitiveKinds = await charterAuthoringApp.kinds();
for (const primitiveKind of Object.keys(primitiveKinds.data)) {
 assert.deepEqual(await fileReader.readBytesIfThere('.cw/charter/primitive/' + primitiveKind + '/.gitkeep'), new Uint8Array());
}
assert.match(await fileReader.readIfThere('.cw/out/CHARTER.md'), /Charter/);
assert.ok(fileBytesByAddress.has(new URL('CLAUDE.md', repositoryAddress).href));
assert.ok([...fileBytesByAddress.keys()].every(fileAddress => fileAddress.startsWith(repositoryAddress.href)));
assert.equal(forbiddenCallCount, 0);
`);
});

test("adding and validating a guide through the installed engine uses only its own adapters (SDK Story 3 scenario 2)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await setUp();
const addedPrimitive = await charterAuthoringApp.add('guide', 'clear-boundary', guideHeaders, 'Keep the boundary clear.');
assert.equal(addedPrimitive.type, 'Primitive', JSON.stringify(addedPrimitive));
assert.match(await fileReader.readIfThere('.cw/charter/primitive/guide/clear-boundary/index.md'), /Keep the boundary clear\./);
const doctorOutcome = await charterBuildingApp.doctor();
assert.equal(doctorOutcome.data.errorCount, 0, JSON.stringify(doctorOutcome));
const buildOutcome = await charterBuildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary', JSON.stringify(buildOutcome));
assert.match(await fileReader.readIfThere('.cw/out/guide/clear-boundary/index.md'), /Keep the boundary clear\./);
assert.equal(forbiddenCallCount, 0);
`);
});

test("an invalid addition through the installed engine answers faults and writes nothing (SDK Story 3 scenario 3)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await setUp();
const originalFiles = [...fileBytesByAddress];
const refusedPrimitive = await charterAuthoringApp.add('guide', 'broken', {}, 'Body');
assert.equal(refusedPrimitive.type, 'Faults', JSON.stringify(refusedPrimitive));
assert.ok(refusedPrimitive.data.faults.length > 0);
for (const faultDTO of refusedPrimitive.data.faults) {
 assert.ok(faultDTO.data.message.length > 0);
 assert.ok(faultDTO.data.fix.length > 0);
}
assert.deepEqual([...fileBytesByAddress], originalFiles);
assert.equal(forbiddenCallCount, 0);
`);
});

test("a memory build matches cw on disk byte for byte, including escaped binary assets (SDK Story 3 scenario 4)", async () => {
  const memorySnapshotText = runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await setUp();
await charterAuthoringApp.add('guide', 'clear-boundary', guideHeaders, 'Keep the boundary clear.');
const assetFile = '.cw/charter/primitive/guide/clear-boundary/a #%.bin';
await fileWriter.write(assetFile, new Uint8Array([0, 255, 128, 13, 10]));
const buildOutcome = await charterBuildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary', JSON.stringify(buildOutcome));
assert.deepEqual(await fileReader.readBytesIfThere('.cw/out/guide/clear-boundary/a #%.bin'), new Uint8Array([0, 255, 128, 13, 10]));
assert.equal(forbiddenCallCount, 0);
process.stdout.write(JSON.stringify([...fileBytesByAddress].map(([fileAddress, fileBytes]) => [decodeURIComponent(fileAddress.slice(repositoryAddress.href.length)), [...fileBytes]])) + "\n");
`);
  const memoryFiles: [string, number[]][] = JSON.parse(memorySnapshotText);
  const diskFolder = await mkdtemp(join(tmpdir(), "cw-engine-disk-parity-"));
  try {
    for (const [filePath, fileBytes] of memoryFiles) {
      if (!filePath.startsWith(".cw/charter/") && filePath !== ".cw/settings.json" && filePath !== ".cw/.gitignore") continue;
      const diskFilePath = join(diskFolder, filePath);
      await mkdir(dirname(diskFilePath), { recursive: true });
      await writeFile(diskFilePath, new Uint8Array(fileBytes));
    }
    const buildRun = spawnSync(process.execPath, [new URL("dist/cw.js", repositoryUrl).pathname, "build"], { cwd: diskFolder, encoding: "utf8" });
    assert.equal(buildRun.status, 0, buildRun.stdout + buildRun.stderr);
    assert.equal(buildRun.stderr, "");
    const diskEntries = await readdir(diskFolder, { recursive: true, withFileTypes: true });
    const diskFiles: [string, number[]][] = await Promise.all(diskEntries.filter(diskEntry => diskEntry.isFile()).map(async diskEntry => {
      const diskFilePath = join(diskEntry.parentPath, diskEntry.name);
      return [relative(diskFolder, diskFilePath), [...await readFile(diskFilePath)]] as [string, number[]];
    }));
    assert.deepEqual(diskFiles.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)), memoryFiles.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)));
  } finally {
    await rm(diskFolder, { recursive: true, force: true });
  }
});

test("every authoring operation honours a minimal read-after-write adapter (SDK Story 3 scenario 5)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
assert.equal((await setUp()).type, 'PlanSummary');
assert.equal((await charterAuthoringApp.listPrimitiveRequirements('guide')).type, 'PrimitiveRequirements');
assert.equal((await charterAuthoringApp.add('guide', 'clear-boundary', guideHeaders, 'First body.')).type, 'Primitive');
assert.equal((await charterAuthoringApp.list('guide')).type, 'Catalogue');
assert.equal((await charterAuthoringApp.fullList('clear-boundary')).data.primitives.length, 1);
assert.equal((await charterAuthoringApp.explain('clear-boundary')).type, 'ExplanationOutcome');
const openedPrimitive = await charterAuthoringApp.open('clear-boundary');
assert.equal(openedPrimitive.data.body, 'First body.');
assert.equal((await charterAuthoringApp.rewrite('clear-boundary', guideHeaders, 'Second body.', openedPrimitive.data.hash)).type, 'Primitive');
assert.equal((await charterAuthoringApp.open('clear-boundary')).data.body, 'Second body.');
assert.equal((await charterAuthoringApp.rewrite('clear-boundary', guideHeaders, 'Stale body.', openedPrimitive.data.hash)).type, 'Fault');
const filesBeforePreview = [...fileBytesByAddress];
const previewOutcome = await charterBuildingApp.preview();
assert.equal(previewOutcome.type, 'PlanSummary');
assert.deepEqual([...fileBytesByAddress], filesBeforePreview);
assert.equal((await charterBuildingApp.predictMainContext()).type, 'MainContexts');
assert.equal((await charterAuthoringApp.test()).type, 'TestRunReport');
assert.equal((await charterBuildingApp.build()).type, 'PlanSummary');
assert.deepEqual((await charterBuildingApp.preview()).data.added, []);
assert.deepEqual((await charterBuildingApp.preview()).data.edited, []);
const escapedAssetFile = '.cw/charter/primitive/guide/clear-boundary/a #%.bin';
await fileWriter.write(escapedAssetFile, new Uint8Array([0, 255]));
assert.equal((await charterAuthoringApp.remove('clear-boundary')).type, 'Primitive');
assert.equal(await fileReader.readBytesIfThere(escapedAssetFile), undefined);
assert.equal(await fileReader.readIfThere('.cw/charter/primitive/guide/clear-boundary/index.md'), undefined);
const cleanupOutcome = await charterBuildingApp.build();
assert.equal(cleanupOutcome.type, 'PlanSummary');
assert.ok(cleanupOutcome.data.deleted.includes('.cw/out/guide/clear-boundary/index.md'));
assert.equal(await fileReader.readIfThere('.cw/out/guide/clear-boundary/index.md'), undefined);
// A missing kind folder is empty, and setup reads back even when empty files are dropped.
for (const fileAddress of fileBytesByAddress.keys()) if (fileAddress.endsWith('/.gitkeep')) fileBytesByAddress.delete(fileAddress);
assert.equal((await charterBuildingApp.doctor()).data.errorCount, 0);
assert.equal((await charterBuildingApp.build()).type, 'PlanSummary');
assert.equal(forbiddenCallCount, 0);
`);
});

test("a memory build reports a failed write and keeps completed writes (SDK Story 3 write-failure edge case)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await setUp();
await charterAuthoringApp.add('guide', 'first-guide', guideHeaders, 'First guide.');
await charterAuthoringApp.add('guide', 'second-guide', guideHeaders, 'Second guide.');
const completedWriteAddresses = [];
const failingWriter = { ...fileWriter, async write(filePath, fileContents, writeOptions) {
 if (completedWriteAddresses.length === 1) throw new Error('Store write refused.');
 await fileWriter.write(filePath, fileContents, writeOptions);
 completedWriteAddresses.push(fileAddressOf(filePath).href);
}};
const failingApp = new BuildingCharter(buildCharterService, loadCharterService, loadMcpOriginsService, new FileCharterRepository(fileReader, failingWriter, {}), new LocalRepoManipulator(fileReader, failingWriter), agentProjectionByProvider, tokenCounter, { agents: ['claude'] }, progressReporter, new AuthoringCharter(loadCharterService, installCharterService, new FileCharterRepository(fileReader, failingWriter, {}), new InMemoryCredentialsRepository(), {}, {now() {return new Date();}}, progressReporter));
const failedBuild = await failingApp.build();
assert.equal(failedBuild.type, 'Fault');
assert.equal(failedBuild.data.name, 'InternalFault');
assert.doesNotMatch(JSON.stringify(failedBuild), /Store write refused/);
assert.match(progressReporter.problems.at(-1), /build[\s\S]*Store write refused\./);
assert.equal(completedWriteAddresses.length, 1);
assert.ok(fileBytesByAddress.has(completedWriteAddresses[0]));
assert.equal((await charterBuildingApp.build()).type, 'PlanSummary');
assert.equal(forbiddenCallCount, 0);
`);
});

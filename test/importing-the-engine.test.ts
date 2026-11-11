import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { after, before, test } from "node:test";
import ts from "typescript";
import packageJson from "../package.json" with { type: "json" };

const repositoryUrl = new URL("../", import.meta.url);
let consumerFolder: string;
let libraryPackageJson: {
  name: string;
  version: string;
  license: string;
  dependencies?: Record<string, string>;
  exports: Record<string, unknown>;
};

before(async () => {
  consumerFolder = await mkdtemp(join(tmpdir(), "cw-engine-consumer-"));
  const packRun = spawnSync("npm", ["pack", "--json", "--pack-destination", consumerFolder], {
    cwd: repositoryUrl,
    encoding: "utf8",
  });
  assert.equal(packRun.status, 0, packRun.stderr || packRun.error?.message);
  const tarballName: string = JSON.parse(packRun.stdout)[0].filename;
  await writeFile(join(consumerFolder, "package.json"), '{"private":true,"type":"module"}\n');
  const installRun = spawnSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(consumerFolder, tarballName)],
    { cwd: consumerFolder, encoding: "utf8" },
  );
  assert.equal(installRun.status, 0, installRun.stderr);
  libraryPackageJson = JSON.parse(
    await readFile(join(consumerFolder, "node_modules/cherry-works/package.json"), "utf8"),
  );
});

after(async () => {
  if (consumerFolder !== undefined) await rm(consumerFolder, { recursive: true, force: true });
});

/** A consumer runs only the installed package, without the source loader. */
function runConsumerCode(consumerCode: string): string {
  const consumerRun = spawnSync(process.execPath, ["--input-type=module", "--eval", consumerCode], {
    cwd: consumerFolder,
    encoding: "utf8",
  });
  assert.equal(consumerRun.status, 0, consumerRun.stderr);
  assert.equal(consumerRun.stderr, "");
  return consumerRun.stdout;
}

/** Type-checks a consumer's TypeScript against the installed package alone. */
function typecheckConsumerSource(consumerFileName: string, ...compilerFlags: string[]): void {
  const typecheckRun = spawnSync(
    process.execPath,
    [
      new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname,
      "--noEmit",
      "--strict",
      ...compilerFlags,
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2023,DOM",
      consumerFileName,
    ],
    { cwd: consumerFolder, encoding: "utf8" },
  );
  assert.equal(typecheckRun.status, 0, typecheckRun.stdout + typecheckRun.stderr);
}

test("an installed engine supplies how to compose it, its driver ports, their DTOs, and every port a tool may replace with the types crossing it (SDK Story 2 scenario 1)", async () => {
  const consumerSource = `
import { composeApplications, CharterDTOs, FaultDTOs, RuntimeDTOs, WorkspaceDTOs, AdapterFault, UnauthorizedMcpFault, McpCredential, McpClientRegistration, VERSION, AgentCli, ClaudeProjection } from 'cherry-works';
import type { ComposedApplications, ComposedEngine, EngineAdapters, ForManagingCharter, ForManagingLocalAgentOutput, ForAuthoringCharter, ForBuildingCharter, ForRunningCharter, ForManagingWorkspace, ForReadingFiles, ReadFile, ListedFile, ForWritingFiles, ForReportingProgress, ForTellingTime, ForCountingTokens, ForRunningShellCommands, ShellCommandResult, ForKeepingWorktrees, ForRunningPromptfoo, PromptfooTest, PromptfooAssertion, PromptfooTestResult, PromptfooLog, ForCallingMcpServers, McpServerAddress, McpServerConnection, UpstreamTool, ToolAnswer, ForAuthorizingMcpOrigins, OAuthGrant, ForStoringCredentials, ForFetchingCharterSources } from 'cherry-works';
const fileReader: ForReadingFiles = {
  async readFilesRecursively(): Promise<readonly ReadFile[]> { return []; },
  async readBytesRecursively(): Promise<readonly ReadFile<Uint8Array>[]> { return [{path: 'a', contents: new Uint8Array([255])}]; },
  async listFolders() { return []; }, async readIfThere() { return undefined; },
  async readBytesIfThere() { return undefined; }, async listFiles(): Promise<readonly ListedFile[]> { return []; },
  findFileAddress(filePath) { return 'memory:/r/' + filePath; }
};
const fileWriter: ForWritingFiles = { async write(file, contents, options) { const fileContents: string | Uint8Array = contents; }, async delete() {}, async deleteFolder() {}, async deleteEmptyFolder() {} };
const progressReporter: ForReportingProgress = { report() {}, problem() {} };
const clock: ForTellingTime = { now() { return new Date(); } };
const tokenCounter: ForCountingTokens = { countTokens(text) { return text.length; } };
const shell: ForRunningShellCommands = { async runShellCommand(): Promise<ShellCommandResult> { return { exitCode: 0, stdout: '', stderr: '' }; } };
const worktrees: ForKeepingWorktrees = { async addWorktree() {}, async removeWorktree() {} };
const promptfooTestResult: PromptfooTestResult = { success: true, totalTokens: 0, componentResults: [] };
const promptfooRunner: ForRunningPromptfoo = {
  installFolderPath: '/promptfoo', async isInstalled() { return true; }, async install() {},
  async evaluate(promptfooTest: PromptfooTest) { const promptfooAssertions: readonly PromptfooAssertion[] = promptfooTest.assertions; return promptfooTestResult; },
  async readLogs(): Promise<readonly PromptfooLog[]> { return []; }
};
const upstreamTool: UpstreamTool = { name: 'echo', inputSchema: {} };
const mcpServers: ForCallingMcpServers = { async connect(mcpServerAddress: McpServerAddress): Promise<McpServerConnection> { return { tools: [upstreamTool], async callTool(): Promise<ToolAnswer> { throw new UnauthorizedMcpFault('Refused.', 'Sign in again.'); }, async close() {} }; } };
const authorizing: ForAuthorizingMcpOrigins = { async authorize(endpoint): Promise<OAuthGrant> { return { accessToken: 'token', client: new McpClientRegistration({ clientId: 'client', issuer: endpoint }) }; }, async renew() { return undefined; } };
const credentialByAddress = new Map<string, McpCredential>([['https://mcp.example/mcp', new McpCredential({ address: 'https://mcp.example/mcp', method: 'token', accessToken: 'token' })]]);
const credentialsRepository: ForStoringCredentials = { async readCredential(address) { return credentialByAddress.get(address); }, async writeCredential(mcpCredential) { credentialByAddress.set(mcpCredential.address, mcpCredential); } };
const sourceFetcher: ForFetchingCharterSources = {
  async fetchCommit() { throw new AdapterFault('No source is reached here.', 'Vendor with cw.', { internal: false }); },
  async listFilesAt() { return []; }, async readFileAt() { return ''; }, async readBytesAt() { return new Uint8Array(); },
  async checkoutFolderAt() {}, async forgetCommit() {}
};
const replacedAdapters: Partial<EngineAdapters> = { fileReader, fileWriter, worktrees, authorizing, mcpServers, tokenCounter, clock, shell, progressReporter, promptfooRunner, credentialsRepository, sourceFetcher };
const composedApplications: ComposedApplications = await composeApplications(new URL('memory:/r/'), new URL('memory:/home/'), replacedAdapters);
const filesReplacedApplications: Promise<ComposedApplications> = composeApplications(new URL('memory:/r/'), new URL('memory:/home/'), { fileReader, fileWriter });
// An agent's projection and command line, and the charter's store, may be a tool's own too.
class OwnAgentCli extends AgentCli { async isInstalled() { return true; } }
class OwnClaudeProjection extends ClaudeProjection {}
const ownProjection: ForManagingLocalAgentOutput = new OwnClaudeProjection(fileReader);
const ownAgentApplications = composeApplications(new URL('memory:/r/'), new URL('memory:/home/'), { fileReader, fileWriter, agentProvider: { claude: { projection: ownProjection, cli: new OwnAgentCli() } } });
const charterRepositoryOfOwn = (charterRepository: ForManagingCharter): Partial<EngineAdapters> => ({ charterRepository });
const workspaceApp: ForManagingWorkspace = composedApplications.workspaceApp;
const engineApp: ComposedEngine = composedApplications.engineApp;
const charterAuthoringApp: ForAuthoringCharter = engineApp.charterAuthoringApp;
const charterBuildingApp: ForBuildingCharter = engineApp.charterBuildingApp;
const charterRuntimeApp: ForRunningCharter = engineApp.charterRuntimeApp;
const workspaceSettings: Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault> = workspaceApp.settings();
const accessTokenAnswer: Promise<CharterDTOs.AccessToken | FaultDTOs.Fault> = charterAuthoringApp.accessToken({ address: 'https://mcp.example/mcp', mcpId: 'example' }, false);
const doctorOutcome: Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault> = charterBuildingApp.doctor();
const sessionReviewOutcome: Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault> = charterRuntimeApp.sessionSummary();
const faultSchema = FaultDTOs.Fault;
const engineVersion: string = VERSION;
`;
  await writeFile(join(consumerFolder, "consumer.ts"), consumerSource);
  typecheckConsumerSource("consumer.ts");
  assert.equal(libraryPackageJson.name, "cherry-works");
  // Every library is bundled in, its types too: nothing else is installed.
  assert.equal(libraryPackageJson.dependencies, undefined);
  assert.deepEqual(
    (await readdir(join(consumerFolder, "node_modules"))).filter((installedName) => !installedName.startsWith(".")),
    ["cherry-works"],
  );
  assert.equal(libraryPackageJson.license, packageJson.license);
  assert.match(await readFile(join(consumerFolder, "node_modules/cherry-works/LICENSE"), "utf8"), /^MIT License\n/);
  // The contract names the ports of the charter's store and of an agent, so a
  // tool writes its own against them (CORE-FR-230).
  const contractText = await readFile(join(consumerFolder, "node_modules/cherry-works/dist/index.d.ts"), "utf8");
  for (const contractName of [
    "ForManagingCharter",
    "ForManagingLocalAgentOutput",
    "ForCheckingAgentCli",
    "EngineAdapters",
  ])
    assert.match(contractText, new RegExp(`\\b${contractName}\\b`), contractName);
});

test("the installed library holds the engine and the adapters cw is composed of, but no command line or portal, and imports no package (SDK Story 2 scenario 2)", async () => {
  const packageFiles = (await readdir(join(consumerFolder, "node_modules/cherry-works"), { recursive: true })).filter(
    (packagePath) => !packagePath.startsWith("dist/zod/") && !packagePath.startsWith("dist/portal/"),
  );
  assert.deepEqual(packageFiles.sort(), [
    "LICENSE",
    "README.md",
    "dist",
    "dist/cw.js",
    "dist/index.d.ts",
    "dist/index.js",
    "dist/main.js",
    "dist/portal",
    "dist/zod",
    "package.json",
  ]);
  const libraryCode = await readFile(join(consumerFolder, "node_modules/cherry-works/dist/index.js"), "utf8");
  assert.doesNotMatch(libraryCode, /^\/\/ (?:main\.ts|src\/presentation\/)/m);
  for (const adapterPath of [
    "src/module/composition.ts",
    "src/module/charter/infra/file-charter.repository.ts",
    "src/module/charter/infra/claude/claude-projection.adapter.ts",
    "src/module/runtime/infra/codex/codex-cli.adapter.ts",
  ])
    assert.ok(libraryCode.includes(`\n// ${adapterPath}\n`), adapterPath);
  const librarySourceFile = ts.createSourceFile(
    "index.js",
    libraryCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const importedPackages = librarySourceFile.statements
    .filter(ts.isImportDeclaration)
    .map((importDeclaration) => (importDeclaration.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual(
    [...new Set(importedPackages)].filter(
      (importedPackage) => !importedPackage.startsWith("node:") && !builtinModules.includes(importedPackage),
    ),
    [],
  );
});

test("the library refuses internal imports and exports only its public contract (SDK Story 2 scenario 3)", () => {
  assert.deepEqual(Object.keys(libraryPackageJson.exports), [".", "./package.json"]);
  runConsumerCode(`
import assert from 'node:assert/strict';
import * as engine from 'cherry-works';
for (const publicName of ['AdapterFault', 'CharterDTOs', 'FaultDTOs', 'McpClientRegistration', 'McpCredential', 'RuntimeDTOs', 'UnauthorizedMcpFault', 'VERSION', 'WorkspaceDTOs', 'composeApplications', 'FileCharterRepository', 'ClaudeProjection', 'CodexProjection', 'AgentProjection', 'AgentCli', 'ClaudeCli', 'CodexCli', 'RawPrimitive']) assert.equal(publicName in engine, true, publicName);
for (const privateName of ['AuthoringCharter', 'BuildingCharter', 'RunningCharter', 'buildCharterService', 'loadCharterService', 'BUILTIN_LAYER', 'TEST_DIRECTORY', 'composeEngine', 'composeWorkspace', 'WorkspaceSettingsSchema', 'folderURL', 'loadCharterRoot', 'RepoLayerPrimitive', 'BUILTIN_PRIMITIVES', 'FileSettingsRepository', 'ManagingWorkspace', 'InMemoryFileReaders', 'Commander']) assert.equal(privateName in engine, false, privateName);
for (const privatePath of ['domain/models/DomainFault', 'storage/FileCharterRepository', 'index.js', 'dist/index.js', 'dist/main.js', 'src/module/charter/module.js', 'application/RunningCharter']) await assert.rejects(import('cherry-works/' + privatePath), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
`);
});

test("the library reports the version of its installed package, the one cw names (SDK Story 2 scenario 4)", () => {
  assert.equal(libraryPackageJson.version, packageJson.version);
  runConsumerCode(
    `import assert from 'node:assert/strict'; import { VERSION } from 'cherry-works'; assert.equal(VERSION, ${JSON.stringify(packageJson.version)});`,
  );
  const versionRun = spawnSync(process.execPath, ["dist/cw.js", "--version"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(versionRun.status, 0, versionRun.stderr);
  assert.equal(versionRun.stdout, `${libraryPackageJson.version}\n`);
});

/**
 * A tool author's own adapters over the installed engine, every file kept in a
 * map at a `memory:` address: a reader that can be made to fail, a reporter
 * keeping what the operator is told, credentials kept in memory, and a
 * promptfoo runner saying evaluating is not offered away from a disk
 * (EVAL-FR-021). Every other adapter is the engine's own, never reached here.
 */
const memoryConsumerCode = String.raw`
import assert from 'node:assert/strict';
import { composeApplications, AdapterFault } from 'cherry-works';
const repositoryAddress = new URL('memory:/team/');
const homeAddress = new URL('memory:/home/');
const fileBytesByAddress = new Map();
let storeFailure;
// Set up on the repository's address: every path the engine hands them is from it.
const fileAddressOf = (filePath) => new URL(filePath.split('/').map(encodeURIComponent).join('/'), repositoryAddress);
const folderAddressOf = (folderPath) => folderPath === '' ? repositoryAddress : new URL(folderPath.split('/').map(encodeURIComponent).join('/') + '/', repositoryAddress);
const pathOf = (fileAddress) => decodeURIComponent(fileAddress.slice(repositoryAddress.href.length)).replace(/\/$/, '');
const fileReader = {
 findFileAddress(filePath) { return fileAddressOf(filePath).href; },
 async readBytesIfThere(filePath) {
  if (storeFailure !== undefined) throw storeFailure;
  return fileBytesByAddress.get(fileAddressOf(filePath).href)?.slice();
 },
 async readIfThere(filePath) {
  const fileBytes = await this.readBytesIfThere(filePath);
  return fileBytes === undefined ? undefined : new TextDecoder().decode(fileBytes);
 },
 async readBytesRecursively(folderPath) {
  if (storeFailure !== undefined) throw storeFailure;
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
const credentialByAddress = new Map();
const credentialsRepository = { async readCredential(address) { return credentialByAddress.get(address); }, async writeCredential(mcpCredential) { credentialByAddress.set(mcpCredential.address, mcpCredential); } };
const evaluatingRefusal = () => new AdapterFault('Evaluating runs an agent in a real folder.', 'Evaluate with cw.', { internal: false });
const promptfooRunner = { installFolderPath: '', async isInstalled() { return false; }, async install() { throw evaluatingRefusal(); }, async evaluate() { throw evaluatingRefusal(); }, async readLogs() { return []; } };
/** The engine composed over these adapters, for the agents the settings kept
 *  name, written first where some are named: called once, so it is composed
 *  for them before a test makes the store fail. */
async function composeOverMemory(settingsAgents, replacedAdapters = {}) {
 if (settingsAgents !== undefined) await fileWriter.write('.cw/settings.json', JSON.stringify({ agents: settingsAgents }));
 const { engineApp } = await composeApplications(repositoryAddress, homeAddress, { fileReader, fileWriter, tokenCounter, progressReporter, credentialsRepository, promptfooRunner, ...replacedAdapters });
 await engineApp.charterAuthoringApp.kinds();
 return engineApp;
}
`;

test("a consumer reads a use case's fault as a DTO, never as an exception (SDK Story 2 scenario 5)", () => {
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
const { charterBuildingApp } = await composeOverMemory(['claude']);
storeFailure = new Error('Store unavailable.');
const sensorRunAnswer = await charterBuildingApp.sensorCommands('Stop', 'claude');
assert.equal(sensorRunAnswer.type, 'Fault');
assert.equal(sensorRunAnswer.data.name, 'InternalFault');
assert.equal(progressReporter.problems.length, 1);
`,
  );
});

/** The engine composed over the tool's in-memory adapters, for Claude. */
const failureConsumerCode =
  memoryConsumerCode +
  String.raw`
const { charterAuthoringApp, charterBuildingApp } = await composeOverMemory(['claude']);
`;

test("a refusal the caller can correct is answered as a fault DTO with its next move, and not logged (SDK Story 5 scenario 1)", () => {
  runConsumerCode(
    failureConsumerCode +
      String.raw`
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
`,
  );
});

test("a driven adapter failing inside is logged with its cause and no secret, and answered as a generic fault DTO (SDK Story 5 scenario 2)", () => {
  runConsumerCode(
    failureConsumerCode +
      String.raw`
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
storeFailure = undefined;
const failingReporterApp = (await composeOverMemory(undefined, { progressReporter: { report() {}, problem() { throw new Error('The log is full.'); } } })).charterBuildingApp;
storeFailure = loopingError;
assert.equal((await failingReporterApp.doctor()).data.name, 'InternalFault');
`,
  );
});

test("charter content that does not hold stays data grouped by file, not a fault (SDK Story 5 scenario 3)", () => {
  runConsumerCode(
    failureConsumerCode +
      String.raw`
await fileWriter.write('.cw/charter/primitive/guide/broken/index.md', '---\nkind: guide\nid: broken\n---\nBody');
const buildAnswer = await charterBuildingApp.build();
assert.equal(buildAnswer.type, 'FaultsByFile');
assert.deepEqual(Object.keys(buildAnswer.data.files), [fileAddressOf('.cw/charter/primitive/guide/broken/index.md').href]);

// Frontmatter that is no set of named headers is a finding under its file
// too, in the engine's words.
await fileWriter.write('.cw/charter/primitive/guide/unread/index.md', '---\nunreadable\n---\nBody');
const refusedBuildAnswer = await charterBuildingApp.build();
assert.equal(refusedBuildAnswer.type, 'FaultsByFile');
assert.deepEqual(refusedBuildAnswer.data.files[fileAddressOf('.cw/charter/primitive/guide/unread/index.md').href].map(({ data }) => data.message), ['The frontmatter must be a list of named headers, one per line — not a bare value or a list.']);
assert.deepEqual(progressReporter.problems, []);
`,
  );
});

test("a calling adapter covers every answer by its type, with no fault class (SDK Story 5 scenario 4)", async () => {
  const consumerSource = `
import type { FaultDTOs, ForAuthoringCharter, ForBuildingCharter, ForRunningCharter, ForManagingWorkspace } from 'cherry-works';
type AnswerOf<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? Answer : never }[keyof Port];
type EveryAnswer = AnswerOf<ForAuthoringCharter> | AnswerOf<ForBuildingCharter> | AnswerOf<ForRunningCharter> | AnswerOf<ForManagingWorkspace>;
// Every operation of every driver port may answer a fault DTO, read by its type.
type FaultAnswered<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? (FaultDTOs.Fault extends Answer ? true : Method) : true }[keyof Port];
const everyOperationAnswersFaults: [FaultAnswered<ForAuthoringCharter>, FaultAnswered<ForBuildingCharter>, FaultAnswered<ForRunningCharter>, FaultAnswered<ForManagingWorkspace>] = [true, true, true, true];
// And every answer is a DTO told apart by its type: no operation answers a bare value.
type BareAnswered<Port> = { [Method in keyof Port]: Port[Method] extends (...args: never[]) => Promise<infer Answer> ? (Answer extends { readonly type: string } ? never : Method) : never }[keyof Port];
const noBareAnswer: [BareAnswered<ForAuthoringCharter>, BareAnswered<ForBuildingCharter>, BareAnswered<ForRunningCharter>, BareAnswered<ForManagingWorkspace>] extends [never, never, never, never] ? true : false = true;
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
  await writeFile(join(consumerFolder, "calling-adapter.ts"), consumerSource);
  typecheckConsumerSource("calling-adapter.ts", "--noImplicitReturns");
});

test("validation through the installed engine answers faults by file (SDK Story 2 scenario 6)", () => {
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
const { charterBuildingApp } = await composeOverMemory([]);
await fileWriter.write('.cw/charter/primitive/guide/broken/index.md', '---\nkind: guide\nid: broken\n---\nBody');
const doctorOutcome = await charterBuildingApp.doctor();
assert.deepEqual(Object.keys(doctorOutcome.data.faultsByFile.data.files), [fileAddressOf('.cw/charter/primitive/guide/broken/index.md').href]);
assert.ok(doctorOutcome.data.errorCount > 0);
`,
  );
});

test("builtin primitives and script bytes arrive inside the engine, without runtime disk reads (SDK Story 2 scenario 7)", () => {
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
import filesystem from 'node:fs';
import filesystemPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const { charterAuthoringApp, charterBuildingApp } = await composeOverMemory(['claude']);
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
const buildOutcome = await charterBuildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary');
const scriptBytes = fileBytesByAddress.get(fileAddressOf('.cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs').href);
assert.ok(scriptBytes instanceof Uint8Array);
assert.ok(new TextDecoder().decode(scriptBytes).includes('appendFile'));
`,
  );
});

test("installing cw adds its one package, the library within it, and depends on nothing (SDK Story 2 scenario 8)", () => {
  assert.equal("dependencies" in packageJson, false);
  const packRun = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(packRun.status, 0, packRun.stderr);
  const packedPaths: string[] = JSON.parse(packRun.stdout)[0].files.map(({ path }: { path: string }) => path);
  assert.deepEqual(packedPaths.filter((packagePath) => !packagePath.startsWith("dist/")).sort(), [
    "LICENSE",
    "README.md",
    "package.json",
  ]);
  assert.ok(packedPaths.every((packagePath) => !packagePath.startsWith("packages/")));
});

test("a tool composes the engine as cw does, replacing some of its adapters with its own, type-checked against the package alone (SDK Story 2 scenario 9)", async () => {
  const repoFolderPath = await mkdtemp(join(tmpdir(), "cw-library-repo-"));
  try {
    await mkdir(join(repoFolderPath, ".cw"));
    await writeFile(join(repoFolderPath, ".cw/settings.json"), '{"agents":["claude"]}\n');
    const consumerSource = `
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { composeApplications } from 'cherry-works';
import type { EngineAdapters, ComposedApplications, ForCountingTokens, ForReportingProgress } from 'cherry-works';
const repoFolder: URL = pathToFileURL(${JSON.stringify(repoFolderPath)} + '/');
const problemTexts: string[] = [];
const progressReporter: ForReportingProgress = { report() {}, problem(problemText) { problemTexts.push(problemText); } };
let countedTextCount = 0;
const tokenCounter: ForCountingTokens = { countTokens(text) { countedTextCount++; return text.length; } };
// Only what the tool replaces is handed: every other adapter is cw's own.
const ownAdapters: Partial<EngineAdapters> = { tokenCounter, progressReporter };
const { workspaceApp, engineApp }: ComposedApplications = await composeApplications(repoFolder, repoFolder, ownAdapters);
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
    const compileRun = spawnSync(
      process.execPath,
      [
        new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname,
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--lib",
        "ES2023,DOM",
        "--types",
        "node",
        "--typeRoots",
        new URL("node_modules/@types", repositoryUrl).pathname,
        "own-plugin.mts",
      ],
      { cwd: consumerFolder, encoding: "utf8" },
    );
    assert.equal(compileRun.status, 0, compileRun.stdout + compileRun.stderr);
    const consumerRun = spawnSync(process.execPath, ["own-plugin.mjs"], { cwd: consumerFolder, encoding: "utf8" });
    assert.equal(consumerRun.status, 0, consumerRun.stdout + consumerRun.stderr);
    assert.ok((await readFile(join(repoFolderPath, "CLAUDE.md"), "utf8")).length > 0);
  } finally {
    await rm(repoFolderPath, { recursive: true, force: true });
  }
});

/** The engine composed over the tool's in-memory adapters alone, where any
 *  call to the file system or to start a process is refused and counted. */
const memoryAuthoringConsumerCode =
  memoryConsumerCode +
  String.raw`
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
const guideHeaders = { description: 'Keep a clear boundary.', globs: ['src/**'] };
let charterAuthoringApp;
let charterBuildingApp;
// Setup is the tool's own: it keeps its settings, composes the engine for
// them, has the charter's folders laid out, and builds (CORE-FR-231).
async function setUp() {
 ({ charterAuthoringApp, charterBuildingApp } = await composeOverMemory(['claude']));
 const charterLayout = await charterAuthoringApp.setUpCharter();
 assert.equal(charterLayout.type, 'CharterLayout', JSON.stringify(charterLayout));
 return charterBuildingApp.build();
}
`;

test("setup through the installed engine keeps settings, empty kind files and its first build in memory (SDK Story 3 scenario 1)", () => {
  runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
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
`,
  );
});

test("adding and validating a guide through the installed engine uses only its own adapters (SDK Story 3 scenario 2)", () => {
  runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
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
`,
  );
});

test("an invalid addition through the installed engine answers faults and writes nothing (SDK Story 3 scenario 3)", () => {
  runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
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
`,
  );
});

test("a memory build matches cw on disk byte for byte, including escaped binary assets (SDK Story 3 scenario 4)", async () => {
  const memorySnapshotText = runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
await setUp();
await charterAuthoringApp.add('guide', 'clear-boundary', guideHeaders, 'Keep the boundary clear.');
const assetFile = '.cw/charter/primitive/guide/clear-boundary/a #%.bin';
await fileWriter.write(assetFile, new Uint8Array([0, 255, 128, 13, 10]));
const buildOutcome = await charterBuildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary', JSON.stringify(buildOutcome));
assert.deepEqual(await fileReader.readBytesIfThere('.cw/out/guide/clear-boundary/a #%.bin'), new Uint8Array([0, 255, 128, 13, 10]));
assert.equal(forbiddenCallCount, 0);
process.stdout.write(JSON.stringify([...fileBytesByAddress].map(([fileAddress, fileBytes]) => [decodeURIComponent(fileAddress.slice(repositoryAddress.href.length)), [...fileBytes]])) + "\n");
`,
  );
  const memoryFiles: [string, number[]][] = JSON.parse(memorySnapshotText);
  const diskFolder = await mkdtemp(join(tmpdir(), "cw-engine-disk-parity-"));
  try {
    for (const [filePath, fileBytes] of memoryFiles) {
      if (!filePath.startsWith(".cw/charter/") && filePath !== ".cw/settings.json" && filePath !== ".cw/.gitignore")
        continue;
      const diskFilePath = join(diskFolder, filePath);
      await mkdir(dirname(diskFilePath), { recursive: true });
      await writeFile(diskFilePath, new Uint8Array(fileBytes));
    }
    const buildRun = spawnSync(process.execPath, [new URL("dist/cw.js", repositoryUrl).pathname, "build"], {
      cwd: diskFolder,
      encoding: "utf8",
    });
    assert.equal(buildRun.status, 0, buildRun.stdout + buildRun.stderr);
    assert.equal(buildRun.stderr, "");
    const diskEntries = await readdir(diskFolder, { recursive: true, withFileTypes: true });
    const diskFiles: [string, number[]][] = await Promise.all(
      diskEntries
        .filter((diskEntry) => diskEntry.isFile())
        .map(async (diskEntry) => {
          const diskFilePath = join(diskEntry.parentPath, diskEntry.name);
          return [relative(diskFolder, diskFilePath), [...(await readFile(diskFilePath))]] as [string, number[]];
        }),
    );
    assert.deepEqual(
      diskFiles.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)),
      memoryFiles.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath)),
    );
  } finally {
    await rm(diskFolder, { recursive: true, force: true });
  }
});

test("every authoring operation honours a minimal read-after-write adapter (SDK Story 3 scenario 5)", () => {
  runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
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
`,
  );
});

test("a memory build reports a failed write and keeps completed writes (SDK Story 3 write-failure edge case)", () => {
  runConsumerCode(
    memoryAuthoringConsumerCode +
      String.raw`
await setUp();
await charterAuthoringApp.add('guide', 'first-guide', guideHeaders, 'First guide.');
await charterAuthoringApp.add('guide', 'second-guide', guideHeaders, 'Second guide.');
const completedWriteAddresses = [];
const failingWriter = { ...fileWriter, async write(filePath, fileContents, writeOptions) {
 if (completedWriteAddresses.length === 1) throw new Error('Store write refused.');
 await fileWriter.write(filePath, fileContents, writeOptions);
 completedWriteAddresses.push(fileAddressOf(filePath).href);
}};
const failingApp = (await composeOverMemory(undefined, { fileWriter: failingWriter })).charterBuildingApp;
const failedBuild = await failingApp.build();
assert.equal(failedBuild.type, 'Fault');
assert.equal(failedBuild.data.name, 'InternalFault');
assert.doesNotMatch(JSON.stringify(failedBuild), /Store write refused/);
assert.match(progressReporter.problems.at(-1), /build[\s\S]*Store write refused\./);
assert.equal(completedWriteAddresses.length, 1);
assert.ok(fileBytesByAddress.has(completedWriteAddresses[0]));
assert.equal((await charterBuildingApp.build()).type, 'PlanSummary');
assert.equal(forbiddenCallCount, 0);
`,
  );
});

/** Every name a declaration file exports, in order of name. */
function exportedNamesOf(declarationText: string): readonly string[] {
  const declarationFile = ts.createSourceFile("index.d.ts", declarationText, ts.ScriptTarget.Latest);
  return declarationFile.statements
    .filter(ts.isExportDeclaration)
    .flatMap((exportDeclaration) =>
      exportDeclaration.exportClause !== undefined && ts.isNamedExports(exportDeclaration.exportClause)
        ? exportDeclaration.exportClause.elements.map((exportSpecifier) => exportSpecifier.name.text)
        : [],
    )
    .sort();
}

/** Every adapter cw is composed of, each one a tool may extend. */
const CW_ADAPTER_NAMES = [
  "AgentCli",
  "AgentProjection",
  "ClaudeCli",
  "ClaudeProjection",
  "CodexCli",
  "CodexProjection",
  "ConsoleReporter",
  "FileCharterRepository",
  "FileOutput",
  "FileReaders",
  "FileSessionAnalysisRepository",
  "FileWorkspaceSettingsRepository",
  "GitSources",
  "GitWorktrees",
  "KeychainCredentialsRepository",
  "LocalRepoManipulator",
  "McpClients",
  "OAuth",
  "Promptfoo",
  "Shell",
  "SystemClock",
  "Tiktoken",
];

/** What a port names that is no model: the helpers a projection lays its
 *  files with, and what makes a vendor's root, kept for a tool to extend
 *  cw's own adapters with. */
const PORT_NAMED_HELPER_NAMES = ["ModelHelper", "mergedTomlText", "VendorRootFactory"];

test("the installed package exports exactly what its contract names: the composition, the driver ports and their DTOs, each adapter's port with the models it names, and cw's own adapters (SDK Story 8 scenario 1)", async () => {
  const installedNames = exportedNamesOf(
    await readFile(join(consumerFolder, "node_modules/cherry-works/dist/index.d.ts"), "utf8"),
  );
  assert.deepEqual(installedNames, exportedNamesOf(await readFile(new URL("contract.d.ts", repositoryUrl), "utf8")));
  // Each name is what its declaring file says it is: the composition, a driver
  // port or its DTO, an adapter's port or a model it names, or one of cw's own
  // adapters — never a use case, a service, a driver or a portal.
  const declaringPathsByName = new Map<string, string[]>();
  for (const sourcePath of await readdir(new URL("src/module/", repositoryUrl), { recursive: true }))
    if (sourcePath.endsWith(".ts"))
      for (const declarationMatch of (
        await readFile(new URL(`src/module/${sourcePath}`, repositoryUrl), "utf8")
      ).matchAll(
        /^export (?:declare )?(?:abstract |async )?(?:class|interface|type|const|function|namespace|enum) (\w+)/gm,
      ))
        declaringPathsByName.set(declarationMatch[1]!, [
          ...(declaringPathsByName.get(declarationMatch[1]!) ?? []),
          sourcePath,
        ]);
  for (const installedName of installedNames.filter((installedName) => installedName !== "VERSION")) {
    const declaringPaths = declaringPathsByName.get(installedName) ?? [];
    assert.ok(
      declaringPaths.some(
        (declaringPath) =>
          declaringPath === "composition.ts" ||
          /\/app\/port\/(?:in|out)\/|\/domain\/(?:models|value-objects)\//.test(declaringPath) ||
          PORT_NAMED_HELPER_NAMES.includes(installedName) ||
          (/\/infra\//.test(declaringPath) && CW_ADAPTER_NAMES.includes(installedName)),
      ),
      `${installedName} is declared in ${declaringPaths.join(", ") || "no module"}`,
    );
  }
  for (const contractName of [
    "composeApplications",
    "EngineAdapters",
    "ForAuthoringCharter",
    "ForBuildingCharter",
    "ForRunningCharter",
    "ForManagingWorkspace",
    "CharterDTOs",
    "ForLoadingSessionAnalysis",
    "SessionLogs",
    "ForStoringWorkspaceSettings",
    "WorkspaceSettings",
    "WorkspaceReadme",
    "ForManagingLocalOutput",
    "CompiledPart",
    "McpOrigins",
    ...CW_ADAPTER_NAMES,
  ])
    assert.ok(installedNames.includes(contractName), contractName);
  for (const internalName of [
    "AuthoringCharter",
    "BuildingCharter",
    "RunningCharter",
    "ManagingWorkspace",
    "ApplicationService",
    "BuildCharterService",
    "buildCharterService",
    "loadCharterService",
    "installCharterService",
    "loadMcpOriginsService",
    "CompileService",
    "TestService",
    "EvalService",
    "composeEngine",
    "composeWorkspace",
    "Commander",
    "InMemoryFileReaders",
  ])
    assert.ok(!installedNames.includes(internalName), internalName);
  runConsumerCode(`
import assert from 'node:assert/strict';
import * as engine from 'cherry-works';
for (const adapterName of ${JSON.stringify(CW_ADAPTER_NAMES)}) assert.equal(typeof engine[adapterName], 'function', adapterName);
`);
});

test("a tool extends cw's own charter store and an agent's projection, imported from the package, and a build answers through the extensions (SDK Story 8 scenario 2)", async () => {
  const repoFolderPath = await mkdtemp(join(tmpdir(), "cw-extended-repo-"));
  try {
    await mkdir(join(repoFolderPath, ".cw"));
    await writeFile(join(repoFolderPath, ".cw/settings.json"), '{"agents":["claude"]}\n');
    const consumerSource = `
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { composeApplications, ClaudeCli, ClaudeProjection, FileCharterRepository, FileOutput, FileReaders, GitSources } from 'cherry-works';
import type { CharterOutput, CharterRoot, ProjectionPlan, RawPrimitive } from 'cherry-works';
const repoFolder: URL = pathToFileURL(${JSON.stringify(repoFolderPath)} + '/');
class CountingCharterRepository extends FileCharterRepository {
  loadedCharterCount = 0;
  override async loadCharter(checkoutPath?: string): Promise<readonly RawPrimitive[]> {
    this.loadedCharterCount++;
    return super.loadCharter(checkoutPath);
  }
}
class CountingClaudeProjection extends ClaudeProjection {
  plannedProjectionCount = 0;
  override async createAgentProjectionPlan(charter: CharterRoot, charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan> {
    this.plannedProjectionCount++;
    return super.createAgentProjectionPlan(charter, charterOutput, checkoutPath);
  }
}
const fileReader = new FileReaders(repoFolder);
const fileWriter = new FileOutput(repoFolder);
const charterRepository = new CountingCharterRepository(fileReader, fileWriter, new GitSources(repoFolder));
const claudeProjection = new CountingClaudeProjection(fileReader);
const { engineApp } = await composeApplications(repoFolder, repoFolder, {
  fileReader,
  fileWriter,
  charterRepository,
  agentProvider: { claude: { projection: claudeProjection, cli: new ClaudeCli() } },
});
assert.equal((await engineApp.charterAuthoringApp.setUpCharter()).type, 'CharterLayout');
const buildAnswer = await engineApp.charterBuildingApp.build();
assert.equal(buildAnswer.type, 'PlanSummary', JSON.stringify(buildAnswer));
assert.ok(charterRepository.loadedCharterCount > 0);
assert.equal(claudeProjection.plannedProjectionCount, 1);
`;
    await writeFile(join(consumerFolder, "extended-adapters.mts"), consumerSource);
    const compileRun = spawnSync(
      process.execPath,
      [
        new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname,
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--lib",
        "ES2023,DOM",
        "--types",
        "node",
        "--typeRoots",
        new URL("node_modules/@types", repositoryUrl).pathname,
        "extended-adapters.mts",
      ],
      { cwd: consumerFolder, encoding: "utf8" },
    );
    assert.equal(compileRun.status, 0, compileRun.stdout + compileRun.stderr);
    const consumerRun = spawnSync(process.execPath, ["extended-adapters.mjs"], {
      cwd: consumerFolder,
      encoding: "utf8",
    });
    assert.equal(consumerRun.status, 0, consumerRun.stdout + consumerRun.stderr);
    assert.ok((await readFile(join(repoFolderPath, "CLAUDE.md"), "utf8")).length > 0);
  } finally {
    await rm(repoFolderPath, { recursive: true, force: true });
  }
});

test("the engine is composed at memory: addresses with no adapter handed, with no failure and no file-system call (SDK Story 8 scenario 3)", () => {
  runConsumerCode(String.raw`
import assert from 'node:assert/strict';
import filesystem from 'node:fs';
import filesystemPromises from 'node:fs/promises';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { composeApplications } from 'cherry-works';
const forbiddenCallNames = [];
for (const externalModule of [filesystem, filesystemPromises, childProcess]) {
 for (const methodName of Object.keys(externalModule)) {
  const originalMethod = externalModule[methodName];
  if (typeof originalMethod === 'function') externalModule[methodName] = function (...callArguments) {
   forbiddenCallNames.push(methodName);
   return originalMethod.apply(this, callArguments);
  };
 }
}
syncBuiltinESMExports();
const { workspaceApp, engineApp } = await composeApplications(new URL('memory:/repo/'), new URL('memory:/home/'));
assert.deepEqual(forbiddenCallNames, []);
assert.deepEqual(workspaceApp.agentProviderNames, ['claude', 'codex']);
assert.deepEqual(Object.keys(engineApp), ['charterAuthoringApp', 'charterBuildingApp', 'charterRuntimeApp']);
`);
});

test("an engine composed before setup reads the settings again on its next call, and keeps the engine once they read (SDK Story 8 scenario 3, SDK-FR-011)", () => {
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
const { workspaceApp, engineApp } = await composeApplications(repositoryAddress, homeAddress, { fileReader, fileWriter, tokenCounter, progressReporter, credentialsRepository, promptfooRunner });
assert.equal(engineApp.charterBuildingApp.toJSON, undefined);
assert.equal('build' in engineApp.charterBuildingApp, true);
assert.equal('toJSON' in engineApp.charterBuildingApp, false);
const claudeEntryAddress = new URL('CLAUDE.md', repositoryAddress).href;
const codexEntryAddress = new URL('AGENTS.md', repositoryAddress).href;
assert.equal((await engineApp.charterAuthoringApp.setUpCharter()).type, 'CharterLayout');
assert.equal((await engineApp.charterBuildingApp.build()).type, 'PlanSummary');
assert.equal(fileBytesByAddress.has(claudeEntryAddress), false);
assert.equal((await workspaceApp.setUp(['claude'], '1.0.0')).type, 'WorkspaceSettings');
assert.equal((await engineApp.charterBuildingApp.build()).type, 'PlanSummary');
assert.ok(fileBytesByAddress.has(claudeEntryAddress));
await fileWriter.write('.cw/settings.json', JSON.stringify({ agents: ['codex'] }));
const keptBuildAnswer = await engineApp.charterBuildingApp.build();
assert.equal(keptBuildAnswer.type, 'PlanSummary', JSON.stringify(keptBuildAnswer));
assert.ok(fileBytesByAddress.has(claudeEntryAddress));
assert.equal(fileBytesByAddress.has(codexEntryAddress), false);
`,
  );
});

test("a sessions store, a settings store and a local output of a tool's own are what the use cases using them answer through (SDK Story 8 scenario 4)", () => {
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
import { LocalRepoManipulator, SessionLogs } from 'cherry-works';
const keptSettingsTexts = [];
const workspaceSettingsRepository = {
 async loadSettingsText() { return keptSettingsTexts.at(-1); },
 async saveSettings(workspaceSettings) { keptSettingsTexts.push(JSON.stringify({ agents: workspaceSettings.agents })); },
 async keepLogIgnored() {},
 async keepReadme() {},
};
const loadedSessionFolders = [];
const sessionAnalysisRepository = {
 async loadSessionLogs(sessionAnalysisFolder) {
  loadedSessionFolders.push(sessionAnalysisFolder);
  return new SessionLogs('own-sessions', []);
 },
};
class CountingLocalOutput extends LocalRepoManipulator {
 writtenPlanCount = 0;
 async writePlan(projectionPlan) {
  this.writtenPlanCount++;
  return super.writePlan(projectionPlan);
 }
}
const localOutput = new CountingLocalOutput(fileReader, fileWriter);
const { workspaceApp, engineApp } = await composeApplications(repositoryAddress, homeAddress, { fileReader, fileWriter, tokenCounter, progressReporter, credentialsRepository, promptfooRunner, workspaceSettingsRepository, sessionAnalysisRepository, localOutput });
const setUpAnswer = await workspaceApp.setUp(['claude'], '1.0.0');
assert.equal(setUpAnswer.type, 'WorkspaceSettings', JSON.stringify(setUpAnswer));
assert.deepEqual(keptSettingsTexts, ['{"agents":["claude"]}']);
assert.equal(fileBytesByAddress.has(new URL('.cw/settings.json', repositoryAddress).href), false);
assert.equal((await engineApp.charterAuthoringApp.setUpCharter()).type, 'CharterLayout');
const buildAnswer = await engineApp.charterBuildingApp.build();
assert.equal(buildAnswer.type, 'PlanSummary', JSON.stringify(buildAnswer));
assert.equal(localOutput.writtenPlanCount, 1);
assert.ok(fileBytesByAddress.has(new URL('CLAUDE.md', repositoryAddress).href));
const sessionReviewAnswer = await engineApp.charterRuntimeApp.sessionSummary();
assert.equal(sessionReviewAnswer.type, 'SessionReviewOutcome', JSON.stringify(sessionReviewAnswer));
assert.equal(sessionReviewAnswer.data.sessionsFolder, 'own-sessions');
assert.equal(loadedSessionFolders.length, 1);
assert.deepEqual(progressReporter.problems, []);
`,
  );
});

test("the contract recorded for the first release under it says how it was made, and that nothing has been published under it yet (SDK Story 8 scenario 5)", async () => {
  const [contractHeaderLine] = (await readFile(new URL("contract.d.ts", repositoryUrl), "utf8")).split("\n");
  assert.match(contractHeaderLine ?? "", /dist\/index\.d\.ts/);
  assert.match(contractHeaderLine ?? "", /Nothing has been published under it yet\./);
});

test("running a signal's sensors names the agent they run for, and the engine assumes none (SDK Story 8 scenario 6)", async () => {
  const consumerSource = `
import type { ForRunningCharter } from 'cherry-works';
declare const charterRuntimeApp: ForRunningCharter;
await charterRuntimeApp.runSensors('Stop', '{}', 'codex');
// @ts-expect-error The agent the sensors run for is named.
await charterRuntimeApp.runSensors('Stop', '{}');
`;
  await writeFile(join(consumerFolder, "named-agent.ts"), consumerSource);
  typecheckConsumerSource("named-agent.ts");
  runConsumerCode(
    memoryConsumerCode +
      String.raw`
const { charterAuthoringApp, charterBuildingApp, charterRuntimeApp } = await composeOverMemory(['claude']);
assert.equal((await charterAuthoringApp.setUpCharter()).type, 'CharterLayout');
assert.equal((await charterBuildingApp.build()).type, 'PlanSummary');
const unnamedAnswer = await charterRuntimeApp.runSensors('NoSensorSignal', '{}');
assert.equal(unnamedAnswer.type, 'Fault', JSON.stringify(unnamedAnswer));
assert.notEqual(unnamedAnswer.data.name, 'InternalFault');
assert.deepEqual(progressReporter.problems, []);
assert.equal((await charterRuntimeApp.runSensors('NoSensorSignal', '{}', 'claude')).type, 'SensorRunOutcome');
`,
  );
});

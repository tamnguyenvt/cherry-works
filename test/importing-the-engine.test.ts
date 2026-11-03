import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import packageJson from "../package.json" with { type: "json" };

const repositoryUrl = new URL("../", import.meta.url);
let consumerFolder: string;
let enginePackageJson: { name: string; version: string; license: string; dependencies: Record<string, string>; exports: Record<string, unknown> };

before(async () => {
  consumerFolder = await mkdtemp(join(tmpdir(), "cw-engine-consumer-"));
  const packRun = spawnSync("npm", ["pack", "--json", "--pack-destination", consumerFolder], { cwd: new URL("packages/engine/dist/", repositoryUrl), encoding: "utf8" });
  assert.equal(packRun.status, 0, packRun.stderr || packRun.error?.message);
  const tarballName: string = JSON.parse(packRun.stdout)[0].filename;
  await writeFile(join(consumerFolder, "package.json"), '{"private":true,"type":"module"}\n');
  const installRun = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(consumerFolder, tarballName)], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(installRun.status, 0, installRun.stderr);
  enginePackageJson = JSON.parse(await readFile(join(consumerFolder, "node_modules/@cherry-works/engine/package.json"), "utf8"));
});

after(async () => {
  if (consumerFolder !== undefined) await rm(consumerFolder, { recursive: true, force: true });
});

/** A consumer runs only the installed package, without the source loader. */
function runConsumerCode(consumerCode: string): void {
  const consumerRun = spawnSync(process.execPath, ["--input-type=module", "--eval", consumerCode], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(consumerRun.status, 0, consumerRun.stderr);
  assert.equal(consumerRun.stderr, "");
}

test("an installed engine supplies use cases, both ports and every crossing type (SDK Story 2 scenario 1)", async () => {
  const consumerSource = `
import { CharterAuthoring, CharterEvaluating, CharterVendoring, McpConnecting, SensorRunning, SessionReviewing, TestAuthoring, DataDTOs, OutcomeDTOs, DomainFault, AdapterFault, CharterPrimitiveFault, UnauthorizedMcpFault, VERSION } from '@cherry-works/engine';
import type { ForManagingCharter, ForEvaluatingCharter, ForVendoringCharters, ForConnectingMcps, ForRunningSensors, ForReviewingSessions, ForAuthoringTests, SettingsOptions, UnparsedHeaders, AgentProvider, LayerName, ForReadingFiles, ReadFile, ListedFile, ForWritingFiles, ForParsingYaml, ForParsingToml, ForCountingTokens, ForCheckingAgentCli, ForRunningAgentCli, Answer, PromptUsage, ForCallingMcpServers, McpServerAddress, UpstreamTool, ToolAnswer, McpServerConnection, ForKeepingSecrets, ForAuthorizing, OAuthGrant, ForFetchingSources, ForKeepingWorktrees, ForRunningPromptfoo, PromptfooTest, PromptfooAssertion, PromptfooTestResult, PromptfooLog, ForReportingProgress, ForTellingTime, ForRunningShellCommands, ShellCommandResult } from '@cherry-works/engine';
const fileReader: ForReadingFiles = {
  async readFilesRecursively(): Promise<readonly ReadFile[]> { return []; },
  async readBytesRecursively(): Promise<readonly ReadFile<Uint8Array>[]> { return [{file: new URL('memory://r/a'), contents: new Uint8Array([255])}]; },
  async listFolders() { return []; }, async readIfThere() { return undefined; },
  async readBytesIfThere() { return undefined; }, async listFiles(): Promise<readonly ListedFile[]> { return []; }
};
const fileWriter: ForWritingFiles = { async write(file, contents, options) { const fileContents: string | Uint8Array = contents; }, async delete() {}, async deleteFolder() {}, async deleteEmptyFolder() {} };
const charterApp: ForManagingCharter = new CharterAuthoring(new URL('memory://r/'), fileReader, {parse() {return {};}}, fileWriter, {countTokens() {return 0;}}, {});
const doctorOutcome: Promise<OutcomeDTOs.DoctorOutcome> = charterApp.doctor();
const faultSchema = DataDTOs.Fault;
`;
  await writeFile(join(consumerFolder, "consumer.ts"), consumerSource);
  const typecheckRun = spawnSync(process.execPath, [new URL("node_modules/typescript/bin/tsc", repositoryUrl).pathname, "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--lib", "ES2023,DOM", "consumer.ts"], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(typecheckRun.status, 0, typecheckRun.stdout + typecheckRun.stderr);
  assert.equal(enginePackageJson.name, "@cherry-works/engine");
  assert.deepEqual(Object.keys(enginePackageJson.dependencies).sort(), ["picomatch", "zod"]);
  assert.equal(enginePackageJson.license, packageJson.license);
  assert.match(await readFile(join(consumerFolder, "node_modules/@cherry-works/engine/LICENSE"), "utf8"), /^MIT License\n/);
});

test("the installed engine holds no CLI, portal, adapter or composition root (SDK Story 2 scenario 2)", async () => {
  const packageFiles = await readdir(join(consumerFolder, "node_modules/@cherry-works/engine"), { recursive: true });
  assert.deepEqual(packageFiles.sort(), ["LICENSE", "README.md", "index.d.ts", "index.js", "package.json"]);
  const engineCode = await readFile(join(consumerFolder, "node_modules/@cherry-works/engine/index.js"), "utf8");
  assert.doesNotMatch(engineCode, /^\/\/ src\/(?:driver|zdriven)\//m);
  const engineSourceFile = ts.createSourceFile("index.js", engineCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const importedPackages = engineSourceFile.statements.filter(ts.isImportDeclaration).map(importDeclaration => (importDeclaration.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual([...new Set(importedPackages)].sort(), ["picomatch", "zod"]);
});

test("the engine refuses internal imports and exports only its public contract (SDK Story 2 scenario 3)", () => {
  assert.deepEqual(Object.keys(enginePackageJson.exports), ["."]);
  runConsumerCode(`
import assert from 'node:assert/strict';
import * as engine from '@cherry-works/engine';
assert.deepEqual(Object.keys(engine).sort(), ['AGENT_PROVIDERS', 'AdapterFault', 'BUILTIN_LAYER', 'CharterAuthoring', 'CharterEvaluating', 'CharterPrimitiveFault', 'CharterVendoring', 'DataDTOs', 'DomainFault', 'EVAL_DIRECTORY', 'McpConnecting', 'OutcomeDTOs', 'REPO_LAYER', 'SensorRunning', 'SessionReviewing', 'TEST_DIRECTORY', 'TestAuthoring', 'UnauthorizedMcpFault', 'VENDOR_LAYER', 'VERSION', 'isAgentProvider'].sort());
for (const privateName of ['CharterRoot', 'WorkspaceSettingsSchema', 'folderURL', 'loadCharterRoot', 'RepoLayerPrimitive', 'BUILTIN_PRIMITIVES']) assert.equal(privateName in engine, false);
for (const privatePath of ['domain/models/DomainFault', 'service/charterRepo', 'index.js', 'package.json', 'application/CharterAuthoring']) await assert.rejects(import('@cherry-works/engine/' + privatePath), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'});
`);
});

test("the engine reports the version on its installed package and cw (SDK Story 2 scenario 4)", () => {
  assert.equal(enginePackageJson.version, packageJson.version);
  runConsumerCode(`import assert from 'node:assert/strict'; import { VERSION } from '@cherry-works/engine'; assert.equal(VERSION, ${JSON.stringify(packageJson.version)});`);
  const versionRun = spawnSync(process.execPath, ["dist/cw.js", "--version"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(versionRun.status, 0, versionRun.stderr);
  assert.equal(versionRun.stdout, `${enginePackageJson.version}\n`);
});

test("a consumer catches engine and adapter faults with their message and fix (SDK Story 2 scenario 5)", () => {
  runConsumerCode(`
import assert from 'node:assert/strict';
import { SensorRunning, DomainFault, AdapterFault } from '@cherry-works/engine';
assert.throws(() => new SensorRunning(new URL('urn:x'), {}, {}), fault => fault instanceof DomainFault && fault.message.includes('names no folder') && fault.fix.includes('Write an address'));
const adapterFault = new AdapterFault('Store unavailable.', 'Reconnect the store.');
const sensorApp = new SensorRunning(new URL('memory://r/'), {async readIfThere() {throw adapterFault;}}, {});
await assert.rejects(sensorApp.runSensors('Stop', '', 'claude'), fault => fault === adapterFault && fault instanceof DomainFault && fault.fix === 'Reconnect the store.');
`);
});

const charterConsumerCode = `
import assert from 'node:assert/strict';
import { CharterAuthoring } from '@cherry-works/engine';
const fileTextByAddress = new Map([['memory://r/.cw/settings.json', '{"agents":[]}']]);
const fileReader = {
 async readIfThere(file) {return fileTextByAddress.get(file.href);},
 async readBytesIfThere(file) {const fileText = fileTextByAddress.get(file.href); return fileText === undefined ? undefined : new TextEncoder().encode(fileText);},
 async readFilesRecursively(folder) {return [...fileTextByAddress].filter(([fileAddress]) => fileAddress.startsWith(folder.href)).map(([fileAddress, contents]) => ({file: new URL(fileAddress), contents}));},
 async readBytesRecursively(folder) {return (await this.readFilesRecursively(folder)).map(({file, contents}) => ({file, contents: new TextEncoder().encode(contents)}));},
 async listFolders() {return [];}, async listFiles() {return [];}
};
// This consumer only needs the flat headers emitted by the builtin primitives.
const yamlParser = {parse(headerBlock) {
 return Object.fromEntries(headerBlock.trim().split('\\n').map(headerLine => {
  const separatorIndex = headerLine.indexOf(':');
  const headerName = headerLine.slice(0, separatorIndex);
  const headerText = headerLine.slice(separatorIndex + 1).trim();
  let headerValue;
  try {headerValue = JSON.parse(headerText);} catch {headerValue = headerText;}
  return [headerName, headerValue];
 }));
}};
const charterApp = new CharterAuthoring(new URL('memory://r/'), fileReader, yamlParser, {}, {countTokens() {return 0;}}, {});
`;

test("validation through the installed engine answers faults by file (SDK Story 2 scenario 6)", () => {
  runConsumerCode(charterConsumerCode + `
fileTextByAddress.set('memory://r/.cw/charter/guide/broken/index.md', '---\\nkind: guide\\nid: broken\\n---\\nBody');
const doctorOutcome = await charterApp.doctor();
assert.deepEqual(Object.keys(doctorOutcome.data.faultsByFile.data.files), ['.cw/charter/guide/broken/index.md']);
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
const primitiveList = await charterApp.fullList();
assert.equal(primitiveList.type, 'Primitives', JSON.stringify(primitiveList));
for (const primitiveId of ['cw-author', 'cw-session-cost', 'cw-session-tokens-counter', 'cw-session-tokens-counter-on-stop']) assert.ok(primitiveList.data.primitives.some(primitive => primitive.data.id === primitiveId));
const counterPrimitive = await charterApp.open('cw-session-tokens-counter');
assert.ok(counterPrimitive.data.body.includes('session-analysis.jsonl'));
const fileBytesByAddress = new Map();
const buildingApp = new CharterAuthoring(new URL('memory://r/'), fileReader, yamlParser, {async write(file, contents) {fileBytesByAddress.set(file.href, contents);}, async delete() {}, async deleteFolder() {}, async deleteEmptyFolder() {}}, {countTokens() {return 0;}}, {});
const buildOutcome = await buildingApp.build();
assert.equal(buildOutcome.type, 'PlanSummary');
const scriptBytes = fileBytesByAddress.get('memory://r/.cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs');
assert.ok(scriptBytes instanceof Uint8Array);
assert.ok(new TextDecoder().decode(scriptBytes).includes('appendFile'));
`);
});

test("installing cw still adds its existing package with no engine dependency (SDK Story 2 scenario 8)", () => {
  assert.equal("dependencies" in packageJson, false);
  const packRun = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd: repositoryUrl, encoding: "utf8" });
  assert.equal(packRun.status, 0, packRun.stderr);
  const packedPaths: string[] = JSON.parse(packRun.stdout)[0].files.map(({ path }: { path: string }) => path);
  assert.deepEqual(packedPaths.filter(packagePath => !packagePath.startsWith("dist/")).sort(), ["LICENSE", "README.md", "package.json"]);
  assert.ok(packedPaths.every(packagePath => !packagePath.includes("engine/")));
});

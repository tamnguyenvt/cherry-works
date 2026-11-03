import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
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
function runConsumerCode(consumerCode: string): string {
  const consumerRun = spawnSync(process.execPath, ["--input-type=module", "--eval", consumerCode], { cwd: consumerFolder, encoding: "utf8" });
  assert.equal(consumerRun.status, 0, consumerRun.stderr);
  assert.equal(consumerRun.stderr, "");
  return consumerRun.stdout;
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

/** An integrator's adapters: no repository implementation is imported. The
 *  parser accepts the flat YAML headers this consumer authors, not arbitrary YAML. */
const memoryAuthoringConsumerCode = String.raw`
import assert from 'node:assert/strict';
import { CharterAuthoring, DomainFault } from '@cherry-works/engine';
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
const fileReader = {
 async readBytesIfThere(file) { return fileBytesByAddress.get(file.href)?.slice(); },
 async readIfThere(file) {
  const fileBytes = await this.readBytesIfThere(file);
  return fileBytes === undefined ? undefined : new TextDecoder().decode(fileBytes);
 },
 async readBytesRecursively(folder) {
  return [...fileBytesByAddress].filter(([fileAddress]) => fileAddress.startsWith(folder.href))
   .map(([fileAddress, fileBytes]) => ({ file: new URL(fileAddress), contents: fileBytes.slice() }));
 },
 async readFilesRecursively(folder) {
  return (await this.readBytesRecursively(folder)).map(({ file, contents }) => ({ file, contents: new TextDecoder().decode(contents) }));
 },
 async listFolders(folder) {
  const folderNames = [...fileBytesByAddress.keys()].filter(fileAddress => fileAddress.startsWith(folder.href))
   .map(fileAddress => fileAddress.slice(folder.href.length)).filter(filePath => filePath.includes('/'))
   .map(filePath => filePath.split('/')[0]);
  return [...new Set(folderNames)].map(folderName => new URL(folderName + '/', folder));
 },
 async listFiles(folder) {
  return [...fileBytesByAddress.keys()].filter(fileAddress => fileAddress.startsWith(folder.href) && !fileAddress.slice(folder.href.length).includes('/'))
   .map(fileAddress => ({ file: new URL(fileAddress), modifiedAt: new Date(0) }));
 }
};
const fileWriter = {
 async write(file, fileContents) {
  fileBytesByAddress.set(file.href, typeof fileContents === 'string' ? new TextEncoder().encode(fileContents) : fileContents.slice());
 },
 async delete(file) { fileBytesByAddress.delete(file.href); },
 async deleteFolder(folder) {
  for (const fileAddress of fileBytesByAddress.keys()) if (fileAddress.startsWith(folder.href)) fileBytesByAddress.delete(fileAddress);
 },
 async deleteEmptyFolder() {} // Empty folders have no map entry.
};
const yamlParser = { parse(headerBlock) {
 return Object.fromEntries(headerBlock.trim().split('\n').map(headerLine => {
  const separatorIndex = headerLine.indexOf(':');
  const headerName = headerLine.slice(0, separatorIndex);
  const headerText = headerLine.slice(separatorIndex + 1).trim();
  let headerValue;
  try { headerValue = JSON.parse(headerText); } catch { headerValue = headerText; }
  return [headerName, headerValue];
 }));
}};
const tokenCounter = { countTokens(text) { return text.length; } };
const charterApp = new CharterAuthoring(repositoryAddress, fileReader, yamlParser, fileWriter, tokenCounter, {});
const guideHeaders = { description: 'Keep a clear boundary.', globs: ['src/**'] };
`;

test("setup through the installed engine keeps settings, empty kind files and its first build in memory (SDK Story 3 scenario 1)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
const setupOutcome = await charterApp.init({ agents: ['claude'] });
assert.equal(setupOutcome.type, 'PlanSummary', JSON.stringify(setupOutcome));
assert.deepEqual(JSON.parse(await fileReader.readIfThere(new URL('.cw/settings.json', repositoryAddress))), { agents: ['claude'] });
const primitiveKinds = await charterApp.kinds();
for (const primitiveKind of Object.keys(primitiveKinds.data)) {
 assert.deepEqual(await fileReader.readBytesIfThere(new URL('.cw/charter/' + primitiveKind + '/.gitkeep', repositoryAddress)), new Uint8Array());
}
assert.match(await fileReader.readIfThere(new URL('.cw/out/CHARTER.md', repositoryAddress)), /Charter/);
assert.ok(fileBytesByAddress.has(new URL('CLAUDE.md', repositoryAddress).href));
assert.ok([...fileBytesByAddress.keys()].every(fileAddress => fileAddress.startsWith(repositoryAddress.href)));
assert.equal(forbiddenCallCount, 0);
`);
});

test("adding and validating a guide through the installed engine uses only its own adapters (SDK Story 3 scenario 2)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await charterApp.init({ agents: ['claude'] });
const addedPrimitive = await charterApp.add('guide', 'clear-boundary', guideHeaders, 'Keep the boundary clear.');
assert.equal(addedPrimitive.type, 'Primitive', JSON.stringify(addedPrimitive));
assert.match(await fileReader.readIfThere(new URL('.cw/charter/guide/clear-boundary/index.md', repositoryAddress)), /Keep the boundary clear\./);
const doctorOutcome = await charterApp.doctor();
assert.equal(doctorOutcome.data.errorCount, 0, JSON.stringify(doctorOutcome));
const buildOutcome = await charterApp.build();
assert.equal(buildOutcome.type, 'PlanSummary', JSON.stringify(buildOutcome));
assert.match(await fileReader.readIfThere(new URL('.cw/out/guide/clear-boundary/index.md', repositoryAddress)), /Keep the boundary clear\./);
assert.equal(forbiddenCallCount, 0);
`);
});

test("an invalid addition through the installed engine answers faults and writes nothing (SDK Story 3 scenario 3)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await charterApp.init({ agents: ['claude'] });
const originalFiles = [...fileBytesByAddress];
const refusedPrimitive = await charterApp.add('guide', 'broken', {}, 'Body');
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
await charterApp.init({ agents: ['claude'] });
await charterApp.add('guide', 'clear-boundary', guideHeaders, 'Keep the boundary clear.');
const assetFile = new URL('.cw/charter/guide/clear-boundary/' + encodeURIComponent('a #%.bin'), repositoryAddress);
await fileWriter.write(assetFile, new Uint8Array([0, 255, 128, 13, 10]));
const buildOutcome = await charterApp.build();
assert.equal(buildOutcome.type, 'PlanSummary', JSON.stringify(buildOutcome));
assert.deepEqual(await fileReader.readBytesIfThere(new URL('.cw/out/guide/clear-boundary/' + encodeURIComponent('a #%.bin'), repositoryAddress)), new Uint8Array([0, 255, 128, 13, 10]));
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
await charterApp.init({ agents: ['claude'] });
await charterApp.ensureRepoReady();
assert.deepEqual((await charterApp.settings()).data.agents, ['claude']);
assert.equal((await charterApp.listPrimitiveRequirements('guide')).type, 'PrimitiveRequirements');
await charterApp.add('guide', 'clear-boundary', guideHeaders, 'First body.');
assert.equal((await charterApp.list('guide')).type, 'Catalogue');
assert.equal((await charterApp.fullList('clear-boundary')).data.primitives.length, 1);
assert.equal((await charterApp.explain('clear-boundary')).type, 'ExplanationOutcome');
const openedPrimitive = await charterApp.open('clear-boundary');
assert.equal(openedPrimitive.data.body, 'First body.');
assert.equal((await charterApp.rewrite('clear-boundary', guideHeaders, 'Second body.', openedPrimitive.data.hash)).type, 'Primitive');
assert.equal((await charterApp.open('clear-boundary')).data.body, 'Second body.');
await assert.rejects(charterApp.rewrite('clear-boundary', guideHeaders, 'Stale body.', openedPrimitive.data.hash), DomainFault);
const filesBeforePreview = [...fileBytesByAddress];
const previewOutcome = await charterApp.preview();
assert.equal(previewOutcome.type, 'PlanSummary');
assert.deepEqual([...fileBytesByAddress], filesBeforePreview);
assert.equal((await charterApp.predictMainContext({ exact: false })).type, 'MainContexts');
assert.equal((await charterApp.test()).type, 'TestRunReport');
assert.equal((await charterApp.build()).type, 'PlanSummary');
assert.deepEqual((await charterApp.preview()).data.added, []);
assert.deepEqual((await charterApp.preview()).data.edited, []);
const escapedAssetFile = new URL('.cw/charter/guide/clear-boundary/' + encodeURIComponent('a #%.bin'), repositoryAddress);
await fileWriter.write(escapedAssetFile, new Uint8Array([0, 255]));
assert.equal((await charterApp.remove('clear-boundary')).type, 'Primitive');
assert.equal(await fileReader.readBytesIfThere(escapedAssetFile), undefined);
assert.equal(await fileReader.readIfThere(new URL('.cw/charter/guide/clear-boundary/index.md', repositoryAddress)), undefined);
const cleanupOutcome = await charterApp.build();
assert.equal(cleanupOutcome.type, 'PlanSummary');
assert.ok(cleanupOutcome.data.deleted.includes('.cw/out/guide/clear-boundary/index.md'));
assert.equal(await fileReader.readIfThere(new URL('.cw/out/guide/clear-boundary/index.md', repositoryAddress)), undefined);
// A missing kind folder is empty, and setup reads back even when empty files are dropped.
for (const fileAddress of fileBytesByAddress.keys()) if (fileAddress.endsWith('/.gitkeep')) fileBytesByAddress.delete(fileAddress);
assert.equal((await charterApp.doctor()).data.errorCount, 0);
assert.equal((await charterApp.build()).type, 'PlanSummary');
assert.equal(forbiddenCallCount, 0);
`);
});

test("a memory build reports a failed write and keeps completed writes (SDK Story 3 write-failure edge case)", () => {
  runConsumerCode(memoryAuthoringConsumerCode + String.raw`
await charterApp.init({ agents: ['claude'] });
await charterApp.add('guide', 'first-guide', guideHeaders, 'First guide.');
await charterApp.add('guide', 'second-guide', guideHeaders, 'Second guide.');
const completedWriteAddresses = [];
const failingWriter = { ...fileWriter, async write(file, fileContents, writeOptions) {
 if (completedWriteAddresses.length === 1) throw new DomainFault('Store write refused.', 'Reconnect the store.');
 await fileWriter.write(file, fileContents, writeOptions);
 completedWriteAddresses.push(file.href);
}};
const failingApp = new CharterAuthoring(repositoryAddress, fileReader, yamlParser, failingWriter, tokenCounter, {});
await assert.rejects(failingApp.build(), fault => fault instanceof DomainFault && fault.message.includes('Store write refused.') && fault.fix.length > 0);
assert.equal(completedWriteAddresses.length, 1);
assert.ok(fileBytesByAddress.has(completedWriteAddresses[0]));
assert.equal((await charterApp.build()).type, 'PlanSummary');
assert.equal(forbiddenCallCount, 0);
`);
});

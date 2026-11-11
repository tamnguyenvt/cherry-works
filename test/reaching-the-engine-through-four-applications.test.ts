import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { CodexProjection } from "../src/module/charter/infra/codex/codex-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import { composeApplications } from "../src/module/composition.js";
import { FileSessionAnalysisRepository } from "../src/module/runtime/infra/file-session-analysis.repository.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { FileWorkspaceSettingsRepository } from "../src/module/workspace/infra/file-workspace-settings.repository.js";
import { inARelease } from "./a-release.js";

const repositoryUrl = new URL("../", import.meta.url);
const hexagonFolderUrl = new URL("src/module/", repositoryUrl);

/** What each module's application covers (CORE-FR-222), by the operations
 *  of its driver port. */
const operationNamesByPortName = {
  ForAuthoringCharter: [
    "list",
    "fullList",
    "explain",
    "kinds",
    "listPrimitiveRequirements",
    "add",
    "open",
    "rewrite",
    "remove",
    "addVendor",
    "injectVendor",
    "removeVendor",
    "vendors",
    "suites",
    "addSuite",
    "writeSuite",
    "removeSuite",
    "evalSuites",
    "addEvalSuite",
    "writeEvalSuite",
    "removeEvalSuite",
    "signInStatus",
    "signInWithToken",
    "signInWithOAuth",
    "test",
    "setUpCharter",
    "layout",
    "accessToken",
  ],
  ForBuildingCharter: [
    "doctor",
    "build",
    "preview",
    "predictMainContext",
    "tools",
    "declaredTools",
    "sensorCommands",
    "buildInto",
    "mainContextTexts",
    "evalCases",
  ],
  ForRunningCharter: ["runSensors", "call", "countMainContext", "evaluate", "analyze", "sessionSummary"],
  ForManagingWorkspace: ["settings", "setUp"],
} as const;
const portFileUrlByPortName = {
  ForAuthoringCharter: new URL("charter/app/port/in/authoring-charter.port.ts", hexagonFolderUrl),
  ForBuildingCharter: new URL("charter/app/port/in/building-charter.port.ts", hexagonFolderUrl),
  ForRunningCharter: new URL("runtime/app/port/in/running-charter.port.ts", hexagonFolderUrl),
  ForManagingWorkspace: new URL("workspace/app/port/in/managing-workspace.port.ts", hexagonFolderUrl),
} as const;

/** Each operation a driver port's interface declares, with the types of its
 *  parameters and of what it answers, as written. */
function operationsOf(portName: keyof typeof portFileUrlByPortName) {
  const portFileUrl = portFileUrlByPortName[portName];
  const portFileName = portFileUrl.pathname;
  const sourceFile = ts.createSourceFile(portFileName, readFileSync(portFileUrl, "utf8"), ts.ScriptTarget.Latest, true);
  const portInterface = sourceFile.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === portName,
  );
  assert.ok(portInterface, `${portFileName} declares no ${portName}`);
  return portInterface.members.filter(ts.isMethodSignature).map((methodSignature) => ({
    operationName: methodSignature.name.getText(sourceFile),
    parameterTypeTexts: methodSignature.parameters.map((parameter) => parameter.type?.getText(sourceFile) ?? ""),
    answerTypeText: methodSignature.type?.getText(sourceFile) ?? "",
  }));
}

test("the published package's driver ports are the modules' applications, each covering what it is given (CORE Story 49 scenario 1)", async () => {
  // What the package a tool installs offers, read off what `pnpm build`
  // leaves: `pnpm test` builds first, so it is this working tree's.
  const builtContractText = readFileSync(new URL("dist/index.d.ts", repositoryUrl), "utf8");
  const builtExportedNames = new Set(
    [...builtContractText.matchAll(/^export \{ (.+) \};$/gm)].flatMap((exportMatch) =>
      exportMatch[1]!.split(", ").map((exportedName) => exportedName.replace(/^type /, "").replace(/ as \w+$/, "")),
    ),
  );
  for (const portName of Object.keys(operationNamesByPortName))
    assert.ok(builtExportedNames.has(portName), `the package exports no ${portName}`);

  // Composed through the package, each application answers its port's
  // operations and nothing else.
  const { composeApplications: builtComposeApplications } = await import(new URL("dist/index.js", repositoryUrl).href);
  const composedApplications = await builtComposeApplications(new URL("memory:/repo/"), new URL("memory:/home/"));
  const operationNamesByAppName = {
    charterAuthoringApp: Object.keys(composedApplications.engineApp.charterAuthoringApp),
    charterBuildingApp: Object.keys(composedApplications.engineApp.charterBuildingApp),
    charterRuntimeApp: Object.keys(composedApplications.engineApp.charterRuntimeApp),
    workspaceApp: Object.getOwnPropertyNames(Object.getPrototypeOf(composedApplications.workspaceApp)).filter(
      (operationName) => operationName !== "constructor",
    ),
  };
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(operationNamesByAppName).map(([appName, operationNames]) => [appName, [...operationNames].sort()]),
    ),
    {
      charterAuthoringApp: [...operationNamesByPortName.ForAuthoringCharter].sort(),
      charterBuildingApp: [...operationNamesByPortName.ForBuildingCharter].sort(),
      charterRuntimeApp: [...operationNamesByPortName.ForRunningCharter].sort(),
      workspaceApp: [...operationNamesByPortName.ForManagingWorkspace].sort(),
    },
  );
  // And each port, as written, declares those same operations.
  for (const [portName, operationNames] of Object.entries(operationNamesByPortName))
    assert.deepEqual(
      operationsOf(portName as keyof typeof operationNamesByPortName)
        .map(({ operationName }) => operationName)
        .sort(),
      [...operationNames].sort(),
      portName,
    );
});

const repoFolder = new URL("file:///repo/");
const homeFolder = new URL("file:///home/");
const repoFileUrlOf = (path: string) => new URL(path, repoFolder).href;
const keptGuideText =
  '---\nkind: guide\nid: kept-guide\ndescription: A guide kept by its kind and id.\nglobs: ["src/**/*.ts"]\n---\nKeep it.\n';
const keptSkillText = '---\nkind: skill\nid: kept-skill\ndescription: Keep it.\ntriggers: ["keep it"]\n---\nKeep it.\n';
const testSuiteText = `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "kept-guide" } }] })}\n`;
const evalSuiteText = `${JSON.stringify({ cases: [{ prompt: "keep it", expect: { invoke: "kept-skill" } }] })}\n`;

/** The applications composed as `cw` composes them, over a repository set up
 *  for Claude and held in memory, every adapter that would reach past memory
 *  held there too. */
async function applicationsInMemory() {
  const fileReader = new InMemoryFileReaders({
    [repoFileUrlOf(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"] })}\n`,
    [repoFileUrlOf(".cw/charter/primitive/guide/kept-guide/index.md")]: keptGuideText,
    [repoFileUrlOf(".cw/charter/primitive/skill/kept-skill/index.md")]: keptSkillText,
    [repoFileUrlOf(".cw/charter/test/kept.json")]: testSuiteText,
    [repoFileUrlOf(".cw/charter/eval/skills.json")]: evalSuiteText,
  });
  const fileWriter = new InMemoryFileOutput(fileReader);
  const sourceFetcher = new InMemorySources(fileReader);
  const promptfooRunner = new InMemoryPromptfoo();
  promptfooRunner.folderFiles = fileReader;
  return composeApplications(repoFolder, homeFolder, {
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
    agentProvider: {
      claude: { projection: new ClaudeProjection(fileReader), cli: new InMemoryAgentCli() },
      codex: { projection: new CodexProjection(fileReader), cli: new InMemoryAgentCli() },
    },
    charterRepository: new FileCharterRepository(fileReader, fileWriter, sourceFetcher),
    sessionAnalysisRepository: new FileSessionAnalysisRepository(
      (rootFolder) => new InMemoryFileReaders({}, rootFolder),
      repoFolder,
      homeFolder,
    ),
    workspaceSettingsRepository: new FileWorkspaceSettingsRepository(fileReader, fileWriter),
    localOutput: new LocalRepoManipulator(fileReader, fileWriter),
  });
}

/** Whether a value is made of plain data alone: strings, numbers, booleans,
 *  bytes, and arrays and objects of them, none an instance of a class. */
function isPlainData(value: unknown): boolean {
  if (value === null || typeof value !== "object") return typeof value !== "function" && typeof value !== "symbol";
  if (value instanceof Uint8Array) return true;
  const valuePrototype = Object.getPrototypeOf(value);
  if (valuePrototype !== Object.prototype && valuePrototype !== Array.prototype && valuePrototype !== null)
    return false;
  return Object.values(value).every(isPlainData);
}

test("every operation of the engine, called over a charter, answers the caller plain data, none of it the engine's own models (CORE Story 49 scenario 2)", async () => {
  const { workspaceApp, engineApp } = await applicationsInMemory();
  const { charterAuthoringApp, charterBuildingApp, charterRuntimeApp } = engineApp;
  const mcpOriginAddress = { address: "https://mcp.example.test/", mcpId: "example" };
  // Each operation, called as a driver calls it, in an order where the ones
  // before leave something for the ones after.
  const operationCallByNameByPortName: Record<string, Record<string, () => Promise<unknown>>> = {
    ForManagingWorkspace: {
      settings: () => workspaceApp.settings(),
      setUp: () => workspaceApp.setUp(["claude"], "0.0.0"),
    },
    ForAuthoringCharter: {
      setUpCharter: () => charterAuthoringApp.setUpCharter(),
      layout: () => charterAuthoringApp.layout(),
      list: () => charterAuthoringApp.list(),
      fullList: () => charterAuthoringApp.fullList(),
      explain: () => charterAuthoringApp.explain("kept-guide"),
      kinds: () => charterAuthoringApp.kinds(),
      listPrimitiveRequirements: () => charterAuthoringApp.listPrimitiveRequirements("guide"),
      add: () =>
        charterAuthoringApp.add("guide", "added-guide", { description: "Added.", globs: ["src/**/*.ts"] }, "Body."),
      open: () => charterAuthoringApp.open("added-guide"),
      rewrite: () =>
        charterAuthoringApp.rewrite("added-guide", { description: "Rewritten." }, "Body.", "not-the-opened-hash"),
      remove: () => charterAuthoringApp.remove("added-guide"),
      addVendor: () => charterAuthoringApp.addVendor("memory:/no-such-source/"),
      injectVendor: () => charterAuthoringApp.injectVendor("memory:/no-such-source/"),
      removeVendor: () => charterAuthoringApp.removeVendor("no-such-vendor"),
      vendors: () => charterAuthoringApp.vendors(),
      suites: () => charterAuthoringApp.suites(),
      addSuite: () => charterAuthoringApp.addSuite(),
      writeSuite: () => charterAuthoringApp.writeSuite("kept", testSuiteText),
      removeSuite: () => charterAuthoringApp.removeSuite("no-such-suite"),
      evalSuites: () => charterAuthoringApp.evalSuites(),
      addEvalSuite: () => charterAuthoringApp.addEvalSuite(),
      writeEvalSuite: () => charterAuthoringApp.writeEvalSuite("skills", evalSuiteText),
      removeEvalSuite: () => charterAuthoringApp.removeEvalSuite("no-such-suite"),
      signInStatus: () => charterAuthoringApp.signInStatus(),
      signInWithToken: () => charterAuthoringApp.signInWithToken(mcpOriginAddress.address, "a-token"),
      signInWithOAuth: () => charterAuthoringApp.signInWithOAuth(mcpOriginAddress.address, () => {}),
      accessToken: () => charterAuthoringApp.accessToken(mcpOriginAddress, false),
      test: () => charterAuthoringApp.test(),
    },
    ForBuildingCharter: {
      doctor: () => charterBuildingApp.doctor(),
      preview: () => charterBuildingApp.preview(),
      build: () => charterBuildingApp.build(),
      predictMainContext: () => charterBuildingApp.predictMainContext(),
      mainContextTexts: () => charterBuildingApp.mainContextTexts(),
      tools: () => charterBuildingApp.tools(),
      declaredTools: () => charterBuildingApp.declaredTools(),
      sensorCommands: () => charterBuildingApp.sensorCommands("Stop", "claude"),
      buildInto: () => charterBuildingApp.buildInto("/checkout"),
      evalCases: () => charterBuildingApp.evalCases("/checkout"),
    },
    ForRunningCharter: {
      runSensors: () => charterRuntimeApp.runSensors("Stop", "", "claude"),
      call: () => charterRuntimeApp.call("example__tool", {}),
      countMainContext: () => charterRuntimeApp.countMainContext(),
      evaluate: () => charterRuntimeApp.evaluate("claude"),
      analyze: () => charterRuntimeApp.analyze(),
      sessionSummary: () => charterRuntimeApp.sessionSummary(),
    },
  };
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(operationCallByNameByPortName).map(([portName, operationCallByName]) => [
        portName,
        Object.keys(operationCallByName).sort(),
      ]),
    ),
    Object.fromEntries(
      Object.entries(operationNamesByPortName).map(([portName, operationNames]) => [
        portName,
        [...operationNames].sort(),
      ]),
    ),
  );
  for (const [portName, operationCallByName] of Object.entries(operationCallByNameByPortName))
    for (const [operationName, callOperation] of Object.entries(operationCallByName)) {
      const operationAnswer = await callOperation();
      const operationLabel = `${portName}.${operationName}`;
      assert.equal(typeof operationAnswer, "object", operationLabel);
      assert.equal(typeof (operationAnswer as { type?: unknown }).type, "string", operationLabel);
      assert.ok(isPlainData(operationAnswer), `${operationLabel} answers more than plain data`);
      assert.deepStrictEqual(structuredClone(operationAnswer), operationAnswer, operationLabel);
    }
});

test("a driver port answers shapes made for the driver, and takes none of the domain's models (CORE Story 49 scenario 2)", () => {
  // What a driver writes and reads: DTOs, plain values, and the shapes each
  // port declares for it.
  const driverTypePattern =
    /^(string|number|boolean|readonly string\[\]|Readonly<Record<string, unknown>>|\{ readonly exact: boolean \}|\(authorizationUrl: string\) => void|AgentProviderName|UnparsedHeaders|SettingsOptions|McpOriginAddress|readonly string\[\]|number)$/;
  for (const portName of Object.keys(operationNamesByPortName) as (keyof typeof operationNamesByPortName)[])
    for (const { operationName, parameterTypeTexts, answerTypeText } of operationsOf(portName)) {
      const answerMatch = answerTypeText.match(/^Promise<(.+)>$/);
      assert.ok(answerMatch, `${portName}.${operationName} answers ${answerTypeText}`);
      for (const answerTypeName of answerMatch[1]!.split(" | "))
        assert.match(
          answerTypeName,
          /^(CharterDTOs|RuntimeDTOs|WorkspaceDTOs|FaultDTOs)\.\w+$/,
          `${portName}.${operationName} answers ${answerTypeName}`,
        );
      for (const parameterTypeText of parameterTypeTexts)
        assert.match(parameterTypeText, driverTypePattern, `${portName}.${operationName} takes ${parameterTypeText}`);
    }
  // Every model a driven port a tool may replace names is public to the
  // adapters behind it (CORE-FR-223, SDK-FR-020); the base of every fault
  // stays the engine's.
  const engineIndexText = readFileSync(new URL("src/index.ts", repositoryUrl), "utf8");
  const exportedNames = new Set(
    [...engineIndexText.matchAll(/^export \{ (.+) \} from /gm)].flatMap((exportMatch) =>
      exportMatch[1]!.split(", ").map((exportedName) => exportedName.replace(/^type /, "")),
    ),
  );
  const drivenPortFolderUrls = ["charter", "runtime", "shared"].map(
    (moduleName) => new URL(`${moduleName}/app/port/out/`, hexagonFolderUrl),
  );
  const drivenModelNames = drivenPortFolderUrls
    .flatMap((drivenPortFolderUrl) =>
      readdirSync(drivenPortFolderUrl).map((portFileName) => new URL(portFileName, drivenPortFolderUrl)),
    )
    .filter((portFileUrl) =>
      [...readFileSync(portFileUrl, "utf8").matchAll(/^export interface (For\w+)/gm)].some((portMatch) =>
        exportedNames.has(portMatch[1]!),
      ),
    )
    .flatMap((portFileUrl) => [
      ...readFileSync(portFileUrl, "utf8").matchAll(
        /^import (?:type )?\{ (.+) \} from "(?:\.\.\/)+(?:(?:shared|charter|runtime|workspace)\/)?domain\/models\/.+";$/gm,
      ),
    ])
    .flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, "")))
    .filter((modelName) => modelName !== "DomainFault");
  assert.deepEqual(
    [...new Set(drivenModelNames)].filter((modelName) => !exportedNames.has(modelName)),
    [],
  );
});

test("every command and the portal are handed the modules' applications and nothing else (CORE-FR-222)", () => {
  const contextText = readFileSync(
    new URL("src/presentation/cli/commands/command.interface.ts", repositoryUrl),
    "utf8",
  );
  const contextAppTypeNames = [...contextText.matchAll(/^ {2}readonly \w+App: (For\w+);$/gm)].map(
    (appMatch) => appMatch[1]!,
  );
  assert.deepEqual(contextAppTypeNames.sort(), Object.keys(operationNamesByPortName).sort());
  const portalRoutesText = readFileSync(new URL("src/presentation/portal/portal.routes.ts", repositoryUrl), "utf8");
  const portalPortNames = [
    ...portalRoutesText.matchAll(/^import (?:type )?\{ ([^}]+) \} from "#module\/[\w-]+\/module\.js";$/gm),
  ]
    .flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, "")))
    .filter((importedName) => importedName.startsWith("For"));
  assert.deepEqual(portalPortNames.sort(), ["ForAuthoringCharter", "ForBuildingCharter"]);
});

test("the driver ports changed and the models made public are released only as a new major, the changelog naming each change, as is a change to a model a driven port names (CORE Story 49 scenario 4)", async () => {
  const builtContractText = readFileSync(new URL("dist/index.d.ts", repositoryUrl), "utf8");
  // The contract as a release before the four applications recorded it: one of
  // the seven driver ports there, exported.
  const lastContractText = builtContractText
    .replace(
      "\ndeclare const VERSION: string;",
      "\ninterface ForKeepingCharter {\n    build(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;\n}\ndeclare const VERSION: string;",
    )
    .replace("export { ", "export { type ForKeepingCharter, ");
  await inARelease(
    { currentVersion: "1.0.0", nextVersion: "1.1.0", releaseMode: "dry-run", builtContractText, lastContractText },
    async (releaseRun) => {
      assert.equal(releaseRun.status, 1);
      assert.match(releaseRun.stderr, /1\.1\.0 is not a new major.*removes .*ForKeepingCharter.*Release 2\.0\.0/);
    },
  );
  // A model a driven port a tool may replace names is the contract too: the
  // output part every projection is handed, with a member it did not have.
  const outputPartPathText =
    "\n    /** Where it lands inside the build's output: `guide/no-any/index.md`. */\n    readonly path: string;\n    constructor";
  assert.ok(builtContractText.includes(`declare class OutputPart {`));
  assert.ok(builtContractText.includes(outputPartPathText));
  const contractBeforeOutputPartPathText = builtContractText.replace(outputPartPathText, "\n    constructor");
  await inARelease(
    {
      currentVersion: "1.0.0",
      nextVersion: "1.1.0",
      releaseMode: "dry-run",
      builtContractText,
      lastContractText: contractBeforeOutputPartPathText,
    },
    async (releaseRun) => {
      assert.equal(releaseRun.status, 1);
      assert.match(releaseRun.stderr, /1\.1\.0 is not a new major.*changes .*\bOutputPart\b.*Release 2\.0\.0/);
    },
  );
  const changelogText =
    "# Changelog\n\n## 2.0.0 — 2026-11-07\n\n- `ForKeepingCharter` is gone: the engine is reached through `ForAuthoringCharter`, `ForRunningCharter`, `ForRunningCharter` and `ForRunningCharter`.\n";
  await inARelease(
    {
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
      releaseMode: "dry-run",
      builtContractText,
      lastContractText,
      changelogText,
    },
    async (releaseRun) => {
      assert.equal(releaseRun.status, 0, releaseRun.stderr);
    },
  );
});

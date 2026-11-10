import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { inARelease } from "./a-release.js";

const repositoryUrl = new URL("../", import.meta.url);
const hexagonFolderUrl = new URL("src/module/", repositoryUrl);

/** What each module's application covers (CORE-FR-222), by the operations
 *  of its driver port. */
const operationNamesByPortName = {
  ForAuthoringCharter: [
    "list", "fullList", "explain", "kinds", "listPrimitiveRequirements", "add", "open", "rewrite", "remove",
    "addVendor", "injectVendor", "removeVendor", "vendors",
    "suites", "addSuite", "writeSuite", "removeSuite",
    "evalSuites", "addEvalSuite", "writeEvalSuite", "removeEvalSuite",
    "signInStatus", "signInWithToken", "signInWithOAuth",
    "test", "setUpCharter", "layout", "accessToken",
  ],
  ForBuildingCharter: ["doctor", "build", "preview", "predictMainContext", "tools", "declaredTools", "sensorCommands", "buildInto", "mainContextTexts", "evalCases"],
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
  const portInterface = sourceFile.statements.find((statement): statement is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(statement) && statement.name.text === portName);
  assert.ok(portInterface, `${portFileName} declares no ${portName}`);
  return portInterface.members.filter(ts.isMethodSignature).map((methodSignature) => ({
    operationName: methodSignature.name.getText(sourceFile),
    parameterTypeTexts: methodSignature.parameters.map((parameter) => parameter.type?.getText(sourceFile) ?? ""),
    answerTypeText: methodSignature.type?.getText(sourceFile) ?? "",
  }));
}

test("the published package's driver ports are the modules' applications, each covering what it is given (CORE Story 49 scenario 1)", () => {
  const engineIndexText = readFileSync(new URL("src/index.ts", repositoryUrl), "utf8");
  const declaredDriverPortNames = new Set(
    ["charter", "runtime"].flatMap((moduleName) =>
      readdirSync(new URL(`${moduleName}/app/port/in/`, hexagonFolderUrl))
        .filter((portFileName) => portFileName.endsWith(".port.ts"))
        .flatMap((portFileName) => [...readFileSync(new URL(`${moduleName}/app/port/in/${portFileName}`, hexagonFolderUrl), "utf8").matchAll(/^export interface (For\w+)/gm)].map((portMatch) => portMatch[1]!)),
    ),
  );
  const exportedDriverPortNames = [...engineIndexText.matchAll(/\btype (For\w+)\b/g)].map((exportMatch) => exportMatch[1]!).filter((portName) => declaredDriverPortNames.has(portName));
  // The workspace is no module of the engine: whoever composes it reads the
  // settings and hands them in (CORE-FR-222, CORE-FR-231).
  assert.deepEqual(exportedDriverPortNames.sort(), Object.keys(operationNamesByPortName).filter((portName) => portName !== "ForManagingWorkspace").sort());
  for (const [portName, operationNames] of Object.entries(operationNamesByPortName))
    assert.deepEqual(operationsOf(portName as keyof typeof operationNamesByPortName).map(({ operationName }) => operationName).sort(), [...operationNames].sort(), portName);
});

test("a driver port answers shapes made for the driver, and takes none of the domain's models (CORE Story 49 scenario 2)", () => {
  // What a driver writes and reads: DTOs, plain values, and the shapes each
  // port declares for it.
  const driverTypePattern = /^(string|number|boolean|readonly string\[\]|Readonly<Record<string, unknown>>|\{ readonly exact: boolean \}|\(authorizationUrl: string\) => void|AgentProviderName|UnparsedHeaders|SettingsOptions|McpOriginAddress|readonly string\[\]|number)$/;
  for (const portName of Object.keys(operationNamesByPortName) as (keyof typeof operationNamesByPortName)[])
    for (const { operationName, parameterTypeTexts, answerTypeText } of operationsOf(portName)) {
      const answerMatch = answerTypeText.match(/^Promise<(.+)>$/);
      assert.ok(answerMatch, `${portName}.${operationName} answers ${answerTypeText}`);
      for (const answerTypeName of answerMatch[1]!.split(" | ")) assert.match(answerTypeName, /^(CharterDTOs|RuntimeDTOs|WorkspaceDTOs|FaultDTOs)\.\w+$/, `${portName}.${operationName} answers ${answerTypeName}`);
      for (const parameterTypeText of parameterTypeTexts) assert.match(parameterTypeText, driverTypePattern, `${portName}.${operationName} takes ${parameterTypeText}`);
    }
  // Every model a driven port names is public to the adapters behind it
  // (CORE-FR-223); the base of every fault stays the engine's.
  const engineIndexText = readFileSync(new URL("src/index.ts", repositoryUrl), "utf8");
  const exportedNames = new Set([...engineIndexText.matchAll(/^export \{ (.+) \} from /gm)].flatMap((exportMatch) => exportMatch[1]!.split(", ").map((exportedName) => exportedName.replace(/^type /, ""))));
  const drivenPortFolderUrls = ["charter", "runtime", "shared"].map((moduleName) => new URL(`${moduleName}/app/port/out/`, hexagonFolderUrl));
  const drivenModelNames = drivenPortFolderUrls
    .flatMap((drivenPortFolderUrl) => readdirSync(drivenPortFolderUrl).map((portFileName) => new URL(portFileName, drivenPortFolderUrl)))
    .flatMap((portFileUrl) => [...readFileSync(portFileUrl, "utf8").matchAll(/^import (?:type )?\{ (.+) \} from "(?:\.\.\/)+(?:(?:shared|charter|runtime|workspace)\/)?domain\/models\/.+";$/gm)])
    .flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, "")))
    .filter((modelName) => modelName !== "DomainFault");
  assert.deepEqual([...new Set(drivenModelNames)].filter((modelName) => !exportedNames.has(modelName)), []);
});

test("every command and the portal are handed the modules' applications and nothing else (CORE Story 49 scenario 3)", () => {
  const contextText = readFileSync(new URL("src/presentation/cli/commands/command.interface.ts", repositoryUrl), "utf8");
  const contextAppTypeNames = [...contextText.matchAll(/^ {2}readonly \w+App: (For\w+);$/gm)].map((appMatch) => appMatch[1]!);
  assert.deepEqual(contextAppTypeNames.sort(), Object.keys(operationNamesByPortName).sort());
  const portalRoutesText = readFileSync(new URL("src/presentation/portal/portal.routes.ts", repositoryUrl), "utf8");
  const portalPortNames = [...portalRoutesText.matchAll(/^import (?:type )?\{ ([^}]+) \} from "#module\/[\w-]+\/module\.js";$/gm)].flatMap((importMatch) => importMatch[1]!.split(", ").map((importedName) => importedName.replace(/^type /, ""))).filter((importedName) => importedName.startsWith("For"));
  assert.deepEqual(portalPortNames.sort(), ["ForAuthoringCharter", "ForBuildingCharter"]);
});

test("the driver ports changed and the models made public are released only as a new major, the changelog naming each change (CORE Story 49 scenario 4)", async () => {
  const builtContractText = readFileSync(new URL("dist/index.d.ts", repositoryUrl), "utf8");
  // The contract as a release before the four applications recorded it: one of
  // the seven driver ports there, exported.
  const lastContractText = builtContractText
    .replace("\ndeclare const VERSION: string;", "\ninterface ForKeepingCharter {\n    build(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;\n}\ndeclare const VERSION: string;")
    .replace("export { ", "export { type ForKeepingCharter, ");
  await inARelease({ currentVersion: "1.0.0", nextVersion: "1.1.0", releaseMode: "dry-run", builtContractText, lastContractText }, async (releaseRun) => {
    assert.equal(releaseRun.status, 1);
    assert.match(releaseRun.stderr, /1\.1\.0 is not a new major.*removes .*ForKeepingCharter.*Release 2\.0\.0/);
  });
  const changelogText = "# Changelog\n\n## 2.0.0 — 2026-11-07\n\n- `ForKeepingCharter` is gone: the engine is reached through `ForAuthoringCharter`, `ForRunningCharter`, `ForRunningCharter` and `ForRunningCharter`.\n";
  await inARelease({ currentVersion: "1.0.0", nextVersion: "2.0.0", releaseMode: "dry-run", builtContractText, lastContractText, changelogText }, async (releaseRun) => {
    assert.equal(releaseRun.status, 0, releaseRun.stderr);
  });
});

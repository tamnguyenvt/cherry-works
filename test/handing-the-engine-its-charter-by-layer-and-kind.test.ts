import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import type { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import type { ForManagingCharter } from "../src/module/charter/app/port/out/managing-charter.port.js";
import type { ForManagingLocalOutput } from "../src/module/charter/app/port/out/managing-local-output.port.js";
import type { ForStoringCredentials } from "../src/module/charter/app/port/out/storing-credentials.port.js";
import { buildCharterService } from "../src/module/charter/app/services/build-charter.service.js";
import { loadCharterService } from "../src/module/charter/app/services/load-charter.service.js";
import { RawEvalSuite } from "../src/module/charter/domain/models/eval/raw-eval-suite.js";
import type { McpCredential } from "../src/module/charter/domain/models/mcp/mcp-credential.js";
import { McpPrimitive } from "../src/module/charter/domain/models/primitive/mcp-primitive.js";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";
import { CopyPlan, ProjectionPlan, WritePlan } from "../src/module/charter/domain/models/projection/projection-plan.js";
import { RawTestSuite } from "../src/module/charter/domain/models/test/raw-test-suite.js";
import { RawVendorSource } from "../src/module/charter/domain/models/vendor/raw-vendor-source.js";
import { VendorRoot } from "../src/module/charter/domain/models/vendor/vendor-root.js";
import { SourceCharter } from "../src/module/charter/domain/models/vendor/vendor-source.js";
import { VendorSourceOrigin } from "../src/module/charter/domain/models/vendor/vendor-source-origin.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { OUT_FOLDER, placeOfPart } from "../src/module/charter/infra/helper.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryLocalRepo } from "../src/module/charter/infra/in-memory/in-memory-local-repo.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { SessionLogs } from "../src/module/runtime/domain/models/session/session-logs.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryPromptfoo } from "../src/module/runtime/infra/in-memory/in-memory-promptfoo.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import type { FaultDTOs } from "../src/module/shared/app/port/in/fault.dto.js";
import { FileOutput } from "../src/module/shared/infra/file-output.adapter.js";
import { FileReaders } from "../src/module/shared/infra/file-readers.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import type { WorkspaceSettings } from "../src/presentation/cli/commands/command.interface.js";
import { showPathsFromFolder, wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { answerOf } from "./answer-of.js";
import {
  agentProjectionByProviderOf,
  authoringCharterOf,
  type CharterRuntimeApps,
  charterOutputWriterOf,
  runningCharterOf,
  workspaceAppOf,
} from "./use-cases-of.js";

/** The answer of this type, where the test expects nothing else. */
function answerTyped<Answer extends { readonly type: string }>(
  answer: { readonly type: string },
  type: Answer["type"],
): Answer {
  assert.equal(answer.type, type, JSON.stringify(answer));
  return answer as Answer;
}

const repositoryUrl = new URL("../", import.meta.url);
const hexagonModuleUrls = ["shared", "charter", "runtime"].map(
  (moduleName) => new URL(`src/module/${moduleName}/`, repositoryUrl),
);
const storagePortFileUrls = hexagonModuleUrls.flatMap((moduleUrl) => {
  const drivenPortFolderUrl = new URL("app/port/out/", moduleUrl);
  return readdirSync(drivenPortFolderUrl)
    .filter((fileName) => /^(storing|loading)-[a-z-]+\.port\.ts$/.test(fileName))
    .map((fileName) => new URL(fileName, drivenPortFolderUrl));
});
const serviceFileUrls = hexagonModuleUrls.flatMap((moduleUrl) => {
  const serviceFolderUrl = new URL("app/services/", moduleUrl);
  return existsSync(serviceFolderUrl)
    ? readdirSync(serviceFolderUrl).map((fileName) => new URL(fileName, serviceFolderUrl))
    : [];
});

const keptGuideText =
  '---\nkind: guide\nid: kept-guide\ndescription: A guide kept by its kind and id.\nglobs: ["src/**/*.ts"]\n---\nKeep it.\n';
const brokenGuideText = "---\nkind: guide\nid: broken-guide\n---\nNo description.\n";
const testSuiteText = `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "kept-guide" } }] })}\n`;

/** A charter kept with no path at all, as a database would keep it: each
 *  primitive by its kind and id, each suite by its name, through its one port;
 *  no vendor installed and no source to fetch. */
function charterKeptWithNoPath(): {
  readonly charterRepository: ForManagingCharter;
  readonly rawPrimitiveByKey: Map<string, RawPrimitive>;
} {
  const rawPrimitiveByKey = new Map<string, RawPrimitive>();
  const rawPrimitiveOf = (
    layer: PrimitiveLayer,
    kind: string,
    id: string,
    text: string,
    assets: RawPrimitive["assets"] = [],
  ) => new RawPrimitive(layer, kind, id, text, assets, `db://charter:${kind}/${id}`);
  rawPrimitiveByKey.set("guide/kept-guide", rawPrimitiveOf(PrimitiveLayer.REPO, "guide", "kept-guide", keptGuideText));
  rawPrimitiveByKey.set(
    "guide/broken-guide",
    rawPrimitiveOf(PrimitiveLayer.REPO, "guide", "broken-guide", brokenGuideText),
  );
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
      const rawPrimitive = rawPrimitiveOf(PrimitiveLayer.REPO, kind, id, text, assets);
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
      const rawPrimitive = rawPrimitiveByKey.get(`${primitive.kind}/${primitive.headers.id}`)!;
      rawPrimitiveByKey.set(
        `${primitive.kind}/${primitive.headers.id}`,
        rawPrimitiveOf(
          rawPrimitive.layer,
          rawPrimitive.kind,
          rawPrimitive.id,
          primitive.toMarkdown(),
          rawPrimitive.assets,
        ),
      );
    },
    async removePrimitive(primitive) {
      rawPrimitiveByKey.delete(`${primitive.kind}/${primitive.headers.id}`);
    },
    async fetchVendorSource() {
      throw new Error("Nothing is fetched here.");
    },
    async cleanupVendorSource() {},
    async loadVendorRoot() {
      return new VendorRoot([]);
    },
    async storeVendor() {},
    findVendorUri(vendorName) {
      return `db://vendor:${vendorName}`;
    },
    async removeVendor() {},
    async loadTestSuites() {
      return [new RawTestSuite("kept.json", testSuiteText, "db://test:kept.json")];
    },
    async writeTestSuite() {},
    async removeTestSuite() {},
    async loadEvalSuites() {
      return [];
    },
    async writeEvalSuite() {},
    async removeEvalSuite() {},
  };
  return { charterRepository, rawPrimitiveByKey };
}

/** The settings of a repository compiling for claude, as the command line
 *  hands them, or none where it was never set up. */
function settingsKeptInMemory(isSetUp = true): WorkspaceSettings {
  return { agents: isSetUp ? ["claude"] : [] };
}

/** Authoring the charter kept in `charterRepository`, its credentials kept in
 *  the store a test hands it, or else as credentialsRepository no test reads. */
function charterAuthoringAppOver(
  charterRepository: ForManagingCharter,
  {
    fileReaders = new InMemoryFileReaders({}),
    credentialsRepository = new InMemoryCredentialsRepository(),
  }: { readonly fileReaders?: InMemoryFileReaders; readonly credentialsRepository?: ForStoringCredentials } = {},
): AuthoringCharter {
  return authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
    charterRepository,
    credentialsRepository,
    authorizing: new InMemoryAuthorizing(),
  });
}

/** The charter kept as files, its sources fetched off those same files. */
function charterKeptAsFiles(
  fileReaders: InMemoryFileReaders,
  fileOutput = new InMemoryFileOutput(fileReaders),
): FileCharterRepository {
  return new FileCharterRepository(fileReaders, fileOutput, new InMemorySources(fileReaders));
}

/** Running the charter kept in these stores, laid through `localRepo`. */
function charterProjectingAppOver(
  charterRepository: ForManagingCharter,
  workspaceSettings: WorkspaceSettings,
  localRepo: ForManagingLocalOutput,
  fileReaders = new InMemoryFileReaders({}),
): CharterRuntimeApps {
  return runningCharterOf(fileReaders, new InMemoryReporter(), {
    fileWriter: new InMemoryFileOutput(fileReaders),
    tokenCounter: new InMemoryTokenCounter(),
    agentCliByProvider: { claude: new InMemoryAgentCli() },
    shell: new InMemoryShellCommands({}),
    workspaceSettings,
    charterRepository,
    localRepo,
    charterAuthoringApp: charterAuthoringAppOver(charterRepository, { fileReaders }),
  });
}

/** Running the charter kept in these stores, its cases evaluated in
 *  worktrees of `fileReaders` through `promptfoo`. */
function charterTestingAppOver(
  charterRepository: ForManagingCharter,
  workspaceSettings: WorkspaceSettings,
  fileReaders: InMemoryFileReaders,
  promptfoo = new InMemoryPromptfoo(),
): CharterRuntimeApps {
  return runningCharterOf(fileReaders, new InMemoryReporter(), {
    fileWriter: new InMemoryFileOutput(fileReaders),
    worktrees: new InMemoryWorktrees(fileReaders),
    agentCliByProvider: { claude: new InMemoryAgentCli() },
    promptfooRunner: promptfoo,
    workspaceSettings,
    charterRepository,
    charterAuthoringApp: charterAuthoringAppOver(charterRepository, { fileReaders }),
  });
}

/** The three applications over the charter and its settings kept in these
 *  stores, laid onto `fileReaders`. */
function charterAppsOver(
  charterRepository: ForManagingCharter,
  workspaceSettings: WorkspaceSettings,
  fileReaders = new InMemoryFileReaders({}),
) {
  return {
    charterAuthoringApp: charterAuthoringAppOver(charterRepository, { fileReaders }),
    charterRuntimeApp: charterProjectingAppOver(
      charterRepository,
      workspaceSettings,
      charterOutputWriterOf(fileReaders, new InMemoryFileOutput(fileReaders)),
      fileReaders,
    ),
  };
}

test("what crosses between the engine and what keeps its state is the engine's models, never a record carrying them or a path (CORE Story 47 scenario 1)", () => {
  assert.ok(storagePortFileUrls.length > 0, "no storage port is found");
  for (const storagePortFileUrl of storagePortFileUrls) {
    const storagePortFileName = storagePortFileUrl.pathname.split("/").at(-1)!;
    const storagePortText = readFileSync(storagePortFileUrl, "utf8");
    assert.doesNotMatch(
      storagePortText,
      /interface Stored|type Stored/,
      `${storagePortFileName} declares a record of its own`,
    );
    assert.doesNotMatch(storagePortText, /\b(path|pathInLayer|filePath)\??:/, `${storagePortFileName} carries a path`);
    assert.doesNotMatch(
      storagePortText,
      /:\s*(readonly\s+)?\{|\{\s*readonly \w+:/,
      `${storagePortFileName} carries a record made for it`,
    );
  }
  // A uri is said back, never read: nothing in the hexagon outside its stores
  // joins a path onto one or cuts one out of it.
  const hexagonFolderUrl = new URL("src/module/", repositoryUrl);
  const uriReadingLocations = readdirSync(hexagonFolderUrl, { recursive: true, encoding: "utf8" })
    .filter((filePath) => filePath.endsWith(".ts") && !filePath.includes("/infra/"))
    .flatMap((filePath) =>
      readFileSync(new URL(filePath, hexagonFolderUrl), "utf8")
        .split("\n")
        .flatMap((sourceLine, lineIndex) =>
          /[uU]ri\}\/|[uU]ri\.(slice|split|startsWith|endsWith|lastIndexOf)\(/.test(sourceLine)
            ? [`${filePath}:${lineIndex + 1}`]
            : [],
        ),
    );
  assert.deepEqual(uriReadingLocations, []);
});

test("a charter kept with no path is validated, listed, written and tested as the same charter kept as files (CORE Story 47 scenario 2)", async () => {
  const { charterRepository, rawPrimitiveByKey } = charterKeptWithNoPath();
  const { charterAuthoringApp: keptAuthoringApp, charterRuntimeApp: keptBuildingApp } = charterAppsOver(
    charterRepository,
    settingsKeptInMemory(),
  );
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["claude"] })}\n`,
    "file:///repo/.cw/charter/primitive/guide/kept-guide/index.md": keptGuideText,
    "file:///repo/.cw/charter/primitive/guide/broken-guide/index.md": brokenGuideText,
    "file:///repo/.cw/charter/test/kept.json": testSuiteText,
  });
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const { charterAuthoringApp: filesAuthoringApp, charterRuntimeApp: filesBuildingApp } = charterAppsOver(
    charterKeptAsFiles(fileReaders, fileOutput),
    { agents: ["claude"] },
    fileReaders,
  );

  const [keptDoctorOutcome, filesDoctorOutcome] = [
    answerOf(await keptBuildingApp.doctor()),
    answerOf(await filesBuildingApp.doctor()),
  ];
  assert.deepEqual(Object.keys(keptDoctorOutcome.data.faultsByFile.data.files), ["db://charter:guide/broken-guide"]);
  assert.deepEqual(Object.keys(filesDoctorOutcome.data.faultsByFile.data.files), [
    "file:///repo/.cw/charter/primitive/guide/broken-guide/index.md",
  ]);
  assert.deepEqual(
    Object.values(keptDoctorOutcome.data.faultsByFile.data.files),
    Object.values(filesDoctorOutcome.data.faultsByFile.data.files),
  );

  // With the broken guide mended in both, each builds, tests and lists the same charter.
  rawPrimitiveByKey.delete("guide/broken-guide");
  fileReaders.remove(new URL("file:///repo/.cw/charter/primitive/guide/broken-guide/index.md"));
  const [keptPlanSummary, filesPlanSummary] = [
    answerTyped<CharterDTOs.PlanSummary>(await keptBuildingApp.build(), "PlanSummary"),
    answerTyped<CharterDTOs.PlanSummary>(await filesBuildingApp.build(), "PlanSummary"),
  ];
  assert.deepEqual(keptPlanSummary, filesPlanSummary);
  assert.ok(keptPlanSummary.data.added.includes(".cw/out/guide/kept-guide/index.md"));
  const [keptTestRunReport, filesTestRunReport] = [
    answerTyped<CharterDTOs.TestRunReport>(await keptAuthoringApp.test(), "TestRunReport"),
    answerTyped<CharterDTOs.TestRunReport>(await filesAuthoringApp.test(), "TestRunReport"),
  ];
  assert.deepEqual(
    JSON.stringify(keptTestRunReport).replaceAll("db://test:", "file:///repo/.cw/charter/test/"),
    JSON.stringify(filesTestRunReport),
  );

  const [keptPrimitives, filesPrimitives] = [
    answerTyped<CharterDTOs.Primitives>(await keptAuthoringApp.fullList(), "Primitives"),
    answerTyped<CharterDTOs.Primitives>(await filesAuthoringApp.fullList(), "Primitives"),
  ];
  const primitiveKeysOf = (primitivesAnswer: typeof keptPrimitives) =>
    primitivesAnswer.data.primitives.map(({ data }) => `${data.layerName} ${data.kind} ${data.id}`).sort();
  assert.deepEqual(primitiveKeysOf(keptPrimitives), primitiveKeysOf(filesPrimitives));
  assert.equal(
    keptPrimitives.data.primitives.find(({ data }) => data.id === "kept-guide")?.data.file,
    "db://charter:guide/kept-guide",
  );

  const addedPrimitive = answerTyped<CharterDTOs.Primitive>(
    await keptAuthoringApp.add("guide", "added-guide", { description: "A guide added by its kind and id." }, "Added."),
    "Primitive",
  );
  assert.equal(addedPrimitive.data.file, "db://charter:guide/added-guide");
  assert.equal(rawPrimitiveByKey.get("guide/added-guide")?.kind, "guide");
  answerOf(await keptAuthoringApp.remove("added-guide"));
  assert.equal(rawPrimitiveByKey.has("guide/added-guide"), false);
});

test("what each of the engine's services answers with is a model of the domain, never a shape of the service's own (CORE Story 47 scenario 3)", () => {
  for (const serviceFileUrl of serviceFileUrls.filter((fileUrl) => fileUrl.pathname.endsWith(".service.ts"))) {
    const serviceFileName = serviceFileUrl.pathname.split("/").at(-1)!;
    const serviceText = readFileSync(serviceFileUrl, "utf8");
    const declaredNames = [...serviceText.matchAll(/^export (?:interface|type|class) (\w+)/gm)].map(
      ([, declaredName]) => declaredName,
    );
    const serviceClassName = declaredNames.find((declaredName) => declaredName!.endsWith("Service"));
    assert.deepEqual(
      declaredNames.filter((declaredName) => declaredName !== serviceClassName && declaredName !== "McpReaching"),
      [],
      `${serviceFileName} declares a shape of its own`,
    );
    assert.doesNotMatch(serviceText, /Promise<\{/, `${serviceFileName} answers a shape of its own`);
  }
});

test("a build's plan is the domain's own, every file in it one of its planned files (CORE Story 47 scenario 3, CORE-FR-219)", async () => {
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/charter/primitive/guide/kept-guide/index.md": keptGuideText,
    "file:///repo/.cw/out/guide/gone-guide/index.md": "Gone.",
  });
  const charterRoot = await loadCharterService.loadCharterRoot(charterKeptAsFiles(fileReaders));

  const buildPlan = await buildCharterService.planBuild(
    "",
    charterRoot,
    { claude: agentProjectionByProviderOf(fileReaders).claude! },
    charterOutputWriterOf(fileReaders),
    charterKeptAsFiles(fileReaders),
    undefined,
    { refreshMcpOrigins: false },
  );

  assert.ok(buildPlan instanceof ProjectionPlan, JSON.stringify(buildPlan));
  assert.ok(buildPlan.projectionPlan.length > 0 && buildPlan.cleanupPlan.length > 0);
  assert.ok(
    [...buildPlan.cleanupPlan, ...buildPlan.projectionPlan].every((writePlan) => writePlan instanceof WritePlan),
  );
});

test("settings naming an agent this engine compiles for none under are refused, and nothing is composed for them (CORE Story 45)", async () => {
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["gemini"] })}\n`,
  });

  const workspaceSettingsDTO = await workspaceAppOf(fileReaders).settings();
  assert.equal(workspaceSettingsDTO.type, "Fault");
  assert.match(
    workspaceSettingsDTO.type === "Fault" ? workspaceSettingsDTO.data.message : "",
    /"gemini"[\s\S]*no such agent/,
  );
});

test("a link kept under the charter folder is a file of it, so no primitive is written onto what it points to (CORE-FR-044)", async (t) => {
  const repoFolder = await mkdtemp(join(tmpdir(), "cw-repo-"));
  t.after(() => rm(repoFolder, { recursive: true, force: true }));
  const guideFolder = join(repoFolder, ".cw", "charter", "primitive", "guide", "y");
  await mkdir(guideFolder, { recursive: true });
  await writeFile(join(repoFolder, "outside.md"), "kept outside\n");
  await symlink(join(repoFolder, "outside.md"), join(guideFolder, "index.md"));

  const charterRepository = new FileCharterRepository(
    new FileReaders(pathToFileURL(`${repoFolder}/`)),
    new FileOutput(pathToFileURL(`${repoFolder}/`)),
    new InMemorySources(),
  );

  await assert.rejects(
    charterRepository.addPrimitive(new RawPrimitive(PrimitiveLayer.REPO, "guide", "y", keptGuideText, [], "")),
    /is already there/,
  );
  assert.equal(readFileSync(join(repoFolder, "outside.md"), "utf8"), "kept outside\n");
});

test("every other use case answers through stores of a tool's own that keep no path (CORE Story 47 scenario 2, CORE-SC-062)", async () => {
  const { charterRepository } = charterKeptWithNoPath();
  const mcpText = McpPrimitive.of(McpPrimitive.sample, "Read the billing service.").toMarkdown();
  await charterRepository.addPrimitive(
    new RawPrimitive(PrimitiveLayer.REPO, "mcp", McpPrimitive.sample.id, mcpText, [], ""),
  );

  // Test suites, by name.
  const keptTextByName = new Map<string, string>();
  const testsApp = charterAuthoringAppOver({
    ...charterRepository,
    async loadTestSuites() {
      return [...keptTextByName].map(([name, text]) => new RawTestSuite(name, text, `db://test:${name}`));
    },
    async writeTestSuite(name, testSuite) {
      keptTextByName.set(name, testSuite.body);
    },
    async removeTestSuite(name) {
      keptTextByName.delete(name);
    },
  });
  const addedSuiteName = answerOf(await testsApp.addSuite());
  answerOf(await testsApp.writeSuite(addedSuiteName.data.name, testSuiteText));
  assert.deepEqual(
    answerOf(await testsApp.suites()).data.testSuites.map(({ data }) => data.name),
    [addedSuiteName.data.name],
  );
  answerOf(await testsApp.removeSuite(addedSuiteName.data.name));
  assert.equal(keptTextByName.size, 0);

  // Vendors, by name.
  const installedVendorNames = new Set(["team/charter/root"]);
  const vendoringApp = charterAuthoringAppOver({
    ...charterRepository,
    async loadVendorRoot() {
      const installedVendors = [...installedVendorNames].map((vendorName) => ({
        name: vendorName,
        uri: `db://vendor:${vendorName}`,
      }));
      return new VendorRoot(installedVendors);
    },
    async removeVendor(vendorName) {
      installedVendorNames.delete(vendorName);
    },
  });
  assert.deepEqual(answerOf(await vendoringApp.vendors()).data.folders, ["db://vendor:team/charter/root"]);
  assert.deepEqual(
    answerOf(await vendoringApp.removeVendor("team/charter/root")).data.folder,
    "db://vendor:team/charter/root",
  );

  // Credentials, by address, and the charter's mcp origins.
  const credentialByAddress = new Map<string, McpCredential>();
  const credentialsRepository: ForStoringCredentials = {
    async readCredential(address) {
      return credentialByAddress.get(address);
    },
    async writeCredential(credential) {
      credentialByAddress.set(credential.address, credential);
    },
  };
  const mcpApp = charterAuthoringAppOver(charterRepository, { credentialsRepository });
  const [signInStatus] = answerOf(await mcpApp.signInStatus()).data.signInStatuses;
  answerOf(await mcpApp.signInWithToken(signInStatus!.data.address, "a token"));
  assert.equal(credentialByAddress.get(signInStatus!.data.address)?.accessToken, "a token");

  // Sessions, as their store read them.
  const sessionsApp = runningCharterOf(new InMemoryFileReaders({}), new InMemoryReporter(), {
    workspaceSettings: settingsKeptInMemory(),
    sessionAnalysisRepository: {
      async loadSessionLogs() {
        return new SessionLogs("db://sessions", []);
      },
    },
    clock: new InMemoryClock(new Date("2026-11-07T00:00:00Z")),
  });
  assert.equal(answerOf(await sessionsApp.sessionSummary()).data.sessionsFolder, "db://sessions");

  // Evaluation cases, by name: none kept, nothing run.
  const evalFileReaders = new InMemoryFileReaders({});
  const evaluatingApp = charterTestingAppOver(
    {
      ...charterRepository,
      async loadTestSuites() {
        return [];
      },
    },
    settingsKeptInMemory(),
    evalFileReaders,
  );
  assert.notEqual((await evaluatingApp.evaluate()).type, "Fault");
});

test("the command line says where something is kept as the path from where it runs, and leaves what a primitive says as written (CORE Story 47, CORE-FR-214)", () => {
  const shownAnswer = showPathsFromFolder(
    {
      type: "Primitive",
      data: {
        file: "file:///work/repo/.cw/charter/primitive/guide/a%20b/index.md",
        body: "See file:///work/repo/.cw/charter/x.md.",
        files: {
          "file:///work/repo/.cw/charter/y/index.md": [
            {
              type: "Fault",
              data: {
                message: "Kept at file:///work/repo/.cw/charter/y/index.md.",
                fix: "Open file:///work/repo/%E0.",
              },
            },
          ],
        },
      },
    },
    "/work/repo",
  );
  assert.deepEqual(shownAnswer, {
    type: "Primitive",
    data: {
      file: ".cw/charter/primitive/guide/a b/index.md",
      body: "See file:///work/repo/.cw/charter/x.md.",
      files: {
        ".cw/charter/y/index.md": [
          { type: "Fault", data: { message: "Kept at .cw/charter/y/index.md.", fix: "Open %E0." } },
        ],
      },
    },
  });
});

test("the command line says where to move a primitive kept where its kind and id do not say, as it said before (FR-141, CORE-FR-214)", async () => {
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["claude"] })}\n`,
    "file:///repo/.cw/charter/primitive/guide/kept-guide.md": keptGuideText,
    "file:///repo/.cw/charter/primitive/guide/elsewhere/index.md": keptGuideText,
  });
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const filesBuildingApp = wrapAppToShowPaths(
    charterAppsOver(charterKeptAsFiles(fileReaders, fileOutput), { agents: ["claude"] }, fileReaders).charterRuntimeApp,
    "/repo",
  );

  const doctorText = JSON.stringify(await filesBuildingApp.doctor());
  assert.match(doctorText, /Move it to \\".cw\/charter\/primitive\/guide\/kept-guide\/index.md\\"\./);
  assert.match(
    doctorText,
    /This declares \\"guide\\" \\"kept-guide\\", and it is kept at \\"guide\/elsewhere\/index.md\\"; a primitive is kept at \\"<kind>\/<id>\/index.md\\"\./,
  );
  assert.match(
    doctorText,
    /Move its folder to \\".cw\/charter\/primitive\/guide\/kept-guide\/\\", or declare the kind and id its folder says\./,
  );
});

test("what an mcp origin's tool answered is forwarded as it answered, addresses under where the command line runs included (CORE-FR-214)", async () => {
  const toolAnswer = { type: "ToolAnswer", data: { file: "file:///repo/x.md", message: "Kept at file:///repo/x.md." } };
  const mcpApp = wrapAppToShowPaths(
    {
      async call() {
        return toolAnswer;
      },
    },
    "/repo",
  );

  assert.deepEqual(await mcpApp.call(), toolAnswer);
});

test("a word searched for is never found in where the repository sits on the machine (FR-114, CORE-FR-214)", async () => {
  const fileReaders = new InMemoryFileReaders(
    {
      "file:///work/somewhere/.cw/settings.json": `${JSON.stringify({ agents: ["claude"] })}\n`,
      "file:///work/somewhere/.cw/charter/primitive/guide/kept-guide/index.md": keptGuideText,
    },
    new URL("file:///work/somewhere/"),
  );
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const { charterAuthoringApp: filesAuthoringApp } = charterAppsOver(
    charterKeptAsFiles(fileReaders, fileOutput),
    { agents: ["claude"] },
    fileReaders,
  );

  assert.deepEqual(
    answerTyped<CharterDTOs.Primitives>(await filesAuthoringApp.fullList("somewhere"), "Primitives").data.primitives,
    [],
  );
  assert.deepEqual(
    answerTyped<CharterDTOs.Primitives>(
      await filesAuthoringApp.fullList("guide/kept-guide"),
      "Primitives",
    ).data.primitives.map(({ data }) => data.id),
    ["kept-guide"],
  );
});

test("a checkout's primitives and cases are kept where they sit in the repository, the checkout being gone once read (EVAL-FR-021)", async () => {
  const checkoutFolder = ".cw/log/eval/worktrees/head";
  const fileReaders = new InMemoryFileReaders({
    [`file:///repo/${checkoutFolder}/.cw/charter/primitive/guide/kept-guide/index.md`]: keptGuideText,
    [`file:///repo/${checkoutFolder}/.cw/charter/eval/cases.json`]: "{}",
  });

  assert.deepEqual(
    (await charterKeptAsFiles(fileReaders).loadCharter(checkoutFolder)).map(({ uri }) => uri),
    ["file:///repo/.cw/charter/primitive/guide/kept-guide/index.md"],
  );
  assert.deepEqual(
    (await charterKeptAsFiles(fileReaders).loadEvalSuites(checkoutFolder)).map(({ name, uri }) => [name, uri]),
    [["cases.json", "file:///repo/.cw/charter/eval/cases.json"]],
  );
});

test("vendors, evaluations, sensors and every other answer of the charter's use cases are the same through stores that keep no path (CORE Story 47 scenario 2, CORE-SC-062)", async () => {
  /** Answers said the same way whichever store answered: each place a store
   *  kept something said by its kind and id or name. */
  const answerTextOf = (answer: unknown) =>
    JSON.stringify(answer)
      .replace(/file:\/\/\/repo\/\.cw\/charter\/primitive\/([a-z]+)\/([^"]+)\/index\.md/g, "kept:$1/$2")
      .replace(/db:\/\/charter:([a-z]+)\/([^"]+?)(?=["\s.,])/g, "kept:$1/$2")
      .replace(/file:\/\/\/repo\/\.cw\/charter\/eval\/([^"]+)/g, "kept-eval:$1")
      .replace(/db:\/\/eval:([^"]+)/g, "kept-eval:$1")
      .replace(/file:\/\/\/repo\/\.cw\/charter\/test\/([^"]+)/g, "kept-test:$1")
      .replace(/db:\/\/test:([^"]+)/g, "kept-test:$1");
  const evalSuiteText = JSON.stringify({ cases: [{ prompt: "keep it", expect: { invoke: "kept-skill" } }] });
  const keptSkillText =
    '---\nkind: skill\nid: kept-skill\ndescription: Keep it.\ntriggers: ["keep it"]\n---\nKeep it.\n';
  const sensorsText = `${JSON.stringify({ sensors: [] })}\n`;

  // The charter kept with no path, beside the same charter kept as files.
  const { charterRepository, rawPrimitiveByKey } = charterKeptWithNoPath();
  rawPrimitiveByKey.delete("guide/broken-guide");
  await charterRepository.addPrimitive(
    new RawPrimitive(PrimitiveLayer.REPO, "skill", "kept-skill", keptSkillText, [], ""),
  );
  const keptFileReaders = new InMemoryFileReaders({});
  const { charterAuthoringApp: keptAuthoringApp, charterRuntimeApp: keptBuildingApp } = charterAppsOver(
    charterRepository,
    settingsKeptInMemory(),
    keptFileReaders,
  );
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["claude"] })}\n`,
    "file:///repo/.cw/charter/primitive/guide/kept-guide/index.md": keptGuideText,
    "file:///repo/.cw/charter/primitive/skill/kept-skill/index.md": keptSkillText,
    "file:///repo/.cw/charter/test/kept.json": testSuiteText,
    "file:///repo/.cw/charter/eval/skills.json": evalSuiteText,
  });
  const fileOutput = new InMemoryFileOutput(fileReaders);
  const { charterAuthoringApp: filesAuthoringApp, charterRuntimeApp: filesBuildingApp } = charterAppsOver(
    charterKeptAsFiles(fileReaders, fileOutput),
    { agents: ["claude"] },
    fileReaders,
  );

  assert.equal(
    answerTextOf(await keptAuthoringApp.explain("kept-guide")),
    answerTextOf(await filesAuthoringApp.explain("kept-guide")),
  );
  assert.equal(answerTextOf(await keptBuildingApp.preview()), answerTextOf(await filesBuildingApp.preview()));
  assert.equal(
    answerTextOf(await keptBuildingApp.predictMainContext()),
    answerTextOf(await filesBuildingApp.predictMainContext()),
  );
  const [keptOpenedPrimitive, filesOpenedPrimitive] = [
    answerTyped<CharterDTOs.Primitive>(await keptAuthoringApp.open("kept-guide"), "Primitive"),
    answerTyped<CharterDTOs.Primitive>(await filesAuthoringApp.open("kept-guide"), "Primitive"),
  ];
  const rewrittenHeaders = { description: "A guide kept and rewritten.", globs: ["src/**/*.ts"] };
  assert.equal(
    answerTextOf(
      await keptAuthoringApp.rewrite("kept-guide", rewrittenHeaders, "Rewritten.", keptOpenedPrimitive.data.hash),
    ),
    answerTextOf(
      await filesAuthoringApp.rewrite("kept-guide", rewrittenHeaders, "Rewritten.", filesOpenedPrimitive.data.hash),
    ),
  );
  assert.match(rawPrimitiveByKey.get("guide/kept-guide")?.text ?? "", /Rewritten\./);

  // A source fetched and read with no path, beside the same source fetched as files.
  const publishedText = "---\nkind: guide\nid: published\ndescription: Published.\n---\n";
  const rawVendorSource = new RawVendorSource(
    new VendorSourceOrigin("team/source", "team/source"),
    "team/source",
    new SourceCharter(
      "",
      true,
      false,
      [new RawPrimitive(PrimitiveLayer.REPO, "guide", "published", publishedText, [], "db://source:guide/published")],
      "",
      ".cw/charter/vendor",
      ".cw/charter/primitive",
    ),
    [],
    [],
  );
  const installedVendorUris: string[] = [];
  const keptVendoringApp = charterAuthoringAppOver({
    ...charterRepository,
    async fetchVendorSource() {
      return rawVendorSource;
    },
    async storeVendor(_vendorSource, { projectionPlan }) {
      // The vendor each folder copied lands in: `.cw/charter/vendor/<name>/primitive`.
      for (const copyPlan of projectionPlan)
        if (copyPlan instanceof CopyPlan)
          installedVendorUris.push(`db://vendor:${copyPlan.destinationPath.split("/").slice(3, 6).join("/")}`);
    },
  });
  const filesVendoringApp = authoringCharterOf(fileReaders, fileOutput, new InMemoryReporter(), {
    sourceFetcher: new InMemorySources(fileReaders),
  });
  const primitivesOf = (vendorAddAnswer: unknown) =>
    answerOf(vendorAddAnswer as FaultDTOs.Fault | CharterDTOs.VendorAddOutcome).data.map(
      ({ primitives }) => primitives,
    );
  assert.deepEqual(
    primitivesOf(await keptVendoringApp.addVendor("team/source")),
    primitivesOf(await filesVendoringApp.addVendor("team/source")),
  );
  assert.deepEqual(installedVendorUris, ["db://vendor:team/source/root"]);
  // Injected into a charter that installed nothing, as the store with no path holds none.
  const injectedFileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/charter/primitive/guide/kept-guide/index.md": keptGuideText,
  });
  const injectingVendoringApp = authoringCharterOf(
    injectedFileReaders,
    new InMemoryFileOutput(injectedFileReaders),
    new InMemoryReporter(),
    { sourceFetcher: new InMemorySources(injectedFileReaders) },
  );
  assert.deepEqual(
    primitivesOf(await keptVendoringApp.injectVendor("team/source")),
    primitivesOf(await injectingVendoringApp.injectVendor("team/source")),
  );
  assert.equal(rawPrimitiveByKey.get("guide/published")?.text, publishedText);

  // Evaluation cases kept with no path, beside the same cases kept as files.
  const evaluatingAppOver = (
    evalCharterRepository: ForManagingCharter,
    evalSettingsRepository: WorkspaceSettings,
    evalFileReaders: InMemoryFileReaders,
    promptfoo: InMemoryPromptfoo,
  ) => charterTestingAppOver(evalCharterRepository, evalSettingsRepository, evalFileReaders, promptfoo);
  const [keptPromptfoo, filesPromptfoo] = [new InMemoryPromptfoo(), new InMemoryPromptfoo()];
  const keptEvalRunReport = await evaluatingAppOver(
    {
      ...charterRepository,
      async loadEvalSuites() {
        return [new RawEvalSuite("skills.json", evalSuiteText, "db://eval:skills.json")];
      },
    },
    settingsKeptInMemory(),
    keptFileReaders,
    keptPromptfoo,
  ).evaluate();
  const filesEvalRunReport = await evaluatingAppOver(
    charterKeptAsFiles(fileReaders, fileOutput),
    { agents: ["claude"] },
    fileReaders,
    filesPromptfoo,
  ).evaluate();
  assert.equal(keptEvalRunReport.type, "EvalRunReport", JSON.stringify(keptEvalRunReport));
  assert.equal(answerTextOf(keptEvalRunReport), answerTextOf(filesEvalRunReport));
  assert.deepEqual(keptPromptfoo.evaluatedTests, filesPromptfoo.evaluatedTests);

  // The sensors a build kept, read with no path, beside the same read as files.
  const keptLocalRepo = new InMemoryLocalRepo();
  keptLocalRepo.textByPlace.set("all:sensors:charter:sensors", sensorsText);
  const keptSensorsApp = charterProjectingAppOver(charterRepository, settingsKeptInMemory(), keptLocalRepo);
  const filesSensorsApp = charterProjectingAppOver(
    charterRepository,
    settingsKeptInMemory(),
    charterOutputWriterOf(new InMemoryFileReaders({ "file:///repo/.cw/out/sensors.json": sensorsText })),
  );
  assert.equal(
    answerTextOf(await keptSensorsApp.runSensors("Stop", "{}", "claude")),
    answerTextOf(await filesSensorsApp.runSensors("Stop", "{}", "claude")),
  );
});

test("a markdown file a source keeps on its own is no primitive of its charter, so it is neither listed nor injected (CORE-FR-196)", async () => {
  const sourceFiles = {
    ".cw/charter/primitive/guide/published/index.md": "---\nkind: guide\nid: published\ndescription: Published.\n---\n",
    ".cw/charter/primitive/guide/README.md": "# Our guides\n",
  };
  const vendoringAppOver = (fileReaders: InMemoryFileReaders) => {
    const sourceFetcher = new InMemorySources(fileReaders);
    sourceFetcher.sourceFilesBySource["team/source"] = sourceFiles;
    return authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
      sourceFetcher,
    });
  };
  const addedPrimitiveIds = answerOf(
    await vendoringAppOver(new InMemoryFileReaders({})).addVendor("team/source"),
  ).data.flatMap(({ primitives }) => primitives.map(({ data }) => data.id));
  assert.deepEqual(addedPrimitiveIds, ["published"]);

  const injectedFileReaders = new InMemoryFileReaders({});
  answerOf(await vendoringAppOver(injectedFileReaders).injectVendor("team/source"));
  assert.deepEqual(
    (await injectedFileReaders.readFilesRecursively(".cw/charter")).map(({ path }) => path),
    [".cw/charter/primitive/guide/published/index.md"],
  );
});

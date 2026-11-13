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
import { outputPath, vendorSourcePath } from "../src/module/charter/domain/constants.js";
import { CharterOutput } from "../src/module/charter/domain/models/charter-output/charter-output.js";
import { ProjectionPlan, WritePlan } from "../src/module/charter/domain/models/charter-output/projection-plan.js";
import { RawEvalSuite } from "../src/module/charter/domain/models/eval/raw-eval-suite.js";
import type { McpCredential } from "../src/module/charter/domain/models/mcp/mcp-credential.js";
import { McpPrimitive } from "../src/module/charter/domain/models/primitive/mcp-primitive.js";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";
import { RawTestSuite } from "../src/module/charter/domain/models/test/raw-test-suite.js";
import { RawVendorSource } from "../src/module/charter/domain/models/vendor/raw-vendor-source.js";
import { VendorRoot } from "../src/module/charter/domain/models/vendor/vendor-root.js";
import { SourceCharter } from "../src/module/charter/domain/models/vendor/vendor-source.js";
import { VendorSourceOrigin } from "../src/module/charter/domain/models/vendor/vendor-source-origin.value-object.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { findItemPlace, OUT_FOLDER } from "../src/module/charter/infra/helper.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryLocalRepo } from "../src/module/charter/infra/in-memory/in-memory-local-repo.adapter.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
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
    ? readdirSync(serviceFolderUrl)
        .filter((fileName) => !/\.probe\./.test(fileName))
        .map((fileName) => new URL(fileName, serviceFolderUrl))
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
    async readCompiledOutputItem() {
      // What a build laid is the output writer's, kept elsewhere: this store
      // has read none of it back.
      return undefined;
    },
    describeItemPlace(itemPath) {
      // Laid where the files' output writer lays it, so an item is named the
      // same whichever store keeps the charter.
      return findItemPlace(itemPath);
    },
    resolveOutputLinks(laidText) {
      return laidText.replaceAll(outputPath.cwOutFolderPlaceholder, OUT_FOLDER);
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
    describeCharterPlace() {
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
          primitive.writeMarkdown(),
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
    async removeTempSource() {},
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
    oauthAuthorizer: new InMemoryOAuthAuthorizer(),
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
    .filter((filePath) => filePath.endsWith(".ts") && !filePath.includes("/infra/") && !/\.probe\./.test(filePath))
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

test("a charter kept with no path is validated, listed, written and tested as the same charter kept as files (CORE Story 44 scenarios 1, 2, CORE Story 47 scenario 2, CORE Story 55 scenario 11)", async () => {
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
    answerOf(await keptBuildingApp.diagnoseCharter()),
    answerOf(await filesBuildingApp.diagnoseCharter()),
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
  fileReaders.removeFile(new URL("file:///repo/.cw/charter/primitive/guide/broken-guide/index.md"));
  const [keptPlanSummary, filesPlanSummary] = [
    answerTyped<CharterDTOs.ProjectionPlanSummary>(await keptBuildingApp.buildCharter(), "ProjectionPlanSummary"),
    answerTyped<CharterDTOs.ProjectionPlanSummary>(await filesBuildingApp.buildCharter(), "ProjectionPlanSummary"),
  ];
  assert.deepEqual(keptPlanSummary, filesPlanSummary);
  assert.ok(keptPlanSummary.data.added.includes(".cw/out/guide/kept-guide/index.md"));
  const [keptTestRunReport, filesTestRunReport] = [
    answerTyped<CharterDTOs.TestRunReport>(await keptAuthoringApp.testCharter(), "TestRunReport"),
    answerTyped<CharterDTOs.TestRunReport>(await filesAuthoringApp.testCharter(), "TestRunReport"),
  ];
  assert.deepEqual(
    JSON.stringify(keptTestRunReport).replaceAll("db://test:", "file:///repo/.cw/charter/test/"),
    JSON.stringify(filesTestRunReport),
  );

  const [keptPrimitives, filesPrimitives] = [
    answerTyped<CharterDTOs.Primitives>(await keptAuthoringApp.listPrimitives(), "Primitives"),
    answerTyped<CharterDTOs.Primitives>(await filesAuthoringApp.listPrimitives(), "Primitives"),
  ];
  const primitiveKeysOf = (primitivesAnswer: typeof keptPrimitives) =>
    primitivesAnswer.data.primitives.map(({ data }) => `${data.layerName} ${data.kind} ${data.id}`).sort();
  assert.deepEqual(primitiveKeysOf(keptPrimitives), primitiveKeysOf(filesPrimitives));
  assert.equal(
    keptPrimitives.data.primitives.find(({ data }) => data.id === "kept-guide")?.data.file,
    "db://charter:guide/kept-guide",
  );

  const addedPrimitive = answerTyped<CharterDTOs.Primitive>(
    await keptAuthoringApp.addPrimitive(
      "guide",
      "added-guide",
      { description: "A guide added by its kind and id." },
      "Added.",
    ),
    "Primitive",
  );
  assert.equal(addedPrimitive.data.file, "db://charter:guide/added-guide");
  assert.equal(rawPrimitiveByKey.get("guide/added-guide")?.kind, "guide");
  answerOf(await keptAuthoringApp.removePrimitive("added-guide"));
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
    charterRoot,
    { claude: agentProjectionByProviderOf(fileReaders).claude! },
    charterOutputWriterOf(fileReaders),
    charterKeptAsFiles(fileReaders),
    undefined,
    { shouldRefreshMcpOrigins: false },
  );

  assert.ok(buildPlan instanceof ProjectionPlan, JSON.stringify(buildPlan));
  assert.ok(buildPlan.writePlans.length > 0 && buildPlan.cleanupPlan.length > 0);
  assert.ok([...buildPlan.cleanupPlan, ...buildPlan.writePlans].every((writePlan) => writePlan instanceof WritePlan));
});

test("what each agent is told to edit names where a store of a test's own keeps the charter, never cw's own layout, for every projection composed (CORE Story 55 scenario 24)", async () => {
  const { charterRepository, rawPrimitiveByKey } = charterKeptWithNoPath();
  rawPrimitiveByKey.delete("guide/broken-guide");
  const composedAgentNames = Object.keys(agentProjectionByProviderOf(new InMemoryFileReaders({})));
  assert.ok(composedAgentNames.length > 1, "fewer than two projections are composed");

  for (const agentName of composedAgentNames) {
    const fileReaders = new InMemoryFileReaders({});
    const { charterRuntimeApp } = charterAppsOver(charterRepository, { agents: [agentName] }, fileReaders);

    answerTyped(await charterRuntimeApp.buildCharter(), "ProjectionPlanSummary");

    // Every file the build laid for this agent: the charter file every agent
    // is sent to and one of the agent's own say where to edit, and neither it
    // nor any of the agent's own names cw's layout.
    const laidFiles = await fileReaders.readFilesRecursively("");
    const toldFilePaths = laidFiles
      .filter(({ contents }) => /`db:\/\/charter\/`/.test(contents))
      .map(({ fileUrl }) => fileUrl.pathname);
    assert.ok(
      toldFilePaths.some((toldFilePath) => toldFilePath.endsWith("/.cw/out/CHARTER.md")),
      `${agentName}: CHARTER.md names no place to edit`,
    );
    assert.ok(
      toldFilePaths.some((toldFilePath) => !toldFilePath.includes("/.cw/out/")),
      `${agentName}: no file of its own names the place to edit`,
    );
    for (const { fileUrl, contents } of laidFiles.filter(
      ({ fileUrl }) => !fileUrl.pathname.includes("/.cw/out/") || fileUrl.pathname.endsWith("/.cw/out/CHARTER.md"),
    ))
      assert.doesNotMatch(contents, /\.cw\/charter/, `${agentName}: ${fileUrl.pathname}`);
  }
});

test("settings naming an agent this engine compiles for none under are refused, and nothing is composed for them (CORE Story 45)", async () => {
  const fileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/settings.json": `${JSON.stringify({ agents: ["gemini"] })}\n`,
  });

  const workspaceSettingsDTO = await workspaceAppOf(fileReaders).readWorkspaceSettings();
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

test("every other use case answers through stores of a tool's own that keep no path (CORE Story 44 scenarios 1, 2, CORE Story 47 scenario 2, CORE-SC-062, CORE Story 55 scenario 11)", async () => {
  const { charterRepository } = charterKeptWithNoPath();
  const mcpText = McpPrimitive.of(McpPrimitive.sample, "Read the billing service.").writeMarkdown();
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
  const addedSuiteName = answerOf(await testsApp.addTestSuite());
  answerOf(await testsApp.writeTestSuite(addedSuiteName.data.name, testSuiteText));
  assert.deepEqual(
    answerOf(await testsApp.listTestSuites()).data.testSuites.map(({ data }) => data.name),
    [addedSuiteName.data.name],
  );
  answerOf(await testsApp.removeTestSuite(addedSuiteName.data.name));
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
  assert.deepEqual(answerOf(await vendoringApp.listVendors()).data.folders, ["db://vendor:team/charter/root"]);
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
  const [signInStatus] = answerOf(await mcpApp.listSignInStatuses()).data.signInStatuses;
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
  assert.equal(answerOf(await sessionsApp.summarizeSessions()).data.sessionsFolder, "db://sessions");

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
  assert.notEqual((await evaluatingApp.evaluateCharter()).type, "Fault");
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

  const doctorText = JSON.stringify(await filesBuildingApp.diagnoseCharter());
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
      async callTool() {
        return toolAnswer;
      },
    },
    "/repo",
  );

  assert.deepEqual(await mcpApp.callTool(), toolAnswer);
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
    answerTyped<CharterDTOs.Primitives>(await filesAuthoringApp.listPrimitives("somewhere"), "Primitives").data
      .primitives,
    [],
  );
  assert.deepEqual(
    answerTyped<CharterDTOs.Primitives>(
      await filesAuthoringApp.listPrimitives("guide/kept-guide"),
      "Primitives",
    ).data.primitives.map(({ data }) => data.id),
    ["kept-guide"],
  );
});

test("an output extended with a constructor and a private field of its own builds itself over a checkout by overriding createCheckoutOutput (CORE Story 53 scenario 2)", async () => {
  const checkoutFolder = ".cw/log/eval/worktrees/1";
  const fileReaders = new InMemoryFileReaders({});
  class CountedLocalOutput extends LocalRepoManipulator {
    readonly #fileReaders: InMemoryFileReaders;
    #planCount = 0;

    constructor(
      readonly outputTag: string,
      fileReaders: InMemoryFileReaders,
      checkoutFolder = "",
    ) {
      super(fileReaders, new InMemoryFileOutput(fileReaders), checkoutFolder);
      this.#fileReaders = fileReaders;
    }

    override createCheckoutOutput(checkoutFolder: string): CountedLocalOutput {
      return new CountedLocalOutput(this.outputTag, this.#fileReaders, checkoutFolder);
    }

    override async createProjectionPlan(charterOutput: CharterOutput) {
      this.#planCount += 1;
      return super.createProjectionPlan(charterOutput);
    }

    get planCount(): number {
      return this.#planCount;
    }
  }
  const countedOutput = new CountedLocalOutput("counted", fileReaders);

  const checkoutOutput = countedOutput.createCheckoutOutput(checkoutFolder);
  const projectionPlan = await checkoutOutput.createProjectionPlan(new CharterOutput());

  assert.ok(checkoutOutput instanceof CountedLocalOutput);
  assert.equal(checkoutOutput.outputTag, "counted");
  assert.equal(checkoutOutput.planCount, 1);
  assert.ok(projectionPlan.writePlans.every(({ filePath }) => filePath.startsWith(`${checkoutFolder}/`)));
});

test("an output or a projection extended with a constructor of its own, and no override, is refused a checkout before anything is laid (EVAL-FR-021, CORE Story 53 scenario 2)", () => {
  const fileReaders = new InMemoryFileReaders({});
  class TaggedLocalOutput extends LocalRepoManipulator {
    constructor(
      readonly outputTag: string,
      outputFileReaders: InMemoryFileReaders,
    ) {
      super(outputFileReaders, new InMemoryFileOutput(outputFileReaders));
    }
  }
  class TaggedClaudeProjection extends ClaudeProjection {
    constructor(
      readonly projectionTag: string,
      projectionFileReaders: InMemoryFileReaders,
    ) {
      super(projectionFileReaders);
    }
  }

  // One whose added argument comes last, the checkout landing where it would.
  class OptionedLocalOutput extends LocalRepoManipulator {
    constructor(
      outputFileReaders: InMemoryFileReaders,
      checkoutFolder = "",
      readonly outputOption = "kept",
    ) {
      super(outputFileReaders, new InMemoryFileOutput(outputFileReaders), checkoutFolder);
    }
  }
  assert.throws(
    () => new OptionedLocalOutput(fileReaders, "", "chosen").createCheckoutOutput(".cw/log/eval/worktrees/1"),
    (raisedValue: Error) => raisedValue.name === "UnbuiltCheckoutAdapterFault",
  );
  assert.throws(
    () => new TaggedLocalOutput("tagged", fileReaders).createCheckoutOutput(".cw/log/eval/worktrees/1"),
    (raisedValue: Error & { fix?: string }) =>
      raisedValue.name === "UnbuiltCheckoutAdapterFault" &&
      /Override createCheckoutOutput in TaggedLocalOutput/.test(raisedValue.fix ?? ""),
  );
  assert.throws(
    () => new TaggedClaudeProjection("tagged", fileReaders).createCheckoutProjection(".cw/log/eval/worktrees/1"),
    (raisedValue: Error & { fix?: string }) =>
      raisedValue.name === "UnbuiltCheckoutAdapterFault" &&
      /Override createCheckoutProjection in TaggedClaudeProjection/.test(raisedValue.fix ?? ""),
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
    answerTextOf(await keptAuthoringApp.explainPrimitive("kept-guide")),
    answerTextOf(await filesAuthoringApp.explainPrimitive("kept-guide")),
  );
  assert.equal(
    answerTextOf(await keptBuildingApp.previewCharterBuild()),
    answerTextOf(await filesBuildingApp.previewCharterBuild()),
  );
  assert.equal(
    answerTextOf(await keptBuildingApp.predictMainContext()),
    answerTextOf(await filesBuildingApp.predictMainContext()),
  );
  const [keptOpenedPrimitive, filesOpenedPrimitive] = [
    answerTyped<CharterDTOs.Primitive>(await keptAuthoringApp.openPrimitive("kept-guide"), "Primitive"),
    answerTyped<CharterDTOs.Primitive>(await filesAuthoringApp.openPrimitive("kept-guide"), "Primitive"),
  ];
  const rewrittenHeaders = { description: "A guide kept and rewritten.", globs: ["src/**/*.ts"] };
  assert.equal(
    answerTextOf(
      await keptAuthoringApp.rewritePrimitive(
        "kept-guide",
        rewrittenHeaders,
        "Rewritten.",
        keptOpenedPrimitive.data.hash,
      ),
    ),
    answerTextOf(
      await filesAuthoringApp.rewritePrimitive(
        "kept-guide",
        rewrittenHeaders,
        "Rewritten.",
        filesOpenedPrimitive.data.hash,
      ),
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
    async storeVendor(vendorSource) {
      // Each charter of the source is a vendor of its own, under the origin's name.
      for (const charterName of [
        ...(vendorSource.ownCharter === undefined ? [] : [vendorSourcePath.ownCharterName]),
        ...vendorSource.charters.map(({ name }) => name),
      ])
        installedVendorUris.push(`db://vendor:${vendorSource.origin.name}/${charterName}`);
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
  ).evaluateCharter();
  const filesEvalRunReport = await evaluatingAppOver(
    charterKeptAsFiles(fileReaders, fileOutput),
    { agents: ["claude"] },
    fileReaders,
    filesPromptfoo,
  ).evaluateCharter();
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

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import type { ForManagingLocalAgentOutput } from "../src/module/charter/app/port/out/managing-local-agent-output.port.js";
import {
  type CharterOutput,
  CharterOutputItem,
  type ForManagingLocalOutput,
} from "../src/module/charter/app/port/out/managing-local-output.port.js";
import { loadCharterService } from "../src/module/charter/app/services/load-charter.service.js";
import { outputPath } from "../src/module/charter/domain/constants.js";
import { Catalogue } from "../src/module/charter/domain/models/charter-output/catalogue.js";
import { CharterMd } from "../src/module/charter/domain/models/charter-output/charter-md.js";
import { CompiledPrimitive } from "../src/module/charter/domain/models/charter-output/compiled-primitive.js";
import { McpOrigin, McpOrigins } from "../src/module/charter/domain/models/charter-output/mcp-origin.js";
import { ProjectionPlan, WritePlan } from "../src/module/charter/domain/models/charter-output/projection-plan.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { ClaudeProjection } from "../src/module/charter/infra/claude/claude-projection.adapter.js";
import { FileCharterRepository } from "../src/module/charter/infra/file-charter.repository.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryLocalRepo } from "../src/module/charter/infra/in-memory/in-memory-local-repo.adapter.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { AgentProvider } from "../src/module/shared/domain/models/agent/agent-provider.value-object.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { SystemClock } from "../src/module/shared/infra/system-clock.adapter.js";
import { charterOfEveryKind } from "./a-charter-of-every-kind.js";
import { charterRepositoryOf, loadCharterRoot, runningCharterOf } from "./use-cases-of.js";

/** Every file a build wrote before CORE Story 48, for `charterOfEveryKind`,
 *  and what that build said it did: what laying the same charter must leave. */
const laidBefore = JSON.parse(
  await readFile(new URL("./laid-charter-of-every-kind.json", import.meta.url), "utf8"),
) as {
  readonly built: unknown;
  readonly files: Readonly<Record<string, string | { readonly base64: string }>>;
};

/** Where a build would write a host's or the output's files. */
const OUTPUT_PLACES = [".cw/out", ".claude/", ".codex/", ".agents/", ".mcp.json"];

const projectingCharterOver = (heldFileReaders: InMemoryFileReaders, localRepo: ForManagingLocalOutput) => {
  const fileWriter = new InMemoryFileOutput(heldFileReaders);
  return runningCharterOf(heldFileReaders, new InMemoryReporter(), {
    fileWriter,
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands(),
    localRepo,
  });
};

const authoringCharterOver = (heldFileReaders: InMemoryFileReaders) => {
  const fileWriter = new InMemoryFileOutput(heldFileReaders);
  return new AuthoringCharter(
    loadCharterService,
    charterRepositoryOf(heldFileReaders, fileWriter, new InMemorySources()),
    new InMemoryCredentialsRepository(),
    new InMemoryOAuthAuthorizer(),
    new SystemClock(),
    new InMemoryReporter(),
  );
};

test("a compiled charter's items are each known by their path inside the output and hold their text and assets; an item for one agent alone names that agent in its path, and none names where the output lands (CORE-FR-220, CORE Story 48 scenario 1)", async () => {
  const hostNames = ["claude", "codex"];
  const charterRoot = await loadCharterRoot(new InMemoryFileReaders(charterOfEveryKind));
  const charterOutput = CharterOutputService.compileCharterRoot(
    charterRoot,
    hostNames.map((hostName) => new AgentProvider(hostName)),
  );

  assert.ok(charterOutput.charterOutputItems.length > 0);
  for (const charterOutputItem of charterOutput.charterOutputItems) {
    const path = outputPath.getPath(charterOutputItem);
    assert.ok(charterOutputItem instanceof CharterOutputItem, `${path} is an item of the output`);
    assert.ok(path !== "" && !path.startsWith("/") && !path.startsWith("."), `${path} is a path inside the output`);
    assert.equal(typeof charterOutputItem.text, "string");
    for (const placeField of ["file", "projections", "projectionPolicy"])
      assert.ok(!(placeField in charterOutputItem), `${path} holds no ${placeField}`);
    for (const outputPlace of OUTPUT_PLACES)
      assert.ok(!charterOutputItem.text.includes(outputPlace), `${path} names ${outputPlace}`);
  }
  // An item for one agent alone names that agent in its path; an item every
  // agent reads names none.
  const agentCatalogues = charterOutput.charterOutputItems.filter(
    (charterOutputItem): charterOutputItem is Catalogue =>
      charterOutputItem instanceof Catalogue && charterOutputItem.agentProvider !== undefined,
  );
  assert.deepEqual(agentCatalogues.map((agentCatalogue) => agentCatalogue.agentProvider!.name).sort(), hostNames);
  for (const agentCatalogue of agentCatalogues)
    assert.ok(
      outputPath.getPath(agentCatalogue).includes(agentCatalogue.agentProvider!.name),
      `${outputPath.getPath(agentCatalogue)} names ${agentCatalogue.agentProvider!.name}`,
    );
  for (const sharedItem of charterOutput.charterOutputItems.filter(
    (charterOutputItem) => !agentCatalogues.includes(charterOutputItem as Catalogue),
  ))
    for (const hostName of hostNames)
      assert.ok(
        !outputPath.getPath(sharedItem).includes(hostName),
        `${outputPath.getPath(sharedItem)} names ${hostName}`,
      );
  // Every primitive with files beside its document carries each of them, as
  // its author kept it, among its assets.
  const primitiveFolderUrl = "file:///repo/.cw/charter/team/primitive/";
  const compiledPrimitives = charterOutput.charterOutputItems.filter(
    (charterOutputItem): charterOutputItem is CompiledPrimitive => charterOutputItem instanceof CompiledPrimitive,
  );
  const assetPrimitiveIds = new Set<string>();
  for (const [fileUrl, keptContents] of Object.entries(charterOfEveryKind)) {
    const assetMatch = fileUrl.startsWith(primitiveFolderUrl)
      ? decodeURIComponent(fileUrl.slice(primitiveFolderUrl.length)).match(/^([^/]+)\/(.+?)\/([^/]+)$/)
      : null;
    if (assetMatch === null || assetMatch[3] === "index.md") continue;
    const [, assetKind, assetPrimitiveId, assetFile] = assetMatch;
    assetPrimitiveIds.add(`${assetKind}/${assetPrimitiveId}`);
    const assetPrimitive = compiledPrimitives.find(
      (compiledPrimitive) => compiledPrimitive.kind === assetKind && compiledPrimitive.id === assetPrimitiveId,
    );
    const compiledAsset = assetPrimitive?.assets.find(({ assetPath }) => assetPath === assetFile);
    assert.ok(compiledAsset !== undefined, `${assetKind} ${assetPrimitiveId} carries ${assetFile}`);
    assert.deepEqual(
      compiledAsset.contents,
      typeof keptContents === "string" ? new TextEncoder().encode(keptContents) : keptContents,
    );
  }
  assert.deepEqual([...assetPrimitiveIds].sort(), ["guide/general", "script/check"]);
  const compiledScript = compiledPrimitives.find((compiledPrimitive) => compiledPrimitive.id === "check");
  assert.ok(compiledScript !== undefined);
  assert.deepEqual(
    compiledScript.assets.map(({ assetPath, isExecutable }) => [assetPath, isExecutable]),
    [
      ["run.sh", true],
      ["logo.png", false],
    ],
  );
});

test("the engine's own code names no place of the build's output or of a host (CORE-FR-221)", async () => {
  const hexagonFolder = new URL("../src/module/", import.meta.url);
  const sourceFiles = (await readdir(hexagonFolder, { recursive: true })).filter(
    (file) => file.endsWith(".ts") && !file.includes("/infra/") && !/\.probe\./.test(file),
  );
  for (const sourceFile of sourceFiles) {
    // What the code says, its comments left out: a comment may say where a host reads a file.
    const sourceText = (await readFile(new URL(sourceFile, hexagonFolder), "utf8")).replace(
      /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm,
      "",
    );
    for (const outputPlace of [...OUTPUT_PLACES, '"CLAUDE.md"', '"AGENTS.md"'])
      assert.ok(!sourceText.includes(outputPlace), `${sourceFile} names ${outputPlace}`);
  }
});

test("laid onto a repository, a charter leaves the build's output, its paths written from where each file lands, and every host's folders as laid before, byte for byte (CORE-FR-221, CORE-SC-063, CORE Story 48 scenario 2, CORE Story 52 scenario 13)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const charterRuntimeApp = projectingCharterOver(
    heldFileReaders,
    new LocalRepoManipulator(heldFileReaders, new InMemoryFileOutput(heldFileReaders)),
  );

  assert.deepEqual(await charterRuntimeApp.buildCharter(), laidBefore.built);
  const laidFiles = Object.fromEntries(
    (await heldFileReaders.readBytesRecursively("")).map(({ path, contents }) => [path, contents] as const),
  );
  assert.deepEqual(Object.keys(laidFiles).sort(), Object.keys(laidBefore.files).sort());
  for (const [path, laidContents] of Object.entries(laidBefore.files)) {
    const expectedBytes =
      typeof laidContents === "string"
        ? new TextEncoder().encode(laidContents)
        : Uint8Array.from(Buffer.from(laidContents.base64, "base64"));
    assert.deepEqual(laidFiles[path], expectedBytes, `${path} is as it was laid before`);
  }
});

test("an output writer of a tool author's own is handed the whole of what the charter compiles to, and decides where the output lands (CORE-FR-221)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const filesBefore = (await heldFileReaders.readBytesRecursively("")).length;
  const recordingLocalRepo = new InMemoryLocalRepo();

  const planSummaryDTO = await projectingCharterOver(heldFileReaders, recordingLocalRepo).buildCharter();

  const [charterOutput] = recordingLocalRepo.charterOutputs;
  assert.ok(charterOutput !== undefined);
  const places = charterOutput.charterOutputItems.map((charterOutputItem) =>
    recordingLocalRepo.describeItemPlace(outputPath.getPath(charterOutputItem)),
  );
  for (const expectedPlace of [
    "catalogue.json",
    "catalogue.claude.json",
    "catalogue.codex.json",
    "CHARTER.md",
    "mcp-origins.json",
    "sensors.json",
    "guide/acme/style/index.md",
  ])
    assert.ok(places.includes(expectedPlace), `handed ${expectedPlace}`);
  // What a part says of another is its path inside the output.
  const charterMd = charterOutput.charterOutputItems.find(
    (charterOutputItem): charterOutputItem is CharterMd => charterOutputItem instanceof CharterMd,
  )!;
  assert.match(charterMd.text, /\(\$CW_OUT\/catalogue\.json\)/);
  assert.equal(planSummaryDTO.type, "ProjectionPlanSummary");
  if (planSummaryDTO.type === "ProjectionPlanSummary")
    for (const place of places) assert.ok(planSummaryDTO.data.added.includes(place), `${place} is added`);
  assert.equal(recordingLocalRepo.laidProjectionPlans.length, 1);
  assert.equal(
    (await heldFileReaders.readBytesRecursively("")).length,
    filesBefore,
    "nothing was written but through the output writer",
  );
});

test("a projection of a tool author's own, handed for an agent, is handed the same output cw's own projection is, and decides where each part lands (CORE-FR-221, CORE Story 48 scenario 3)", async () => {
  /** What a projection was handed by each build, recorded beside what it does. */
  const handedCharterOutputs: { readonly projectionName: string; readonly charterOutput: CharterOutput }[] = [];
  const recordingProjectionOf = (
    projectionName: string,
    agentProjection: ForManagingLocalAgentOutput,
  ): ForManagingLocalAgentOutput => ({
    tokenFactor: agentProjection.tokenFactor,
    createCheckoutProjection: (checkoutFolder) =>
      recordingProjectionOf(projectionName, agentProjection.createCheckoutProjection(checkoutFolder)),
    listMainContextTexts: (charter, charterOutput) => agentProjection.listMainContextTexts(charter, charterOutput),
    createAgentProjectionPlan: async (charter, charterOutput) => {
      handedCharterOutputs.push({ projectionName, charterOutput });
      return agentProjection.createAgentProjectionPlan(charter, charterOutput);
    },
  });
  // The author's own lays each part under a folder of its choosing, its path
  // inside the output kept.
  const ownProjection: ForManagingLocalAgentOutput = {
    tokenFactor: 1,
    createCheckoutProjection: () => ownProjection,
    listMainContextTexts: () => [],
    createAgentProjectionPlan: async (_charter, charterOutput) =>
      new ProjectionPlan(
        [],
        [],
        charterOutput.charterOutputItems.map((charterOutputItem) => {
          const { text } = charterOutputItem;
          const path = outputPath.getPath(charterOutputItem);
          const ownPlace = `own-agent/${path}`;
          return new WritePlan(ownPlace, ownPlace, text);
        }),
      ),
  };
  const laidLocalRepoOf = async (agentProjection: ForManagingLocalAgentOutput) => {
    const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
    const recordingLocalRepo = new InMemoryLocalRepo();
    const charterRuntimeApp = runningCharterOf(heldFileReaders, new InMemoryReporter(), {
      fileWriter: new InMemoryFileOutput(heldFileReaders),
      tokenCounter: new InMemoryTokenCounter(),
      shell: new InMemoryShellCommands(),
      localRepo: recordingLocalRepo,
      workspaceSettings: { agents: ["claude"] },
      agentProjectionByProvider: { claude: agentProjection },
    });
    assert.equal((await charterRuntimeApp.buildCharter()).type, "ProjectionPlanSummary");
    return recordingLocalRepo;
  };

  await laidLocalRepoOf(
    recordingProjectionOf("cw's own", new ClaudeProjection(new InMemoryFileReaders(charterOfEveryKind))),
  );
  const ownLocalRepo = await laidLocalRepoOf(recordingProjectionOf("the author's own", ownProjection));

  const [cwHandedRecord, ownHandedRecord] = handedCharterOutputs;
  assert.deepEqual(
    handedCharterOutputs.map(({ projectionName }) => projectionName),
    ["cw's own", "the author's own"],
  );
  assert.deepEqual(ownHandedRecord?.charterOutput, cwHandedRecord?.charterOutput);
  // What the author's projection decided is what the build lays.
  const [laidProjectionPlan] = ownLocalRepo.laidProjectionPlans;
  assert.ok(laidProjectionPlan !== undefined);
  const laidPaths = laidProjectionPlan.writePlans.map(({ path }) => path);
  for (const path of ownHandedRecord!.charterOutput.charterOutputItems.map((charterOutputItem) =>
    outputPath.getPath(charterOutputItem),
  ))
    assert.ok(laidPaths.includes(`own-agent/${path}`), `laid own-agent/${path}`);
});

test("the mcp origins are served from what the build put out, read back from where an output writer of a tool author's own laid it (CORE-FR-221, CORE-FR-222, CORE Story 48 scenario 4)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const fileWriter = new InMemoryFileOutput(heldFileReaders);
  // The output is laid in memory, nowhere the engine or cw's own would look,
  // and the charter's repository reads it back from there.
  const ownLocalRepo = new InMemoryLocalRepo();
  class OwnLaidCharterRepository extends FileCharterRepository {
    override async readCompiledOutputItem(itemPath: string): Promise<string | undefined> {
      return ownLocalRepo.readCompiledOutputItem(itemPath);
    }
  }
  const mcpServerCaller = new InMemoryMcpServers();
  mcpServerCaller.mcpServerByAddress.set("node", {
    tools: [{ name: "echo", description: "Echoes.", inputSchema: { type: "object" } }],
  });
  const charterRuntimeApp = runningCharterOf(heldFileReaders, new InMemoryReporter(), {
    fileWriter,
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands(),
    localRepo: ownLocalRepo,
    charterRepository: new OwnLaidCharterRepository(heldFileReaders, fileWriter, new InMemorySources()),
    workspaceSettings: { agents: ["claude"] },
    agentProjectionByProvider: { claude: new ClaudeProjection(heldFileReaders) },
    mcpServerCaller,
    credentialsRepository: new InMemoryCredentialsRepository(),
    oauthAuthorizer: new InMemoryOAuthAuthorizer(),
    clock: new InMemoryClock(new Date("2026-11-07T00:00:00Z")),
  });

  assert.equal((await charterRuntimeApp.buildCharter()).type, "ProjectionPlanSummary");
  const laidOriginsText = ownLocalRepo.textByPlace.get("mcp-origins.json");
  assert.ok(laidOriginsText !== undefined, "the build laid the mcp origins");
  const [laidOrigin] = (JSON.parse(laidOriginsText) as { origins: { names: Record<string, string> }[] }).origins;
  assert.equal(await heldFileReaders.readIfThere(".cw/out/mcp-origins.json"), undefined);

  const servedTools = await charterRuntimeApp.listServedTools();

  assert.equal(servedTools.type, "ServedTools");
  if (servedTools.type === "ServedTools") {
    assert.deepEqual(
      servedTools.data.tools.map(({ data: servedTool }) => servedTool.name),
      [`${laidOrigin?.names.local}__echo`],
    );
    assert.deepEqual(servedTools.data.problems, []);
  }
});

test("built with projections of a tool author's own, under any agent's name, the engine writes nothing outside the build's output but what each projection lays (CORE-FR-221, CORE Story 52 scenario 13)", async () => {
  const contentsByPathOf = async (heldFileReaders: InMemoryFileReaders) =>
    Object.fromEntries(
      (await heldFileReaders.readBytesRecursively("")).map(({ path, contents }) => [path, contents] as const),
    );
  /** A projection laying one file of its own, named for the agent it is
   *  handed under. */
  const ownProjectionOf = (agentName: string): ForManagingLocalAgentOutput => ({
    tokenFactor: 1,
    createCheckoutProjection: () => ownProjectionOf(agentName),
    listMainContextTexts: () => [],
    createAgentProjectionPlan: async () =>
      new ProjectionPlan([], [], [new WritePlan(`.${agentName}/rules.md`, `.${agentName}/rules.md`, "Own.\n")]),
  });
  // The charter names claude, so a projection is handed under that name; the
  // other is a name no part of cw knows.
  const agentProjectionByProvider = { claude: ownProjectionOf("claude"), quill: ownProjectionOf("quill") };
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const contentsByPathBefore = await contentsByPathOf(heldFileReaders);
  const charterRuntimeApp = runningCharterOf(heldFileReaders, new InMemoryReporter(), {
    fileWriter: new InMemoryFileOutput(heldFileReaders),
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands(),
    workspaceSettings: { agents: Object.keys(agentProjectionByProvider) },
    agentProjectionByProvider,
  });

  const planSummaryDTO = await charterRuntimeApp.buildCharter();

  assert.equal(planSummaryDTO.type, "ProjectionPlanSummary", JSON.stringify(planSummaryDTO));
  const contentsByPathAfter = await contentsByPathOf(heldFileReaders);
  const changedPaths = Object.keys(contentsByPathAfter)
    .filter(
      (path) =>
        !(path in contentsByPathBefore) ||
        !Buffer.from(contentsByPathAfter[path]!).equals(Buffer.from(contentsByPathBefore[path]!)),
    )
    .filter((path) => !path.startsWith(".cw/out/"));
  assert.deepEqual(changedPaths.sort(), [".claude/rules.md", ".quill/rules.md"]);
});

test("a search reads when a kind comes up as the domain says it, its paths under $CW_OUT/ (FR-114, CORE-FR-221)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const charterAuthoringApp = authoringCharterOver(heldFileReaders);
  const matchedIdsOf = async (matching: string) => {
    const primitivesDTO = await charterAuthoringApp.listPrimitives(matching);
    assert.equal(primitivesDTO.type, "Primitives");
    return primitivesDTO.type === "Primitives"
      ? primitivesDTO.data.primitives.map(({ data: primitive }) => primitive.id)
      : [];
  };

  assert.ok((await matchedIdsOf("$CW_OUT/script")).includes("check"));
  assert.ok(!(await matchedIdsOf(".cw/out/script")).includes("check"));
});

test("what an mcp origin listed is laid in its own words, whatever it holds (CORE-FR-221)", async () => {
  const listedDescription = "Echoes $CW_OUT/sensors.json back.";
  const mcpOrigins = new McpOrigins([
    new McpOrigin({
      ids: ["local"],
      names: { local: "local" },
      address: "node",
      auth: [],
      tools: [{ name: "echo", description: listedDescription, inputSchema: { type: "object" } }],
    }),
  ]);

  const laidOrigins = JSON.parse(mcpOrigins.text) as { origins: { tools: { description: string }[] }[] };

  assert.equal(laidOrigins.origins[0]?.tools[0]?.description, listedDescription);
});

test("an output item of no class the layout knows is refused by a named fault, never a bare error (CORE-FR-220)", () => {
  class UnplacedItem extends CharterOutputItem {
    get text(): string {
      return "";
    }
  }

  assert.throws(
    () => outputPath.getPath(new UnplacedItem()),
    (thrownError: unknown) =>
      thrownError instanceof Error &&
      thrownError.name === "UnplaceableCharterOutputItemFault" &&
      thrownError.message.includes("UnplacedItem"),
  );
});

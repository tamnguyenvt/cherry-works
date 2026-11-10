import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { InMemoryAuthorizing } from "../src/module/charter/infra/in-memory/in-memory-authorizing.adapter.js";
import { InMemoryClock } from "../src/module/shared/infra/in-memory/in-memory-clock.adapter.js";
import { InMemoryMcpServers } from "../src/module/shared/infra/in-memory/in-memory-mcp-servers.adapter.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryShellCommands } from "../src/module/runtime/infra/in-memory/in-memory-shell-commands.adapter.js";
import { LocalRepoManipulator } from "../src/module/charter/infra/local-repo-manipulator.adapter.js";
import { InMemoryLocalRepo } from "../src/module/charter/infra/in-memory/in-memory-local-repo.adapter.js";
import { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import type { WorkspaceSettings } from "../src/presentation/cli/commands/command.interface.js";
import { SystemClock } from "../src/module/shared/infra/system-clock.adapter.js";
import { buildCharterService } from "../src/module/charter/app/services/build-charter.service.js";
import { installCharterService } from "../src/module/charter/app/services/install-charter.service.js";
import { loadCharterService } from "../src/module/charter/app/services/load-charter.service.js";
import { loadMcpOriginsService } from "../src/module/charter/app/services/load-mcp-origins.service.js";
import { CompileService } from "../src/module/charter/domain/services/compile.service.js";
import { AgentProvider } from "../src/module/charter/domain/models/agent/agent-provider.js";
import { CompiledPrimitive } from "../src/module/charter/domain/models/projection/compiled-primitive.js";
import { McpOrigin, McpOrigins } from "../src/module/charter/domain/models/projection/mcp-origin.js";
import type { CharterOutput } from "../src/module/charter/domain/models/projection/charter-output.js";
import type { ForManagingLocalOutput } from "../src/module/charter/app/port/out/managing-local-output.port.js";
import { charterOfEveryKind } from "./a-charter-of-every-kind.js";
import { charterRepositoryOf, loadCharterRoot, runningCharterOf } from "./use-cases-of.js";

const repo = new URL("file:///repo/");

/** Every file a build wrote before CORE Story 48, for `charterOfEveryKind`,
 *  and what that build said it did: what laying the same charter must leave. */
const laidBefore = JSON.parse(await readFile(new URL("./laid-charter-of-every-kind.json", import.meta.url), "utf8")) as {
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
    installCharterService,
    charterRepositoryOf(heldFileReaders, fileWriter, new InMemorySources()),
    new InMemoryCredentialsRepository(),
    new InMemoryAuthorizing(),
    new SystemClock(),
    new InMemoryReporter(),
  );
};

test("a compiled charter's parts each name their id, kind and part, their path inside the output, their text and assets, and no place the output lands at (CORE-FR-220)", async () => {
  const charterRoot = await loadCharterRoot(new InMemoryFileReaders(charterOfEveryKind));
  const charterOutput = CompileService.compileCharterRoot(charterRoot, [new AgentProvider("claude"), new AgentProvider("codex")]);

  assert.ok(charterOutput.compiledParts.length > 0);
  for (const compiledPart of charterOutput.compiledParts) {
    const { part, kind, id, path } = compiledPart.outputPart;
    assert.ok(part !== "" && kind !== "", `${id} names its part and kind`);
    assert.ok(path !== "" && !path.startsWith("/") && !path.startsWith("."), `${part} ${id} names its path inside the output`);
    assert.equal(typeof id, "string");
    assert.equal(typeof compiledPart.text, "string");
    for (const placeField of ["file", "path", "projections", "projectionPolicy"]) assert.ok(!(placeField in compiledPart), `${part} ${id} holds no ${placeField}`);
    for (const outputPlace of OUTPUT_PLACES) assert.ok(!compiledPart.text.includes(outputPlace), `${part} ${id} names ${outputPlace}`);
  }
  const compiledScript = charterOutput.compiledParts.find((compiledPart) => compiledPart instanceof CompiledPrimitive && compiledPart.id === "check");
  assert.ok(compiledScript instanceof CompiledPrimitive);
  assert.deepEqual(compiledScript.assets.map(({ file, executable }) => [file, executable]), [["run.sh", true], ["logo.png", false]]);
});

test("the engine's own code names no place of the build's output or of a host (CORE-FR-221)", async () => {
  const hexagonFolder = new URL("../src/module/", import.meta.url);
  const sourceFiles = (await readdir(hexagonFolder, { recursive: true })).filter((file) => file.endsWith(".ts") && !file.includes("/infra/"));
  for (const sourceFile of sourceFiles) {
    // What the code says, its comments left out: a comment may say where a host reads a file.
    const sourceText = (await readFile(new URL(sourceFile, hexagonFolder), "utf8")).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
    for (const outputPlace of [...OUTPUT_PLACES, '"CLAUDE.md"', '"AGENTS.md"']) assert.ok(!sourceText.includes(outputPlace), `${sourceFile} names ${outputPlace}`);
  }
});

test("laid onto a repository, a charter leaves the build's output, its paths written from where each file lands, and every host's folders as laid before, byte for byte (CORE-FR-221, CORE-SC-063, CORE Story 52 scenario 13)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const charterRuntimeApp = projectingCharterOver(heldFileReaders, new LocalRepoManipulator(heldFileReaders, new InMemoryFileOutput(heldFileReaders)));

  assert.deepEqual(await charterRuntimeApp.build(), laidBefore.built);
  const laidFiles = Object.fromEntries((await heldFileReaders.readBytesRecursively("")).map(({ path, contents }) => [path, contents] as const));
  assert.deepEqual(Object.keys(laidFiles).sort(), Object.keys(laidBefore.files).sort());
  for (const [path, laidContents] of Object.entries(laidBefore.files)) {
    const expectedBytes = typeof laidContents === "string" ? new TextEncoder().encode(laidContents) : Uint8Array.from(Buffer.from(laidContents.base64, "base64"));
    assert.deepEqual(laidFiles[path], expectedBytes, `${path} is as it was laid before`);
  }
});

test("an output writer of a tool author's own is handed the whole of what the charter compiles to, and decides where the output lands (CORE-FR-221)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const filesBefore = (await heldFileReaders.readBytesRecursively("")).length;
  const recordingLocalRepo = new InMemoryLocalRepo();

  const planSummaryDTO = await projectingCharterOver(heldFileReaders, recordingLocalRepo).build();

  const [charterOutput] = recordingLocalRepo.charterOutputs;
  assert.ok(charterOutput !== undefined);
  const places = charterOutput.compiledParts.map((compiledPart) => recordingLocalRepo.findPlace(compiledPart.outputPart));
  for (const expectedPlace of ["catalogue.json", "catalogue.claude.json", "catalogue.codex.json", "CHARTER.md", "mcp-origins.json", "sensors.json", "guide/acme/style/index.md"])
    assert.ok(places.includes(expectedPlace), `handed ${expectedPlace}`);
  // What a part says of another is its path inside the output.
  assert.match(charterOutput.charterMd.text, /\(\$CW_OUT\/catalogue\.json\)/);
  assert.equal(planSummaryDTO.type, "PlanSummary");
  if (planSummaryDTO.type === "PlanSummary") for (const place of places) assert.ok(planSummaryDTO.data.added.includes(place), `${place} is added`);
  assert.equal(recordingLocalRepo.laidPlans.length, 1);
  assert.equal((await heldFileReaders.readBytesRecursively("")).length, filesBefore, "nothing was written but through the output writer");
});

test("the mcp origins are served from what the build put out, read back through the charter's repository (CORE-FR-221, CORE-FR-222)", async () => {
  const origin = { ids: ["local"], names: { local: "local" }, address: "node", command: { command: "node", args: [] }, auth: [], tools: [{ name: "echo", description: "Echoes.", inputSchema: { type: "object" } }] };
  const laidFileReaders = new InMemoryFileReaders({
    "file:///repo/.cw/out/mcp-origins.json": `${JSON.stringify({ origins: [origin] })}\n`,
    "file:///repo/.cw/out/mcp/local/index.md": "---\nkind: mcp\nid: local\ndescription: A local mcp origin.\ncommand: node\ntools: [echo]\n---\n\nEcho.\n",
  });
  const charterRuntimeApp = runningCharterOf(laidFileReaders, new InMemoryReporter(), {
    fileWriter: new InMemoryFileOutput(laidFileReaders),
    tokenCounter: new InMemoryTokenCounter(),
    shell: new InMemoryShellCommands(),
    localRepo: new InMemoryLocalRepo(),
    workspaceSettings: { agents: [] },
    mcpServers: new InMemoryMcpServers(),
    credentialsRepository: new InMemoryCredentialsRepository(),
    authorizing: new InMemoryAuthorizing(),
    clock: new InMemoryClock(new Date("2026-11-07T00:00:00Z")),
  });

  const servedTools = await charterRuntimeApp.tools();

  assert.equal(servedTools.type, "ServedTools");
  if (servedTools.type === "ServedTools") assert.deepEqual(servedTools.data.tools.map(({ data }) => data.name), ["local__echo"]);
  if (servedTools.type === "ServedTools") assert.deepEqual(servedTools.data.problems, []);
});

test("a search reads when a kind comes up as the domain says it, its paths under $CW_OUT/ (FR-114, CORE-FR-221)", async () => {
  const heldFileReaders = new InMemoryFileReaders(charterOfEveryKind);
  const charterAuthoringApp = authoringCharterOver(heldFileReaders);
  const matchedIdsOf = async (matching: string) => {
    const primitivesDTO = await charterAuthoringApp.fullList(matching);
    assert.equal(primitivesDTO.type, "Primitives");
    return primitivesDTO.type === "Primitives" ? primitivesDTO.data.primitives.map(({ data }) => data.id) : [];
  };

  assert.ok((await matchedIdsOf("$CW_OUT/script")).includes("check"));
  assert.ok(!(await matchedIdsOf(".cw/out/script")).includes("check"));
});

test("what an mcp origin listed is laid in its own words, whatever it holds (CORE-FR-221)", async () => {
  const listedDescription = "Echoes $CW_OUT/sensors.json back.";
  const mcpOrigins = new McpOrigins([new McpOrigin({ ids: ["local"], names: { local: "local" }, address: "node", auth: [], tools: [{ name: "echo", description: listedDescription, inputSchema: { type: "object" } }] })]);

  const laidOrigins = JSON.parse(mcpOrigins.text) as { origins: { tools: { description: string }[] }[] };

  assert.equal(laidOrigins.origins[0]?.tools[0]?.description, listedDescription);
});

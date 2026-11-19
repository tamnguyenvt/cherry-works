import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterReleaseActionScript } from "../src/module/charter/domain/builtin/charter-release-action-script.js";
import { CharterReleaseSkill } from "../src/module/charter/domain/builtin/charter-release-skill.js";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { CwSessionTokensCounterScript } from "../src/module/charter/domain/builtin/cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "../src/module/charter/domain/builtin/cw-session-tokens-sensor.js";
import { outputPath } from "../src/module/charter/domain/constants.js";
import { ContentHelper } from "../src/module/charter/domain/helper.js";
import { CharterMd } from "../src/module/charter/domain/models/charter-output/charter-md.js";
import { CharterOutput } from "../src/module/charter/domain/models/charter-output/charter-output.js";
import { CharterOutputItem } from "../src/module/charter/domain/models/charter-output/charter-output-item.js";
import { CompiledPrimitive } from "../src/module/charter/domain/models/charter-output/compiled-primitive.js";
import { StampedDocumentSpec } from "../src/module/charter/domain/models/charter-output/stamped-document.specification.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import { YamlLib } from "../src/module/shared/domain/libs/yaml.lib.js";
import { AgentProvider } from "../src/module/shared/domain/models/agent/agent-provider.value-object.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { putDownBy } from "./put-down-by.js";
import { agentProjectionByProviderOf, loadCharterRoot } from "./use-cases-of.js";

const CLAUDE = new AgentProvider("claude");
const repo = new URL("file:///repo/");
const root = FolderAddress.parseFolderUrl("file:///repo/.cw/charter/team/primitive/");

const primitive = (kind: string, id: string, body = `The body of ${id}.`) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: What ${id} is for, in one line.`,
    'globs: ["src/**/*.ts"]',
    'triggers: ["a request"]',
    "---",
    "",
    body,
    "",
  ].join("\n");

/** The skill the engine brings, as the catalogue carries it before the file it
 *  is opened at: every charter holds it, so every catalogue lists it (FR-017). */
const builtinEntry = {
  id: "cw-author",
  kind: "skill",
  description: new CwAuthorSkill().headers.description,
};

/** The script and the sensor the engine brings to count a session's tokens,
 *  catalogued as every charter's are (EVAL-FR-008). */
const sessionCounterEntries = [
  {
    id: "cw-session-tokens-counter",
    kind: "script",
    description: new CwSessionTokensCounterScript().headers.description,
    file: ".cw/out/script/cw-session-tokens-counter/index.md",
  },
  {
    id: "cw-session-tokens-counter-on-stop",
    kind: "sensor",
    description: new CwSessionTokensSensor().headers.description,
    file: ".cw/out/sensor/cw-session-tokens-counter-on-stop/index.md",
  },
];

/** What the engine's session primitives compile to under the workspace: the
 *  script's document and its one asset, then the sensor's document. */
const sessionCounterPaths = [
  ".cw/out/script/cw-session-tokens-counter/index.md",
  ".cw/out/script/cw-session-tokens-counter/sessionTokensCounter.mjs",
  ".cw/out/sensor/cw-session-tokens-counter-on-stop/index.md",
];

/** `/charter-release` and its script, which every repository is brought and
 *  catalogues before the engine's other primitives (VENDOR-FR-027). */
const charterReleaseEntries = [
  {
    id: "charter-release",
    kind: "skill",
    description: new CharterReleaseSkill().headers.description,
    file: ".cw/out/skill/charter-release/index.md",
  },
  {
    id: "charter-release-action",
    kind: "script",
    description: new CharterReleaseActionScript().headers.description,
    file: ".cw/out/script/charter-release-action/index.md",
  },
];

/** What `/charter-release` and its script compile to under the workspace. */
const charterReleasePaths = [
  ".cw/out/skill/charter-release/index.md",
  ".cw/out/script/charter-release-action/index.md",
  ".cw/out/script/charter-release-action/charter-release-action.mjs",
];

const oneGuide = { [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any") };

/** What one charter compiles to, put down: the paths it wrote, and what each of
 *  them holds. Compiling and projecting are asked together because neither is
 *  worth anything alone — one says what the files hold, the other where they go
 *  (SC-004). */
const built = async (authored: Readonly<Record<string, string>>, agents: readonly AgentProvider[] = [CLAUDE]) => {
  const held = new InMemoryFileReaders(authored);
  const charter = await loadCharterRoot(held);
  const writtenPaths = await putDownBy(charter, CharterOutputService.compileCharterRoot(charter, agents), held);

  return {
    charter,
    writtenPaths,
    files: Object.fromEntries(
      await Promise.all(writtenPaths.map(async (path) => [path, await held.readFile(new URL(path, repo))] as const)),
    ) as Readonly<Record<string, string>>,
  };
};

test("compiling produces the listing, the charter file, and what the chosen agent reads", async () => {
  const { writtenPaths } = await built(oneGuide);

  assert.deepEqual(writtenPaths, [
    ".cw/out/catalogue.json",
    ".cw/out/catalogue.claude.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/sensors.json",
    ".cw/out/CHARTER.md",
    // Every primitive as it compiled, in the catalogue's order, since the
    // catalogue is what names each file (FR-139, FR-140).
    ...charterReleasePaths,
    ".cw/out/skill/cw-author/index.md",
    ...sessionCounterPaths,
    ".cw/out/guide/no-any/index.md",
    // The file that agent reads unasked, which is what sends it to the
    // orientation above.
    "CLAUDE.md",
    // The hook the engine's own sensor runs when the agent stops.
    ".claude/settings.json",
    // The one server that reaches every mcp origin the charter declares.
    ".mcp.json",
    // The skills the engine brings, which every charter holds and reads first.
    ".claude/skills/charter-release/SKILL.md",
    ".claude/skills/cw-author/SKILL.md",
    // The one guide as the chosen agent's own kinds have it.
    ".claude/rules/no-any.md",
  ]);
});

test("every compiled file is written at a path from the repository", async () => {
  const { writtenPaths } = await built(oneGuide);

  // Relative to the repository holding the charter, so the same charter compiles
  // the same on every machine that checks it out.
  for (const path of writtenPaths) assert.ok(!path.startsWith("/"), `${path} is not from the repository`);
});

test("no listing and no projection can be produced without the others (SC-004)", async () => {
  // Not a test of what compiling returns but of what it offers: one call, one
  // list, and no argument that narrows it to a single file. The second argument
  // says which agents the repository chose, never which file is wanted.
  assert.equal(CharterOutputService.compileCharterRoot.length, 2);
  assert.equal((await built(oneGuide)).writtenPaths.length, 19);
});

test("a repository that chose no agent still compiles the whole neutral half (FR-019)", async () => {
  const { writtenPaths } = await built(oneGuide, []);

  assert.deepEqual(writtenPaths, [
    ".cw/out/catalogue.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/sensors.json",
    ".cw/out/CHARTER.md",
    ...charterReleasePaths,
    ".cw/out/skill/cw-author/index.md",
    ...sessionCounterPaths,
    ".cw/out/guide/no-any/index.md",
  ]);
});

test("the full catalogue is written as the catalogue says it, one entry per line", async () => {
  const { files } = await built(oneGuide);

  const contents = files[".cw/out/catalogue.json"] ?? "";
  assert.deepEqual(JSON.parse(contents), [
    ...charterReleaseEntries,
    { ...builtinEntry, file: ".cw/out/skill/cw-author/index.md" },
    ...sessionCounterEntries.filter((entry) => entry.kind !== "sensor"),
    {
      id: "no-any",
      kind: "guide",
      description: "What no-any is for, in one line.",
      file: ".cw/out/guide/no-any/index.md",
      globs: ["src/**/*.ts"],
    },
  ]);
  assert.ok(contents.includes("\n  {\n"));
});

test("every primitive compiles to one document holding its headers, then its mixins' bodies, then its own (FR-139, CORE Story 16 scenario 1)", async () => {
  const { files } = await built({
    [new URL("mixin/house-style/index.md", root).href]: [
      "---",
      "kind: mixin",
      "id: house-style",
      "description: What every rule here shares.",
      "---",
      "",
      "LENT BODY",
      "",
    ].join("\n"),
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", "OWN BODY").replace(
      "---\n\nOWN BODY",
      "mixins: [house-style]\n---\n\nOWN BODY",
    ),
  });

  const document = files[".cw/out/guide/no-any/index.md"] ?? "";

  assert.match(document, /^---\nkind: guide\nid: no-any\n/);
  assert.match(document, /mixins: \["house-style"\]\n---\n\nLENT BODY\n\nOWN BODY\n/);
  assert.ok(new StampedDocumentSpec().isSatisfiedBy(document));
});

test("a mixin at the end lends its body after its host's, and one at the start before it, each in the order the host named them", async () => {
  const mixinText = (id: string, position: string) =>
    [
      "---",
      "kind: mixin",
      `id: ${id}`,
      "description: What every rule here shares.",
      ...(position === "" ? [] : [`position: ${position}`]),
      "---",
      "",
      id.toUpperCase(),
      "",
    ].join("\n");
  const { files } = await built({
    [new URL("mixin/opening/index.md", root).href]: mixinText("opening", ""),
    [new URL("mixin/closing/index.md", root).href]: mixinText("closing", "end"),
    [new URL("mixin/setting/index.md", root).href]: mixinText("setting", "start"),
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", "OWN BODY").replace(
      "---\n\nOWN BODY",
      "mixins: [closing, opening, setting]\n---\n\nOWN BODY",
    ),
  });

  assert.match(files[".cw/out/guide/no-any/index.md"] ?? "", /---\n\nOPENING\n\nSETTING\n\nOWN BODY\n\nCLOSING\n/);
});

test("what the engine brings compiles to a file on disk like any other primitive (SC-033, CORE Story 16 scenarios 2, 3)", async () => {
  const { files } = await built(oneGuide);

  const catalogue: readonly { id: string; file: string }[] = JSON.parse(files[".cw/out/catalogue.json"] ?? "");

  // Each file named from the repository's root, where the catalogue lands it.
  for (const { id, file } of catalogue) assert.ok(files[file], `${id} names ${file}, which was not written`);
  assert.match(files[".cw/out/skill/cw-author/index.md"] ?? "", /^---\nkind: skill\nid: cw-author\n/);
});

test("one listing is compiled, and no reduced copy of it", async () => {
  const { files } = await built(oneGuide);

  assert.ok(files[".cw/out/catalogue.json"]);
  assert.equal(files[".cw/out/catalog.min.json"], undefined);
});

test("every compiled file ends with a newline, as a text file does", async () => {
  const { files } = await built(oneGuide);

  for (const [path, contents] of Object.entries(files))
    assert.ok(contents.endsWith("\n"), `${path} does not end with a newline`);
});

test("the same charter compiles byte for byte the same however its files were read", async () => {
  const authored = {
    [new URL("skill/writing-tests/index.md", root).href]: primitive("skill", "writing-tests"),
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any"),
    [new URL("corpus/type-safety/index.md", root).href]: primitive("corpus", "type-safety"),
  };
  const reversed = Object.fromEntries(Object.entries(authored).reverse());

  assert.deepEqual((await built(reversed)).files, (await built(authored)).files);
});

test("a body reaches no listing: what carries a body is what an agent opens (FR-013, CORE Story 1 scenario 10)", async () => {
  const { files } = await built({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", "SECRET BODY TEXT"),
  });

  assert.ok(!(files[".cw/out/catalogue.json"] ?? "").includes("SECRET BODY TEXT"));
});

test("a charter with a broken file still compiles what the readable files hold", async () => {
  const { charter, files } = await built({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any"),
    [new URL("guide/broken/index.md", root).href]: "---\nkind: guide\n---\n\nNo id, no description.\n",
  });

  assert.equal(Object.keys(charter.allFaultsByFiles.faultsByFilePath).length, 1);
  assert.deepEqual(
    JSON.parse(files[".cw/out/catalogue.json"] ?? "").map((catalogueEntry: { id: string }) => catalogueEntry.id),
    ["charter-release", "charter-release-action", "cw-author", "cw-session-tokens-counter", "no-any"],
  );
});

test("a header YAML would read as something else is quoted in the compiled document, so it reads back as written", async () => {
  const run = '[ -z "$(git status --porcelain)" ] || exit 2';
  const { files } = await built({
    [new URL("sensor/on-stop/index.md", root).href]: [
      "---",
      "kind: sensor",
      "id: on-stop",
      "description: Refuse to stop with work unsaved.",
      "signal: Stop",
      `run: '${run}'`,
      "---",
      "",
    ].join("\n"),
  });

  const document = files[".cw/out/sensor/on-stop/index.md"] ?? "";
  const [, headers = ""] = document.split("---\n");

  assert.deepEqual(YamlLib.parseYamlFields(headers).run, run);
});

test("an mcp origin is served under the first segment of its id and a hash of its id, the same on every build (FR-145)", () => {
  assert.deepEqual(ContentHelper.shortenStringsOf(["notion", "moneyforward/tax", "moneyforward/billing-service"]), {
    "moneyforward/billing-service": "moneyforward_c3ae",
    "moneyforward/tax": "moneyforward_e2d3",
    notion: "notion_8d57",
  });
});

test("two mcp origins whose prefixes hash alike are told apart by a number, in the order they sort in (FR-145)", () => {
  // Both hash to `acme_3b85`; `place-1157` sorts before `place-5`.
  assert.deepEqual(ContentHelper.shortenStringsOf(["acme/place-5", "acme/place-1157"]), {
    "acme/place-1157": "acme_3b85",
    "acme/place-5": "acme_3b85_2",
  });
});

test("a charter compiles to a list of items, each of its own kind extending one base, known by its path inside the output and added in the order a build lays them (CORE Story 53 scenario 7, CORE-FR-220)", async () => {
  const held = new InMemoryFileReaders(oneGuide);
  const charter = await loadCharterRoot(held);

  const charterOutput = CharterOutputService.compileCharterRoot(charter, [CLAUDE]);

  assert.ok(
    charterOutput.charterOutputItems.every((charterOutputItem) => charterOutputItem instanceof CharterOutputItem),
  );
  assert.deepEqual(
    charterOutput.charterOutputItems.map((charterOutputItem) => [
      charterOutputItem.constructor.name,
      outputPath.getPath(charterOutputItem),
    ]),
    [
      ["Catalogue", "catalogue.json"],
      ["Catalogue", "catalogue.claude.json"],
      ["McpOrigins", "mcp-origins.json"],
      ["BuiltSensors", "sensors.json"],
      ["CharterMd", "CHARTER.md"],
      ...charterOutput.charterOutputItems
        .filter((charterOutputItem) => charterOutputItem instanceof CompiledPrimitive)
        .map((compiledPrimitive) => ["CompiledPrimitive", outputPath.getPath(compiledPrimitive)]),
    ],
  );
  assert.equal(outputPath.getPath(charterOutput.findCharterOutputItem(CharterMd)), outputPath.charterMdFileName);
});

test("each item of the output is known by its path inside it and holds its text and its assets, one for one agent alone names that agent in its path, and none names where the output lands (CORE Story 48 scenario 1, CORE-FR-220, CORE Story 55 scenario 16)", async () => {
  const charter = await loadCharterRoot(new InMemoryFileReaders(oneGuide));

  const charterOutputItems = CharterOutputService.compileCharterRoot(charter, [CLAUDE]).charterOutputItems;

  const itemPaths = charterOutputItems.map((charterOutputItem) => outputPath.getPath(charterOutputItem));
  assert.equal(new Set(itemPaths).size, itemPaths.length, "each path is one item's");
  for (const [itemIndex, charterOutputItem] of charterOutputItems.entries()) {
    const itemPath = itemPaths[itemIndex] ?? "";
    assert.ok(!itemPath.startsWith("/") && !itemPath.startsWith(".cw/"), itemPath);
    assert.ok(charterOutputItem.text.length > 0, itemPath);
    assert.ok(!charterOutputItem.text.includes("/repo") && !charterOutputItem.text.includes(".cw/out"), itemPath);
    const isForClaudeAlone = "agentProvider" in charterOutputItem && charterOutputItem.agentProvider !== undefined;
    assert.equal(itemPath.includes("claude"), isForClaudeAlone, itemPath);
  }
  const counterScript = charterOutputItems.find(
    (charterOutputItem) => outputPath.getPath(charterOutputItem) === "script/cw-session-tokens-counter/index.md",
  );
  assert.ok(counterScript instanceof CompiledPrimitive);
  assert.equal(counterScript.assets.length, 1, "the script holds the file it runs");
});

test("an agent's projection finds each item it needs by what it is, wherever the item sits in the output (CORE Story 53 scenario 7, CORE Story 48 scenario 1, CORE-FR-220, CORE Story 55 scenario 16)", async () => {
  const held = new InMemoryFileReaders({
    ...oneGuide,
    [new URL("mcp/billing/index.md", root).href]: [
      "---",
      "kind: mcp",
      "id: billing",
      "description: The billing service.",
      "endpoint: https://mcp.example.com/",
      "auth: [oauth]",
      "tools: [search]",
      "---",
      "",
      "Billing.",
      "",
    ].join("\n"),
  });
  const charter = await loadCharterRoot(held);
  const charterOutput = CharterOutputService.compileCharterRoot(charter, [CLAUDE]);
  const reversedOutput = new CharterOutput();
  for (const charterOutputItem of [...charterOutput.charterOutputItems].reverse())
    reversedOutput.add(charterOutputItem);
  const claudeProjection = agentProjectionByProviderOf(held).claude!;
  const writtenPlanOf = async (laidOutput: CharterOutput) =>
    (await claudeProjection.createAgentProjectionPlan(charter, laidOutput)).writePlans
      .map(({ path, contents }) => [path, contents] as const)
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));

  const [inOrderPlan, reversedPlan] = [await writtenPlanOf(charterOutput), await writtenPlanOf(reversedOutput)];

  assert.deepEqual(reversedPlan, inOrderPlan);
  // What it found: its own catalogue, the mcp origins, the sensors, each compiled primitive.
  const plannedPaths = inOrderPlan.map(([path]) => path);
  for (const plannedPath of ["CLAUDE.md", ".mcp.json", ".claude/settings.json", ".claude/rules/no-any.md"])
    assert.ok(plannedPaths.includes(plannedPath), plannedPath);
});

test("where the charter document explains ids, it names the layer the engine brings beside the repository's own (CORE Story 56 scenario 1)", async () => {
  const { charter, files } = await built(oneGuide);
  const charterText = files[".cw/out/CHARTER.md"] ?? "";
  const idSectionText = charterText.slice(charterText.indexOf("## One id, one primitive"));

  const layerNames = Object.values(charter.primitiveLayerByUri).map((primitiveLayer) => primitiveLayer.name);
  assert.ok(layerNames.includes("repo") && layerNames.includes("builtin"), `${layerNames} read`);
  assert.match(idSectionText, /^## One id, one primitive\n/);
  assert.match(
    idSectionText,
    /whether this repository authored it, installed it from a charter source, or the engine brought it/,
  );
});

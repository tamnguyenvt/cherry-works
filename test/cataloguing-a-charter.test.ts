import assert from "node:assert/strict";
import { test } from "node:test";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { CwSessionTokensCounterScript } from "../src/module/charter/domain/builtin/cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "../src/module/charter/domain/builtin/cw-session-tokens-sensor.js";
import { Catalogue } from "../src/module/charter/domain/models/charter-output/catalogue.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import { AgentProvider } from "../src/module/shared/domain/models/agent/agent-provider.value-object.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { loadCharterRoot } from "./use-cases-of.js";

const root = FolderAddress.parseFolderUrl("file:///repo/.cw/charter/primitive/");
const vendorRoot = FolderAddress.parseFolderUrl("file:///repo/.cw/charter/vendor/");

/** One authored file, holding what any of the kinds these tests use asks
 *  for. The body is what a real guide's body is like: the bulk of the file, and
 *  the thing neither catalogue carries. */
const primitive = (kind: string, id: string, { body = paragraphs(id), headers = [] as readonly string[] } = {}) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: What ${id} is for, in one line.`,
    'globs: ["src/**/*.ts"]',
    'triggers: ["a request"]',
    ...headers,
    "---",
    "",
    body,
    "",
  ].join("\n");

const paragraphs = (id: string) =>
  Array.from({ length: 12 }, (_, at) => `Paragraph ${at} of ${id}: ${"the reasoning at length. ".repeat(8)}`).join(
    "\n\n",
  );

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
    file: "$CW_OUT/script/cw-session-tokens-counter/index.md",
  },
  {
    id: "cw-session-tokens-counter-on-stop",
    kind: "sensor",
    description: new CwSessionTokensSensor().headers.description,
    file: "$CW_OUT/sensor/cw-session-tokens-counter-on-stop/index.md",
  },
];

const load = (files: InMemoryFileReaders) => loadCharterRoot(files);

/** The listing this charter compiles to. Read off what compiling produces, since
 *  a listing is one of the things a charter is compiled into and there is no way
 *  to ask for it on its own (SC-004); each entry's file under `$CW_OUT/`
 *  (CORE-FR-221). */
const catalogueOf = async (files: InMemoryFileReaders): Promise<Catalogue> => {
  return CharterOutputService.compileCharterRoot(await load(files), []).charterOutputItems.find(
    (charterOutputItem): charterOutputItem is Catalogue => charterOutputItem instanceof Catalogue,
  )!;
};

/** The bytes a listing lands on disk as, which is what an agent pays to read
 *  (SC-005). */
const catalogueTextOf = (entries: readonly unknown[]) => JSON.stringify(entries);

test("the catalogue records what a primitive is called, what it is for, the files and providers it applies to and where its body is (CORE Story 27 scenario 5)", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({
      [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", {
        headers: ["tags: [types]", "rationale: type-safety", "mixins: [house-style]"],
      }),
    }),
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(catalogue.entries)),
    [
      { ...builtinEntry, file: "$CW_OUT/skill/cw-author/index.md" },
      ...sessionCounterEntries.filter((catalogueEntry) => catalogueEntry.id !== CwSessionTokensSensor.id),
      {
        id: "no-any",
        kind: "guide",
        description: "What no-any is for, in one line.",
        file: "$CW_OUT/guide/no-any/index.md",
        globs: ["src/**/*.ts"],
      },
    ].map((catalogueEntry) => ({ ...catalogueEntry, agentProviders: "all" })),
  );
});

test("a header the author left out is left out, not recorded as nothing", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({ [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any") }),
  );

  const guideCatalogueEntry = catalogue.entries.find((catalogueEntry) => catalogueEntry.id === "no-any");

  assert.deepEqual(Object.keys(guideCatalogueEntry!).sort(), [
    "agentProviders",
    "description",
    "file",
    "globs",
    "id",
    "kind",
  ]);
});

test("the output keeps shared entries in catalogue and restricted entries only in provider catalogues", async () => {
  const charter = await load(new InMemoryFileReaders());
  const charterOutput = CharterOutputService.compileCharterRoot(charter, [
    new AgentProvider("claude"),
    new AgentProvider("codex"),
  ]);
  const sensorId = CwSessionTokensSensor.id;
  const catalogues = charterOutput.charterOutputItems.filter(
    (charterOutputItem): charterOutputItem is Catalogue => charterOutputItem instanceof Catalogue,
  );
  const sharedCatalogue = catalogues.find((catalogue) => catalogue.agentProvider === undefined)!;
  const catalogueOfAgent = (agentName: string) =>
    catalogues.find((catalogue) => catalogue.agentProvider?.name === agentName);

  assert.ok(sharedCatalogue.entries.every((catalogueEntry) => catalogueEntry.agentProviders === "all"));
  assert.ok(!sharedCatalogue.entries.some((catalogueEntry) => catalogueEntry.id === sensorId));
  assert.deepEqual(
    catalogueOfAgent("claude")?.entries.map((catalogueEntry) => catalogueEntry.id),
    [sensorId],
  );
  assert.deepEqual(catalogueOfAgent("codex")?.entries, []);
  assert.ok(!JSON.parse(sharedCatalogue.text).some((catalogueEntry: { id: string }) => catalogueEntry.id === sensorId));
});

test("a vendored primitive is catalogued at its compiled file, as every layer's is (FR-140)", async () => {
  const vendored = new URL("team/rules/root/primitive/guide/no-any/index.md", vendorRoot);
  const catalogue = await catalogueOf(new InMemoryFileReaders({ [vendored.href]: primitive("guide", "no-any") }));

  const noAnyCatalogueEntry = catalogue.entries.find((catalogueEntry) => catalogueEntry.kind === "guide");

  assert.equal(noAnyCatalogueEntry!.id, "no-any");
  assert.equal(noAnyCatalogueEntry!.file, "$CW_OUT/guide/no-any/index.md");
});

test("the same charter catalogues in the same order however its files were read", async () => {
  const files = new InMemoryFileReaders({
    [new URL("skill/writing-tests/index.md", root).href]: primitive("skill", "writing-tests"),
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any"),
    [new URL("corpus/type-safety/index.md", root).href]: primitive("corpus", "type-safety"),
  });

  const ids = (await catalogueOf(files)).entries.map((catalogueEntry) => catalogueEntry.id);

  assert.deepEqual(ids, ["cw-author", "cw-session-tokens-counter", "no-any", "type-safety", "writing-tests"]);
});

test("the catalogue carries no body", async () => {
  const files = new InMemoryFileReaders({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", { body: "SECRET BODY TEXT" }),
  });

  const catalogue = await catalogueOf(files);

  assert.ok(!catalogueTextOf(catalogue.entries).includes("SECRET BODY TEXT"));
});

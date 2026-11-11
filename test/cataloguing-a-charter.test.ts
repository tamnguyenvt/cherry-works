import assert from "node:assert/strict";
import { test } from "node:test";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { CwSessionCostSkill } from "../src/module/charter/domain/builtin/cw-session-cost-skill.js";
import { CwSessionTokensCounterScript } from "../src/module/charter/domain/builtin/cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "../src/module/charter/domain/builtin/cw-session-tokens-sensor.js";
import { AgentProvider } from "../src/module/charter/domain/models/agent/agent-provider.js";
import type { Catalogue } from "../src/module/charter/domain/models/projection/catalogue.js";
import { CompileService } from "../src/module/charter/domain/services/compile.service.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { loadCharterRoot } from "./use-cases-of.js";

const root = FolderAddress.urlOf("file:///repo/.cw/charter/primitive/");
const vendorRoot = FolderAddress.urlOf("file:///repo/.cw/charter/vendor/");

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

/** The skill that prices a session, and the script and the sensor the
 *  engine brings to count its tokens, catalogued as every charter's are
 *  (EVAL-FR-008, EVAL-FR-014). */
const sessionCounterEntries = [
  {
    id: "cw-session-cost",
    kind: "skill",
    description: new CwSessionCostSkill().headers.description,
    file: "$CW_OUT/skill/cw-session-cost/index.md",
  },
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
  const { catalogue } = CompileService.compileCharterRoot(await load(files), []);
  return catalogue;
};

/** The bytes a listing lands on disk as, which is what an agent pays to read
 *  (SC-005). */
const written = (entries: readonly unknown[]) => JSON.stringify(entries);

test("the catalogue records what a primitive is called, what it is for, the files and providers it applies to and where its body is", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({
      [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", {
        headers: ["tags: [types]", "rationale: type-safety", "mixins: [house-style]"],
      }),
    }),
  );

  assert.deepEqual(
    catalogue.entries.map((catalogueEntry) => ({ ...catalogueEntry })),
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

  const entry = catalogue.entries.find((one) => one.id === "no-any");

  assert.deepEqual(Object.keys(entry!).sort(), ["agentProviders", "description", "file", "globs", "id", "kind"]);
});

test("the output keeps shared entries in catalogue and restricted entries only in provider catalogues", async () => {
  const charter = await load(new InMemoryFileReaders());
  const charterOutput = CompileService.compileCharterRoot(charter, [
    new AgentProvider("claude"),
    new AgentProvider("codex"),
  ]);
  const sensorId = CwSessionTokensSensor.id;

  assert.ok(charterOutput.catalogue.entries.every((catalogueEntry) => catalogueEntry.agentProviders === "all"));
  assert.ok(!charterOutput.catalogue.entries.some((catalogueEntry) => catalogueEntry.id === sensorId));
  assert.deepEqual(
    charterOutput.agentBasedCatalogues.claude?.entries.map((catalogueEntry) => catalogueEntry.id),
    [sensorId],
  );
  assert.deepEqual(charterOutput.agentBasedCatalogues.codex?.entries, []);
  assert.ok(
    !JSON.parse(charterOutput.catalogue.text).some((catalogueEntry: { id: string }) => catalogueEntry.id === sensorId),
  );
});

test("a vendored primitive is catalogued at its compiled file, as every layer's is (FR-140)", async () => {
  const vendored = new URL("team/rules/root/primitive/guide/no-any/index.md", vendorRoot);
  const catalogue = await catalogueOf(new InMemoryFileReaders({ [vendored.href]: primitive("guide", "no-any") }));

  const entry = catalogue.entries.find((one) => one.kind === "guide");

  assert.equal(entry!.id, "no-any");
  assert.equal(entry!.file, "$CW_OUT/guide/no-any/index.md");
});

test("the same charter catalogues in the same order however its files were read", async () => {
  const files = new InMemoryFileReaders({
    [new URL("skill/writing-tests/index.md", root).href]: primitive("skill", "writing-tests"),
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any"),
    [new URL("corpus/type-safety/index.md", root).href]: primitive("corpus", "type-safety"),
  });

  const ids = (await catalogueOf(files)).entries.map((one) => one.id);

  assert.deepEqual(ids, [
    "cw-author",
    "cw-session-cost",
    "cw-session-tokens-counter",
    "no-any",
    "type-safety",
    "writing-tests",
  ]);
});

test("the catalogue carries no body", async () => {
  const files = new InMemoryFileReaders({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", { body: "SECRET BODY TEXT" }),
  });

  const catalogue = await catalogueOf(files);

  assert.ok(!written(catalogue.entries).includes("SECRET BODY TEXT"));
});

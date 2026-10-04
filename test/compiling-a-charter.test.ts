import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { putDownBy } from "./put-down-by.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { compile } from "../src/hexagon/domain/services/compile/compileService.js";
import { shortenStringsOf } from "../src/hexagon/domain/models/helper.js";
import type { AgentProvider } from "../src/hexagon/domain/models/AgentProvider.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { CwAuthorSkill } from "../src/hexagon/domain/models/charter/builtin/CwAuthorSkill.js";
import { SessionTokensCounterScript } from "../src/hexagon/domain/models/charter/builtin/SessionTokensCounterScript.js";
import { SessionTokensSensor } from "../src/hexagon/domain/models/charter/builtin/SessionTokensSensor.js";
import { isStamped } from "../src/hexagon/domain/models/output/StampedDocument.js";

const CLAUDE: AgentProvider = "claude";
const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");

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
    id: "session-tokens-counter",
    kind: "script",
    description: new SessionTokensCounterScript().headers.description,
    file: ".cw/out/script/session-tokens-counter/index.md",
  },
  {
    id: "session-tokens-counter-on-stop",
    kind: "sensor",
    description: new SessionTokensSensor().headers.description,
    file: ".cw/out/sensor/session-tokens-counter-on-stop/index.md",
  },
];

/** What the engine's session counter compiles to under the workspace: the
 *  script's document and its one asset, then the sensor's document. */
const sessionCounterPaths = [
  ".cw/out/script/session-tokens-counter/index.md",
  ".cw/out/script/session-tokens-counter/count.mjs",
  ".cw/out/sensor/session-tokens-counter-on-stop/index.md",
];

const oneGuide = { [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any") };

/** What one charter compiles to, put down: the paths it wrote, and what each of
 *  them holds. Compiling and projecting are asked together because neither is
 *  worth anything alone — one says what the files hold, the other where they go
 *  (SC-004). */
const built = async (authored: Readonly<Record<string, string>>, agents: readonly AgentProvider[] = [CLAUDE]) => {
  const held = new InMemoryFileReaders(authored);
  const charter = await loadCharterRoot(repo, held, new YamlParser());
  const written = await putDownBy(repo, compile(charter, agents), held);

  return {
    charter,
    written,
    files: Object.fromEntries(
      await Promise.all(written.map(async (path) => [path, await held.read(new URL(path, repo))] as const)),
    ) as Readonly<Record<string, string>>,
  };
};

test("compiling produces the listing, the charter file, and what the installed agent reads", async () => {
  const { written } = await built(oneGuide);

  assert.deepEqual(written, [
    ".cw/out/catalog.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/CHARTER.md",
    // Every primitive as it compiled, in the catalogue's order, since the
    // catalogue is what names each file (FR-139, FR-140).
    ".cw/out/skill/cw-author/index.md",
    ".cw/out/guide/no-any/index.md",
    ...sessionCounterPaths,
    // The file that agent reads unasked, which is what sends it to the
    // orientation above.
    "CLAUDE.md",
    // The hook the engine's own sensor runs when the agent stops.
    ".claude/settings.json",
    // The one server that reaches every place the charter declares.
    ".mcp.json",
    // The skill the engine brings, which every charter holds and reads first.
    ".claude/skills/cw-author/SKILL.md",
    // The one guide as the installed agent's own kinds have it.
    ".claude/rules/no-any.md",
  ]);
});

test("every compiled file is written at a path from the repository", async () => {
  const { written } = await built(oneGuide);

  // Relative to the repository holding the charter, so the same charter compiles
  // the same on every machine that checks it out.
  for (const path of written) assert.ok(!path.startsWith("/"), `${path} is not from the repository`);
});

test("no listing and no projection can be produced without the others (SC-004)", async () => {
  // Not a test of what compiling returns but of what it offers: one call, one
  // list, and no argument that narrows it to a single file. The second argument
  // says which agents are installed, never which file is wanted.
  assert.equal(compile.length, 2);
  assert.equal((await built(oneGuide)).written.length, 13);
});

test("a repository with no agent installed still compiles the whole neutral half (FR-019)", async () => {
  const { written } = await built(oneGuide, []);

  assert.deepEqual(written, [
    ".cw/out/catalog.json",
    ".cw/out/mcp-origins.json",
    ".cw/out/CHARTER.md",
    ".cw/out/skill/cw-author/index.md",
    ".cw/out/guide/no-any/index.md",
    ...sessionCounterPaths,
  ]);
});

test("the full catalogue is written as the catalogue says it, one entry per line", async () => {
  const { files } = await built(oneGuide);

  const contents = files[".cw/out/catalog.json"] ?? "";
  assert.deepEqual(JSON.parse(contents), [
    { ...builtinEntry, file: ".cw/out/skill/cw-author/index.md" },
    {
      id: "no-any",
      kind: "guide",
      description: "What no-any is for, in one line.",
      file: ".cw/out/guide/no-any/index.md",
      globs: ["src/**/*.ts"],
    },
    ...sessionCounterEntries,
  ]);
  assert.ok(contents.includes("\n  {\n"));
});

test("every primitive compiles to one document holding its headers, then its mixins' bodies, then its own (FR-139)", async () => {
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
  assert.ok(isStamped(document));
});

test("what the engine brings compiles to a file on disk like any other primitive (SC-033)", async () => {
  const { files } = await built(oneGuide);

  const catalogue: readonly { id: string; file: string }[] = JSON.parse(files[".cw/out/catalog.json"] ?? "");

  for (const { id, file } of catalogue) assert.ok(files[file], `${id} names ${file}, which was not written`);
  assert.match(files[".cw/out/skill/cw-author/index.md"] ?? "", /^---\nkind: skill\nid: cw-author\n/);
});

test("one listing is compiled, and no reduced copy of it", async () => {
  const { files } = await built(oneGuide);

  assert.ok(files[".cw/out/catalog.json"]);
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

test("a body reaches no listing: what carries a body is what an agent opens (FR-013)", async () => {
  const { files } = await built({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", "SECRET BODY TEXT"),
  });

  assert.ok(!(files[".cw/out/catalog.json"] ?? "").includes("SECRET BODY TEXT"));
});

test("a charter with a broken file still compiles what the readable files hold", async () => {
  const { charter, files } = await built({
    [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any"),
    [new URL("guide/broken/index.md", root).href]: "---\nkind: guide\n---\n\nNo id, no description.\n",
  });

  assert.equal(Object.keys(charter.allFaultsByFiles.files).length, 1);
  assert.deepEqual(
    JSON.parse(files[".cw/out/catalog.json"] ?? "").map((one: { id: string }) => one.id),
    ["cw-author", "no-any", "session-tokens-counter", "session-tokens-counter-on-stop"],
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

  assert.deepEqual(new YamlParser().parse(headers).run, run);
});

test("a place is served under the first segment of its id and a hash of its id, the same on every build (FR-145)", () => {
  assert.deepEqual(
    shortenStringsOf(["notion", "moneyforward/tax", "moneyforward/billing-service"]),
    {
      "moneyforward/billing-service": "moneyforward_c3ae",
      "moneyforward/tax": "moneyforward_e2d3",
      "notion": "notion_8d57",
    },
  );
});

test("two places whose prefixes hash alike are told apart by a number, in the order they sort in (FR-145)", () => {
  // Both hash to `acme_3b85`; `place-1157` sorts before `place-5`.
  assert.deepEqual(
    shortenStringsOf(["acme/place-5", "acme/place-1157"]),
    {
      "acme/place-1157": "acme_3b85",
      "acme/place-5": "acme_3b85_2",
    },
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharters } from "../src/hexagon/service/charterRepo.js";
import { putDownBy } from "./put-down-by.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { compile } from "../src/hexagon/domain/services/compileService.js";
import type { AgentProvider } from "../src/hexagon/domain/models/AgentProvider.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { CwAuthorSkill } from "../src/hexagon/domain/models/charter/builtin/CwAuthorSkill.js";

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

/** The skill the engine brings, as the compact catalogue carries it: every
 *  charter holds it, so every catalogue lists it (FR-017). */
const builtinEntry = {
  identity: "skill:cw-author",
  kind: "skill",
  id: "cw-author",
  description: new CwAuthorSkill().headers.description,
};

const oneGuide = { [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any") };

/** What one charter compiles to, put down: the paths it wrote, and what each of
 *  them holds. Compiling and projecting are asked together because neither is
 *  worth anything alone — one says what the files hold, the other where they go
 *  (SC-004). */
const built = async (authored: Readonly<Record<string, string>>, agents: readonly AgentProvider[] = [CLAUDE]) => {
  const held = new InMemoryFileReaders(authored);
  const charter = await loadCharters(repo, held, new YamlParser());
  const written = await putDownBy(repo, compile(charter, agents), agents, held);

  return {
    charter,
    written,
    files: Object.fromEntries(
      await Promise.all(written.map(async (path) => [path, await held.read(new URL(path, repo))] as const)),
    ) as Readonly<Record<string, string>>,
  };
};

test("compiling produces both listings, the charter file, and what the installed agent reads", async () => {
  const { written } = await built(oneGuide);

  assert.deepEqual(written, [
    ".cw/out/catalog.json",
    ".cw/out/catalog.min.json",
    ".cw/out/CHARTER.md",
    // The file that agent reads unasked, which is what sends it to the
    // orientation above.
    "CLAUDE.md",
    // The skill the engine brings, which every charter holds and reads first.
    ".claude/skills/skill-cw-author/SKILL.md",
    // The one guide as the installed agent's own kinds have it.
    ".claude/rules/guide-no-any.md",
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
  assert.equal((await built(oneGuide)).written.length, 6);
});

test("a repository with no agent installed still compiles the whole neutral half (FR-019)", async () => {
  const { written } = await built(oneGuide, []);

  assert.deepEqual(written, [".cw/out/catalog.json", ".cw/out/catalog.min.json", ".cw/out/CHARTER.md"]);
});

test("the full catalogue is written as the catalogue says it, one entry per line", async () => {
  const { files } = await built(oneGuide);

  const contents = files[".cw/out/catalog.json"] ?? "";
  assert.deepEqual(JSON.parse(contents), [
    {
      identity: "guide:no-any",
      kind: "guide",
      id: "no-any",
      description: "What no-any is for, in one line.",
      file: ".cw/charter/guide/no-any.md",
      globs: ["src/**/*.ts"],
    },
    { ...builtinEntry, file: "(built into cw)/skill/cw-author.md" },
  ]);
  assert.ok(contents.includes("\n  {\n"));
});

test("the compact catalogue spends no bytes on whitespace", async () => {
  const { files } = await built(oneGuide);

  const contents = files[".cw/out/catalog.min.json"] ?? "";
  assert.deepEqual(JSON.parse(contents), [
    { identity: "guide:no-any", kind: "guide", id: "no-any", description: "What no-any is for, in one line." },
    builtinEntry,
  ]);
  assert.equal(contents, `${JSON.stringify(JSON.parse(contents))}\n`);
});

test("every compiled file ends with a newline, as a text file does", async () => {
  const { files } = await built(oneGuide);

  for (const [path, contents] of Object.entries(files))
    assert.ok(contents.endsWith("\n"), `${path} does not end with a newline`);
});

test("the same charter compiles byte for byte the same however its files were read", async () => {
  const authored = {
    [new URL("skill/writing-tests.md", root).href]: primitive("skill", "writing-tests"),
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any"),
    [new URL("corpus/type-safety.md", root).href]: primitive("corpus", "type-safety"),
  };
  const reversed = Object.fromEntries(Object.entries(authored).reverse());

  assert.deepEqual((await built(reversed)).files, (await built(authored)).files);
});

test("a body reaches no listing: what carries a body is what an agent opens (FR-013)", async () => {
  const { files } = await built({
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", "SECRET BODY TEXT"),
  });

  for (const path of [".cw/out/catalog.json", ".cw/out/catalog.min.json"])
    assert.ok(!(files[path] ?? "").includes("SECRET BODY TEXT"), `${path} carries the body`);
});

test("a charter with a broken file still compiles what the readable files hold", async () => {
  const { charter, files } = await built({
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any"),
    [new URL("guide/broken.md", root).href]: "---\nkind: guide\n---\n\nNo id, no description.\n",
  });

  assert.equal(Object.keys(charter.allFaultsByFiles.files).length, 1);
  assert.deepEqual(
    JSON.parse(files[".cw/out/catalog.min.json"] ?? "").map((one: { identity: string }) => one.identity),
    ["guide:no-any", "skill:cw-author"],
  );
});

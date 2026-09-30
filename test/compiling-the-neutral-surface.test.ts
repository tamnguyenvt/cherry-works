import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { putDownBy } from "./put-down-by.js";
import { compile } from "../src/hexagon/domain/services/compile/compileService.js";
import type { AgentProvider } from "../src/hexagon/domain/models/AgentProvider.js";
import { PRIMITIVE_CLASSES } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");
const CLAUDE: AgentProvider = "claude";
const CHARTER_MD = ".cw/out/CHARTER.md";

const primitive = (kind: string, id: string, body: string, headers: readonly string[] = []) =>
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

const at = (path: string) => new URL(path, root).href;

const load = (files: Readonly<Record<string, string>>, held = new InMemoryFileReaders(files)) =>
  loadCharterRoot(repo, held, new YamlParser());

/** What one of the files every reader shares holds, once this charter is put
 *  down. */
const written = async (files: Readonly<Record<string, string>>, path: string) => {
  const held = new InMemoryFileReaders(files);
  const charter = await load(files, held);

  const put = await putDownBy(repo, compile(charter, [CLAUDE]), [CLAUDE], held);
  assert.ok(put.includes(path), `${path} is not among the files this charter was put down as`);

  return held.read(new URL(path, repo));
};

const oneGuide = { [at("guide/no-any.md")]: primitive("guide", "no-any", "Never write `any`.") };

test("the charter file is among what a charter is put down as, whatever it holds", async () => {
  assert.ok((await written(oneGuide, CHARTER_MD)).startsWith("# Charter\n"));
});

test("a charter with no primitive at all still compiles it (FR-019)", async () => {
  assert.ok((await written({}, CHARTER_MD)).startsWith("# Charter\n"));
});

test("the charter file sends an agent to the compact listing first (FR-012, SC-005)", async () => {
  const contents = await written(oneGuide, CHARTER_MD);

  // Named beside it, since the two listings land in the same folder it does.
  assert.ok(contents.includes("(./catalog.min.json)"));
  assert.ok(contents.includes("(./catalog.json)"));
  assert.ok(contents.indexOf("catalog.min.json") < contents.indexOf("(./catalog.json)"));
});

test("the charter file says, for every kind, when it applies (FR-001)", async () => {
  const contents = await written(oneGuide, CHARTER_MD);

  for (const one of PRIMITIVE_CLASSES) {
    assert.ok(contents.includes(`- **${one.kind}** — ${one.activatesWhen}.`), `${one.kind} is not said`);
  }
});

test("the charter file carries no body: a body is opened when it activates (FR-013)", async () => {
  const files = {
    [at("guide/no-any.md")]: primitive("guide", "no-any", "SECRET BODY TEXT"),
    [at("mixin/house-style.md")]: primitive("mixin", "house-style", "SECRET MIXIN TEXT"),
    [at("corpus/type-safety.md")]: primitive("corpus", "type-safety", "SECRET CORPUS TEXT"),
  };

  const contents = await written(files, CHARTER_MD);
  for (const secret of ["SECRET BODY TEXT", "SECRET MIXIN TEXT", "SECRET CORPUS TEXT"]) {
    assert.ok(!contents.includes(secret), `the charter file carries ${secret}`);
  }
});




test("the charter file does not grow with the charter: what grows is the listing (SC-005)", async () => {
  const forty = Object.fromEntries(
    Array.from({ length: 40 }, (_, at) => [
      new URL(`guide/rule-${at}.md`, root).href,
      primitive("guide", `rule-${at}`, "A paragraph of rule."),
    ]),
  );

  assert.equal(await written(forty, CHARTER_MD), await written(oneGuide, CHARTER_MD));
});

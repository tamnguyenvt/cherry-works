import assert from "node:assert/strict";
import { test } from "node:test";
import { AgentProvider } from "../src/module/charter/domain/models/agent/agent-provider.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { CompileService } from "../src/module/charter/domain/services/compile.service.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";

import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { putDownBy } from "./put-down-by.js";
import { loadCharterRoot } from "./use-cases-of.js";

const repo = new URL("file:///repo/");
const root = FolderAddress.urlOf("file:///repo/.cw/charter/primitive/");
const CLAUDE = new AgentProvider("claude");
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

const load = (files: Readonly<Record<string, string>>, held = new InMemoryFileReaders(files)) => loadCharterRoot(held);

/** What one of the files every reader shares holds, once this charter is put
 *  down. */
const written = async (files: Readonly<Record<string, string>>, path: string) => {
  const held = new InMemoryFileReaders(files);
  const charter = await load(files, held);

  const put = await putDownBy(charter, CompileService.compileCharterRoot(charter, [CLAUDE]), held);
  assert.ok(put.includes(path), `${path} is not among the files this charter was put down as`);

  return held.read(new URL(path, repo));
};

const oneGuide = { [at("guide/no-any/index.md")]: primitive("guide", "no-any", "Never write `any`.") };

test("the charter file is among what a charter is put down as, whatever it holds", async () => {
  assert.ok((await written(oneGuide, CHARTER_MD)).startsWith("# Charter\n"));
});

test("a charter with no primitive at all still compiles it (FR-019)", async () => {
  assert.ok((await written({}, CHARTER_MD)).startsWith("# Charter\n"));
});

test("the charter file sends an agent to the catalogue first, and to no reduced copy of it", async () => {
  const contents = await written(oneGuide, CHARTER_MD);

  // Named beside it, since the listing lands in the same folder it does.
  assert.ok(contents.includes("catalogue.<provider>.json"));
  assert.ok(!contents.includes("catalog.min.json"));
});

test("the charter file says, for every kind, when it applies (FR-001)", async () => {
  const contents = await written(oneGuide, CHARTER_MD);

  // A place a kind's line names is written from the charter file's own folder, where it lands.
  for (const one of Primitives.classes) {
    assert.ok(
      contents.includes(`- **${one.kind}** — ${one.activatesWhen.replaceAll("$CW_OUT/", "./")}.`),
      `${one.kind} is not said`,
    );
  }
});

test("the charter file carries no body: a body is opened when it activates (FR-013)", async () => {
  const files = {
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", "SECRET BODY TEXT"),
    [at("mixin/house-style/index.md")]: primitive("mixin", "house-style", "SECRET MIXIN TEXT"),
    [at("corpus/type-safety/index.md")]: primitive("corpus", "type-safety", "SECRET CORPUS TEXT"),
  };

  const contents = await written(files, CHARTER_MD);
  for (const secret of ["SECRET BODY TEXT", "SECRET MIXIN TEXT", "SECRET CORPUS TEXT"]) {
    assert.ok(!contents.includes(secret), `the charter file carries ${secret}`);
  }
});

test("the charter file does not grow with the charter: what grows is the listing (SC-005)", async () => {
  const forty = Object.fromEntries(
    Array.from({ length: 40 }, (_, at) => [
      new URL(`guide/rule-${at}/index.md`, root).href,
      primitive("guide", `rule-${at}`, "A paragraph of rule."),
    ]),
  );

  assert.equal(await written(forty, CHARTER_MD), await written(oneGuide, CHARTER_MD));
});

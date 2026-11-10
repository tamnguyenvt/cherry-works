import { test } from "node:test";
import assert from "node:assert/strict";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import { CharterRoot } from "../src/module/charter/domain/models/charter/charter-root.js";
import { type LayerName, PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.js";

import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { loadCharterRoot } from "./use-cases-of.js";
import { CharterRootFactory } from "../src/module/charter/domain/models/charter/charter-root.factory.js";
import { RawPrimitive } from "../src/module/charter/domain/models/primitive/raw-primitive.js";

const repo = new URL("file:///repo/");
const root = FolderAddress.urlOf("file:///repo/.cw/charter/primitive/");
const vendorRoot = FolderAddress.urlOf("file:///repo/.cw/charter/vendor/");
const guide = new URL("guide/no-any/index.md", root);
const corpus = new URL("corpus/type-safety/index.md", root);

/** One authored file, holding whatever the kind of the directory it lands in
 *  requires: these tests are about layers, not about fields. */
const primitive = (kind: string, id: string, body = "Body.") =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: About ${id}.`,
    'globs: ["src/**/*.ts"]',
    'triggers: ["a request"]',
    "---",
    "",
    body,
    "",
  ].join("\n");

const charterHolding = () =>
  new InMemoryFileReaders({ [guide.href]: primitive("guide", "no-any"), [corpus.href]: primitive("corpus", "type-safety") });


const load = (files: InMemoryFileReaders) => loadCharterRoot(files);

/** What one layer of a charter declares, by id. */
const ids = (layerName: LayerName, charter: CharterRoot) =>
  charter.primitives
    .filter((one) => one.layerName === layerName)
    .map((one) => one.headers.id)
    .sort();

/** What reading the charter asks of the files before it reads them: whether
 *  the repository is laid out the old way (CORE-FR-226). */
const layoutCheckCalls = ["folders under file:///repo/.cw/", "folders under file:///repo/.cw/charter/"];

test("every file the root lists is read as a primitive", async () => {
  const charter = await load(charterHolding());
  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "type-safety"]);
});

test("the charter is read once, and its vendors once more, however many are installed", async () => {
  const files = charterHolding();
  files.write(new URL("team/rules/root/primitive/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));

  await load(files);

  // One read of what this repository authored and one of what its vendors
  // installed, whichever sources or owners of sources they are (FR-050): the
  // engine reads which is which off the files it is handed. The settings the
  // repository configured itself with are read from their own file, not from
  // the charter (FR-037).
  assert.deepEqual(files.calls, [...layoutCheckCalls, `bytes under ${root.href}`, `bytes under ${vendorRoot.href}`]);
});

test("a file outside a kind's folder is no one's primitive (FR-002)", async () => {
  const files = charterHolding();
  files.write(new URL("catalog.json", root), "{}");
  files.write(new URL("README.md", root), "How this repository authors its charter.\n");
  files.write(new URL("team/rules/root/primitive/charter.lock.json", vendorRoot), "{}");

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "type-safety"]);
  assert.deepEqual(charter.faultsByFiles.files, {});
});

test("a load reads what is there now, not what was there before", async () => {
  const files = charterHolding();
  await load(files);

  files.write(guide, primitive("guide", "no-any", "A rewritten body."));
  files.remove(corpus);
  files.write(new URL("skill/naming/index.md", root), primitive("skill", "naming"));
  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["naming", "no-any"]);
  assert.equal(
    charter.primitives.find((one) => one.headers.id === "no-any")?.body,
    "A rewritten body.",
  );
});

test("what a vendor published is read as a layer of its own", async () => {
  const files = charterHolding();
  const vendor = FolderAddress.urlOf(new URL("team/rules/root/primitive/", vendorRoot));
  files.write(new URL("guide/no-any/index.md", vendor), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "type-safety"]);
  assert.deepEqual([...new Set(charter.primitives.map((one) => one.layerName))].sort(), [PrimitiveLayer.BUILTIN.name, PrimitiveLayer.REPO.name, PrimitiveLayer.vendorName]);
  assert.deepEqual(ids(PrimitiveLayer.vendorName, charter), ["no-any"]);
});

test("each vendor is its own layer, and a repository with none has none", async () => {
  const files = charterHolding();
  files.write(new URL("team/rules/root/primitive/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));
  files.write(new URL("design/skills/root/primitive/skill/naming/index.md", vendorRoot), primitive("skill", "naming"));

  assert.deepEqual(
    [...new Set((await load(files)).primitives.map((one) => one.layerName))].sort(),
    [PrimitiveLayer.BUILTIN.name, PrimitiveLayer.REPO.name, PrimitiveLayer.vendorName],
  );
  assert.deepEqual(
    [...new Set((await load(charterHolding())).primitives.map((one) => one.layerName))],
    [PrimitiveLayer.BUILTIN.name, PrimitiveLayer.REPO.name],
  );
});

test("what the engine brings is no folder: it adds no read, and is read without a fault (FR-016, FR-022)", async () => {
  const files = charterHolding();

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.BUILTIN.name, charter), ["cw-author", "cw-session-cost", "cw-session-tokens-counter", "cw-session-tokens-counter-on-stop"]);
  assert.equal(charter.primitiveById.get("cw-author")?.uri, "(built into cw)/skill/cw-author/index.md");
  assert.deepEqual(charter.faultsByFiles.files, {});
  assert.deepEqual(files.calls, [...layoutCheckCalls, `bytes under ${root.href}`, `bytes under ${vendorRoot.href}`]);
});

/** One primitive the engine brings, kept as `loadCharterService.loadCharterRoot` keeps it. */
const builtinRawPrimitive = (kind: string, id: string, contents = primitive(kind, id)) => new RawPrimitive(PrimitiveLayer.BUILTIN, kind, id, contents, [], `(built into cw)/${kind}/${id}/index.md`);

test("what the engine brings is read as a layer of its own, first (FR-015, FR-017)", () => {
  const charter = CharterRootFactory.create(
    [
      new RawPrimitive(PrimitiveLayer.REPO, "corpus", "type-safety", primitive("corpus", "type-safety"), [], ".cw/charter/primitive/corpus/type-safety/index.md"),
      new RawPrimitive(PrimitiveLayer.ofVendor("team/rules/root"), "guide", "no-any", primitive("guide", "no-any"), [], ".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md"),
      builtinRawPrimitive("skill", "cw-author"),
    ],
  );

  assert.deepEqual(
    charter.primitives.map(({ headers, layerName, uri }) => [headers.id, layerName, uri]),
    [
      ["cw-author", PrimitiveLayer.BUILTIN.name, "(built into cw)/skill/cw-author/index.md"],
      ["type-safety", PrimitiveLayer.REPO.name, ".cw/charter/primitive/corpus/type-safety/index.md"],
      ["no-any", PrimitiveLayer.vendorName, ".cw/charter/vendor/team/rules/root/primitive/guide/no-any/index.md"],
    ],
  );
});

test("what the engine brings is checked like any file, and a refused one is named under its own name (FR-018)", () => {
  const charter = CharterRootFactory.create([builtinRawPrimitive("skill", "cw-author", "---\nkind: skill\nid: cw-author\n---\n")]);

  assert.deepEqual(charter.primitives, []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["(built into cw)/skill/cw-author/index.md"]);
});

test("a repository claiming what the engine brings is the collision, filed against its own file (FR-019)", () => {
  const charter = CharterRootFactory.create(
    [new RawPrimitive(PrimitiveLayer.REPO, "skill", "cw-author", primitive("skill", "cw-author"), [], ".cw/charter/primitive/skill/cw-author/index.md"), builtinRawPrimitive("skill", "cw-author")],
  );

  assert.equal(charter.primitiveById.get("cw-author")?.layerName, PrimitiveLayer.BUILTIN.name);
  const [collision, ...rest] = charter.compositeFaultsByFiles.files[".cw/charter/primitive/skill/cw-author/index.md"] ?? [];
  assert.deepEqual(rest, []);
  assert.match(collision?.message ?? "", /already declared by \(built into cw\)\/skill\/cw-author\/index\.md/);
  assert.match(collision?.fix ?? "", /the engine's own .* the one to rename is yours/);
});

test("a repository is read through the charter it keeps, and no other", async () => {
  const files = charterHolding();
  const elsewhere = new URL("file:///other/");
  files.write(new URL(".cw/charter/primitive/skill/naming/index.md", elsewhere), primitive("skill", "naming"));

  const charter = await loadCharterRoot(files.rootedAt(elsewhere));

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["naming"]);
});

test("a file the format refuses is a problem naming that file, not a read that fails", async () => {
  const file = new URL("guide/no-any/index.md", root);
  const charter = await load(new InMemoryFileReaders({ [file.href]: primitive("concern", "no-any") }));

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["file:///repo/.cw/charter/primitive/guide/no-any/index.md"]);
});

test("what reads is kept, and what does not is named, in one read", async () => {
  const files = charterHolding();
  files.write(new URL("guide/broken/index.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "type-safety"]);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["file:///repo/.cw/charter/primitive/guide/broken/index.md"]);
});

test("every bad file in a charter is named in one read", async () => {
  const charter = await load(
    new InMemoryFileReaders({
      [new URL("guide/one/index.md", root).href]: "Just prose.\n",
      [new URL("guide/other/index.md", root).href]: "---\nkind: guide\nid: no-any\n",
    }),
  );

  assert.deepEqual(Object.keys(charter.faultsByFiles.files).sort(), ["file:///repo/.cw/charter/primitive/guide/one/index.md", "file:///repo/.cw/charter/primitive/guide/other/index.md"]);
});

test("a root is a folder, and one written as a file is refused", () => {
  assert.equal(FolderAddress.urlOf(new URL("file:///repo/.cw/charter/primitive/")).href, root.href);
  assert.throws(() => FolderAddress.urlOf("file:///repo/.cw/charter"), /names a file/);
});

test("a broken file in a vendored layer is named like any other, and costs that layer nothing else", async () => {
  const files = charterHolding();
  files.write(new URL("team/rules/root/primitive/guide/broken/index.md", vendorRoot), "Just prose.\n");
  files.write(new URL("team/rules/root/primitive/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["file:///repo/.cw/charter/vendor/team/rules/root/primitive/guide/broken/index.md"]);
  assert.deepEqual(ids(PrimitiveLayer.vendorName, charter), ["no-any"]);
});

test("what only shows when files are read together is kept apart from what one file got wrong", async () => {
  const files = charterHolding();
  files.write(new URL("acme/charter/root/primitive/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));
  files.write(new URL("guide/broken/index.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["file:///repo/.cw/charter/primitive/guide/broken/index.md"]);
  // The second of the two to be read: the repository's layer is read before a
  // vendor's. The corpus nobody cites is only a warning, and not what is asked
  // here.
  assert.deepEqual(Object.keys(charter.compositeFaultsByFiles.errors().files), ["file:///repo/.cw/charter/vendor/acme/charter/root/primitive/guide/no-any/index.md"]);
});

test("a primitive is read from its folder, and every other file under it is one of its assets, another index.md included (FR-141, FR-168)", async () => {
  const files = charterHolding();
  files.write(new URL("skill/team/index.md", root), primitive("skill", "team"));
  files.write(new URL("skill/team/checklist.md", root), "Check it.\n");
  files.write(new URL("skill/team/review/index.md", root), primitive("skill", "team/review"));

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "team", "type-safety"]);
  assert.deepEqual(
    charter.primitiveById.get("team")?.assets.map(({ file }) => file).sort(),
    ["checklist.md", "review/index.md"],
  );
  assert.deepEqual(Object.keys(charter.allFaultsByFiles.errors().files), []);
});

test("a markdown file kept as a file of its own, or an index.md kept where its kind and id do not say, is an error saying where to move it (FR-141)", async () => {
  const files = charterHolding();
  files.write(new URL("mcp/billing.md", root), primitive("mcp", "billing"));
  files.write(new URL("guide/elsewhere/index.md", root), primitive("guide", "house/style"));

  const charter = await load(files);

  assert.deepEqual(ids(PrimitiveLayer.REPO.name, charter), ["no-any", "type-safety"]);
  const faultsByFile = charter.allFaultsByFiles.errors().files;
  assert.match(faultsByFile["file:///repo/.cw/charter/primitive/mcp/billing.md"]?.[0]?.fix ?? "", /Move it to "file:\/\/\/repo\/\.cw\/charter\/primitive\/mcp\/billing\/index\.md"/);
  assert.match(faultsByFile["file:///repo/.cw/charter/primitive/guide/elsewhere/index.md"]?.[0]?.fix ?? "", /Move its folder to "file:\/\/\/repo\/\.cw\/charter\/primitive\/guide\/house\/style\/"/);
});

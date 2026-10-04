import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { charterRootOf, type CharterRoot } from "../src/hexagon/domain/models/charter/CharterRoot.js";
import { BUILTIN_LAYER, REPO_LAYER, VENDOR_LAYER, type LayerName } from "../src/hexagon/domain/models/charter/PrimitiveLayer.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");
const vendorRoot = folderURL("file:///repo/.cw/vendor/");
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

const parser = new YamlParser();

const load = (files: InMemoryFileReaders) => loadCharterRoot(repo, files, parser);

/** What one layer of a charter declares, by id. */
const ids = (layerName: LayerName, charter: CharterRoot) =>
  charter.primitives
    .filter((one) => one.layerName === layerName)
    .map((one) => one.headers.id)
    .sort();

test("every file the root lists is read as a primitive", async () => {
  const charter = await load(charterHolding());
  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "type-safety"]);
});

test("the charter is read once, and one more read per vendor installed", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));

  await load(files);

  // One read of what this repository authored, the vendor folder asked what is
  // installed, and one read of each layer that is — and the settings the
  // repository configured itself with are read from their own file, not from
  // the charter (FR-037).
  assert.deepEqual(files.calls, [
    `files under ${root.href}`,
    `folders under ${vendorRoot.href}`,
    `files under ${new URL("team/", vendorRoot).href}`,
  ]);
});

test("a file outside a kind's folder is no one's primitive (FR-002)", async () => {
  const files = charterHolding();
  files.write(new URL("catalog.json", root), "{}");
  files.write(new URL("README.md", root), "How this repository authors its charter.\n");
  files.write(new URL("team/charter.lock.json", vendorRoot), "{}");

  const charter = await load(files);

  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "type-safety"]);
  assert.deepEqual(charter.faultsByFiles.files, {});
});

test("a load reads what is there now, not what was there before", async () => {
  const files = charterHolding();
  await load(files);

  files.write(guide, primitive("guide", "no-any", "A rewritten body."));
  files.remove(corpus);
  files.write(new URL("skill/naming/index.md", root), primitive("skill", "naming"));
  const charter = await load(files);

  assert.deepEqual(ids(REPO_LAYER, charter), ["naming", "no-any"]);
  assert.equal(
    charter.primitives.find((one) => one.headers.id === "no-any")?.body,
    "A rewritten body.",
  );
});

test("what a vendor published is read as a layer of its own", async () => {
  const files = charterHolding();
  const vendor = folderURL(new URL("team/", vendorRoot));
  files.write(new URL("guide/no-any/index.md", vendor), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "type-safety"]);
  assert.deepEqual([...new Set(charter.primitives.map((one) => one.layerName))].sort(), [BUILTIN_LAYER, REPO_LAYER, VENDOR_LAYER]);
  assert.deepEqual(ids(VENDOR_LAYER, charter), ["no-any"]);
});

test("each vendor is its own layer, and a repository with none has none", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));
  files.write(new URL("design/skill/naming/index.md", vendorRoot), primitive("skill", "naming"));

  assert.deepEqual(
    [...new Set((await load(files)).primitives.map((one) => one.layerName))].sort(),
    [BUILTIN_LAYER, REPO_LAYER, VENDOR_LAYER],
  );
  assert.deepEqual(
    [...new Set((await load(charterHolding())).primitives.map((one) => one.layerName))],
    [BUILTIN_LAYER, REPO_LAYER],
  );
});

test("what the engine brings is no folder: it adds no read, and is read without a fault (FR-016, FR-022)", async () => {
  const files = charterHolding();

  const charter = await load(files);

  assert.deepEqual(ids(BUILTIN_LAYER, charter), ["cw-author", "cw-session-cost", "cw-session-tokens-counter", "cw-session-tokens-counter-on-stop"]);
  assert.equal(charter.primitiveById.get("cw-author")?.file, "(built into cw)/skill/cw-author/index.md");
  assert.deepEqual(charter.faultsByFiles.files, {});
  assert.deepEqual(files.calls, [`files under ${root.href}`, `folders under ${vendorRoot.href}`]);
});

/** One primitive the engine brings, named the way `loadCharterRoot` names it. */
const builtinFile = (kind: string, id: string, contents = primitive(kind, id)) => ({
  path: `(built into cw)/${kind}/${id}/index.md`,
  pathInLayer: `${kind}/${id}/index.md`,
  contents,
});

test("what the engine brings is read as a layer of its own, first (FR-015, FR-017)", () => {
  const charter = charterRootOf(
    {
      repo: [{ path: ".cw/charter/corpus/type-safety/index.md", pathInLayer: "corpus/type-safety/index.md", contents: primitive("corpus", "type-safety") }],
      vendor: [{ path: ".cw/vendor/team/guide/no-any/index.md", pathInLayer: "guide/no-any/index.md", contents: primitive("guide", "no-any"), vendor: "team" }],
      builtin: [builtinFile("skill", "cw-author")],
    },
    parser,
  );

  assert.deepEqual(
    charter.primitives.map(({ headers, layerName, file }) => [headers.id, layerName, file]),
    [
      ["cw-author", BUILTIN_LAYER, "(built into cw)/skill/cw-author/index.md"],
      ["type-safety", REPO_LAYER, ".cw/charter/corpus/type-safety/index.md"],
      ["no-any", VENDOR_LAYER, ".cw/vendor/team/guide/no-any/index.md"],
    ],
  );
});

test("what the engine brings is checked like any file, and a refused one is named under its own name (FR-018)", () => {
  const charter = charterRootOf(
    { repo: [], vendor: [], builtin: [builtinFile("skill", "cw-author", "---\nkind: skill\nid: cw-author\n---\n")] },
    parser,
  );

  assert.deepEqual(charter.primitives, []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["(built into cw)/skill/cw-author/index.md"]);
});

test("a repository claiming what the engine brings is the collision, filed against its own file (FR-019)", () => {
  const charter = charterRootOf(
    {
      repo: [{ path: ".cw/charter/skill/cw-author/index.md", pathInLayer: "skill/cw-author/index.md", contents: primitive("skill", "cw-author") }],
      vendor: [],
      builtin: [builtinFile("skill", "cw-author")],
    },
    parser,
  );

  assert.equal(charter.primitiveById.get("cw-author")?.layerName, BUILTIN_LAYER);
  const [collision, ...rest] = charter.compositeFaultsByFiles.files[".cw/charter/skill/cw-author/index.md"] ?? [];
  assert.deepEqual(rest, []);
  assert.match(collision?.message ?? "", /already declared by \(built into cw\)\/skill\/cw-author\/index\.md/);
  assert.match(collision?.fix ?? "", /the engine's own .* the one to rename is yours/);
});

test("a repository is read through the charter it keeps, and no other", async () => {
  const files = charterHolding();
  const elsewhere = new URL("file:///other/");
  files.write(new URL(".cw/charter/skill/naming/index.md", elsewhere), primitive("skill", "naming"));

  const charter = await loadCharterRoot(elsewhere, files, parser);

  assert.deepEqual(ids(REPO_LAYER, charter), ["naming"]);
});

test("a file the format refuses is a problem naming that file, not a read that fails", async () => {
  const file = new URL("guide/no-any/index.md", root);
  const charter = await load(new InMemoryFileReaders({ [file.href]: primitive("concern", "no-any") }));

  assert.deepEqual(ids(REPO_LAYER, charter), []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/no-any/index.md"]);
});

test("what reads is kept, and what does not is named, in one read", async () => {
  const files = charterHolding();
  files.write(new URL("guide/broken/index.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "type-safety"]);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/broken/index.md"]);
});

test("every bad file in a charter is named in one read", async () => {
  const charter = await load(
    new InMemoryFileReaders({
      [new URL("guide/one/index.md", root).href]: "Just prose.\n",
      [new URL("guide/other/index.md", root).href]: "---\nkind: guide\nid: no-any\n",
    }),
  );

  assert.deepEqual(Object.keys(charter.faultsByFiles.files).sort(), [".cw/charter/guide/one/index.md", ".cw/charter/guide/other/index.md"]);
});

test("a root is a folder, and one written as a file is refused", () => {
  assert.equal(folderURL(new URL("file:///repo/.cw/charter/")).href, root.href);
  assert.throws(() => folderURL("file:///repo/.cw/charter"), /names a file/);
});

test("a broken file in a vendored layer is named like any other, and costs that layer nothing else", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/broken/index.md", vendorRoot), "Just prose.\n");
  files.write(new URL("team/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/vendor/team/guide/broken/index.md"]);
  assert.deepEqual(ids(VENDOR_LAYER, charter), ["no-any"]);
});

test("what only shows when files are read together is kept apart from what one file got wrong", async () => {
  const files = charterHolding();
  files.write(new URL("acme/guide/no-any/index.md", vendorRoot), primitive("guide", "no-any"));
  files.write(new URL("guide/broken/index.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/broken/index.md"]);
  // The second of the two to be read: the repository's layer is read before a
  // vendor's. The corpus nobody cites is only a warning, and not what is asked
  // here.
  assert.deepEqual(Object.keys(charter.compositeFaultsByFiles.errors().files), [".cw/vendor/acme/guide/no-any/index.md"]);
});

test("a primitive is read from its folder, and every other file under it is one of its assets, another index.md included (FR-141, FR-168)", async () => {
  const files = charterHolding();
  files.write(new URL("skill/team/index.md", root), primitive("skill", "team"));
  files.write(new URL("skill/team/checklist.md", root), "Check it.\n");
  files.write(new URL("skill/team/review/index.md", root), primitive("skill", "team/review"));

  const charter = await load(files);

  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "team", "type-safety"]);
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

  assert.deepEqual(ids(REPO_LAYER, charter), ["no-any", "type-safety"]);
  const faultsByFile = charter.allFaultsByFiles.errors().files;
  assert.match(faultsByFile[".cw/charter/mcp/billing.md"]?.[0]?.fix ?? "", /\.cw\/charter\/mcp\/billing\/index\.md/);
  assert.match(faultsByFile[".cw/charter/guide/elsewhere/index.md"]?.[0]?.fix ?? "", /\.cw\/charter\/guide\/house\/style\//);
});

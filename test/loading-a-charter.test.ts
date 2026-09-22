import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharters } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import {
  BUILTIN_SCOPE,
  charterRootOf,
  REPO_SCOPE,
  VENDOR_SCOPE,
  type CharterRoot,
  type Scope,
} from "../src/hexagon/domain/models/charter/CharterRoot.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");
const vendorRoot = folderURL("file:///repo/.cw/vendor/");
const guide = new URL("guide/no-any.md", root);
const corpus = new URL("corpus/type-safety.md", root);

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

const load = (files: InMemoryFileReaders) => loadCharters(repo, files, parser);

/** What one layer of a charter declares, by identity. */
const identities = (scope: Scope, charter: CharterRoot) =>
  charter.primitives
    .filter((one) => one.scope === scope)
    .map((one) => one.identity)
    .sort();

test("every file the root lists is read as a primitive", async () => {
  const charter = await load(charterHolding());
  assert.deepEqual(identities(REPO_SCOPE, charter), ["corpus:type-safety", "guide:no-any"]);
});

test("the charter is read once, and one more read per vendor installed", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/no-any.md", vendorRoot), primitive("guide", "no-any"));

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

  assert.deepEqual(identities(REPO_SCOPE, charter), ["corpus:type-safety", "guide:no-any"]);
  assert.deepEqual(charter.faultsByFiles.files, {});
});

test("a load reads what is there now, not what was there before", async () => {
  const files = charterHolding();
  await load(files);

  files.write(guide, primitive("guide", "no-any", "A rewritten body."));
  files.remove(corpus);
  files.write(new URL("skill/naming.md", root), primitive("skill", "naming"));
  const charter = await load(files);

  assert.deepEqual(identities(REPO_SCOPE, charter), ["guide:no-any", "skill:naming"]);
  assert.equal(
    charter.primitives.find((one) => one.primitive.headers.id === "no-any")?.primitive.body,
    "A rewritten body.",
  );
});

test("what a vendor published is read as a layer of its own", async () => {
  const files = charterHolding();
  const vendor = folderURL(new URL("team/", vendorRoot));
  files.write(new URL("guide/no-any.md", vendor), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(identities(REPO_SCOPE, charter), ["corpus:type-safety", "guide:no-any"]);
  assert.deepEqual([...new Set(charter.primitives.map((one) => one.scope))].sort(), [BUILTIN_SCOPE, REPO_SCOPE, VENDOR_SCOPE]);
  assert.deepEqual(identities(VENDOR_SCOPE, charter), ["guide:no-any"]);
});

test("each vendor is its own layer, and a repository with none has none", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/no-any.md", vendorRoot), primitive("guide", "no-any"));
  files.write(new URL("design/skill/naming.md", vendorRoot), primitive("skill", "naming"));

  assert.deepEqual(
    [...new Set((await load(files)).primitives.map((one) => one.scope))].sort(),
    [BUILTIN_SCOPE, REPO_SCOPE, VENDOR_SCOPE],
  );
  assert.deepEqual(
    [...new Set((await load(charterHolding())).primitives.map((one) => one.scope))],
    [BUILTIN_SCOPE, REPO_SCOPE],
  );
});

test("what the engine brings is no folder: it adds no read, and is read without a fault (FR-016, FR-022)", async () => {
  const files = charterHolding();

  const charter = await load(files);

  assert.deepEqual(identities(BUILTIN_SCOPE, charter), ["skill:cw-author"]);
  assert.equal(charter.primitiveById.get("skill:cw-author")?.file, "(built into cw)/skill/cw-author.md");
  assert.deepEqual(charter.faultsByFiles.files, {});
  assert.deepEqual(files.calls, [`files under ${root.href}`, `folders under ${vendorRoot.href}`]);
});

/** One primitive the engine brings, named the way `loadCharters` names it. */
const builtinFile = (kind: string, id: string, contents = primitive(kind, id)) => ({
  path: `(built into cw)/${kind}/${id}.md`,
  contents,
});

test("what the engine brings is read as a layer of its own, first (FR-015, FR-017)", () => {
  const charter = charterRootOf(
    {
      repo: [{ path: ".cw/charter/corpus/type-safety.md", contents: primitive("corpus", "type-safety") }],
      vendor: [{ path: ".cw/vendor/team/guide/no-any.md", contents: primitive("guide", "no-any"), vendor: "team" }],
      builtin: [builtinFile("skill", "cw-author")],
    },
    parser,
  );

  assert.deepEqual(
    charter.primitives.map(({ identity, scope, file }) => [identity, scope, file]),
    [
      ["skill:cw-author", BUILTIN_SCOPE, "(built into cw)/skill/cw-author.md"],
      ["corpus:type-safety", REPO_SCOPE, ".cw/charter/corpus/type-safety.md"],
      ["guide:no-any", VENDOR_SCOPE, ".cw/vendor/team/guide/no-any.md"],
    ],
  );
});

test("what the engine brings is checked like any file, and a refused one is named under its own name (FR-018)", () => {
  const charter = charterRootOf(
    { repo: [], vendor: [], builtin: [builtinFile("skill", "cw-author", "---\nkind: skill\nid: cw-author\n---\n")] },
    parser,
  );

  assert.deepEqual(charter.primitives, []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), ["(built into cw)/skill/cw-author.md"]);
});

test("a repository claiming what the engine brings is the collision, filed against its own file (FR-019)", () => {
  const charter = charterRootOf(
    {
      repo: [{ path: ".cw/charter/skill/cw-author.md", contents: primitive("skill", "cw-author") }],
      vendor: [],
      builtin: [builtinFile("skill", "cw-author")],
    },
    parser,
  );

  assert.equal(charter.primitiveById.get("skill:cw-author")?.scope, BUILTIN_SCOPE);
  const [collision, ...rest] = charter.compositeFaultsByFiles.files[".cw/charter/skill/cw-author.md"] ?? [];
  assert.deepEqual(rest, []);
  assert.match(collision?.message ?? "", /already declared by \(built into cw\)\/skill\/cw-author\.md/);
  assert.match(collision?.fix ?? "", /the engine's own .* the one to rename is yours/);
});

test("a repository is read through the charter it keeps, and no other", async () => {
  const files = charterHolding();
  const elsewhere = new URL("file:///other/");
  files.write(new URL(".cw/charter/skill/naming.md", elsewhere), primitive("skill", "naming"));

  const charter = await loadCharters(elsewhere, files, parser);

  assert.deepEqual(identities(REPO_SCOPE, charter), ["skill:naming"]);
});

test("a file the format refuses is a problem naming that file, not a read that fails", async () => {
  const file = new URL("guide/no-any.md", root);
  const charter = await load(new InMemoryFileReaders({ [file.href]: primitive("concern", "no-any") }));

  assert.deepEqual(identities(REPO_SCOPE, charter), []);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/no-any.md"]);
});

test("what reads is kept, and what does not is named, in one read", async () => {
  const files = charterHolding();
  files.write(new URL("guide/broken.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(identities(REPO_SCOPE, charter), ["corpus:type-safety", "guide:no-any"]);
  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/broken.md"]);
});

test("every bad file in a charter is named in one read", async () => {
  const charter = await load(
    new InMemoryFileReaders({
      [new URL("guide/one.md", root).href]: "Just prose.\n",
      [new URL("guide/other.md", root).href]: "---\nkind: guide\nid: no-any\n",
    }),
  );

  assert.deepEqual(Object.keys(charter.faultsByFiles.files).sort(), [".cw/charter/guide/one.md", ".cw/charter/guide/other.md"]);
});

test("a root is a folder, and one written as a file is refused", () => {
  assert.equal(folderURL(new URL("file:///repo/.cw/charter/")).href, root.href);
  assert.throws(() => folderURL("file:///repo/.cw/charter"), /names a file/);
});

test("a broken file in a vendored layer is named like any other, and costs that layer nothing else", async () => {
  const files = charterHolding();
  files.write(new URL("team/guide/broken.md", vendorRoot), "Just prose.\n");
  files.write(new URL("team/guide/no-any.md", vendorRoot), primitive("guide", "no-any"));

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/vendor/team/guide/broken.md"]);
  assert.deepEqual(identities(VENDOR_SCOPE, charter), ["guide:no-any"]);
});

test("what only shows when files are read together is kept apart from what one file got wrong", async () => {
  const files = charterHolding();
  files.write(new URL("guide/copied.md", root), primitive("guide", "no-any"));
  files.write(new URL("guide/broken.md", root), "Just prose.\n");

  const charter = await load(files);

  assert.deepEqual(Object.keys(charter.faultsByFiles.files), [".cw/charter/guide/broken.md"]);
  // The second of the two to be read, which is the second in path order. The
  // corpus nobody cites is only a warning, and not what is asked here.
  assert.deepEqual(Object.keys(charter.compositeFaultsByFiles.errors().files), [".cw/charter/guide/no-any.md"]);
});

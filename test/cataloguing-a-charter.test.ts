import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCharters } from "../src/hexagon/service/charterRepo.js";
import { folderURL } from "../src/hexagon/domain/path.js";
import { compile } from "../src/hexagon/domain/services/compileService.js";
import { Catalogue } from "../src/hexagon/domain/models/output/CharterOutput.js";

import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { CwAuthorSkill } from "../src/hexagon/domain/models/charter/builtin/CwAuthorSkill.js";

const repo = new URL("file:///repo");
const root = folderURL("file:///repo/.cw/charter/");
const vendorRoot = folderURL("file:///repo/.cw/vendor/");

/** One authored file, holding what any of the kinds these tests use asks
 *  for. The body is what a real guide's body is like: the bulk of the file, and
 *  the thing neither catalogue carries. */
const primitive = (
  kind: string,
  id: string,
  { body = paragraphs(id), headers = [] as readonly string[] } = {},
) =>
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

/** The skill the engine brings, as the compact catalogue carries it: every
 *  charter holds it, so every catalogue lists it (FR-017). */
const builtinEntry = {
  identity: "skill:cw-author",
  kind: "skill",
  id: "cw-author",
  description: new CwAuthorSkill().headers.description,
};

const load = (files: InMemoryFileReaders) => loadCharters(repo, files, new YamlParser());

/** The listing this charter compiles to. Read off what compiling produces, since
 *  a listing is one of the things a charter is compiled into and there is no way
 *  to ask for it on its own (SC-004). */
const catalogueOf = async (files: InMemoryFileReaders): Promise<Catalogue> => compile(await load(files), []).catalogue;

/** The bytes a listing lands on disk as, which is what an agent pays to read
 *  (SC-005). */
const written = (entries: readonly unknown[]) => JSON.stringify(entries);

test("the full catalogue records every descriptive header and where the body is", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({
      [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", {
        headers: ["tags: [types]", "rationale: corpus:type-safety", "mixins: [house-style]"],
      }),
    }),
  );

  assert.deepEqual(catalogue.full, [
    {
      identity: "guide:no-any",
      kind: "guide",
      id: "no-any",
      description: "What no-any is for, in one line.",
      file: ".cw/charter/guide/no-any.md",
      tags: ["types"],
      globs: ["src/**/*.ts"],
      rationale: "corpus:type-safety",
      mixins: ["house-style"],
    },
    { ...builtinEntry, file: "(built into cw)/skill/cw-author.md" },
  ]);
});

test("a header the author left out is left out, not recorded as nothing", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({ [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any") }),
  );

  const [entry] = catalogue.full;

  assert.deepEqual(Object.keys(entry!).sort(), ["description", "file", "globs", "id", "identity", "kind"]);
});

test("a vendored primitive is named as it was authored, at the path it was installed to", async () => {
  const vendored = new URL("team/guide/no-any.md", vendorRoot);
  const catalogue = await catalogueOf(new InMemoryFileReaders({ [vendored.href]: primitive("guide", "no-any") }));

  const [entry] = catalogue.full;

  assert.equal(entry!.identity, "guide:no-any");
  assert.equal(entry!.file, ".cw/vendor/team/guide/no-any.md");
});

test("the compact catalogue carries what an agent surveys by, and nothing else", async () => {
  const catalogue = await catalogueOf(
    new InMemoryFileReaders({ [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any") }),
  );

  assert.deepEqual(catalogue.compact, [
    {
      identity: "guide:no-any",
      kind: "guide",
      id: "no-any",
      description: "What no-any is for, in one line.",
    },
    builtinEntry,
  ]);
});

test("the same charter catalogues in the same order however its files were read", async () => {
  const files = new InMemoryFileReaders({
    [new URL("skill/writing-tests.md", root).href]: primitive("skill", "writing-tests"),
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any"),
    [new URL("corpus/type-safety.md", root).href]: primitive("corpus", "type-safety"),
  });

  const identities = (await catalogueOf(files)).full.map((one) => one.identity);

  assert.deepEqual(identities, ["corpus:type-safety", "guide:no-any", "skill:cw-author", "skill:writing-tests"]);
});

test("neither catalogue carries a body", async () => {
  const files = new InMemoryFileReaders({
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", { body: "SECRET BODY TEXT" }),
  });

  const catalogue = await catalogueOf(files);

  assert.ok(!`${written(catalogue.full)}${written(catalogue.compact)}`.includes("SECRET BODY TEXT"));
});

test("the compact catalogue is at least ten times smaller than the charter it describes (SC-005)", async () => {
  const authored = Object.fromEntries(
    Array.from({ length: 40 }, (_, at) => [
      new URL(`guide/rule-${at}.md`, root).href,
      primitive("guide", `rule-${at}`),
    ]),
  );
  // What the engine brings is part of the charter the catalogue describes.
  const charterBytes = [...Object.values(authored), new CwAuthorSkill().toMarkdown()].reduce(
    (all, text) => all + Buffer.byteLength(text),
    0,
  );

  const catalogue = await catalogueOf(new InMemoryFileReaders(authored));
  const compact = written(catalogue.compact);

  assert.equal(catalogue.compact.length, 41);
  assert.ok(
    Buffer.byteLength(compact) * 10 <= charterBytes,
    `compact catalogue is ${Buffer.byteLength(compact)} bytes of a ${charterBytes}-byte charter`,
  );
});

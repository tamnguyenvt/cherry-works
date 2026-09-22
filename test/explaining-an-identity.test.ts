import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";

const repo = "/repo";

/** What installing a vendor is driven through: a context always carries every
 *  use case, and nothing here asks this one for anything. */
const charterVendoringApp = new CharterVendoring(new URL(`file://${repo}/`), new InMemoryFileReaders({}), new InMemoryVCS());

const root = new URL("file:///repo/.cw/charter/");
const vendored = new URL("file:///repo/.cw/vendor/acme/");

/** One authored file, holding what the kind it declares requires. */
const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: What ${id} is for.`,
    'globs: ["src/**/*.ts"]',
    'triggers: ["a request"]',
    ...headers,
    "---",
    "",
    "SECRET BODY TEXT",
    "",
  ].join("\n");

/** Everything one run wrote, kept apart the way a pipeline reads it. */
const writing = async (work: () => Promise<number>) => {
  const results: string[] = [];
  const problems: string[] = [];
  const streams = [
    { stream: process.stdout, kept: process.stdout.write, into: results },
    { stream: process.stderr, kept: process.stderr.write, into: problems },
  ];
  for (const { stream, into } of streams) {
    stream.write = ((text: string | Uint8Array) => {
      into.push(String(text));
      return true;
    }) as typeof stream.write;
  }
  try {
    const code = await work();
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    for (const { stream, kept } of streams) stream.write = kept;
  }
};

/** The command line as a user meets it, over a charter held in memory. */
const run = async (files: Readonly<Record<string, string>>, argv: readonly string[]) => {
  const readers = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), readers, new YamlParser(), new InMemoryFileOutput(readers), new InMemoryVCS());
  const cli = new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp }, COMMANDS);
  return writing(() => cli.run(argv));
};

const charter = {
  [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", ["tags: [types]"]),
  [new URL("guide/small-diffs.md", vendored).href]: primitive("guide", "small-diffs"),
};

test("an identity is traced in one command to the file that declares it", async () => {
  const { code, results } = await run(charter, ["explain", "guide:no-any"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(results, [
    "guide:no-any  What no-any is for.",
    "  .cw/charter/guide/no-any.md",
    "  authored in this repository",
    "  comes up when a touched file matches one of its `globs`, or every turn where globs are not specified",
    "  declares tags: types",
    "  declares globs: src/**/*.ts",
    "",
  ].join("\n"));
});

test("an explanation says when the primitive comes up, in the words its kind says it in", async () => {
  const kinds = await run(charter, ["kinds"]);
  const sensor = await run(
    { [new URL("sensor/no-secrets.md", root).href]: primitive("sensor", "no-secrets", ["signal: PreToolUse", 'run: "pnpm test"']) },
    ["explain", "sensor:no-secrets"],
  );

  const activatesWhen = /^sensor {2}(.+)$/m.exec(kinds.results)?.[1];
  assert.ok(activatesWhen);
  assert.ok(sensor.results.split("\n").includes(`  comes up when ${activatesWhen}`));
});

test("an explanation says what the primitive itself declared, so a sensor names the signal and the command it runs", async () => {
  const { results } = await run(
    { [new URL("sensor/no-secrets.md", root).href]: primitive("sensor", "no-secrets", ["signal: PreToolUse", 'run: "pnpm test"']) },
    ["explain", "sensor:no-secrets"],
  );

  assert.match(results, /^ {2}declares signal: PreToolUse$/m);
  assert.match(results, /^ {2}declares run: pnpm test$/m);
  assert.doesNotMatch(results, /declares (id|description):/);
});

test("what explaining finds reaches a driver as its DTO, saying when the primitive comes up and the rationale it cites", async () => {
  const readers = new InMemoryFileReaders({
    [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", ["rationale: corpus:gone"]),
  });
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), readers, new YamlParser(), new InMemoryFileOutput(readers), new InMemoryVCS());

  // Sent and read back, the way the portal's page will read it.
  const explanationOutcomeDTO = OutcomeDTOs.ExplanationOutcome.parse(
    JSON.parse(JSON.stringify(await charterAuthoringApp.explain("guide:no-any"))),
  );

  assert.equal(explanationOutcomeDTO.data.activatesWhen, "a touched file matches one of its `globs`, or every turn where globs are not specified");
  assert.equal(explanationOutcomeDTO.data.rationale, undefined);
  assert.equal(explanationOutcomeDTO.data.scopedPrimitive.data.headers.rationale, "corpus:gone");
});

test("a vendored identity is named the same way, and says which layer it came from", async () => {
  const { code, results } = await run(charter, ["explain", "guide:small-diffs"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^ {2}\.cw\/vendor\/acme\/guide\/small-diffs\.md$/m);
  assert.match(results, /installed from a vendor/);
});

test("what is explained carries no body", async () => {
  const { results } = await run(charter, ["explain", "guide:no-any"]);

  assert.ok(!results.includes("SECRET BODY TEXT"));
});

const related = {
  [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", ["mixins: [typed]", "rationale: corpus:why-types"]),
  [new URL("mixin/typed.md", root).href]: primitive("mixin", "typed"),
  [new URL("corpus/why-types.md", vendored).href]: primitive("corpus", "why-types"),
};

test("an explanation says which mixins a primitive uses and which corpus it cites", async () => {
  const { code, results } = await run(related, ["explain", "guide:no-any"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^ {2}uses mixin mixin:typed$/m);
  assert.match(results, /^ {2}rationale corpus:why-types$/m);
});

test("an explanation says what uses a mixin and what cites a corpus", async () => {
  const mixin = await run(related, ["explain", "mixin:typed"]);
  assert.match(mixin.results, /^ {2}mixin of guide:no-any$/m);

  const corpus = await run(related, ["explain", "corpus:why-types"]);
  assert.match(corpus.results, /^ {2}rationale of guide:no-any$/m);
});

test("a rationale citing a corpus the charter does not hold is named, and marked as not resolving", async () => {
  const { code, results } = await run(
    { [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", ["rationale: corpus:gone"]) },
    ["explain", "guide:no-any"],
  );

  assert.equal(code, EXIT_OK);
  assert.match(results, /^ {2}rationale corpus:gone \(does not resolve\)$/m);
});

/** One test file, written the way an author writes it, in the folder tests are
 *  read from. */
const suite = (written: unknown, name = "activation") => ({
  [new URL(`.cw/test/${name}.json`, "file:///repo/").href]: `${JSON.stringify(written, undefined, 2)}\n`,
});

const pinnedDown = {
  [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any"),
  [new URL("sensor/no-secrets.md", root).href]: primitive("sensor", "no-secrets", ["signal: PreToolUse", 'run: "pnpm test"']),
  ...suite({
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } },
      { do: { touchFile: ".env" }, expect: { allow: false } },
      { when: "PreToolUse", expect: { run: "sensor:no-secrets" } },
    ],
  }),
};

test("an explanation says which situations this repository wrote down about the primitive", async () => {
  const { code, results } = await run(pinnedDown, ["explain", "guide:no-any"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^ {2}pinned down by \.cw\/test\/activation\.json: touching src\/one\.ts activates guide:no-any$/m);
  assert.doesNotMatch(results, /\.env/);
});

test("a sensor is pinned down by the case that fires its signal", async () => {
  const { results } = await run(pinnedDown, ["explain", "sensor:no-secrets"]);

  assert.match(results, /^ {2}pinned down by \.cw\/test\/activation\.json: firing event PreToolUse runs sensor:no-secrets$/m);
});

test("a primitive no case names is explained with no situation under it", async () => {
  const { code, results } = await run({ ...pinnedDown, ...suite({ cases: [{ do: { touchFile: ".env" }, expect: { allow: false } }] }) }, [
    "explain",
    "guide:no-any",
  ]);

  assert.equal(code, EXIT_OK);
  assert.doesNotMatch(results, /pinned down by/);
});

test("a test file that will not read leaves the explanation standing", async () => {
  const { code, results } = await run(
    { ...pinnedDown, [new URL(".cw/test/broken.json", "file:///repo/").href]: "not json at all" },
    ["explain", "guide:no-any"],
  );

  assert.equal(code, EXIT_OK);
  assert.match(results, /^ {2}pinned down by \.cw\/test\/activation\.json: /m);
  assert.doesNotMatch(results, /broken\.json/);
});

test("an identity the charter holds nothing of is refused, and sends the user to the listing", async () => {
  const { code, results, problems } = await run(charter, ["explain", "guide:nothing"]);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /holds no "guide:nothing"/);
  assert.match(problems, /cw list --min/);
});

test("a charter with an error explains nothing and sends the user to doctor", async () => {
  const { code, results, problems } = await run(
    { [new URL("guide/no-any.md", root).href]: ["---", "kind: guide", "id: no-any", "---", "", "Body.", ""].join("\n") },
    ["explain", "guide:no-any"],
  );

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /cw doctor/);
});

test("a collision is the answer doctor gives, naming both files that claim the identity", async () => {
  const { results } = await run(
    {
      [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any"),
      [new URL("guide/no-any.md", vendored).href]: primitive("guide", "no-any"),
    },
    ["doctor"],
  );

  assert.match(results, /\.cw\/charter\/guide\/no-any\.md/);
  assert.match(results, /\.cw\/vendor\/acme\/guide\/no-any\.md/);
});

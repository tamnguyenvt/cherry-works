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
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";
import { CwAuthorSkill } from "../src/hexagon/domain/models/charter/builtin/CwAuthorSkill.js";

const repo = "/repo";

/** What installing a vendor is driven through: a context always carries every
 *  use case, and nothing here asks this one for anything. */
const charterVendoringApp = new CharterVendoring(new URL(`file://${repo}/`), new InMemoryFileReaders({}), new InMemoryVCS());

/** What the test files are driven through, over an empty repository: nothing
 *  here asks it for anything. */
const noTestFiles = new InMemoryFileReaders({});
const testAuthoringApp = new TestAuthoring(new URL(`file://${repo}/`), noTestFiles, new InMemoryFileOutput(noTestFiles));


/** Whose home the command line runs in: what is installed on this machine is
 *  detected under it, and nothing here asks. */
const root = new URL("file:///repo/.cw/charter/");

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
const run = async (files: Readonly<Record<string, string>>, argv: readonly string[] = ["list"]) => {
  const readers = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), readers, new YamlParser(), new InMemoryFileOutput(readers), new InMemoryVCS());
  const cli = new Commander({ cwd: repo, version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp }, COMMANDS);
  return writing(() => cli.run(argv));
};

const charter = {
  [new URL("guide/no-any.md", root).href]: primitive("guide", "no-any", ["tags: [types]"]),
  [new URL("skill/writing-tests.md", root).href]: primitive("skill", "writing-tests"),
  [new URL("corpus/type-safety.md", root).href]: primitive("corpus", "type-safety"),
};

test("every primitive is listed, ordered by identity, with what it is for", async () => {
  const { code, results } = await run(charter);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(
    results
      .split("\n")
      .filter((line) => !line.startsWith(" ") && line !== ""),
    [
      "corpus:type-safety  What type-safety is for.",
      "guide:no-any  What no-any is for.",
      `skill:cw-author  ${new CwAuthorSkill().headers.description}`,
      "skill:writing-tests  What writing-tests is for.",
    ],
  );
});

test("the full listing says where the body is and what else was declared about it", async () => {
  const { results } = await run(charter);

  assert.match(results, /^ {2}\.cw\/charter\/guide\/no-any\.md$/m);
  assert.match(results, /^ {2}globs: src\/\*\*\/\*\.ts, tags: types$/m);
});

test("--min says what an agent surveys by, and nothing else", async () => {
  const { code, results } = await run(charter, ["list", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(results, [
    "corpus:type-safety  What type-safety is for.",
    "guide:no-any  What no-any is for.",
    `skill:cw-author  ${new CwAuthorSkill().headers.description}`,
    "skill:writing-tests  What writing-tests is for.",
    "",
  ].join("\n"));
});

test("no listing carries a body", async () => {
  const both = await Promise.all([run(charter), run(charter, ["list", "--min"])]);

  for (const { results } of both) assert.ok(!results.includes("SECRET BODY TEXT"));
});

test("--kind narrows the listing to that kind", async () => {
  const { code, results } = await run(charter, ["list", "--kind", "guide", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(results, "guide:no-any  What no-any is for.\n");
});

test("a kind the charter holds nothing of lists nothing, and says so", async () => {
  const { code, results } = await run(charter, ["list", "--kind", "playbook"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /no playbook/);
});

test("a word that is no kind is refused, naming it and the kinds it could have been", async () => {
  const { code, results, problems } = await run(charter, ["list", "--kind", "rule"]);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /"rule" is not a kind the charter knows/);
  assert.match(problems, /guide, sensor, command/);
});

test("a charter with an error lists nothing and sends the user to doctor", async () => {
  const { code, results, problems } = await run({
    [new URL("guide/no-any.md", root).href]: ["---", "kind: guide", "id: no-any", "---", "", "Body.", ""].join("\n"),
  });

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /cw doctor/);
});

test("a repository that authored nothing is listed what the engine brings (FR-017)", async () => {
  const { code, results } = await run({}, ["list", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.equal(results, `skill:cw-author  ${new CwAuthorSkill().headers.description}\n`);
});

test("cw kinds says every kind and when each comes up, in a repository that authored none of them", async () => {
  const { code, results } = await run({}, ["kinds"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(
    results.trim().split("\n").map((line) => line.split("  ")[0]),
    [...KINDS],
  );
  assert.match(results, new RegExp(`guide {2}${GuidePrimitive.activatesWhen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

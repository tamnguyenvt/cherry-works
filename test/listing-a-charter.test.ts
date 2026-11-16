import assert from "node:assert/strict";
import { test } from "node:test";
import { CwAuthorSkill } from "../src/module/charter/domain/builtin/cw-author-skill.js";
import { CwSessionTokensCounterScript } from "../src/module/charter/domain/builtin/cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "../src/module/charter/domain/builtin/cw-session-tokens-sensor.js";
import { GuidePrimitive } from "../src/module/charter/domain/models/primitive/guide-primitive.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";

/** Whose home the command line runs in: what is installed on this machine is
 *  detected under it, and nothing here asks. */
const root = new URL("file:///repo/.cw/charter/primitive/");

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
  const charterAuthoringApp = authoringCharterOf(readers, new InMemoryFileOutput(readers), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    readers,
    new InMemoryFileOutput(readers),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const cli = new Commander(
    commandLineOf(
      readers,
      new InMemoryFileOutput(readers),
      { charterAuthoringApp, charterRuntimeApp: charterRuntimeApps },
      repo,
    ),
    COMMANDS,
  );
  return writing(() => cli.runCommandLine(argv));
};

/** Each row of an answer under its heading, read as the one line it is —
 *  its value no longer wrapped beneath its own column — and its label and
 *  value two spaces apart, the way a pipeline reads it. */
const rowsOf = (answerText: string) =>
  answerText
    .replace(/\n {5,}/g, " ")
    .split("\n")
    .filter((line) => /^ {2}\S/.test(line))
    .map((line) => line.trim().replace(/ {2,}/, "  "));

/** The lines the engine's own session primitives are listed by, in every
 *  repository: the counter's script, then the sensor that runs it
 *  (EVAL-FR-008). */
const sessionCounterLines = [
  `cw-session-tokens-counter  ${new CwSessionTokensCounterScript().headers.description}`,
  `cw-session-tokens-counter-on-stop  ${new CwSessionTokensSensor().headers.description}`,
];

const charter = {
  [new URL("guide/no-any/index.md", root).href]: primitive("guide", "no-any", ["tags: [types]"]),
  [new URL("skill/writing-tests/index.md", root).href]: primitive("skill", "writing-tests"),
  [new URL("corpus/type-safety/index.md", root).href]: primitive("corpus", "type-safety"),
};

test("every primitive is listed, ordered by id, with what it is for", async () => {
  const { code, results } = await run(charter);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^Primitives\n/);
  const openingLines = [
    `cw-author  ${new CwAuthorSkill().headers.description}`,
    ...sessionCounterLines,
    "no-any  What no-any is for.",
    "type-safety  What type-safety is for.",
    "writing-tests  What writing-tests is for.",
  ];
  // What follows the description on its row is the files beneath it.
  assert.deepEqual(
    rowsOf(results).map((row, rowIndex) =>
      row.startsWith(`${openingLines[rowIndex]} `) ? openingLines[rowIndex] : row,
    ),
    openingLines,
  );
});

test("the full listing opens each primitive on its id and description, with the file it was authored in and the files it applies to each on a line of its own beneath (CORE Story 3 scenario 10, FR-028, FR-140, CORE Story 55 scenario 12, CORE Story 27 scenario 5)", async () => {
  const { code, results } = await run(charter);

  assert.equal(code, EXIT_OK);
  assert.match(
    results,
    /^ {2}no-any {2,}What no-any is for\.\n( {4,})\.cw\/charter\/primitive\/guide\/no-any\/index\.md\n\1globs: src\/\*\*\/\*\.ts\n/m,
  );
  assert.match(results, /^ {4,}\.cw\/charter\/primitive\/guide\/no-any\/index\.md$/m);
  assert.match(results, /^ {4,}globs: src\/\*\*\/\*\.ts$/m);
  // Every other header is read from the file the line above names.
  assert.doesNotMatch(results, /tags:/);
});

test("a listing is read off the charter, so every layer is named where it was authored, not where it compiled (FR-140, CORE Story 16 scenario 6)", async () => {
  const { results } = await run({
    "file:///repo/.cw/charter/vendor/team/rules/root/primitive/guide/no-console/index.md": primitive(
      "guide",
      "no-console",
    ),
  });

  assert.match(results, /^ {4,}\.cw\/charter\/vendor\/team\/rules\/root\/primitive\/guide\/no-console\/index\.md$/m);
  assert.match(results, /^ {4,}\(built into cw\)\/skill\/cw-author\/index\.md$/m);
  assert.doesNotMatch(results, /\.cw\/out\//);
});

test("--min says what an agent surveys by, and nothing else (CORE Story 3 scenario 10, FR-028, CORE Story 55 scenario 12)", async () => {
  const { code, results } = await run(charter, ["list", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^Primitives\n {2}\S/);
  assert.deepEqual(rowsOf(results), [
    `cw-author  ${new CwAuthorSkill().headers.description}`,
    ...sessionCounterLines,
    "no-any  What no-any is for.",
    "type-safety  What type-safety is for.",
    "writing-tests  What writing-tests is for.",
  ]);
});

test("no listing carries a body", async () => {
  const both = await Promise.all([run(charter), run(charter, ["list", "--min"])]);

  for (const { results } of both) assert.ok(!results.includes("SECRET BODY TEXT"));
});

test("--kind narrows the listing to that kind (CORE Story 3 scenario 10, FR-028, CORE Story 55 scenario 12)", async () => {
  const { code, results } = await run(charter, ["list", "--kind", "guide", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(results, "Primitives\n  no-any  What no-any is for.\n");
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
  assert.match(problems, /guide, sensor, skill/);
});

test("a charter with an error lists nothing and sends the user to doctor (CORE Story 3 scenario 10, FR-028, CORE Story 55 scenario 12)", async () => {
  const { code, results, problems } = await run({
    [new URL("guide/no-any/index.md", root).href]: ["---", "kind: guide", "id: no-any", "---", "", "Body.", ""].join(
      "\n",
    ),
  });

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /cw doctor/);
});

test("a repository that authored nothing is listed what the engine brings (FR-017)", async () => {
  const { code, results } = await run({}, ["list", "--min"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^Primitives\n {2}\S/);
  assert.deepEqual(rowsOf(results), [`cw-author  ${new CwAuthorSkill().headers.description}`, ...sessionCounterLines]);
});

test("cw kinds says every kind and when each comes up, in a repository that authored none of them (CORE Story 11 scenario 2)", async () => {
  const { code, results } = await run({}, ["kinds"]);

  assert.equal(code, EXIT_OK);
  assert.match(results, /^Kinds\n/);
  assert.deepEqual(
    rowsOf(results).map((row) => row.split("  ")[0]),
    [...Primitives.kinds],
  );
  assert.ok(rowsOf(results).includes(`guide  ${GuidePrimitive.activatesWhen}`));
});

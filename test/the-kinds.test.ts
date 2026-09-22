import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import {
  KINDS,
  isKind,
  primitiveHeadersOf,
  primitiveOf,
} from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { SIGNALS } from "../src/hexagon/domain/models/charter/primitive/SensorPrimitive.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = "/repo";
const repoPath = new URL("file:///repo/");

/** What vendoring is driven through: a context always carries every use case,
 *  and nothing here asks this one for anything. */
const charterVendoringApp = new CharterVendoring(repoPath, new InMemoryFileReaders({}), new InMemoryVCS());

/** What the test files are driven through, over an empty repository: nothing
 *  here asks it for anything. */
const noTestFiles = new InMemoryFileReaders({});
const testAuthoringApp = new TestAuthoring(repoPath, noTestFiles, new InMemoryFileOutput(noTestFiles));

/** The command line as an author meets it, over a repository held in memory:
 *  the real command, the real service behind it, and what the terminal read. */
const asking = async (argv: readonly string[]) => {
  const held = new InMemoryFileReaders({});
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp, testAuthoringApp }, COMMANDS).run(argv);
    return { code, held, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

/** Every header `cw kinds <kind>` named, read back off the answer the way an
 *  author reads it: one indented line per header, its name and its shape, and
 *  the values it may hold where the set is closed. */
const headersNamedIn = (answer: string) =>
  answer
    .split("\n")
    .flatMap((line) => {
      const named = /^ {2}(\S+)\s+(line|list)(?:, one of .+)?$/.exec(line);
      return named === null ? [] : [{ field: named[1]!, shape: named[2]! }];
    });

/** The frontmatter block of the sample the answer showed, as an author would
 *  copy it into a file. */
const sampleShownIn = (answer: string) => answer.slice(answer.indexOf("kind: ")).trim();

test("the set is exactly the kinds the charter format defines", () => {
  assert.deepEqual([...KINDS].sort(), [
    "agent",
    "command",
    "corpus",
    "guide",
    "mixin",
    "playbook",
    "posture",
    "sensor",
    "skill",
  ]);
});

test("isKind accepts only the closed set", () => {
  for (const kind of KINDS) assert.ok(isKind(kind));
  for (const other of ["concern", "guides", "", "Guide", 7, null, undefined]) {
    assert.equal(isKind(other), false, String(other));
  }
});

test("cw kinds <kind> names what that kind's contract requires, and no more (FR-001, FR-004)", async () => {
  for (const kind of KINDS) {
    const { code, results } = await asking(["kinds", kind]);

    assert.equal(code, EXIT_OK, kind);
    assert.deepEqual(
      headersNamedIn(results),
      primitiveHeadersOf(kind)
        .filter(({ required }) => required)
        .map(({ field, shape }) => ({ field, shape })),
      kind,
    );
  }
});

test("a header read from a closed set carries its values, and no other header does (FR-118)", async () => {
  for (const kind of KINDS)
    for (const { field, allowedValues } of primitiveHeadersOf(kind))
      assert.deepEqual(allowedValues, kind === "sensor" && field === "signal" ? SIGNALS : undefined, `${kind} ${field}`);

  const { results } = await asking(["kinds", "sensor"]);
  assert.match(results, new RegExp(`signal\\s+line, one of ${SIGNALS.join(", ")}\n`));
});

test("the sample it shows is a primitive of that kind, as an author writes one (FR-001)", async () => {
  for (const kind of KINDS) {
    const { results } = await asking(["kinds", kind]);
    const read = primitiveOf(["---", sampleShownIn(results), "---", "", "What it has to say."].join("\n"), new YamlParser());

    assert.equal(read.kind, kind);
  }
});

test("the headers it names are the ones cw add takes, one flag apiece (FR-004, spec Story 2 scenario 4)", async () => {
  for (const kind of KINDS) {
    const { results } = await asking(["kinds", kind]);
    const flags = headersNamedIn(results).flatMap(({ field }) => [
      "--header",
      `${field}=${field === "signal" ? "SessionStart" : `what ${field} holds`}`,
    ]);
    const { code, held: files, problems } = await asking(["add", kind, "something", ...flags]);

    assert.equal(code, EXIT_OK, `${kind}: ${problems}`);
    assert.notEqual(await files.readIfThere(new URL(`.cw/charter/${kind}/something.md`, repoPath)), undefined, kind);
  }
});

test("cw kinds with no kind answers as it does today: one line per kind (FR-002)", async () => {
  const { code, results } = await asking(["kinds"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(
    results.trim().split("\n").map((line) => line.split("  ")[0]),
    [...KINDS],
  );
});

test("a word that is no kind is answered with every kind there is (FR-003)", async () => {
  const { code, problems } = await asking(["kinds", "rule"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(problems, /"rule" is not a kind/);
  for (const kind of KINDS) assert.match(problems, new RegExp(kind));
});

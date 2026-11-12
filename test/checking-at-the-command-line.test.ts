import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  type OptionSpec,
  type Options,
  type Outcome,
} from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";

/** Whose home the command line runs in: what is installed on this machine is
 *  detected under it, and nothing here asks. */
const root = new URL("file:///repo/.cw/charter/primitive/");

/** One authored file, holding what the kind of the directory it lands in
 *  requires. */
const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", "Body.", ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) =>
  primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** A test file naming one guide, so no warning says nothing pins it down
 *  (FR-014). */
const pinningDown = (id: string) => ({
  [`file:///repo/.cw/charter/test/${id.replace("/", "-")}.json`]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: id } }],
  }),
});

/** The four applications the command line is driven through, over files held
 *  in memory. Given a writing port like the real ones are, and validating never
 *  reaches for it — which is the point of the split (FR-041). */
const applicationsOver = (files: InMemoryFileReaders) => ({
  charterAuthoringApp: authoringCharterOf(files, new InMemoryFileOutput(files), new InMemoryReporter()),
  charterRuntimeApp: buildingCharterOf(
    files,
    new InMemoryFileOutput(files),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  ),
});

/** A charter nothing asks about: what a command that never validates is given,
 *  since a context always carries every use case. */
const unread = applicationsOver(new InMemoryFileReaders({}));

/** Everything one run wrote, kept apart the way a pipeline reads it: results
 *  from stdout, problems from stderr. The command line writes to the process it
 *  runs in, so a test that wants to read what a user reads listens there. */
class Written {
  readonly results: string[] = [];
  readonly problems: string[] = [];

  get everything(): string {
    return [...this.results, ...this.problems].join("");
  }
}

/** Run something with both streams held, and give back what it wrote. */
const writing = async (work: () => Promise<number>): Promise<{ code: number; written: Written }> => {
  const written = new Written();
  const streams = [
    { stream: process.stdout, kept: process.stdout.write, into: written.results },
    { stream: process.stderr, kept: process.stderr.write, into: written.problems },
  ];
  for (const { stream, into } of streams) {
    stream.write = ((text: string | Uint8Array) => {
      into.push(String(text));
      return true;
    }) as typeof stream.write;
  }
  try {
    return { code: await work(), written };
  } finally {
    for (const { stream, kept } of streams) stream.write = kept;
  }
};

/** The command line as a user meets it, over a charter held in memory: the real
 *  command, the real service behind it, and the files it reads bound to a
 *  test's own adapter. `cw doctor` is what reads a charter and says what is
 *  wrong with it — there is no second command saying the same thing. */
const run = async (files: Readonly<Record<string, string>>, argv: readonly string[] = ["doctor"]) => {
  const heldFiles = new InMemoryFileReaders(files);
  const cli = new Commander(
    commandLineOf(heldFiles, new InMemoryFileOutput(heldFiles), applicationsOver(heldFiles), repo),
    COMMANDS,
  );
  return writing(() => cli.runCommandLine(argv));
};

test("a charter with nothing wrong passes, and says so", async () => {
  const { written } = await run({
    [new URL("guide/no-any/index.md", root).href]: guide("no-any", ['mixins: ["ts-defaults"]']),
    [new URL("mixin/ts-defaults/index.md", root).href]: primitive("mixin", "ts-defaults"),
    ...pinningDown("no-any"),
  });

  // Whether this repository is built is a question of its own, and not this
  // one: what a charter with nothing wrong answers is that it holds.
  assert.deepEqual(written.problems, []);
  assert.match(written.everything, /Charter: {2}good\./);
});

test("a file that is no primitive at all is named, with the problem and the next move", async () => {
  const { code, written } = await run({
    [new URL("skill/refactoring/index.md", root).href]: primitive("skill", "refactoring"),
  });

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /skill\/refactoring\/index\.md/);
  assert.match(written.everything, /triggers/);
});

test("what is wrong is part of the report, not the command going wrong", async () => {
  const { written } = await run({
    [new URL("skill/refactoring/index.md", root).href]: primitive("skill", "refactoring"),
  });

  // The command ran and this is what it found, so all of it is the result: a
  // pipeline reads the report on one stream and gates on the exit status.
  assert.deepEqual(written.problems, []);
  assert.match(written.everything, /triggers/);
});

test("a file is named as the user would type it, under the repository they ran in", async () => {
  const { written } = await run({
    [new URL("guide/no-any/index.md", root).href]: guide("no-any", ['mixins: ["absent"]']),
  });

  assert.match(written.everything, /^\.cw\/charter\/primitive\/guide\/no-any\/index\.md$/m);
});

test("what is wrong with the charter as a whole fails the run too", async () => {
  const { code, written } = await run({
    [new URL("guide/no-any/index.md", root).href]: guide("no-any"),
    [new URL("file:///repo/.cw/charter/vendor/acme/charter/root/primitive/guide/no-any/index.md").href]:
      guide("no-any"),
  });

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /already declared/);
});

test("every bad file is named in one run, not the first one found", async () => {
  const { written } = await run({
    [new URL("guide/no-any/index.md", root).href]: guide("no-any"),
    [new URL("guide/copied/index.md", root).href]: guide("no-any"),
    [new URL("guide/other/index.md", root).href]: guide("other", ['mixins: ["absent"]']),
  });

  assert.match(written.everything, /guide\/copied\/index\.md/);
  assert.match(written.everything, /guide\/other\/index\.md/);
});

test("a warning is said and lets the run through", async () => {
  const { written } = await run({
    [new URL("guide/no-any/index.md", root).href]: guide("no-any", ["rationale: absent"]),
    ...pinningDown("no-any"),
  });

  // Said, and the charter still holds: a warning is worth saying and not worth
  // stopping on.
  assert.match(written.everything, /good, with 1 warning/);
  assert.match(written.everything, /warn: .*absent/);
});

test("a flag the command never declared is a usage error, not a fault of the charter's", async () => {
  const { code } = await run({}, ["doctor", "--fix"]);

  assert.equal(code, EXIT_USAGE);
});

/** What one command declares it takes. Written here rather than in `src`
 *  because nothing the engine offers takes an argument yet: what is under test
 *  is that a command which does gets it back typed. */
const COUNTED = {
  times: { type: "number", describe: "How many", default: 1 },
} as const satisfies OptionSpec;

type Count = typeof COUNTED;

class CountingCommand implements Command<Count> {
  readonly name = "count";
  readonly summary = "Say a number back";
  readonly options = COUNTED;

  runCommand(_context: Context, options: Options<Count>): Outcome {
    // A number, and the compiler knows it: no cast, no field of unknown, and
    // no parser named anywhere in this file.
    return { exitCode: EXIT_OK, resultText: `${options.times + 1}\n` };
  }
}

test("a command reads the options it declared, under the types it declared", async () => {
  const cli = new Commander(
    commandLineOf(new InMemoryFileReaders({}), new InMemoryFileOutput(new InMemoryFileReaders({})), unread, repo),
    [new CountingCommand()],
  );

  const { code, written } = await writing(() => cli.runCommandLine(["count", "--times", "3"]));

  assert.equal(code, EXIT_OK);
  assert.deepEqual(written.results, ["4\n"]);
});

test("an option a command declared a default for arrives without being typed", async () => {
  const cli = new Commander(
    commandLineOf(new InMemoryFileReaders({}), new InMemoryFileOutput(new InMemoryFileReaders({})), unread, repo),
    [new CountingCommand()],
  );

  const { written } = await writing(() => cli.runCommandLine(["count"]));

  assert.deepEqual(written.results, ["2\n"]);
});

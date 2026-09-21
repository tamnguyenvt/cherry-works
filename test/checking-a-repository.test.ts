import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const repo = "/repo";
const root = new URL("file:///repo/.cw/charter/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", body, ""].join("\n");

const guide = (id: string, body?: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]'], body);

const compilingFor = (...agents: readonly string[]) => ({
  [inRepo(".cw/settings.json")]: `${JSON.stringify({ agents }, undefined, 2)}\n`,
});

/** Everything one run wrote, kept apart the way a pipeline reads it. */
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

/** The command line over one repository held in memory, with the version
 *  control a test answers for: doctor asks all four questions of the same
 *  repository a build writes into, which is what makes the staleness it reports
 *  the build's own answer. */
const commandLine = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS();
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), vcs);
  const cli = new Commander({ cwd: repo, charterAuthoringApp, charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), vcs) }, COMMANDS);
  return { held, vcs, run: (argv: readonly string[]) => writing(() => cli.run(argv)) };
};

test("a repository with nothing wrong passes, and says so of each thing it looked at (FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await run(["build"]);

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Agents: {3}claude\./);
  assert.match(written.everything, /Charter: {2}holds\./);
  assert.match(written.everything, /Vendors: {2}none edited here\./);
  assert.match(written.everything, /Built: {4}up to date\./);
  assert.match(written.everything, /Nothing to fix\./);
});

test("a repository that has never been built is out of date, and fails (FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Built: {4}6 files out of date\. Run "cw build"\./);
});

test("staleness is the preview run, not a record kept of the last build (FR-040)", async () => {
  const { held, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await run(["build"]);
  held.write(new URL("guide/no-any.md", root), guide("no-any", "Never write `any`."));

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Built: {4}1 file out of date/);
});

test("a charter with an error is counted, and read where every fault is (FR-040, SC-003)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Charter: {2}1 error\./);
  // Counted above, and written out below: the file that has to change, and what
  // is wrong with it (FR-009, SC-003).
  assert.match(written.everything, /\.cw\/charter\/guide\/no-any\.md/);
  assert.match(written.everything, /error: This pulls in the mixin "nowhere"/);
  // A charter that does not hold previews nothing, so what is built cannot be
  // answered.
  assert.match(written.everything, /Built: {4}not known, since the charter does not hold\./);
  assert.match(written.everything, /2 things to fix\./);
});

test("what validating finds reaches a driver as its DTO: counted, and every fault named from the repository (FR-009, FR-040)", async () => {
  const held = new InMemoryFileReaders({
    ...compilingFor("claude"),
    [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS());

  // Sent and read back, the way the portal's page will read it.
  const doctorOutcomeDTO = OutcomeDTOs.DoctorOutcome.parse(JSON.parse(JSON.stringify(await charterAuthoringApp.doctor())));
  const { errorCount, warnCount, pendingCount, faultsByFile } = doctorOutcomeDTO.data;

  assert.equal(doctorOutcomeDTO.type, "DoctorOutcome");
  // The charter does not hold, and so what is built cannot be known either.
  assert.equal(doctorOutcomeDTO.data.problemCount, 2);
  // One error, no warning, and nothing previewed: a charter that does not hold
  // has no build to count what it would still change.
  assert.deepEqual([errorCount, warnCount, pendingCount], [1, 0, null]);
  assert.deepEqual(Object.keys(faultsByFile.data.files), [".cw/charter/guide/no-any.md"]);
  assert.ok(faultsByFile.data.files[".cw/charter/guide/no-any.md"]?.some(({ data: { message } }) => /This pulls in the mixin "nowhere"/.test(message)));
});

test("a vendored file edited here is named by its vendor, once (FR-040, SC-008)", async () => {
  const { vcs, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await run(["build"]);
  vcs.changed.push(".cw/vendor/house-rules/guide/no-any.md", ".cw/vendor/house-rules/command/ship.md");

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Vendors: {2}edited here: house-rules\./);
});

test("work in hand outside the vendor folder is no business of doctor's (FR-040)", async () => {
  const { vcs, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });
  await run(["build"]);
  vcs.changed.push("src/main.ts", ".cw/charter/guide/no-any.md");

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Vendors: {2}none edited here\./);
});

test("a repository compiling for no agent is told what that means, and passes (FR-019, FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor(), [at("guide/no-any.md")]: guide("no-any") });
  await run(["build"]);

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Agents: {3}none chosen/);
});

test("what doctor reports is a result, never a problem", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any.md")]: guide("no-any") });

  const { written } = await run(["doctor"]);

  // Nothing here went wrong: the report is what was asked for, and the exit
  // status is what a pipeline gates on.
  assert.deepEqual(written.problems, []);
});

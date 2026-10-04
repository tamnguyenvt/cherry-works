import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { OutcomeDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noPlacesReached } from "./no-places.js";
import { noSessionsKept } from "./no-sessions.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repo = "/repo";
const root = new URL("file:///repo/.cw/charter/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", body, ""].join("\n");

const guide = (id: string, body?: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]'], body);

/** A test file naming one guide, so no warning says nothing pins it down
 *  (FR-014). */
const pinningDown = (id: string) => ({
  [inRepo(`.cw/test/${id.replace("/", "-")}.json`)]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: id } }],
  }),
});

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
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const cli = new Commander(
    {
      cwd: repo,
      version: "1.2.3",
      charterAuthoringApp,
      charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), held, vcs),
      testAuthoringApp: new TestAuthoring(new URL(`file://${repo}/`), held, new InMemoryFileOutput(held)),
      mcpConnectingApp: noPlacesReached, sessionReviewingApp: noSessionsKept,
    },
    COMMANDS,
  );
  return { held, vcs, run: (argv: readonly string[]) => writing(() => cli.run(argv)) };
};

test("a repository with nothing wrong passes, and says so of each thing it looked at (FR-040)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    ...pinningDown("no-any"),
  });
  await run(["build"]);

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Agents: {3}claude\./);
  assert.match(written.everything, /Charter: {2}holds\./);
  assert.match(written.everything, /Vendors: {2}none edited here\./);
  assert.match(written.everything, /Built: {4}up to date\./);
  assert.match(written.everything, /Nothing to fix\./);
});

test("the report starts with the version of cw that wrote it (FR-132)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { written } = await run(["doctor"]);

  assert.match(written.results.join(""), /^cw 1\.2\.3\n/);
});

test("a repository that has never been built is out of date, and fails (FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Built: {4}13 files out of date\. Run "cw build"\./);
});

test("staleness is the preview run, not a record kept of the last build (FR-040)", async () => {
  const { held, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);
  held.write(new URL("guide/no-any/index.md", root), guide("no-any", "Never write `any`."));

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Built: {4}1 file out of date/);
});

test("a charter with an error is counted, and read where every fault is (FR-040, SC-003)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Charter: {2}1 error\./);
  // Counted above, and written out below: the file that has to change, and what
  // is wrong with it (FR-009, SC-003).
  assert.match(written.everything, /\.cw\/charter\/guide\/no-any\/index\.md/);
  assert.match(written.everything, /error: This pulls in the mixin "nowhere"/);
  // A charter that does not hold previews nothing, so what is built cannot be
  // answered.
  assert.match(written.everything, /Built: {4}not known, since the charter does not hold\./);
  assert.match(written.everything, /2 things to fix\./);
});

test("what validating finds reaches a driver as its DTO: counted, and every fault named from the repository (FR-009, FR-040)", async () => {
  const held = new InMemoryFileReaders({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });

  // Sent and read back, the way the portal's page will read it.
  const doctorOutcomeDTO = OutcomeDTOs.DoctorOutcome.parse(JSON.parse(JSON.stringify(await charterAuthoringApp.doctor())));
  const { errorCount, warnCount, pendingCount, faultsByFile } = doctorOutcomeDTO.data;

  assert.equal(doctorOutcomeDTO.type, "DoctorOutcome");
  // The charter does not hold, and so what is built cannot be known either.
  assert.equal(doctorOutcomeDTO.data.problemCount, 2);
  // One error, no warning, and nothing previewed: a charter that does not hold
  // has no build to count what it would still change.
  assert.deepEqual([errorCount, warnCount, pendingCount], [1, 0, null]);
  assert.deepEqual(Object.keys(faultsByFile.data.files), [".cw/charter/guide/no-any/index.md"]);
  assert.ok(faultsByFile.data.files[".cw/charter/guide/no-any/index.md"]?.some(({ data: { message } }) => /This pulls in the mixin "nowhere"/.test(message)));
});

test("a vendored file edited here is named by its vendor, once (FR-040, SC-008)", async () => {
  const { vcs, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);
  vcs.changed.push(".cw/vendor/house-rules/guide/no-any/index.md", ".cw/vendor/house-rules/agent/ship/index.md");

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /Vendors: {2}edited here: house-rules\./);
});

test("work in hand outside the vendor folder is no business of doctor's (FR-040)", async () => {
  const { vcs, run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);
  vcs.changed.push("src/main.ts", ".cw/charter/guide/no-any/index.md");

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Vendors: {2}none edited here\./);
});

test("a repository compiling for no agent is told what that means, and passes (FR-019, FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor(), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Agents: {3}none chosen/);
});

test("what doctor reports is a result, never a problem", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { written } = await run(["doctor"]);

  // Nothing here went wrong: the report is what was asked for, and the exit
  // status is what a pipeline gates on.
  assert.deepEqual(written.problems, []);
});

/** What `doctor()` answers over these files, read back as the portal reads it. */
const doctorOf = async (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders({ ...compilingFor("claude"), ...files });
  const charterAuthoringApp = new CharterAuthoring(new URL(`file://${repo}/`), held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  return OutcomeDTOs.DoctorOutcome.parse(JSON.parse(JSON.stringify(await charterAuthoringApp.doctor()))).data;
};

const messagesUnder = (faultsByFile: OutcomeDTOs.DoctorOutcome["data"]["faultsByFile"], file: string) =>
  (faultsByFile.data.files[file] ?? []).map(({ data: { severity, message } }) => `${severity}: ${message}`);

test("a guide and a sensor no test case names are each a warning under their own file, and a posture is none (FR-014)", async () => {
  const { errorCount, warnCount, faultsByFile } = await doctorOf({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("sensor/lint/index.md")]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
    [at("posture/no-env/index.md")]: primitive("posture", "no-env", ['allow: ["src/**"]', 'deny: [".env"]']),
  });

  assert.deepEqual([errorCount, warnCount], [0, 2]);
  assert.deepEqual(Object.keys(faultsByFile.data.files).sort(), [".cw/charter/guide/no-any/index.md", ".cw/charter/sensor/lint/index.md"]);
  assert.match(messagesUnder(faultsByFile, ".cw/charter/guide/no-any/index.md").join(), /warn: No test case names "no-any"/);
  assert.match(messagesUnder(faultsByFile, ".cw/charter/sensor/lint/index.md").join(), /warn: No test case names "lint"/);
});

test("a guide and a sensor a test case names raise no warning (FR-014)", async () => {
  const { warnCount } = await doctorOf({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("sensor/lint/index.md")]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
    ...pinningDown("no-any"),
    [inRepo(".cw/test/lint.json")]: JSON.stringify({ cases: [{ when: "PostToolUse", expect: { run: "lint" } }] }),
  });

  assert.equal(warnCount, 0);
});

test("a guide naming no files is a rule like any other, so a test case is asked for it too (FR-014)", async () => {
  const { warnCount, faultsByFile } = await doctorOf({ [at("guide/plain-words/index.md")]: primitive("guide", "plain-words") });

  assert.equal(warnCount, 1);
  assert.match(messagesUnder(faultsByFile, ".cw/charter/guide/plain-words/index.md").join("\n"), /No test case names "plain-words"/);
});

test("a vendor's warnings are left out, since it is tested in its own repository, and the repository's own are kept (FR-014)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [inRepo(".cw/vendor/team/guide/no-class/index.md")]: guide("no-class"),
  });

  const { written } = await run(["doctor"]);

  assert.match(written.everything, /Charter: {2}holds, with 1 warning\./);
  assert.match(written.everything, /\.cw\/charter\/guide\/no-any\/index\.md/);
  assert.doesNotMatch(written.everything, /\.cw\/vendor\/team/);
});

test("a vendor's error is still said, since it stops the build (FR-014)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [inRepo(".cw/vendor/team/guide/no-class/index.md")]: primitive("guide", "no-class", ['globs: ["src/**/*.ts"]', "rationale: absent"]),
    [inRepo(".cw/vendor/team/guide/broken/index.md")]: "---\nkind: guide\n---\n",
  });

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(written.everything, /\.cw\/vendor\/team\/guide\/broken\/index\.md/);
  assert.doesNotMatch(written.everything, /No test case names "no-class"/);
});

test("a guide warned about twice keeps both warnings under its file", async () => {
  const { warnCount, faultsByFile } = await doctorOf({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: absent"]),
  });

  assert.equal(warnCount, 2);
  const messages = messagesUnder(faultsByFile, ".cw/charter/guide/no-any/index.md").join("\n");
  assert.match(messages, /absent/);
  assert.match(messages, /No test case names "no-any"/);
});

test("a test file that does not read raises no warning of its own; cw test names it", async () => {
  const { faultsByFile } = await doctorOf({ [at("guide/no-any/index.md")]: guide("no-any"), [inRepo(".cw/test/broken.json")]: "not json" });

  assert.deepEqual(Object.keys(faultsByFile.data.files), [".cw/charter/guide/no-any/index.md"]);
});

test("warnings alone let the build through, and doctor passes once it is built (FR-014)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("corpus/why/index.md")]: primitive("corpus", "why"),
    [at("mixin/ts/index.md")]: primitive("mixin", "ts"),
  });
  assert.equal((await run(["build"])).code, EXIT_OK);

  const { code, written } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(written.everything, /Charter: {2}holds, with 3 warnings\./);
});

test("an mcp no primitive names is a warning in doctor, and stops nothing (FR-144)", async () => {
  const { errorCount, warnCount, faultsByFile } = await doctorOf({
    ...pinningDown("no-any"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("mcp/mfbs/billing/index.md")]: primitive("mcp", "mfbs/billing", ["endpoint: https://mcp.example.com/", "auth: [oauth]", "tools: [search_code]"]),
  });

  assert.deepEqual([errorCount, warnCount], [0, 1]);
  assert.match(messagesUnder(faultsByFile, ".cw/charter/mcp/mfbs/billing/index.md").join(), /warn: No primitive names "mfbs\/billing" in its body/);
});

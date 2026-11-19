import assert from "node:assert/strict";
import { test } from "node:test";
import { CharterDTOs } from "../src/module/charter/app/port/in/charter.dto.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
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
const root = new URL("file:///repo/.cw/charter/team/primitive/");
const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], body = `The body of ${id}.`) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", body, ""].join("\n");

const guide = (id: string, body?: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]'], body);

/** A test file naming one guide, so no warning says nothing pins it down
 *  (FR-014). */
const pinningDown = (id: string) => ({
  [inRepo(`.cw/charter/team/test/${id.replace("/", "-")}.json`)]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: id } }],
  }),
});

/** The record that makes `.cw/charter/rules/primitive/` a charter installed
 *  from a vendor's source (VENDOR Story 3 scenario 2). */
const installedFromTeamRules = {
  [inRepo(".cw/charter/rules/cw-vendor.json")]: `${JSON.stringify({
    charter: "rules",
    source: "team/rules",
    version: "HEAD",
  })}\n`,
};

const compilingFor = (...agents: readonly string[]) => ({
  [inRepo(".cw/settings.json")]: `${JSON.stringify({ agents }, undefined, 2)}\n`,
});

/** Everything one run wrote, kept apart the way a pipeline reads it. */
class PrintedOutput {
  readonly results: string[] = [];
  readonly problems: string[] = [];

  get everything(): string {
    return [...this.results, ...this.problems].join("");
  }
}

/** Run something with both streams held, and give back what it wrote. */
const printedOutputOf = async (
  work: () => Promise<number>,
): Promise<{ code: number; printedOutput: PrintedOutput }> => {
  const printedOutput = new PrintedOutput();
  const streams = [
    { stream: process.stdout, kept: process.stdout.write, into: printedOutput.results },
    { stream: process.stderr, kept: process.stderr.write, into: printedOutput.problems },
  ];
  for (const { stream, into } of streams) {
    stream.write = ((text: string | Uint8Array) => {
      into.push(String(text));
      return true;
    }) as typeof stream.write;
  }
  try {
    return { code: await work(), printedOutput };
  } finally {
    for (const { stream, kept } of streams) stream.write = kept;
  }
};

/** The command line over one repository held in memory, with the version
 *  control a test answers for: doctor asks all three questions of the same
 *  repository a build writes into, which is what makes the staleness it reports
 *  the build's own answer. */
const commandLine = (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const cli = new Commander(
    commandLineOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      {
        charterAuthoringApp: authoringCharterOf(
          fileReaders,
          new InMemoryFileOutput(fileReaders),
          new InMemoryReporter(),
          { sourceFetcher },
        ),
        charterRuntimeApp: buildingCharterOf(
          fileReaders,
          new InMemoryFileOutput(fileReaders),
          new InMemoryTokenCounter(),
          { claude: new InMemoryAgentCli() },
          new InMemoryReporter(),
        ),
      },
      repo,
      "1.2.3",
    ),
    COMMANDS,
  );
  return {
    fileReaders,
    sourceFetcher,
    run: (argv: readonly string[]) => printedOutputOf(() => cli.runCommandLine(argv)),
  };
};

test("a repository with nothing wrong passes, and says so of each thing it looked at (FR-040, CORE Story 3 scenario 5)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    ...pinningDown("no-any"),
  });
  await run(["build"]);

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(printedOutput.everything, /Agents: {3}claude\./);
  assert.match(printedOutput.everything, /✔ Charter: {2}good\./);
  assert.match(printedOutput.everything, /✔ Built: {4}up to date\./);
  assert.match(printedOutput.everything, /Nothing to fix\./);
});

test("the report starts with the version of cw that wrote it (FR-132, CORE Story 14 scenario 4)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { printedOutput } = await run(["doctor"]);

  assert.match(printedOutput.results.join(""), /^cw 1\.2\.3\n/);
});

test("a repository that has never been built is out of date, and fails (FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(printedOutput.everything, /⚠ Built: {4}15 files out of date\. Run "cw build"\./);
});

test("staleness is the preview run, not a record kept of the last build (FR-040, CORE Story 3 scenario 5)", async () => {
  const { fileReaders, run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
  });
  await run(["build"]);
  fileReaders.writeFile(new URL("guide/no-any/index.md", root), guide("no-any", "Never write `any`."));

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(printedOutput.everything, /Built: {4}1 file out of date/);
});

test("a charter with an error is counted, and read where every fault is (FR-040, SC-003)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(printedOutput.everything, /✘ Charter: {2}1 error\./);
  // Counted above, and written out below: the file that has to change, and what
  // is wrong with it (FR-009, SC-003).
  assert.match(printedOutput.everything, /\.cw\/charter\/team\/primitive\/guide\/no-any\/index\.md/);
  assert.match(printedOutput.everything, /^ {2}✘ error: {2}This pulls in the mixin "nowhere"/m);
  // A charter that does not hold previews nothing, so what is built cannot be
  // answered.
  assert.match(printedOutput.everything, /Built: {4}Fix the charter's errors, then run "cw build"\./);
  assert.match(printedOutput.everything, /^✘ 2 things to fix\./m);
});

test("what validating finds reaches a driver as its DTO: counted, and every fault named from the repository (FR-009, FR-040)", async () => {
  const fileReaders = new InMemoryFileReaders({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
  });
  const charterRuntimeApps = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );

  // Sent and read back, the way the portal's page will read it.
  const doctorOutcomeDTO = CharterDTOs.DoctorOutcome.parse(
    JSON.parse(JSON.stringify(await charterRuntimeApps.diagnoseCharter())),
  );
  const { errorCount, warnCount, pendingCount, faultsByFile } = doctorOutcomeDTO.data;

  assert.equal(doctorOutcomeDTO.type, "DoctorOutcome");
  // The charter does not hold, and so what is built cannot be known either.
  assert.equal(doctorOutcomeDTO.data.problemCount, 2);
  // One error, no warning, and nothing previewed: a charter that does not hold
  // has no build to count what it would still change.
  assert.deepEqual([errorCount, warnCount, pendingCount], [1, 0, null]);
  assert.deepEqual(Object.keys(faultsByFile.data.files), [
    "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md",
  ]);
  assert.ok(
    faultsByFile.data.files["file:///repo/.cw/charter/team/primitive/guide/no-any/index.md"]?.some(
      ({ data: { message } }) => /This pulls in the mixin "nowhere"/.test(message),
    ),
  );
});

test("a repository that chose no agent is told what that means, and passes (FR-019, FR-040)", async () => {
  const { run } = commandLine({ ...compilingFor(), [at("guide/no-any/index.md")]: guide("no-any") });
  await run(["build"]);

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(printedOutput.everything, /Agents: {3}none chosen/);
});

test("what doctor reports is a result, never a problem", async () => {
  const { run } = commandLine({ ...compilingFor("claude"), [at("guide/no-any/index.md")]: guide("no-any") });

  const { printedOutput } = await run(["doctor"]);

  // Nothing here went wrong: the report is what was asked for, and the exit
  // status is what a pipeline gates on.
  assert.deepEqual(printedOutput.problems, []);
});

/** What `diagnoseCharter()` answers over these files, read back as the portal reads it. */
const doctorOf = async (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders({ ...compilingFor("claude"), ...files });
  const charterRuntimeApps = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  return CharterDTOs.DoctorOutcome.parse(JSON.parse(JSON.stringify(await charterRuntimeApps.diagnoseCharter()))).data;
};

const messagesUnder = (faultsByFile: CharterDTOs.DoctorOutcome["data"]["faultsByFile"], file: string) =>
  (faultsByFile.data.files[file] ?? []).map(({ data: { severity, message } }) => `${severity}: ${message}`);

test("a guide and a sensor no test case names are each a warning under their own file, and a posture is none (FR-014, CORE Story 7 scenario 5)", async () => {
  const { errorCount, warnCount, faultsByFile } = await doctorOf({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("sensor/lint/index.md")]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
    [at("posture/no-env/index.md")]: primitive("posture", "no-env", ['allow: ["src/**"]', 'deny: [".env"]']),
  });

  assert.deepEqual([errorCount, warnCount], [0, 2]);
  assert.deepEqual(Object.keys(faultsByFile.data.files).sort(), [
    "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md",
    "file:///repo/.cw/charter/team/primitive/sensor/lint/index.md",
  ]);
  assert.match(
    messagesUnder(faultsByFile, "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md").join(),
    /warn: No test case names "no-any"/,
  );
  assert.match(
    messagesUnder(faultsByFile, "file:///repo/.cw/charter/team/primitive/sensor/lint/index.md").join(),
    /warn: No test case names "lint"/,
  );
});

test("a guide and a sensor a test case names raise no warning (FR-014)", async () => {
  const { warnCount } = await doctorOf({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("sensor/lint/index.md")]: primitive("sensor", "lint", ["signal: PostToolUse", "run: pnpm lint"]),
    ...pinningDown("no-any"),
    [inRepo(".cw/charter/team/test/lint.json")]: JSON.stringify({
      cases: [{ when: "PostToolUse", expect: { run: "lint" } }],
    }),
  });

  assert.equal(warnCount, 0);
});

test("a guide naming no files is a rule like any other, so a test case is asked for it too (FR-014)", async () => {
  const { warnCount, faultsByFile } = await doctorOf({
    [at("guide/plain-words/index.md")]: primitive("guide", "plain-words"),
  });

  assert.equal(warnCount, 1);
  assert.match(
    messagesUnder(faultsByFile, "file:///repo/.cw/charter/team/primitive/guide/plain-words/index.md").join("\n"),
    /No test case names "plain-words"/,
  );
});

test("a vendor's warnings are left out, since it is tested in its own repository, and the repository's own are kept (FR-014)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    ...installedFromTeamRules,
    [inRepo(".cw/charter/rules/primitive/guide/no-class/index.md")]: guide("no-class"),
  });

  const { printedOutput } = await run(["doctor"]);

  assert.match(printedOutput.everything, /⚠ Charter: {2}good, with 1 warning\./);
  assert.match(printedOutput.everything, /\.cw\/charter\/team\/primitive\/guide\/no-any\/index\.md/);
  assert.doesNotMatch(printedOutput.everything, /\.cw\/charter\/primitive\/rules/);
});

test("a vendor's error is still said, since it stops the build (FR-014)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    ...installedFromTeamRules,
    [inRepo(".cw/charter/rules/primitive/guide/no-class/index.md")]: primitive("guide", "no-class", [
      'globs: ["src/**/*.ts"]',
      "rationale: absent",
    ]),
    [inRepo(".cw/charter/rules/primitive/guide/broken/index.md")]: "---\nkind: guide\n---\n",
  });

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_FAILURE);
  assert.match(printedOutput.everything, /\.cw\/charter\/rules\/primitive\/guide\/broken\/index\.md/);
  assert.doesNotMatch(printedOutput.everything, /No test case names "no-class"/);
});

test("a guide warned about twice keeps both warnings under its file", async () => {
  const { warnCount, faultsByFile } = await doctorOf({
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: absent"]),
  });

  assert.equal(warnCount, 2);
  const messages = messagesUnder(faultsByFile, "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md").join(
    "\n",
  );
  assert.match(messages, /absent/);
  assert.match(messages, /No test case names "no-any"/);
});

test("a test file that does not read raises no warning of its own; cw test names it", async () => {
  const { faultsByFile } = await doctorOf({
    [at("guide/no-any/index.md")]: guide("no-any"),
    [inRepo(".cw/charter/team/test/broken.json")]: "not json",
  });

  assert.deepEqual(Object.keys(faultsByFile.data.files), [
    "file:///repo/.cw/charter/team/primitive/guide/no-any/index.md",
  ]);
});

test("warnings alone let the build through, and doctor passes once it is built (FR-014, CORE Story 7 scenario 5)", async () => {
  const { run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("corpus/why/index.md")]: primitive("corpus", "why"),
    [at("mixin/ts/index.md")]: primitive("mixin", "ts"),
  });
  assert.equal((await run(["build"])).code, EXIT_OK);

  const { code, printedOutput } = await run(["doctor"]);

  assert.equal(code, EXIT_OK);
  assert.match(printedOutput.everything, /⚠ Charter: {2}good, with 3 warnings\./);
});

test("an mcp no primitive names is a warning in doctor, and stops nothing (FR-144, CORE Story 17 scenario 4, CORE Story 55 scenario 8)", async () => {
  const charterFiles = {
    ...pinningDown("no-any"),
    [at("guide/no-any/index.md")]: guide("no-any"),
    [at("mcp/mfbs/billing/index.md")]: primitive("mcp", "mfbs/billing", [
      "endpoint: https://mcp.example.com/",
      "auth: [oauth]",
      "tools: [search_code]",
    ]),
  };
  const { errorCount, warnCount, faultsByFile } = await doctorOf(charterFiles);

  assert.deepEqual([errorCount, warnCount], [0, 1]);
  assert.match(
    messagesUnder(faultsByFile, "file:///repo/.cw/charter/team/primitive/mcp/mfbs/billing/index.md").join(),
    /warn: No primitive names "mfbs\/billing" in its body/,
  );
  // The build still runs over it, and builds the mcp's document.
  const { fileReaders, run } = commandLine({ ...compilingFor("claude"), ...charterFiles });
  const buildRun = await run(["build"]);
  assert.equal(buildRun.code, EXIT_OK, buildRun.printedOutput.everything);
  assert.notEqual(
    await fileReaders.readIfThere(new URL(".cw/out/mcp/mfbs/billing/index.md", "file:///repo/")),
    undefined,
  );
});

test("a primitive kept as <kind>/<id>.md, or in a folder its kind and id do not say, is an error saying where to move it, checked, built or listed, and nothing is built (CORE Story 23 scenario 5, FR-003, FR-141, FR-002, FR-012, CORE Story 55 scenario 8)", async () => {
  const { fileReaders, run } = commandLine({
    ...compilingFor("claude"),
    [at("guide/kept-guide.md")]: guide("kept-guide"),
    [at("guide/elsewhere/index.md")]: guide("house-style"),
  });

  const doctorRun = await run(["doctor"]);
  const buildRun = await run(["build"]);
  const listRun = await run(["list"]);

  assert.equal(doctorRun.code, EXIT_FAILURE);
  assert.match(doctorRun.printedOutput.everything, /guide\/kept-guide\.md/);
  assert.match(
    doctorRun.printedOutput.everything,
    /Move it to "[^"]*\.cw\/charter\/team\/primitive\/guide\/kept-guide\/index\.md"/,
  );
  assert.match(doctorRun.printedOutput.everything, /guide\/elsewhere\/index\.md/);
  assert.match(
    doctorRun.printedOutput.everything,
    /Move its folder to "[^"]*\.cw\/charter\/team\/primitive\/guide\/house-style\/"/,
  );
  assert.equal(buildRun.code, EXIT_FAILURE);
  assert.match(buildRun.printedOutput.everything, /Move it to "[^"]*guide\/kept-guide\/index\.md"/);
  assert.deepEqual(await fileReaders.readFilesRecursively(new URL("file:///repo/.cw/out/")), []);
  assert.equal(await fileReaders.readIfThere(new URL("file:///repo/CLAUDE.md")), undefined);
  assert.equal(listRun.code, EXIT_FAILURE);
  assert.match(listRun.printedOutput.everything, /cw doctor/);
});

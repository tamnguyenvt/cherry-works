import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { TestSuiteFactory } from "../src/module/charter/domain/models/test/test-suite.factory.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { SuiteAddCommand } from "../src/presentation/cli/commands/suite-add.command.js";
import { SuiteEditCommand } from "../src/presentation/cli/commands/suite-edit.command.js";
import { SuiteRemoveCommand } from "../src/presentation/cli/commands/suite-remove.command.js";
import { answerOf, faultOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, commandContextOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const guide = (id: string, globs: readonly string[]) =>
  [
    "---",
    "kind: guide",
    `id: ${id}`,
    `description: About ${id}.`,
    `globs: ${JSON.stringify(globs)}`,
    "---",
    "",
    "Body.",
    "",
  ].join("\n");

const settings = { [at(".cw/settings.json")]: `${JSON.stringify({ agents: [] })}\n` };

/** The repository's own charter, holding one guide and no test file: the one
 *  charter a test file named with no charter is written into (VENDOR-FR-009). */
const withTeamCharter = {
  ...settings,
  [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
};

const suiteText = (authoredSuite: unknown) => `${JSON.stringify(authoredSuite, undefined, 2)}\n`;

/** One suite putting all three shapes, and one file that does not read. */
const withTwoFiles = () => ({
  ...settings,
  [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
  [at(".cw/charter/team/test/shapes.json")]: suiteText({
    description: "All three shapes.",
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: ".env" }, expect: { allow: false } },
      { when: "Stop", expect: { run: "test" } },
    ],
  }),
  [at(".cw/charter/team/test/broken.json")]: "{ not json",
});

/** Both use cases over one repository held in memory — the test files, and
 *  the charter a run resolves them against — and a way to read back what is on
 *  disk. */
const authoring = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    held,
    new InMemoryFileOutput(held),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  return {
    charterAuthoringApp,
    charterRuntimeApps,
    fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)),
  };
};

const contextOver = ({ charterAuthoringApp, charterRuntimeApps }: ReturnType<typeof authoring>) =>
  commandContextOf({
    charterAuthoringApp,
    charterRuntimeApp: charterRuntimeApps,
  });

test("suites() lists each file with its name, text and cases said, and one that does not read with its fault (FR-124)", async () => {
  const files = withTwoFiles();
  const { charterAuthoringApp } = authoring(files);

  const { testSuites } = answerOf(await charterAuthoringApp.listTestSuites()).data;

  assert.deepEqual(
    testSuites.map(({ data: testSuite }) => testSuite.name),
    ["broken.json", "shapes.json"],
  );
  const [broken, shapes] = testSuites;
  assert.equal(broken?.data.text, undefined);
  assert.deepEqual(broken?.data.cases, []);
  assert.match(broken?.data.fault?.data.message ?? "", /not JSON/);

  assert.equal(shapes?.data.text, files[at(".cw/charter/team/test/shapes.json")]);
  assert.equal(shapes?.data.description, "All three shapes.");
  assert.equal(shapes?.data.fault, undefined);
  assert.deepEqual(
    shapes?.data.cases.map(({ data: testCase }) => testCase),
    [
      { situation: "touching src/one.ts", expectation: "activates no-any", id: "no-any" },
      { situation: "touching .env", expectation: "is denied" },
      { situation: "firing event Stop", expectation: "runs test", id: "test" },
    ],
  );
});

test("suites() is empty for a repository with no test folder (FR-124)", async () => {
  assert.deepEqual(answerOf(await authoring(settings).charterAuthoringApp.listTestSuites()).data.testSuites, []);
});

test("a run names the test file each case came from (FR-125)", async () => {
  const { charterAuthoringApp } = authoring({
    ...settings,
    [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
    [at(".cw/charter/team/test/one.json")]: suiteText({
      cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }],
    }),
    [at(".cw/charter/team/test/two.json")]: suiteText({
      cases: [{ do: { touchFile: "docs/a.md" }, expect: { activate: "no-any" } }],
    }),
  });

  const testRunReportDTO = answerOf(await charterAuthoringApp.testCharter());

  assert.equal(testRunReportDTO.type, "TestRunReport");
  if (testRunReportDTO.type !== "TestRunReport") return;
  assert.deepEqual(
    testRunReportDTO.data.testCaseReports.map(({ data: testCaseReport }) => [
      testCaseReport.suiteName,
      testCaseReport.passed,
    ]),
    [
      ["team/one.json", true],
      ["team/two.json", false],
    ],
  );
});

test("addTestSuite() writes untitled-1.json, then untitled-2.json, each one case that reads (FR-091)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTeamCharter);

  assert.equal(answerOf(await charterAuthoringApp.addTestSuite()).data.name, "untitled-1.json");
  assert.equal(answerOf(await charterAuthoringApp.addTestSuite()).data.name, "untitled-2.json");

  const untitledSuiteText = (await fileAt(".cw/charter/team/test/untitled-2.json")) ?? "";
  assert.equal(TestSuiteFactory.create(untitledSuiteText).cases.length, 1);
  assert.equal(await fileAt(".cw/charter/team/test/untitled-1.json"), untitledSuiteText);
});

test("with no charter named, a test file goes into the one charter the repository authored, and is refused naming the charters held where it authored none or more than one, nothing written (VENDOR Story 3 scenario 30, VENDOR-FR-009)", async () => {
  const { charterAuthoringApp: oneCharterApp, fileAt: oneCharterFileAt } = authoring(withTeamCharter);
  answerOf(await oneCharterApp.addTestSuite());
  assert.ok(await oneCharterFileAt(".cw/charter/team/test/untitled-1.json"));

  const { charterAuthoringApp: twoChartersApp, fileAt: twoChartersFileAt } = authoring({
    ...withTeamCharter,
    [at(".cw/charter/review/primitive/guide/no-mocks/index.md")]: guide("no-mocks", ["src/**/*.ts"]),
  });
  const twoChartersFault = faultOf(await twoChartersApp.addTestSuite());
  assert.equal(twoChartersFault.name, "UnnamedCharterFault");
  assert.match(twoChartersFault.message, /authored more than one/);
  assert.match(twoChartersFault.fix ?? "", /review, team|team, review/);
  assert.equal(await twoChartersFileAt(".cw/charter/team/test/untitled-1.json"), undefined);
  assert.equal(await twoChartersFileAt(".cw/charter/review/test/untitled-1.json"), undefined);

  const noCharterFault = faultOf(await authoring(settings).charterAuthoringApp.addTestSuite());
  assert.match(noCharterFault.message, /authored none/);

  // Opening and removing name the charter the same way, as cw suite edit and
  // cw suite remove do.
  answerOf(await oneCharterApp.openTestSuite("", "untitled-1.json"));
  answerOf(await oneCharterApp.removeTestSuite("", "untitled-1.json"));
  assert.equal(await oneCharterFileAt(".cw/charter/team/test/untitled-1.json"), undefined);
  for (const twoChartersFault of [
    faultOf(await twoChartersApp.openTestSuite("", "untitled-1.json")),
    faultOf(await twoChartersApp.removeTestSuite("", "untitled-1.json")),
  ]) {
    assert.equal(twoChartersFault.name, "UnnamedCharterFault");
    assert.match(twoChartersFault.message, /authored more than one/);
  }
});

test("addTestSuite() takes the first free number", async () => {
  const { charterAuthoringApp } = authoring({
    ...settings,
    [at(".cw/charter/team/test/untitled-1.json")]: "{}",
    [at(".cw/charter/team/test/untitled-3.json")]: "{}",
  });

  assert.equal(answerOf(await charterAuthoringApp.addTestSuite()).data.name, "untitled-2.json");
});

test("writeTestSuite() writes text that reads as a suite (FR-090)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  assert.equal(
    answerOf(await charterAuthoringApp.writeTestSuite("team", "broken.json", text)).data.name,
    "broken.json",
  );

  assert.equal(await fileAt(".cw/charter/team/test/broken.json"), text);
});

test("writeTestSuite() refuses text that is not JSON or not a suite, with the sample, and writes nothing (FR-090)", async () => {
  const files = withTwoFiles();
  const { charterAuthoringApp, fileAt } = authoring(files);

  assert.match(
    faultTextOf(await charterAuthoringApp.writeTestSuite("team", "shapes.json", "{ nope")),
    /not JSON[\s\S]*/,
  );
  const { message, fix } = faultOf(
    await charterAuthoringApp.writeTestSuite("team", "shapes.json", suiteText({ cases: [] })),
  );
  assert.match(message, /not written as a suite/);
  // The sample it is refused with reads as a suite itself.
  const sample = fix.replace(/^Write it as /, "");
  assert.equal(TestSuiteFactory.create(sample).cases.length, 3);

  assert.equal(await fileAt(".cw/charter/team/test/shapes.json"), files[at(".cw/charter/team/test/shapes.json")]);
});

test("writeTestSuite() and removeTestSuite() refuse a name that is no test file (FR-090, FR-092)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  assert.match(
    faultTextOf(await charterAuthoringApp.writeTestSuite("team", "missing.json", text)),
    /holds no test file called "missing.json"/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.writeTestSuite("team", "../guide/no-any/index.md", text)),
    /holds no test file/,
  );
  assert.match(
    faultTextOf(await charterAuthoringApp.removeTestSuite("team", "../guide/no-any/index.md")),
    /holds no test file/,
  );

  assert.equal(await fileAt(".cw/charter/team/test/missing.json"), undefined);
  assert.ok(await fileAt(".cw/charter/team/primitive/guide/no-any/index.md"));
});

test("removeTestSuite() deletes one test file, and nothing else (FR-092)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());

  assert.equal(answerOf(await charterAuthoringApp.removeTestSuite("team", "shapes.json")).data.name, "shapes.json");

  assert.equal(await fileAt(".cw/charter/team/test/shapes.json"), undefined);
  assert.ok(await fileAt(".cw/charter/team/test/broken.json"));
});

test("cw suite add, edit and remove are commands of the command line (FR-109)", () => {
  const names = COMMANDS.map((command) => command.name);
  for (const name of ["suite add", "suite edit <name>", "suite remove <name>"]) assert.ok(names.includes(name), name);
});

test("cw suite add writes a new test file and says how to edit it (FR-091)", async () => {
  const repoInMemory = authoring(withTeamCharter);
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteAddCommand().runCommand(contextOver(repoInMemory), { charter: undefined });

  assert.equal(outcome.exitCode, EXIT_OK);
  assert.match(
    stripVTControlCharacters(outcome.resultText ?? ""),
    /^✔ Wrote \.cw\/charter\/team\/test\/untitled-1\.json\.\nRun "cw suite edit untitled-1\.json --charter=team"/,
  );
  assert.ok(await fileAt(".cw/charter/team/test/untitled-1.json"));
});

test("cw suite remove deletes the test file named (FR-092)", async () => {
  const repoInMemory = authoring(withTwoFiles());
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteRemoveCommand().runCommand(contextOver(repoInMemory), {
    name: "shapes.json",
    charter: undefined,
  });

  assert.equal(stripVTControlCharacters(outcome.resultText ?? ""), "✔ Removed .cw/charter/team/test/shapes.json.\n");
  assert.equal(await fileAt(".cw/charter/team/test/shapes.json"), undefined);
});

test("cw suite edit refuses a name that is no test file, and with no editor set (FR-109)", async (t) => {
  const kept = { visual: process.env.VISUAL, editor: process.env.EDITOR };
  t.after(() => {
    process.env.VISUAL = kept.visual ?? "";
    process.env.EDITOR = kept.editor ?? "";
  });
  process.env.VISUAL = "";
  process.env.EDITOR = "";
  const context = contextOver(authoring(withTwoFiles()));

  assert.match(
    (await new SuiteEditCommand().runCommand(context, { name: "missing.json", charter: undefined })).problemText ?? "",
    /holds no test file called "missing.json"/,
  );
  assert.match(
    (await new SuiteEditCommand().runCommand(context, { name: "shapes.json", charter: undefined })).problemText ?? "",
    /Neither \$VISUAL nor \$EDITOR is set/,
  );
});

test("cw suite edit hands the test file to $VISUAL and writes nothing itself (FR-090, FR-109)", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cw-suite-edit-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const handedOver = join(scratch, "handed-over");
  const kept = { visual: process.env.VISUAL, editor: process.env.EDITOR };
  t.after(() => {
    process.env.VISUAL = kept.visual ?? "";
    process.env.EDITOR = kept.editor ?? "";
  });
  process.env.VISUAL = `node -e "require('node:fs').writeFileSync('${handedOver}', process.argv[1])"`;
  const files = withTwoFiles();
  const repoInMemory = authoring(files);
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteEditCommand().runCommand(contextOver(repoInMemory), {
    name: "shapes.json",
    charter: undefined,
  });

  assert.equal(outcome.exitCode, EXIT_OK);
  assert.equal(await readFile(handedOver, "utf8"), "/repo/.cw/charter/team/test/shapes.json");
  assert.equal(await fileAt(".cw/charter/team/test/shapes.json"), files[at(".cw/charter/team/test/shapes.json")]);
});

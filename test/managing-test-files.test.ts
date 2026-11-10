import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { SuiteAddCommand } from "../src/presentation/cli/commands/suite-add.command.js";
import { SuiteEditCommand } from "../src/presentation/cli/commands/suite-edit.command.js";
import { SuiteRemoveCommand } from "../src/presentation/cli/commands/suite-remove.command.js";
import { EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultTextOf, faultOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, testingCharterOf, commandContextOf } from "./use-cases-of.js";
import { TestSuiteFactory } from "../src/module/charter/domain/models/test/test-suite.factory.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const guide = (id: string, globs: readonly string[]) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, `globs: ${JSON.stringify(globs)}`, "---", "", "Body.", ""].join("\n");

const settings = { [at(".cw/settings.json")]: `${JSON.stringify({ agents: [] })}\n` };

const suiteText = (written: unknown) => `${JSON.stringify(written, undefined, 2)}\n`;

/** One suite putting all three shapes, and one file that does not read. */
const withTwoFiles = () => ({
  ...settings,
  [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
  [at(".cw/charter/test/shapes.json")]: suiteText({
    description: "All three shapes.",
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: ".env" }, expect: { allow: false } },
      { when: "Stop", expect: { run: "test" } },
    ],
  }),
  [at(".cw/charter/test/broken.json")]: "{ not json",
});

/** Both use cases over one repository held in memory — the test files, and
 *  the charter a run resolves them against — and a way to read back what is on
 *  disk. */
const authoring = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter());
  const charterRuntimeApp = buildingCharterOf(held, new InMemoryFileOutput(held), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }, new InMemoryReporter());
  return { charterAuthoringApp, charterRuntimeApp, fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)) };
};

const contextOver = ({ charterAuthoringApp, charterRuntimeApp }: ReturnType<typeof authoring>) => (commandContextOf({
  charterAuthoringApp,
  charterRuntimeApp,
  }));

test("suites() lists each file with its name, text and cases said, and one that does not read with its fault (FR-124)", async () => {
  const files = withTwoFiles();
  const { charterAuthoringApp } = authoring(files);

  const { testSuites } = answerOf(await charterAuthoringApp.suites()).data;

  assert.deepEqual(
    testSuites.map(({ data }) => data.name),
    ["broken.json", "shapes.json"],
  );
  const [broken, shapes] = testSuites;
  assert.equal(broken?.data.text, undefined);
  assert.deepEqual(broken?.data.cases, []);
  assert.match(broken?.data.fault?.data.message ?? "", /not JSON/);

  assert.equal(shapes?.data.text, files[at(".cw/charter/test/shapes.json")]);
  assert.equal(shapes?.data.description, "All three shapes.");
  assert.equal(shapes?.data.fault, undefined);
  assert.deepEqual(
    shapes?.data.cases.map(({ data }) => data),
    [
      { situation: "touching src/one.ts", expectation: "activates no-any", id: "no-any" },
      { situation: "touching .env", expectation: "is denied" },
      { situation: "firing event Stop", expectation: "runs test", id: "test" },
    ],
  );
});

test("suites() is empty for a repository with no test folder (FR-124)", async () => {
  assert.deepEqual(answerOf(await authoring(settings).charterAuthoringApp.suites()).data.testSuites, []);
});

test("a run names the test file each case came from (FR-125)", async () => {
  const { charterAuthoringApp } = authoring({
    ...settings,
    [at(".cw/charter/primitive/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
    [at(".cw/charter/test/one.json")]: suiteText({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }] }),
    [at(".cw/charter/test/two.json")]: suiteText({ cases: [{ do: { touchFile: "docs/a.md" }, expect: { activate: "no-any" } }] }),
  });

  const testRunReportDTO = answerOf(await charterAuthoringApp.test());

  assert.equal(testRunReportDTO.type, "TestRunReport");
  if (testRunReportDTO.type !== "TestRunReport") return;
  assert.deepEqual(
    testRunReportDTO.data.testCaseReports.map(({ data }) => [data.suiteName, data.passed]),
    [
      ["one.json", true],
      ["two.json", false],
    ],
  );
});

test("addSuite() writes untitled-1.json, then untitled-2.json, each one case that reads (FR-091)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(settings);

  assert.equal(answerOf(await charterAuthoringApp.addSuite()).data.name, "untitled-1.json");
  assert.equal(answerOf(await charterAuthoringApp.addSuite()).data.name, "untitled-2.json");

  const untitledSuiteText = (await fileAt(".cw/charter/test/untitled-2.json")) ?? "";
  assert.equal(TestSuiteFactory.create(untitledSuiteText).cases.length, 1);
  assert.equal(await fileAt(".cw/charter/test/untitled-1.json"), untitledSuiteText);
});

test("addSuite() takes the first free number", async () => {
  const { charterAuthoringApp } = authoring({ ...settings, [at(".cw/charter/test/untitled-1.json")]: "{}", [at(".cw/charter/test/untitled-3.json")]: "{}" });

  assert.equal(answerOf(await charterAuthoringApp.addSuite()).data.name, "untitled-2.json");
});

test("writeSuite() writes text that reads as a suite (FR-090)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  assert.equal(answerOf(await charterAuthoringApp.writeSuite("broken.json", text)).data.name, "broken.json");

  assert.equal(await fileAt(".cw/charter/test/broken.json"), text);
});

test("writeSuite() refuses text that is not JSON or not a suite, with the sample, and writes nothing (FR-090)", async () => {
  const files = withTwoFiles();
  const { charterAuthoringApp, fileAt } = authoring(files);

  assert.match(faultTextOf(await charterAuthoringApp.writeSuite("shapes.json", "{ nope")), /not JSON[\s\S]*/);
  const { message, fix } = faultOf(await charterAuthoringApp.writeSuite("shapes.json", suiteText({ cases: [] })));
  assert.match(message, /not written as a suite/);
  // The sample it is refused with reads as a suite itself.
  const sample = fix.replace(/^Write it as /, "");
  assert.equal(TestSuiteFactory.create(sample).cases.length, 3);

  assert.equal(await fileAt(".cw/charter/test/shapes.json"), files[at(".cw/charter/test/shapes.json")]);
});

test("writeSuite() and removeSuite() refuse a name that is no test file (FR-090, FR-092)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  assert.match(faultTextOf(await charterAuthoringApp.writeSuite("missing.json", text)), /holds no test file called "missing.json"/);
  assert.match(faultTextOf(await charterAuthoringApp.writeSuite("../charter/guide/no-any/index.md", text)), /holds no test file/);
  assert.match(faultTextOf(await charterAuthoringApp.removeSuite("../charter/guide/no-any/index.md")), /holds no test file/);

  assert.equal(await fileAt(".cw/charter/test/missing.json"), undefined);
  assert.ok(await fileAt(".cw/charter/primitive/guide/no-any/index.md"));
});

test("removeSuite() deletes one test file, and nothing else (FR-092)", async () => {
  const { charterAuthoringApp, fileAt } = authoring(withTwoFiles());

  assert.equal(answerOf(await charterAuthoringApp.removeSuite("shapes.json")).data.name, "shapes.json");

  assert.equal(await fileAt(".cw/charter/test/shapes.json"), undefined);
  assert.ok(await fileAt(".cw/charter/test/broken.json"));
});

test("cw suite add, edit and remove are commands of the command line (FR-109)", () => {
  const names = COMMANDS.map((command) => command.name);
  for (const name of ["suite add", "suite edit <name>", "suite remove <name>"]) assert.ok(names.includes(name), name);
});

test("cw suite add writes a new test file and says how to edit it (FR-091)", async () => {
  const repoInMemory = authoring(settings);
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteAddCommand().run(contextOver(repoInMemory));

  assert.equal(outcome.code, EXIT_OK);
  assert.match(outcome.result ?? "", /Wrote \.cw\/charter\/test\/untitled-1\.json\.\nRun "cw suite edit untitled-1\.json"/);
  assert.ok(await fileAt(".cw/charter/test/untitled-1.json"));
});

test("cw suite remove deletes the test file named (FR-092)", async () => {
  const repoInMemory = authoring(withTwoFiles());
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteRemoveCommand().run(contextOver(repoInMemory), { name: "shapes.json" });

  assert.equal(outcome.result, "Removed .cw/charter/test/shapes.json.\n");
  assert.equal(await fileAt(".cw/charter/test/shapes.json"), undefined);
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

  assert.match((await new SuiteEditCommand().run(context, { name: "missing.json" })).problem ?? "", /holds no test file called "missing.json"/);
  assert.match((await new SuiteEditCommand().run(context, { name: "shapes.json" })).problem ?? "", /Neither \$VISUAL nor \$EDITOR is set/);
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

  const outcome = await new SuiteEditCommand().run(contextOver(repoInMemory), { name: "shapes.json" });

  assert.equal(outcome.code, EXIT_OK);
  assert.equal(await readFile(handedOver, "utf8"), "/repo/.cw/charter/test/shapes.json");
  assert.equal(await fileAt(".cw/charter/test/shapes.json"), files[at(".cw/charter/test/shapes.json")]);
});

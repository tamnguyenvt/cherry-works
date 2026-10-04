import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { SuiteAddCommand } from "../src/driver/cli/commands/SuiteAddCommand.js";
import { SuiteEditCommand } from "../src/driver/cli/commands/SuiteEditCommand.js";
import { SuiteRemoveCommand } from "../src/driver/cli/commands/SuiteRemoveCommand.js";
import { EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { testSuiteOf } from "../src/hexagon/domain/models/test/TestSuite.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noPlacesReached } from "./no-places.js";
import { noSessionsKept } from "./no-sessions.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");
const at = (path: string) => new URL(path, repoPath).href;

const guide = (id: string, globs: readonly string[]) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, `globs: ${JSON.stringify(globs)}`, "---", "", "Body.", ""].join("\n");

const settings = { [at(".cw/settings.json")]: `${JSON.stringify({ agents: [] })}\n` };

const suiteText = (written: unknown) => `${JSON.stringify(written, undefined, 2)}\n`;

/** One suite putting all three shapes, and one file that does not read. */
const withTwoFiles = () => ({
  ...settings,
  [at(".cw/charter/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
  [at(".cw/test/shapes.json")]: suiteText({
    description: "All three shapes.",
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } },
      { do: { touchFile: ".env" }, expect: { allow: false } },
      { when: "Stop", expect: { run: "test" } },
    ],
  }),
  [at(".cw/test/broken.json")]: "{ not json",
});

/** Both use cases over one repository held in memory — the test files, and
 *  the charter a run resolves them against — and a way to read back what is on
 *  disk. */
const authoring = (files: Readonly<Record<string, string>> = {}) => {
  const held = new InMemoryFileReaders(files);
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const testAuthoringApp = new TestAuthoring(repoPath, held, new InMemoryFileOutput(held));
  return { charterAuthoringApp, testAuthoringApp, fileAt: (path: string) => held.readIfThere(new URL(path, repoPath)) };
};

const contextOver = ({ charterAuthoringApp, testAuthoringApp }: ReturnType<typeof authoring>) => ({
  cwd: "/repo",
  version: "0.0.0",
  charterAuthoringApp,
  charterVendoringApp: new CharterVendoring(repoPath, new InMemoryFileReaders({}), new InMemoryVCS()),
  testAuthoringApp,
  mcpConnectingApp: noPlacesReached, sessionReviewingApp: noSessionsKept,
});

test("suites() lists each file with its name, text and cases said, and one that does not read with its fault (FR-124)", async () => {
  const files = withTwoFiles();
  const { testAuthoringApp } = authoring(files);

  const { testSuites } = (await testAuthoringApp.suites()).data;

  assert.deepEqual(
    testSuites.map(({ data }) => data.name),
    ["broken.json", "shapes.json"],
  );
  const [broken, shapes] = testSuites;
  assert.equal(broken?.data.text, undefined);
  assert.deepEqual(broken?.data.cases, []);
  assert.match(broken?.data.fault?.data.message ?? "", /not JSON/);

  assert.equal(shapes?.data.text, files[at(".cw/test/shapes.json")]);
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
  assert.deepEqual((await authoring(settings).testAuthoringApp.suites()).data.testSuites, []);
});

test("a run names the test file each case came from (FR-125)", async () => {
  const { charterAuthoringApp } = authoring({
    ...settings,
    [at(".cw/charter/guide/no-any/index.md")]: guide("no-any", ["src/**/*.ts"]),
    [at(".cw/test/one.json")]: suiteText({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }] }),
    [at(".cw/test/two.json")]: suiteText({ cases: [{ do: { touchFile: "docs/a.md" }, expect: { activate: "no-any" } }] }),
  });

  const testRunReportDTO = await charterAuthoringApp.test();

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
  const { testAuthoringApp, fileAt } = authoring(settings);

  assert.equal(await testAuthoringApp.addSuite(), "untitled-1.json");
  assert.equal(await testAuthoringApp.addSuite(), "untitled-2.json");

  const written = (await fileAt(".cw/test/untitled-2.json")) ?? "";
  assert.equal(testSuiteOf(written).cases.length, 1);
  assert.equal(await fileAt(".cw/test/untitled-1.json"), written);
});

test("addSuite() takes the first free number", async () => {
  const { testAuthoringApp } = authoring({ ...settings, [at(".cw/test/untitled-1.json")]: "{}", [at(".cw/test/untitled-3.json")]: "{}" });

  assert.equal(await testAuthoringApp.addSuite(), "untitled-2.json");
});

test("writeSuite() writes text that reads as a suite (FR-090)", async () => {
  const { testAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  assert.equal(await testAuthoringApp.writeSuite("broken.json", text), "broken.json");

  assert.equal(await fileAt(".cw/test/broken.json"), text);
});

test("writeSuite() refuses text that is not JSON or not a suite, with the sample, and writes nothing (FR-090)", async () => {
  const files = withTwoFiles();
  const { testAuthoringApp, fileAt } = authoring(files);

  await assert.rejects(testAuthoringApp.writeSuite("shapes.json", "{ nope"), /not JSON[\s\S]*/);
  await assert.rejects(testAuthoringApp.writeSuite("shapes.json", suiteText({ cases: [] })), (raised: Error & { fix?: string }) => {
    assert.match(raised.message, /not written as a suite/);
    // The sample it is refused with reads as a suite itself.
    const sample = (raised.fix ?? "").replace(/^Write it as /, "");
    assert.equal(testSuiteOf(sample).cases.length, 3);
    return true;
  });

  assert.equal(await fileAt(".cw/test/shapes.json"), files[at(".cw/test/shapes.json")]);
});

test("writeSuite() and removeSuite() refuse a name that is no test file (FR-090, FR-092)", async () => {
  const { testAuthoringApp, fileAt } = authoring(withTwoFiles());
  const text = suiteText({ cases: [{ when: "Stop", expect: { run: "test" } }] });

  await assert.rejects(testAuthoringApp.writeSuite("missing.json", text), /holds no test file called "missing.json"/);
  await assert.rejects(testAuthoringApp.writeSuite("../charter/guide/no-any/index.md", text), /holds no test file/);
  await assert.rejects(testAuthoringApp.removeSuite("../charter/guide/no-any/index.md"), /holds no test file/);

  assert.equal(await fileAt(".cw/test/missing.json"), undefined);
  assert.ok(await fileAt(".cw/charter/guide/no-any/index.md"));
});

test("removeSuite() deletes one test file, and nothing else (FR-092)", async () => {
  const { testAuthoringApp, fileAt } = authoring(withTwoFiles());

  assert.equal(await testAuthoringApp.removeSuite("shapes.json"), "shapes.json");

  assert.equal(await fileAt(".cw/test/shapes.json"), undefined);
  assert.ok(await fileAt(".cw/test/broken.json"));
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
  assert.match(outcome.result ?? "", /Wrote \.cw\/test\/untitled-1\.json\.\nRun "cw suite edit untitled-1\.json"/);
  assert.ok(await fileAt(".cw/test/untitled-1.json"));
});

test("cw suite remove deletes the test file named (FR-092)", async () => {
  const repoInMemory = authoring(withTwoFiles());
  const { fileAt } = repoInMemory;

  const outcome = await new SuiteRemoveCommand().run(contextOver(repoInMemory), { name: "shapes.json" });

  assert.equal(outcome.result, "Removed .cw/test/shapes.json.\n");
  assert.equal(await fileAt(".cw/test/shapes.json"), undefined);
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

  await assert.rejects(new SuiteEditCommand().run(context, { name: "missing.json" }), /holds no test file called "missing.json"/);
  await assert.rejects(new SuiteEditCommand().run(context, { name: "shapes.json" }), /Neither \$VISUAL nor \$EDITOR is set/);
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
  assert.equal(await readFile(handedOver, "utf8"), "/repo/.cw/test/shapes.json");
  assert.equal(await fileAt(".cw/test/shapes.json"), files[at(".cw/test/shapes.json")]);
});

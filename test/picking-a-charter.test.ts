import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemorySources } from "../src/zdriven/InMemorySources.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noMcpOriginsReached } from "./no-mcp-origins.js";
import { noSessionsKept } from "./no-sessions.js";
import { noEvaluationsRun } from "./no-evaluations.js";
import { noSensorsRun } from "./no-sensors.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");
const pickedAt = (path: string) => new URL(`.cw/vendor/acme/charters/${path}`, repoPath).href;

const guide = (id: string) => ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");
const skillMd = (name: string) => ["---", `name: ${name}`, `description: About ${name}.`, "---", "", "Do it.", ""].join("\n");

/** `acme/charters` as a source of many publishes it: `baseline` and `sdd`,
 *  each under `charters/` laid out as a single-charter source holds its one. */
const acmeCharters = (): Record<string, string> => ({
  "charters/baseline/.cw/charter/guide/small-diffs/index.md": guide("small-diffs"),
  "charters/baseline/README.md": "# Baseline\n",
  "charters/sdd/.cw/charter/guide/spec-first/index.md": guide("spec-first"),
  "README.md": "# Charters\n",
});

/** One run of the command line over a repository and sources held in
 *  memory, and what it wrote. */
async function running(argv: readonly string[], fileReaders: InMemoryFileReaders, sourceFetcher: InMemorySources) {
  const commandOutput: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      commandOutput.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const context = {
      cwd: "/repo",
      version: "0.0.0",
      charterAuthoringApp: new CharterAuthoring(repoPath, fileReaders, new YamlParser(), new InMemoryFileOutput(fileReaders), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
      charterVendoringApp: new CharterVendoring(repoPath, fileReaders, sourceFetcher, new InMemoryFileOutput(fileReaders), new YamlParser()),
      testAuthoringApp: new TestAuthoring(repoPath, fileReaders, new InMemoryFileOutput(fileReaders)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, commandOutput: commandOutput.join("") };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

/** A repository holding nothing yet, the files it is held in and version
 *  control over them, with `acme/charters` published. */
function withChartersPublished(sourceFiles: Record<string, string> = acmeCharters(), heldFiles: Record<string, string> = {}) {
  const fileReaders = new InMemoryFileReaders(heldFiles);
  const sourceFetcher = new InMemorySources(fileReaders);
  sourceFetcher.sourceFilesBySource["acme/charters"] = sourceFiles;
  return { fileReaders, sourceFetcher };
}

const checkedOutFolders = (sourceFetcher: InMemorySources) => sourceFetcher.checkedOutFolders.map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]);

test("a charter picked from a source of many lands in a vendor folder of its own, left unstaged, and the others do not arrive (CORE-FR-195, CORE-FR-196, CORE-SC-052)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"]]);
  assert.equal(await fileReaders.read(new URL(pickedAt("baseline/guide/small-diffs/index.md"))), guide("small-diffs"));
  assert.equal(await fileReaders.read(new URL(pickedAt("baseline/README.md"))), "# Baseline\n", "the charter's own README, beside it");
  await assert.rejects(() => fileReaders.read(new URL(pickedAt("sdd/guide/spec-first/index.md"))));
  await assert.rejects(() => fileReaders.read(new URL(pickedAt("README.md"))), "the source's README is no charter's");
  assert.match(commandOutput, /Installed acme\/charters under \.cw\/vendor\/acme\/charters\/baseline\.\n {2}guide small-diffs\n/);
});

test("each charter picked is a vendor of its own: listed, read, brought up to date, and removed on its own (CORE-FR-196)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();
  await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "sdd"], fileReaders, sourceFetcher);
  const charterVendoringApp = new CharterVendoring(repoPath, fileReaders, sourceFetcher, new InMemoryFileOutput(fileReaders), new YamlParser());

  assert.deepEqual(await charterVendoringApp.installed(), [".cw/vendor/acme/charters/baseline", ".cw/vendor/acme/charters/sdd"]);
  const charterRoot = await loadCharterRoot(repoPath, fileReaders, new YamlParser());
  assert.deepEqual(
    charterRoot.primitives.filter(({ charterFolder }) => charterFolder.startsWith(".cw/vendor/")).map(({ headers, charterFolder }) => [headers.id, charterFolder]).sort(),
    [["small-diffs", ".cw/vendor/acme/charters/baseline"], ["spec-first", ".cw/vendor/acme/charters/sdd"]],
  );

  sourceFetcher.checkedOutFolders.length = 0;
  await running(["vendor", "add", "acme/charters", "--charter", "baseline"], fileReaders, sourceFetcher);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"]]);
  assert.equal(await fileReaders.read(new URL(pickedAt("sdd/guide/spec-first/index.md"))), guide("spec-first"), "sdd left as it was");

  const removeOutcome = await running(["vendor", "remove", "acme/charters/baseline"], fileReaders, sourceFetcher);
  assert.equal(removeOutcome.code, EXIT_OK, removeOutcome.commandOutput);
  await assert.rejects(() => fileReaders.read(new URL(pickedAt("baseline/guide/small-diffs/index.md"))), "baseline is gone");
  assert.equal(await fileReaders.read(new URL(pickedAt("sdd/guide/spec-first/index.md"))), guide("spec-first"), "sdd left as it was");
});

test("a source holding charters under charters/ alone, given neither flag, installs every charter it holds, asking nothing (CORE-FR-193)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"],
    ["charters/sdd/.cw/charter", ".cw/vendor/acme/charters/sdd"],
  ]);
});

test("a source of every shape gives its one charter with neither flag, skills alone with --skill, and both with both (CORE-FR-193)", async () => {
  const everyShape = { ".cw/charter/guide/own/index.md": guide("own"), ...acmeCharters(), "skills/grill-me/SKILL.md": skillMd("grill-me") };

  const withNeither = withChartersPublished(everyShape);
  const ownCharter = await running(["vendor", "add", "acme/charters"], withNeither.fileReaders, withNeither.sourceFetcher);
  assert.equal(ownCharter.code, EXIT_OK, ownCharter.commandOutput);
  assert.deepEqual(checkedOutFolders(withNeither.sourceFetcher), [[".cw/charter", ".cw/vendor/acme/charters"]]);

  const withSkill = withChartersPublished(everyShape);
  const skillsAlone = await running(["vendor", "add", "acme/charters", "--skill", "grill-me"], withSkill.fileReaders, withSkill.sourceFetcher);
  assert.equal(skillsAlone.code, EXIT_OK, skillsAlone.commandOutput);
  assert.deepEqual(checkedOutFolders(withSkill.sourceFetcher), [["skills/grill-me", ".cw/vendor/acme/charters/skill/grill-me"]]);

  const withBoth = withChartersPublished(everyShape);
  const bothOutcome = await running(["vendor", "add", "acme/charters", "--charter", "sdd", "--skill", "grill-me"], withBoth.fileReaders, withBoth.sourceFetcher);
  assert.equal(bothOutcome.code, EXIT_OK, bothOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(withBoth.sourceFetcher), [
    ["charters/sdd/.cw/charter", ".cw/vendor/acme/charters/sdd"],
    ["skills/grill-me", ".cw/vendor/acme/charters/skill/grill-me"],
  ]);
  assert.deepEqual(
    await new CharterVendoring(repoPath, withBoth.fileReaders, withBoth.sourceFetcher, new InMemoryFileOutput(withBoth.fileReaders), new YamlParser()).installed(),
    [".cw/vendor/acme/charters", ".cw/vendor/acme/charters/sdd"],
  );
});

test("a --charter the source does not hold installs nothing, naming the charters it holds (CORE-FR-197)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "nothing-here"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters holds no charter nothing-here/);
  assert.match(commandOutput, /baseline, sdd/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a flag for a shape the source does not hold is refused, taking nothing, saying which shapes it holds (CORE-FR-193)", async () => {
  const skillsOnly = withChartersPublished({ "skills/grill-me/SKILL.md": skillMd("grill-me") });
  const charterRefuseOutcome = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], skillsOnly.fileReaders, skillsOnly.sourceFetcher);
  assert.equal(charterRefuseOutcome.code, EXIT_FAILURE);
  assert.match(charterRefuseOutcome.commandOutput, /acme\/charters holds no "charters\/"/);
  assert.match(charterRefuseOutcome.commandOutput, /skills under "skills\/"/);
  assert.deepEqual(skillsOnly.sourceFetcher.checkedOutFolders, []);

  const chartersOnly = withChartersPublished();
  const skillRefuseOutcome = await running(["vendor", "add", "acme/charters", "--skill", "grill-me"], chartersOnly.fileReaders, chartersOnly.sourceFetcher);
  assert.equal(skillRefuseOutcome.code, EXIT_FAILURE);
  assert.match(skillRefuseOutcome.commandOutput, /acme\/charters holds no "skills\/"/);
  assert.match(skillRefuseOutcome.commandOutput, /charters under "charters\/"/);
  assert.deepEqual(chartersOnly.sourceFetcher.checkedOutFolders, []);
});

test("a folder under charters/ named as a kind is, or holding no charter folder, is refused when picked, naming the folder (CORE-FR-197)", async () => {
  for (const [name, sourceFiles] of [
    ["guide", { ...acmeCharters(), "charters/guide/.cw/charter/guide/x/index.md": guide("x") }],
    ["notes", { ...acmeCharters(), "charters/notes/README.md": "# Notes\n" }],
  ] as const) {
    const { fileReaders, sourceFetcher } = withChartersPublished(sourceFiles);

    const { code, commandOutput } = await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", name], fileReaders, sourceFetcher);

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(commandOutput, new RegExp(`charters/${name}`), name);
    assert.deepEqual(sourceFetcher.checkedOutFolders, [], name);
  }
});

test("a charter picked that installed vendors of its own is refused, since vendoring is one level deep (FR-170)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({ ...acmeCharters(), "charters/sdd/.cw/vendor/other/guide/x/index.md": guide("x") });

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters", "--charter", "sdd"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /one level deep/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a folder holding the source's one charter takes no charter picked into it, and one holding charters picked takes no one charter (CORE-FR-191)", async () => {
  const intoOwnCharter = withChartersPublished(acmeCharters(), { [pickedAt("guide/own/index.md")]: guide("own"), [pickedAt("README.md")]: "# Charters\n" });
  const pickRefuseOutcome = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], intoOwnCharter.fileReaders, intoOwnCharter.sourceFetcher);
  assert.equal(pickRefuseOutcome.code, EXIT_FAILURE);
  assert.match(pickRefuseOutcome.commandOutput, /\.cw\/vendor\/acme\/charters holds a charter/);
  assert.deepEqual(intoOwnCharter.sourceFetcher.checkedOutFolders, []);

  const intoPicked = withChartersPublished({ ".cw/charter/guide/own/index.md": guide("own") }, { [pickedAt("baseline/guide/small-diffs/index.md")]: guide("small-diffs") });
  const ownRefuseOutcome = await running(["vendor", "add", "acme/charters"], intoPicked.fileReaders, intoPicked.sourceFetcher);
  assert.equal(ownRefuseOutcome.code, EXIT_FAILURE);
  assert.match(ownRefuseOutcome.commandOutput, /\.cw\/vendor\/acme\/charters holds charters picked from acme\/charters/);
  assert.deepEqual(intoPicked.sourceFetcher.checkedOutFolders, []);
});

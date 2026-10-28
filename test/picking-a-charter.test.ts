import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { loadCharterRoot } from "../src/hexagon/service/charterRepo.js";
import { driftedVendors } from "../src/hexagon/service/vendorRepo.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
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

/** One run of the command line over a repository and version control held in
 *  memory, and what it wrote. */
async function running(argv: readonly string[], held: InMemoryFileReaders, vcs: InMemoryVCS) {
  const said: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      said.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const context = {
      cwd: "/repo",
      version: "0.0.0",
      charterAuthoringApp: new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
      charterVendoringApp: new CharterVendoring(repoPath, held, vcs, new InMemoryFileOutput(held), new YamlParser()),
      testAuthoringApp: new TestAuthoring(repoPath, held, new InMemoryFileOutput(held)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, said: said.join("") };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

/** A repository holding nothing yet, the files it is held in and version
 *  control over them, with `acme/charters` published. */
function withChartersPublished(sourceFiles: Record<string, string> = acmeCharters(), heldFiles: Record<string, string> = {}) {
  const held = new InMemoryFileReaders(heldFiles);
  const vcs = new InMemoryVCS(true, true, held);
  vcs.sourceFilesBySource["acme/charters"] = sourceFiles;
  return { held, vcs };
}

const checkedOutFolders = (vcs: InMemoryVCS) => vcs.checkedOut.map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]);

test("a charter picked from a source of many lands in a vendor folder of its own, left unstaged, and the others do not arrive (CORE-FR-195, CORE-FR-196, CORE-SC-052)", async () => {
  const { held, vcs } = withChartersPublished();

  const { code, said } = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.deepEqual(checkedOutFolders(vcs), [["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"]]);
  assert.equal(await held.read(new URL(pickedAt("baseline/guide/small-diffs/index.md"))), guide("small-diffs"));
  assert.equal(await held.read(new URL(pickedAt("baseline/README.md"))), "# Baseline\n", "the charter's own README, beside it");
  await assert.rejects(() => held.read(new URL(pickedAt("sdd/guide/spec-first/index.md"))));
  await assert.rejects(() => held.read(new URL(pickedAt("README.md"))), "the source's README is no charter's");
  assert.match(said, /Installed acme\/charters under \.cw\/vendor\/acme\/charters\/baseline\.\n {2}guide small-diffs\n/);
});

test("each charter picked is a vendor of its own: listed, read, brought up to date, removed and drifted on its own (CORE-FR-196)", async () => {
  const { held, vcs } = withChartersPublished();
  await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "sdd"], held, vcs);
  const charterVendoringApp = new CharterVendoring(repoPath, held, vcs, new InMemoryFileOutput(held), new YamlParser());

  assert.deepEqual(await charterVendoringApp.installed(), [".cw/vendor/acme/charters/baseline", ".cw/vendor/acme/charters/sdd"]);
  const charterRoot = await loadCharterRoot(repoPath, held, new YamlParser());
  assert.deepEqual(
    charterRoot.primitives.filter(({ charterFolder }) => charterFolder.startsWith(".cw/vendor/")).map(({ headers, charterFolder }) => [headers.id, charterFolder]).sort(),
    [["small-diffs", ".cw/vendor/acme/charters/baseline"], ["spec-first", ".cw/vendor/acme/charters/sdd"]],
  );

  vcs.checkedOut.length = 0;
  await running(["vendor", "add", "acme/charters", "--charter", "baseline"], held, vcs);
  assert.deepEqual(checkedOutFolders(vcs), [["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"]]);
  assert.equal(await held.read(new URL(pickedAt("sdd/guide/spec-first/index.md"))), guide("spec-first"), "sdd left as it was");

  vcs.changed.push(".cw/vendor/acme/charters/baseline/guide/small-diffs/index.md", ".cw/vendor/acme/charters/baseline/README.md");
  assert.deepEqual(await driftedVendors(repoPath, vcs), ["acme/charters/baseline"]);

  const removed = await running(["vendor", "remove", "acme/charters/baseline"], held, vcs);
  assert.equal(removed.code, EXIT_OK, removed.said);
  assert.deepEqual(vcs.removed, [{ repo: repoPath, subFolder: ".cw/vendor/acme/charters/baseline" }]);
});

test("a source holding charters under charters/ alone, given neither flag, installs every charter it holds, asking nothing (CORE-FR-193)", async () => {
  const { held, vcs } = withChartersPublished();

  const { code, said } = await running(["vendor", "add", "acme/charters"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.deepEqual(checkedOutFolders(vcs), [
    ["charters/baseline/.cw/charter", ".cw/vendor/acme/charters/baseline"],
    ["charters/sdd/.cw/charter", ".cw/vendor/acme/charters/sdd"],
  ]);
});

test("a source of every shape gives its one charter with neither flag, skills alone with --skill, and both with both (CORE-FR-193)", async () => {
  const everyShape = { ".cw/charter/guide/own/index.md": guide("own"), ...acmeCharters(), "skills/grill-me/SKILL.md": skillMd("grill-me") };

  const withNeither = withChartersPublished(everyShape);
  const ownCharter = await running(["vendor", "add", "acme/charters"], withNeither.held, withNeither.vcs);
  assert.equal(ownCharter.code, EXIT_OK, ownCharter.said);
  assert.deepEqual(checkedOutFolders(withNeither.vcs), [[".cw/charter", ".cw/vendor/acme/charters"]]);

  const withSkill = withChartersPublished(everyShape);
  const skillsAlone = await running(["vendor", "add", "acme/charters", "--skill", "grill-me"], withSkill.held, withSkill.vcs);
  assert.equal(skillsAlone.code, EXIT_OK, skillsAlone.said);
  assert.deepEqual(checkedOutFolders(withSkill.vcs), [["skills/grill-me", ".cw/vendor/acme/charters/skill/grill-me"]]);

  const withBoth = withChartersPublished(everyShape);
  const both = await running(["vendor", "add", "acme/charters", "--charter", "sdd", "--skill", "grill-me"], withBoth.held, withBoth.vcs);
  assert.equal(both.code, EXIT_OK, both.said);
  assert.deepEqual(checkedOutFolders(withBoth.vcs), [
    ["charters/sdd/.cw/charter", ".cw/vendor/acme/charters/sdd"],
    ["skills/grill-me", ".cw/vendor/acme/charters/skill/grill-me"],
  ]);
  assert.deepEqual(
    await new CharterVendoring(repoPath, withBoth.held, withBoth.vcs, new InMemoryFileOutput(withBoth.held), new YamlParser()).installed(),
    [".cw/vendor/acme/charters", ".cw/vendor/acme/charters/sdd"],
  );
});

test("a --charter the source does not hold installs nothing, naming the charters it holds (CORE-FR-197)", async () => {
  const { held, vcs } = withChartersPublished();

  const { code, said } = await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "nothing-here"], held, vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.match(said, /acme\/charters holds no charter nothing-here/);
  assert.match(said, /baseline, sdd/);
  assert.deepEqual(vcs.checkedOut, []);
});

test("a flag for a shape the source does not hold is refused, taking nothing, saying which shapes it holds (CORE-FR-193)", async () => {
  const skillsOnly = withChartersPublished({ "skills/grill-me/SKILL.md": skillMd("grill-me") });
  const charterRefused = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], skillsOnly.held, skillsOnly.vcs);
  assert.equal(charterRefused.code, EXIT_FAILURE);
  assert.match(charterRefused.said, /acme\/charters holds no "charters\/"/);
  assert.match(charterRefused.said, /skills under "skills\/"/);
  assert.deepEqual(skillsOnly.vcs.checkedOut, []);

  const chartersOnly = withChartersPublished();
  const skillRefused = await running(["vendor", "add", "acme/charters", "--skill", "grill-me"], chartersOnly.held, chartersOnly.vcs);
  assert.equal(skillRefused.code, EXIT_FAILURE);
  assert.match(skillRefused.said, /acme\/charters holds no "skills\/"/);
  assert.match(skillRefused.said, /charters under "charters\/"/);
  assert.deepEqual(chartersOnly.vcs.checkedOut, []);
});

test("a folder under charters/ named as a kind is, or holding no charter folder, is refused when picked, naming the folder (CORE-FR-197)", async () => {
  for (const [name, sourceFiles] of [
    ["guide", { ...acmeCharters(), "charters/guide/.cw/charter/guide/x/index.md": guide("x") }],
    ["notes", { ...acmeCharters(), "charters/notes/README.md": "# Notes\n" }],
  ] as const) {
    const { held, vcs } = withChartersPublished(sourceFiles);

    const { code, said } = await running(["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", name], held, vcs);

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(said, new RegExp(`charters/${name}`), name);
    assert.deepEqual(vcs.checkedOut, [], name);
  }
});

test("a charter picked that installed vendors of its own is refused, since vendoring is one level deep (FR-170)", async () => {
  const { held, vcs } = withChartersPublished({ ...acmeCharters(), "charters/sdd/.cw/vendor/other/guide/x/index.md": guide("x") });

  const { code, said } = await running(["vendor", "add", "acme/charters", "--charter", "sdd"], held, vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.match(said, /one level deep/);
  assert.deepEqual(vcs.checkedOut, []);
});

test("a folder holding the source's one charter takes no charter picked into it, and one holding charters picked takes no one charter (CORE-FR-191)", async () => {
  const intoOwnCharter = withChartersPublished(acmeCharters(), { [pickedAt("guide/own/index.md")]: guide("own"), [pickedAt("README.md")]: "# Charters\n" });
  const pickRefused = await running(["vendor", "add", "acme/charters", "--charter", "baseline"], intoOwnCharter.held, intoOwnCharter.vcs);
  assert.equal(pickRefused.code, EXIT_FAILURE);
  assert.match(pickRefused.said, /\.cw\/vendor\/acme\/charters holds a charter/);
  assert.deepEqual(intoOwnCharter.vcs.checkedOut, []);

  const intoPicked = withChartersPublished({ ".cw/charter/guide/own/index.md": guide("own") }, { [pickedAt("baseline/guide/small-diffs/index.md")]: guide("small-diffs") });
  const ownRefused = await running(["vendor", "add", "acme/charters"], intoPicked.held, intoPicked.vcs);
  assert.equal(ownRefused.code, EXIT_FAILURE);
  assert.match(ownRefused.said, /\.cw\/vendor\/acme\/charters holds charters picked from acme\/charters/);
  assert.deepEqual(intoPicked.vcs.checkedOut, []);
});

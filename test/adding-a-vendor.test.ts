import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
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

const repo = "/repo";

/** A charter nothing here asks about: a context carries every use case, and
 *  these commands reach for the vendoring one only. */
const unread = () => {
  const files = new InMemoryFileReaders({});
  return new CharterAuthoring(new URL(`file://${repo}/`), files, new YamlParser(), new InMemoryFileOutput(files), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
};

/** One run of the command line over sources held in memory, and what it
 *  wrote. The command line writes to the process it runs in, so what a user
 *  reads is read from there. */
async function running(argv: readonly string[], sourceFetcher: InMemorySources = new InMemorySources(), fileReaders: InMemoryFileReaders = new InMemoryFileReaders({})) {
  const commandOutput: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      commandOutput.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const noTestFiles = new InMemoryFileReaders({});
    const context = {
      cwd: repo,
      version: "0.0.0",
      charterAuthoringApp: unread(),
      charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), fileReaders, sourceFetcher, new InMemoryFileOutput(fileReaders), new YamlParser()),
      testAuthoringApp: new TestAuthoring(new URL(`file://${repo}/`), noTestFiles, new InMemoryFileOutput(noTestFiles)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, commandOutput: commandOutput.join(""), sourceFetcher, fileReaders };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

test("a source's charter folder is installed under the folder its owner and its repository name (FR-050)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(["vendor", "add", "git@github.com:team/charter.git"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "git@github.com:team/charter.git" }]);
  assert.deepEqual(sourceFetcher.checkedOutFolders, [{ commit: "git@github.com:team/charter.git", fromFolder: ".cw/charter", intoSubFolder: ".cw/vendor/team/charter" }]);
  assert.match(commandOutput, /\.cw\/vendor\/team\/charter/);
  assert.match(commandOutput, /cw build/, "what is installed is compiled by the one command that writes");
});

test("the source is passed on as it was typed, whatever transport it names, into the folder of its owner and its repository (FR-050)", async () => {
  for (const [source, intoSubFolder] of [
    ["https://github.com/team/charter.git", ".cw/vendor/team/charter"],
    ["git@github.com:team/charter.git", ".cw/vendor/team/charter"],
    ["ssh://git@git.example.com:2222/team/charter", ".cw/vendor/team/charter"],
    ["https://gitlab.com/group/team/charter", ".cw/vendor/team/charter"],
    ["/srv/charters/charter", ".cw/vendor/charters/charter"],
  ] as const) {
    const { sourceFetcher } = await running(["vendor", "add", source]);
    assert.equal(sourceFetcher.fetchedSources[0]?.source, source);
    assert.equal(sourceFetcher.checkedOutFolders[0]?.intoSubFolder, intoSubFolder, source);
  }
});

test("two repositories of one name under two owners land side by side (FR-050, SC-051)", async () => {
  const sourceFetcher = new InMemorySources();
  await running(["vendor", "add", "acme/skills"], sourceFetcher);
  await running(["vendor", "add", "other/skills"], sourceFetcher);

  assert.deepEqual(sourceFetcher.checkedOutFolders.map(({ intoSubFolder }) => intoSubFolder), [".cw/vendor/acme/skills", ".cw/vendor/other/skills"]);
});

test("a source whose address names no owner is refused, and nothing is installed (FR-050)", async () => {
  for (const source of ["charter", "https://example.com/charter.git"]) {
    const { code, commandOutput, sourceFetcher } = await running(["vendor", "add", source]);

    assert.equal(code, EXIT_FAILURE, source);
    assert.deepEqual(sourceFetcher.checkedOutFolders, [], source);
    assert.match(commandOutput, /Invalid path/, source);
  }
});

test("a version is what the source is pinned to", async () => {
  const { commandOutput, sourceFetcher } = await running(["vendor", "add", "team/charter", "--ref", "v1.2.0"]);

  assert.equal(sourceFetcher.fetchedSources[0]?.version, "v1.2.0");
  assert.match(commandOutput, /v1\.2\.0/);
});

test("a source holding no charter folder is refused, saying how to make it one", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/notes");

  const { code, commandOutput } = await running(["vendor", "add", "team/notes"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
  assert.match(commandOutput, /no "\.cw\/charter"/);
});

test("a source that installs vendors of its own is refused: vendoring is one level deep", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesHoldingRefusedFolder.push("team/stacked");

  const { code, commandOutput } = await running(["vendor", "add", "team/stacked"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
  assert.match(commandOutput, /holds "\.cw\/vendor"/);
});

test("a machine with no git is told so, and nothing is installed (CORE Story 37 scenario 4)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.hasNoGit = true;

  const { code, commandOutput } = await running(["vendor", "add", "team/charter"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
  assert.match(commandOutput, /needs git/);
});

test("what was fetched is let go of, installed or refused", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/empty");

  await running(["vendor", "add", "team/charter"], sourceFetcher);
  await running(["vendor", "add", "team/empty"], sourceFetcher);

  await running(["vendor", "inject", "team/empty"], sourceFetcher);

  assert.deepEqual(sourceFetcher.forgottenCommits, ["team/charter", "team/empty", "team/empty"]);
});

test("a repository with work in hand installs all the same, and that work is as it was", async () => {
  const { code, sourceFetcher, fileReaders } = await running(["vendor", "add", "team/charter"], undefined, fileReadersHoldingVendor("other/charter"));

  assert.equal(code, EXIT_OK);
  assert.equal(sourceFetcher.checkedOutFolders[0]?.intoSubFolder, ".cw/vendor/team/charter");
  assert.equal(await fileReaders.read(new URL(`file://${repo}/work.txt`)), "In hand.\n");
});

/** One repository holding this vendor, one guide and its README, beside work of
 *  its own. */
const fileReadersHoldingVendor = (vendorName: string) =>
  new InMemoryFileReaders({
    [`file://${repo}/.cw/vendor/${vendorName}/guide/one/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/.cw/vendor/${vendorName}/README.md`]: "# One\n",
    [`file://${repo}/work.txt`]: "In hand.\n",
  });

/** Every file left under the vendor folder. */
const vendoredFiles = async (fileReaders: InMemoryFileReaders) => (await fileReaders.readFilesRecursively(new URL(`file://${repo}/.cw/vendor/`))).map(({ file }) => file.href);

test("an installed charter is taken away by the folder it was installed as, owner and repository (CORE Story 37 scenario 2)", async () => {
  const { code, commandOutput, fileReaders } = await running(["vendor", "remove", "team/charter"], undefined, fileReadersHoldingVendor("team/charter"));

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(await vendoredFiles(fileReaders), []);
  assert.equal(await fileReaders.read(new URL(`file://${repo}/work.txt`)), "In hand.\n", "the work in hand is as it was");
});

test("a source an earlier version named by its repository alone is taken away by that name (FR-180)", async () => {
  const { code, commandOutput, fileReaders } = await running(["vendor", "remove", "charter"], undefined, fileReadersHoldingVendor("charter"));

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(await vendoredFiles(fileReaders), []);
});

test("a name no vendor folder answers to is refused, and nothing changes (CORE Story 37 scenario 3)", async () => {
  for (const name of ["absent/charter", "team"]) {
    const { code, commandOutput, fileReaders } = await running(["vendor", "remove", name], undefined, fileReadersHoldingVendor("team/charter"));

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(commandOutput, /No vendor folder is named/, name);
    assert.equal((await vendoredFiles(fileReaders)).length, 2, name);
  }
});

test("a source nobody named is a usage error, not a vendoring one", async () => {
  const { code, sourceFetcher } = await running(["vendor", "add"]);

  assert.equal(code, EXIT_USAGE);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a name that is no folder is refused, and nothing is taken away (FR-044)", async () => {
  for (const name of ["..", ".", "team/..", "../../src", "group/team/charter/more"]) {
    const { code, commandOutput, fileReaders } = await running(["vendor", "remove", name], undefined, fileReadersHoldingVendor("team/charter"));

    assert.equal(code, EXIT_FAILURE, name);
    assert.equal((await vendoredFiles(fileReaders)).length, 2, name);
    assert.match(commandOutput, /Invalid path/, name);
  }
});

test("a source whose address ends in no folder is refused, and nothing is installed (FR-044)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(["vendor", "add", "https://example.com/team/.."]);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
  assert.match(commandOutput, /Invalid path/);
});

test("vendor inject exposes the same source, version and skill flags as add", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/skills"] = { "skills/grill/SKILL.md": "---\nname: grill-me\ndescription: Ask questions.\n---\nAsk.\n" };
  const { code, commandOutput } = await running(["vendor", "inject", "team/skills", "--ref", "v1", "--skill", "grill-me"], sourceFetcher);
  assert.equal(code, EXIT_OK);
  assert.match(commandOutput, /Injected skill grill-me/);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/skills", version: "v1" }]);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

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
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
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
  return new CharterAuthoring(new URL(`file://${repo}/`), files, new YamlParser(), new InMemoryFileOutput(files), new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
};

/** One run of the command line over version control held in memory, and what it
 *  wrote. The command line writes to the process it runs in, so what a user
 *  reads is read from there. */
async function running(argv: readonly string[], vcs: InMemoryVCS = new InMemoryVCS()) {
  const said: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      said.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const noTestFiles = new InMemoryFileReaders({});
    const context = {
      cwd: repo,
      version: "0.0.0",
      charterAuthoringApp: unread(),
      charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), new InMemoryFileReaders({}), vcs, new InMemoryFileOutput(new InMemoryFileReaders({})), new YamlParser()),
      testAuthoringApp: new TestAuthoring(new URL(`file://${repo}/`), noTestFiles, new InMemoryFileOutput(noTestFiles)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, said: said.join(""), vcs };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

test("a source's charter folder is installed under the folder its owner and its repository name (FR-050)", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "git@github.com:team/charter.git"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(vcs.fetched, [{ source: "git@github.com:team/charter.git" }]);
  assert.deepEqual(vcs.checkedOut, [{ commit: "git@github.com:team/charter.git", fromFolder: ".cw/charter", intoSubFolder: ".cw/vendor/team/charter" }]);
  assert.match(said, /\.cw\/vendor\/team\/charter/);
  assert.match(said, /cw build/, "what is installed is compiled by the one command that writes");
});

test("the source is passed on as it was typed, whatever transport it names, into the folder of its owner and its repository (FR-050)", async () => {
  for (const [source, intoSubFolder] of [
    ["https://github.com/team/charter.git", ".cw/vendor/team/charter"],
    ["git@github.com:team/charter.git", ".cw/vendor/team/charter"],
    ["ssh://git@git.example.com:2222/team/charter", ".cw/vendor/team/charter"],
    ["https://gitlab.com/group/team/charter", ".cw/vendor/team/charter"],
    ["/srv/charters/charter", ".cw/vendor/charters/charter"],
  ] as const) {
    const { vcs } = await running(["vendor", "add", source]);
    assert.equal(vcs.fetched[0]?.source, source);
    assert.equal(vcs.checkedOut[0]?.intoSubFolder, intoSubFolder, source);
  }
});

test("two repositories of one name under two owners land side by side (FR-050, SC-051)", async () => {
  const vcs = new InMemoryVCS();
  await running(["vendor", "add", "acme/skills"], vcs);
  await running(["vendor", "add", "other/skills"], vcs);

  assert.deepEqual(vcs.checkedOut.map(({ intoSubFolder }) => intoSubFolder), [".cw/vendor/acme/skills", ".cw/vendor/other/skills"]);
});

test("a source whose address names no owner is refused, and nothing is installed (FR-050)", async () => {
  for (const source of ["charter", "https://example.com/charter.git"]) {
    const { code, said, vcs } = await running(["vendor", "add", source]);

    assert.equal(code, EXIT_FAILURE, source);
    assert.deepEqual(vcs.checkedOut, [], source);
    assert.match(said, /Invalid path/, source);
  }
});

test("a version is what the source is pinned to", async () => {
  const { said, vcs } = await running(["vendor", "add", "team/charter", "--ref", "v1.2.0"]);

  assert.equal(vcs.fetched[0]?.version, "v1.2.0");
  assert.match(said, /v1\.2\.0/);
});

test("a source holding no charter folder is refused, saying how to make it one", async () => {
  const vcs = new InMemoryVCS();
  vcs.sourcesWithoutSubFolder.push("team/notes");

  const { code, said } = await running(["vendor", "add", "team/notes"], vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.checkedOut, []);
  assert.match(said, /no "\.cw\/charter"/);
});

test("a source that installs vendors of its own is refused: vendoring is one level deep", async () => {
  const vcs = new InMemoryVCS();
  vcs.sourcesHoldingRefusedFolder.push("team/stacked");

  const { code, said } = await running(["vendor", "add", "team/stacked"], vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.checkedOut, []);
  assert.match(said, /holds "\.cw\/vendor"/);
});

test("a repository with work in hand installs all the same", async () => {
  const { code, vcs } = await running(["vendor", "add", "team/charter"], new InMemoryVCS(true, false));

  assert.equal(code, EXIT_OK);
  assert.equal(vcs.checkedOut[0]?.intoSubFolder, ".cw/vendor/team/charter");
});

test("a folder outside version control is refused, saying the next move", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "team/charter"], new InMemoryVCS(false));

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.checkedOut, []);
  assert.match(said, /git init/);
});

test("an installed charter is taken away by the folder it was installed as, owner and repository", async () => {
  const { code, vcs } = await running(["vendor", "remove", "team/charter"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(vcs.removed, [{ repo: new URL("file:///repo/"), subFolder: ".cw/vendor/team/charter" }]);
});

test("a charter installed by an earlier version is taken away by its one folder (FR-180)", async () => {
  const { code, said, vcs } = await running(["vendor", "remove", "charter"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(vcs.removed, [{ repo: new URL("file:///repo/"), subFolder: ".cw/vendor/charter" }]);
  assert.match(said, /\.cw\/vendor\/charter/);
});

test("removing while there is work in hand is refused before anything is taken away", async () => {
  const { code, said, vcs } = await running(["vendor", "remove", "charter"], new InMemoryVCS(true, false));

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.removed, []);
  assert.match(said, /work in hand/);
});

test("a source nobody named is a usage error, not a vendoring one", async () => {
  const { code, vcs } = await running(["vendor", "add"]);

  assert.equal(code, EXIT_USAGE);
  assert.deepEqual(vcs.checkedOut, []);
});

test("a name that is no folder is refused, and nothing is taken away (FR-044)", async () => {
  for (const name of ["..", ".", "team/..", "../../src", "group/team/charter/more"]) {
    const { code, said, vcs } = await running(["vendor", "remove", name]);

    assert.equal(code, EXIT_FAILURE, name);
    assert.deepEqual(vcs.removed, [], name);
    assert.match(said, /Invalid path/, name);
  }
});

test("a source whose address ends in no folder is refused, and nothing is installed (FR-044)", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "https://example.com/team/.."]);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.checkedOut, []);
  assert.match(said, /Invalid path/);
});

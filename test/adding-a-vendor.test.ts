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
      charterVendoringApp: new CharterVendoring(new URL(`file://${repo}/`), new InMemoryFileReaders({}), vcs),
      testAuthoringApp: new TestAuthoring(new URL(`file://${repo}/`), noTestFiles, new InMemoryFileOutput(noTestFiles)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, said: said.join(""), vcs };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

test("a source's charter folder is installed under the folder its address names", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "git@github.com:team/charter.git"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(vcs.installed, [
    {
      source: "git@github.com:team/charter.git",
      sourceSubFolder: ".cw/charter",
      repo: new URL("file:///repo/"),
      intoSubFolder: ".cw/vendor/charter",
    },
  ]);
  assert.match(said, /\.cw\/vendor\/charter/);
  assert.match(said, /cw build/, "what is installed is compiled by the one command that writes");
});

test("the source is passed on as it was typed, whatever transport it names", async () => {
  for (const source of [
    "https://github.com/team/charter.git",
    "git@github.com:team/charter.git",
    "ssh://git@git.example.com:2222/team/charter",
    "/srv/charters/charter",
  ]) {
    const { vcs } = await running(["vendor", "add", source]);
    assert.equal(vcs.installed[0]?.source, source);
    assert.equal(vcs.installed[0]?.intoSubFolder, ".cw/vendor/charter");
  }
});

test("a version is what the source is pinned to", async () => {
  const { said, vcs } = await running(["vendor", "add", "team/charter", "--ref", "v1.2.0"]);

  assert.equal(vcs.installed[0]?.version, "v1.2.0");
  assert.match(said, /v1\.2\.0/);
});

test("a source holding no charter folder is refused, saying how to make it one", async () => {
  const vcs = new InMemoryVCS();
  vcs.sourcesWithoutSubFolder.push("team/notes");

  const { code, said } = await running(["vendor", "add", "team/notes"], vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.installed, []);
  assert.match(said, /no folder "\.cw\/charter"/);
});

test("a source that installs vendors of its own is refused: vendoring is one level deep", async () => {
  const vcs = new InMemoryVCS();
  vcs.sourcesHoldingRefusedFolder.push("team/stacked");

  const { code, said } = await running(["vendor", "add", "team/stacked"], vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.installed, []);
  assert.match(said, /holds "\.cw\/vendor"/);
});

test("a repository with work in hand is refused before anything is fetched", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "team/charter"], new InMemoryVCS(true, false));

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.installed, []);
  assert.match(said, /work in hand/);
  assert.match(said, /stash/);
});

test("a folder outside version control is refused, saying the next move", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "team/charter"], new InMemoryVCS(false));

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.installed, []);
  assert.match(said, /git init/);
});

test("an installed charter is taken away by the folder it was installed as", async () => {
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
  assert.deepEqual(vcs.installed, []);
});

test("a name that is no folder is refused, and nothing is taken away (FR-044)", async () => {
  for (const name of ["..", ".", "team/.."]) {
    const { code, said, vcs } = await running(["vendor", "remove", name]);

    assert.equal(code, EXIT_FAILURE, name);
    assert.deepEqual(vcs.removed, [], name);
    assert.match(said, /Invalid path/, name);
  }
});

test("a name that climbs out of the vendor folder is read as its last folder, and stays under it (FR-044)", async () => {
  const { vcs } = await running(["vendor", "remove", "../../src"]);

  assert.deepEqual(vcs.removed, [{ repo: new URL("file:///repo/"), subFolder: ".cw/vendor/src" }]);
});

test("a source whose address ends in no folder is refused, and nothing is installed (FR-044)", async () => {
  const { code, said, vcs } = await running(["vendor", "add", "https://example.com/team/.."]);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(vcs.installed, []);
  assert.match(said, /Invalid path/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noPlacesReached } from "./no-places.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");

/** `cw portal` as a user meets it, over a repository held in memory: the real
 *  command and the real service behind it, with both streams held so what the
 *  user reads can be read back. Only ever run where it is refused, since a
 *  portal that starts stays open. */
const portal = async (files: Readonly<Record<string, string>>, versioned: boolean) => {
  const held = new InMemoryFileReaders(files);
  const vcs = new InMemoryVCS(versioned);
  const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const charterVendoringApp = new CharterVendoring(repoPath, held, vcs);
  const testAuthoringApp = new TestAuthoring(repoPath, held, new InMemoryFileOutput(held));
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander({ cwd: "/repo", version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp: noPlacesReached }, COMMANDS).run(["portal"]);
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

const settings = new URL(".cw/settings.json", repoPath).href;

test("outside a git repository nothing is served, and git init is named (FR-004)", async () => {
  const { code, results, problems } = await portal({ [settings]: '{ "agents": [] }' }, false);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /not inside a git repository/);
  assert.match(problems, /git init/);
});

test("a repository never set up is refused before anything is served, naming cw init (FR-004)", async () => {
  const { code, results, problems } = await portal({}, true);

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /never set up/);
  assert.match(problems, /cw init/);
});

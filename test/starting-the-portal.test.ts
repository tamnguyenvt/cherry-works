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
import { InMemorySources } from "../src/zdriven/InMemorySources.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noMcpOriginsReached } from "./no-mcp-origins.js";
import { noSessionsKept } from "./no-sessions.js";
import { noEvaluationsRun } from "./no-evaluations.js";
import { noSensorsRun } from "./no-sensors.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");

/** `cw portal` as a user meets it, over a repository held in memory: the real
 *  command and the real service behind it, with both streams held so what the
 *  user reads can be read back. Only ever run where it is refused, since a
 *  portal that starts stays open. */
const portal = async (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const charterAuthoringApp = new CharterAuthoring(repoPath, fileReaders, new YamlParser(), new InMemoryFileOutput(fileReaders), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const charterVendoringApp = new CharterVendoring(repoPath, fileReaders, sourceFetcher, new InMemoryFileOutput(fileReaders), new YamlParser());
  const testAuthoringApp = new TestAuthoring(repoPath, fileReaders, new InMemoryFileOutput(fileReaders));
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander({ cwd: "/repo", version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun }, COMMANDS).run(["portal"]);
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

const settings = new URL(".cw/settings.json", repoPath).href;

test("a folder set up with no version control is ready to serve (CORE-FR-107)", async () => {
  const fileReaders = new InMemoryFileReaders({ [settings]: '{ "agents": [] }' });
  const charterAuthoringApp = new CharterAuthoring(repoPath, fileReaders, new YamlParser(), new InMemoryFileOutput(fileReaders), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });

  await charterAuthoringApp.ensureRepoReady();
});

test("a folder with no version control never set up is refused, naming cw init and not git (CORE-FR-107)", async () => {
  const { code, results, problems } = await portal({});

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /never set up/);
  assert.match(problems, /cw init/);
  assert.doesNotMatch(problems, /git/);
});



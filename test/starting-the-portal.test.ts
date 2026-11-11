import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import {
  authoringCharterOf,
  buildingCharterOf,
  commandLineOf,
  workspaceAppOf,
  workspaceSettingsLoaderOf,
} from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");

/** `cw portal` as a user meets it, over a repository held in memory: the real
 *  command and the real service behind it, with both streams held so what the
 *  user reads can be read back. Only ever run where it is refused, since a
 *  portal that starts stays open. */
const portal = async (files: Readonly<Record<string, string>>) => {
  const fileReaders = new InMemoryFileReaders(files);
  const sourceFetcher = new InMemorySources();
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    { sourceFetcher },
  );
  const charterRuntimeApp = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const results: string[] = [];
  const problems: string[] = [];
  const kept = { out: process.stdout.write, err: process.stderr.write };
  process.stdout.write = ((text: string) => (results.push(text), true)) as typeof kept.out;
  process.stderr.write = ((text: string) => (problems.push(text), true)) as typeof kept.err;
  try {
    const code = await new Commander(
      commandLineOf(fileReaders, new InMemoryFileOutput(fileReaders), { charterAuthoringApp, charterRuntimeApp }),
      COMMANDS,
    ).run(["portal"]);
    return { code, results: results.join(""), problems: problems.join("") };
  } finally {
    process.stdout.write = kept.out;
    process.stderr.write = kept.err;
  }
};

const settings = new URL(".cw/settings.json", repoPath).href;

test("a folder set up with no version control is ready to serve (CORE-FR-107)", async () => {
  const fileReaders = new InMemoryFileReaders({ [settings]: '{ "agents": [] }' });
  const workspaceSettingsDTO = await workspaceAppOf(fileReaders).settings();

  assert.equal(workspaceSettingsDTO.type === "WorkspaceSettings" && workspaceSettingsDTO.data.isSetUp, true);
});

test("settings that do not read leave a set-up repository ready to serve, the page saying what is wrong with them (CORE-FR-107, SDK-FR-012)", async () => {
  const fileReaders = new InMemoryFileReaders({ [settings]: "not json at all\n" });

  assert.equal((await workspaceSettingsLoaderOf(fileReaders)()).type, "Fault");
});

test("a folder with no version control never set up is refused, naming cw init and not git (CORE-FR-107)", async () => {
  const { code, results, problems } = await portal({});

  assert.equal(code, EXIT_FAILURE);
  assert.equal(results, "");
  assert.match(problems, /never set up/);
  assert.match(problems, /cw init/);
  assert.doesNotMatch(problems, /git/);
});

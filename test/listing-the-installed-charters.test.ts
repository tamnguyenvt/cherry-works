import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf, faultOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const charterAt = (charterName: string, path: string) => new URL(`.cw/charter/${charterName}/${path}`, repoPath).href;
const installedCharterRecordTextOf = (charterName: string, source: string, version: string) =>
  `${JSON.stringify({ charter: charterName, source, version })}\n`;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** Three installed charters on disk — `baseline` from `acme/charters`, `rules`
 *  from `team/rules` and `skills` from `team/skills` — and one charter, `team`,
 *  authored here. */
const threeInstalledCharters = () =>
  new InMemoryFileReaders({
    [charterAt("baseline", "cw-package.json")]: installedCharterRecordTextOf("baseline", "acme/charters", "v1.0.0"),
    [charterAt("baseline", "guide/old/index.md")]: guide("old"),
    [charterAt("rules", "cw-package.json")]: installedCharterRecordTextOf("rules", "team/rules", "HEAD"),
    [charterAt("rules", "guide/small-diffs/index.md")]: guide("small-diffs"),
    [charterAt("skills", "cw-package.json")]: installedCharterRecordTextOf("skills", "team/skills", "v2"),
    [charterAt("skills", "guide/one-question/index.md")]: guide("one-question"),
    [charterAt("team", "guide/no-any/index.md")]: guide("no-any"),
  });

/** What `cw charter` printed, over one repository held in memory. */
async function listing(fileReaders: InMemoryFileReaders) {
  const said: string[] = [];
  const kept = process.stdout.write;
  process.stdout.write = ((text: string) => {
    said.push(String(text));
    return true;
  }) as typeof process.stdout.write;
  try {
    const sourceFetcher = new InMemorySources();
    const charterAuthoringApp = authoringCharterOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      new InMemoryReporter(),
      { sourceFetcher },
    );
    const charterRuntimeApps = buildingCharterOf(
      fileReaders,
      new InMemoryFileOutput(fileReaders),
      new InMemoryTokenCounter(),
      { claude: new InMemoryAgentCli() },
      new InMemoryReporter(),
    );
    const code = await new Commander(
      commandLineOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        { charterAuthoringApp, charterRuntimeApp: charterRuntimeApps },
        "/repo",
      ),
      COMMANDS,
    ).runCommandLine(["charter"]);
    return { code, said: said.join("") };
  } finally {
    process.stdout.write = kept;
  }
}

test("every installed charter is listed by name, with its source and version, sorted, and nothing authored here (FR-053, VENDOR Story 3 scenario 21)", async () => {
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        threeInstalledCharters(),
        new InMemoryFileOutput(new InMemoryFileReaders({})),
        new InMemoryReporter(),
        { sourceFetcher: new InMemorySources() },
      ).listCharters(true),
    ).data.charters.map(({ data: { name, source, version } }) => ({
      name,
      source,
      version,
    })),
    [
      { name: "baseline", source: "acme/charters", version: "v1.0.0" },
      { name: "rules", source: "team/rules", version: "HEAD" },
      { name: "skills", source: "team/skills", version: "v2" },
    ],
  );
});

test("a folder laid out the way an earlier version installed an installed charter is refused as the old layout, saying to install each source again (FR-180, VENDOR Story 3 scenario 4)", async () => {
  for (const installedCharterFilePath of [
    "legacy/guide/old/index.md",
    "team/rules/guide/old/index.md",
    "team/rules/README.md",
    "acme/charters/baseline/guide/old/index.md",
  ]) {
    const fileReaders = new InMemoryFileReaders({
      [new URL(`.cw/charter/vendor/${installedCharterFilePath}`, repoPath).href]: guide("old"),
    });

    const { name, message, fix } = faultOf(
      await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
        sourceFetcher: new InMemorySources(),
      }).listCharters(true),
    );
    assert.equal(name, "OldLayoutFault", installedCharterFilePath);
    assert.match(message, /is laid out the old way: \.cw\/charter\/vendor\/ sits/, installedCharterFilePath);
    assert.match(fix, /cw-author/, installedCharterFilePath);
    assert.match(
      fix,
      /delete each installed charter under \.cw\/charter\/vendor\/ and install it again with "cw charter pull"/,
      installedCharterFilePath,
    );
  }
});

test("a charter holding a folder an earlier version laid out is refused when listed and when built, naming that folder, with the fix to delete it and install its source again (CORE Story 30 scenario 3, FR-180, CORE Story 55 scenario 8, VENDOR Story 3 scenario 4)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [new URL(".cw/charter/vendor/legacy/guide/old/index.md", repoPath).href]: guide("old"),
    [new URL(".cw/settings.json", repoPath).href]: '{"agents":["claude"]}',
  });
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    {
      sourceFetcher: new InMemorySources(),
    },
  );
  const charterRuntimeApps = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );

  for (const refusalText of [
    faultTextOf(await charterAuthoringApp.listPrimitives()),
    faultTextOf(await charterRuntimeApps.buildCharter()),
  ]) {
    assert.match(refusalText, /is laid out the old way: \.cw\/charter\/vendor\/ sits/);
    assert.match(
      refusalText,
      /delete each installed charter under \.cw\/charter\/vendor\/ and install it again with "cw charter pull"/,
    );
  }
  assert.equal(
    await fileReaders.readIfThere(new URL(".cw/out/catalogue.json", repoPath)),
    undefined,
    "nothing is built",
  );
});

test("a file kept right in the charters' folder is no charter's", async () => {
  const fileReaders = new InMemoryFileReaders({
    [new URL(".cw/charter/.gitkeep", repoPath).href]: "",
  });

  assert.deepEqual(
    answerOf(
      await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
        sourceFetcher: new InMemorySources(),
      }).listCharters(true),
    ).data.charters,
    [],
  );
});

test("a repository with no installed charter lists none", async () => {
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        new InMemoryFileReaders({}),
        new InMemoryFileOutput(new InMemoryFileReaders({})),
        new InMemoryReporter(),
        { sourceFetcher: new InMemorySources() },
      ).listCharters(true),
    ).data.charters,
    [],
  );
});

test("cw charter prints each charter on a line of its own, an installed one with its source and version (VENDOR Story 3 scenario 21, VENDOR Story 7 scenario 1)", async () => {
  const { code, said } = await listing(threeInstalledCharters());

  assert.equal(code, EXIT_OK);
  assert.equal(
    said,
    "Charters\n  baseline  installed  acme/charters v1.0.0\n  rules     installed  team/rules HEAD\n  skills    installed  team/skills v2\n  team      authored\n",
  );
});

test("cw charter says when none is held, and how to make or install one", async () => {
  const { code, said } = await listing(new InMemoryFileReaders({}));

  assert.equal(code, EXIT_OK);
  assert.match(said, /No charter is held/);
  assert.match(said, /cw charter create/);
  assert.match(said, /cw charter pull/);
});

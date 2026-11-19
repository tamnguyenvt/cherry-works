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
const vendorRecordTextOf = (charterName: string, source: string, version: string) =>
  `${JSON.stringify({ charter: charterName, source, version })}\n`;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** Three installed charters on disk — `baseline` from `acme/charters`, `rules`
 *  from `team/rules` and `skills` from `team/skills` — and one charter, `team`,
 *  authored here. */
const threeVendors = () =>
  new InMemoryFileReaders({
    [charterAt("baseline", "cw-vendor.json")]: vendorRecordTextOf("baseline", "acme/charters", "v1.0.0"),
    [charterAt("baseline", "guide/old/index.md")]: guide("old"),
    [charterAt("rules", "cw-vendor.json")]: vendorRecordTextOf("rules", "team/rules", "HEAD"),
    [charterAt("rules", "guide/small-diffs/index.md")]: guide("small-diffs"),
    [charterAt("skills", "cw-vendor.json")]: vendorRecordTextOf("skills", "team/skills", "v2"),
    [charterAt("skills", "guide/one-question/index.md")]: guide("one-question"),
    [charterAt("team", "guide/no-any/index.md")]: guide("no-any"),
  });

/** What `cw vendor list` printed, over one repository held in memory. */
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
    ).runCommandLine(["vendor", "list"]);
    return { code, said: said.join("") };
  } finally {
    process.stdout.write = kept;
  }
}

test("every installed charter is listed by name, with its source and version, sorted, and nothing authored here (FR-053, VENDOR Story 3 scenario 21)", async () => {
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        threeVendors(),
        new InMemoryFileOutput(new InMemoryFileReaders({})),
        new InMemoryReporter(),
        { sourceFetcher: new InMemorySources() },
      ).listVendors(),
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

test("a folder laid out the way an earlier version installed a vendor is refused as the old layout, saying to install each source again (FR-180, VENDOR Story 3 scenario 4)", async () => {
  for (const vendorFilePath of [
    "legacy/guide/old/index.md",
    "team/rules/guide/old/index.md",
    "team/rules/README.md",
    "acme/charters/baseline/guide/old/index.md",
  ]) {
    const fileReaders = new InMemoryFileReaders({
      [new URL(`.cw/charter/vendor/${vendorFilePath}`, repoPath).href]: guide("old"),
    });

    const { name, message, fix } = faultOf(
      await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
        sourceFetcher: new InMemorySources(),
      }).listVendors(),
    );
    assert.equal(name, "OldLayoutFault", vendorFilePath);
    assert.match(message, /is laid out the old way: \.cw\/charter\/vendor\/ sits/, vendorFilePath);
    assert.match(fix, /cw-author/, vendorFilePath);
    assert.match(
      fix,
      /delete each vendor under \.cw\/charter\/vendor\/ and install it again with "cw vendor add"/,
      vendorFilePath,
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
      /delete each vendor under \.cw\/charter\/vendor\/ and install it again with "cw vendor add"/,
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
      }).listVendors(),
    ).data.charters,
    [],
  );
});

test("a repository with no vendor lists none", async () => {
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        new InMemoryFileReaders({}),
        new InMemoryFileOutput(new InMemoryFileReaders({})),
        new InMemoryReporter(),
        { sourceFetcher: new InMemorySources() },
      ).listVendors(),
    ).data.charters,
    [],
  );
});

test("cw vendor list prints each installed charter on a line of its own, with its source and version (VENDOR Story 3 scenario 21)", async () => {
  const { code, said } = await listing(threeVendors());

  assert.equal(code, EXIT_OK);
  assert.equal(
    said,
    "Installed charters\n  baseline  acme/charters v1.0.0\n  rules     team/rules HEAD\n  skills    team/skills v2\n",
  );
});

test("cw vendor list says when none is installed, and how to install one", async () => {
  const { code, said } = await listing(new InMemoryFileReaders({}));

  assert.equal(code, EXIT_OK);
  assert.match(said, /No charter is installed/);
  assert.match(said, /cw vendor add/);
});

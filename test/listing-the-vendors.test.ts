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
const vendoredAt = (vendor: string, path: string) => new URL(`.cw/charter/vendor/${vendor}/${path}`, repoPath).href;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** Three vendors on disk — `acme/charters/baseline` picked from a source of
 *  many, `team/rules/root` and `team/skills/root` each a source's own — and one
 *  guide authored here. */
const threeVendors = () =>
  new InMemoryFileReaders({
    [vendoredAt("acme/charters/baseline", "primitive/guide/old/index.md")]: guide("old"),
    [vendoredAt("team/rules/root", "primitive/guide/small-diffs/index.md")]: guide("small-diffs"),
    [vendoredAt("team/skills/root", "primitive/guide/one-question/index.md")]: guide("one-question"),
    [new URL(".cw/charter/primitive/guide/no-any/index.md", repoPath).href]: guide("no-any"),
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
    const charterRuntimeApp = buildingCharterOf(
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
        { charterAuthoringApp, charterRuntimeApp },
        "/repo",
      ),
      COMMANDS,
    ).runCommandLine(["vendor", "list"]);
    return { code, said: said.join("") };
  } finally {
    process.stdout.write = kept;
  }
}

test("every source folder under the vendor folder is listed by owner, repository and name, sorted, and nothing authored here (FR-053, CORE-FR-196)", async () => {
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        threeVendors(),
        new InMemoryFileOutput(new InMemoryFileReaders({})),
        new InMemoryReporter(),
        { sourceFetcher: new InMemorySources() },
      ).listVendors(),
    ).data.folders,
    [
      "file:///repo/.cw/charter/vendor/acme/charters/baseline",
      "file:///repo/.cw/charter/vendor/team/rules/root",
      "file:///repo/.cw/charter/vendor/team/skills/root",
    ],
  );
});

test("a folder laid out the way an earlier version installed a vendor is refused, saying to install each source again (FR-180)", async () => {
  for (const vendorFilePath of [
    "legacy/guide/old/index.md",
    "team/rules/guide/old/index.md",
    "team/rules/README.md",
    "acme/charters/baseline/guide/old/index.md",
  ]) {
    const fileReaders = new InMemoryFileReaders({
      [new URL(`.cw/charter/vendor/${vendorFilePath}`, repoPath).href]: guide("old"),
    });

    const { message, fix } = faultOf(
      await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
        sourceFetcher: new InMemorySources(),
      }).listVendors(),
    );
    assert.match(message, /is laid out the way an earlier version installed a vendor/, vendorFilePath);
    assert.match(fix, /install each source again with "cw vendor add"/, vendorFilePath);
  }
});

test("a charter holding a folder an earlier version laid out is refused when listed and when built, naming that folder, with the fix to delete it and install its source again (CORE Story 30 scenario 3, FR-180, CORE Story 55 scenario 8)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [vendoredAt("legacy", "guide/old/index.md")]: guide("old"),
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
  const charterRuntimeApp = buildingCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );

  for (const refusalText of [
    faultTextOf(await charterAuthoringApp.listPrimitives()),
    faultTextOf(await charterRuntimeApp.buildCharter()),
  ]) {
    assert.match(
      refusalText,
      /\.cw\/charter\/vendor\/legacy is laid out the way an earlier version installed a vendor/,
    );
    assert.match(refusalText, /Delete it, then install each source again with "cw vendor add"/);
  }
  assert.equal(
    await fileReaders.readIfThere(new URL(".cw/out/catalogue.json", repoPath)),
    undefined,
    "nothing is built",
  );
});

test("a file kept right in the vendor folder is no vendor's", async () => {
  const fileReaders = new InMemoryFileReaders({ [new URL(".cw/charter/vendor/.gitkeep", repoPath).href]: "" });

  assert.deepEqual(
    answerOf(
      await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
        sourceFetcher: new InMemorySources(),
      }).listVendors(),
    ).data.folders,
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
    ).data.folders,
    [],
  );
});

test("cw vendor list prints each folder on a line of its own", async () => {
  const { code, said } = await listing(threeVendors());

  assert.equal(code, EXIT_OK);
  assert.equal(
    said,
    ".cw/charter/vendor/acme/charters/baseline\n.cw/charter/vendor/team/rules/root\n.cw/charter/vendor/team/skills/root\n",
  );
});

test("cw vendor list says when none is installed, and how to install one", async () => {
  const { code, said } = await listing(new InMemoryFileReaders({}));

  assert.equal(code, EXIT_OK);
  assert.match(said, /No vendor source is installed/);
  assert.match(said, /cw vendor add/);
});

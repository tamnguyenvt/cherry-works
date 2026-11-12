import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const repo = "/repo";

/** A charter nothing here builds or tests: a context carries every
 *  application, and these commands reach for the authoring one only. */
const unbuilt = () => {
  const files = new InMemoryFileReaders({});
  return buildingCharterOf(
    files,
    new InMemoryFileOutput(files),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
};

/** One run of the command line over sources held in memory, and what it
 *  wrote. The command line writes to the process it runs in, so what a user
 *  reads is read from there. */
async function running(
  argv: readonly string[],
  sourceFetcher: InMemorySources = new InMemorySources(),
  fileReaders: InMemoryFileReaders = new InMemoryFileReaders({}),
) {
  const commandOutput: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      commandOutput.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const context = {
      cwd: repo,
      version: "0.0.0",
      charterAuthoringApp: authoringCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryReporter(),
        { sourceFetcher },
      ),
      charterRuntimeApp: unbuilt(),
    };
    const code = await new Commander(
      commandLineOf(fileReaders, new InMemoryFileOutput(fileReaders), context, context.cwd),
      COMMANDS,
    ).runCommandLine(argv);
    return { code, commandOutput: commandOutput.join(""), sourceFetcher, fileReaders };
  } finally {
    for (const [index, stream] of streams.entries()) stream.write = kept[index] as typeof stream.write;
  }
}

test("a source's charter folder is installed under the folder its owner and its repository name (FR-050)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(["vendor", "add", "git@github.com:team/charter.git"]);

  assert.equal(code, EXIT_OK);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "git@github.com:team/charter.git" }]);
  assert.deepEqual(sourceFetcher.checkedOutFolders, [
    {
      commit: "git@github.com:team/charter.git",
      fromFolder: ".cw/charter/primitive",
      intoSubFolder: ".cw/charter/vendor/team/charter/root/primitive",
    },
  ]);
  assert.match(commandOutput, /\.cw\/charter\/vendor\/team\/charter\/root/);
  assert.match(commandOutput, /cw build/, "what is installed is compiled by the one command that writes");
});

test("the source is passed on as it was typed, whatever transport it names, into the folder of its owner and its repository (FR-050)", async () => {
  for (const [source, intoSubFolder] of [
    ["https://github.com/team/charter.git", ".cw/charter/vendor/team/charter/root/primitive"],
    ["git@github.com:team/charter.git", ".cw/charter/vendor/team/charter/root/primitive"],
    ["ssh://git@git.example.com:2222/team/charter", ".cw/charter/vendor/team/charter/root/primitive"],
    ["https://gitlab.com/group/team/charter", ".cw/charter/vendor/team/charter/root/primitive"],
    ["/srv/charters/charter", ".cw/charter/vendor/charters/charter/root/primitive"],
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

  assert.deepEqual(
    sourceFetcher.checkedOutFolders.map(({ intoSubFolder }) => intoSubFolder),
    [".cw/charter/vendor/acme/skills/root/primitive", ".cw/charter/vendor/other/skills/root/primitive"],
  );
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
  assert.match(commandOutput, /holds "\.cw\/charter\/vendor"/);
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
  const { code, sourceFetcher, fileReaders } = await running(
    ["vendor", "add", "team/charter"],
    undefined,
    fileReadersHoldingVendor("other/charter/root"),
  );

  assert.equal(code, EXIT_OK);
  assert.equal(sourceFetcher.checkedOutFolders[0]?.intoSubFolder, ".cw/charter/vendor/team/charter/root/primitive");
  assert.equal(await fileReaders.readFile(new URL(`file://${repo}/work.txt`)), "In hand.\n");
});

/** One repository holding this vendor, two guides, beside work of its own. */
const fileReadersHoldingVendor = (vendorName: string) =>
  new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/vendor/${vendorName}/primitive/guide/one/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/.cw/charter/vendor/${vendorName}/primitive/guide/two/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/work.txt`]: "In hand.\n",
  });

/** Every file left under the vendor folder. */
const vendoredFiles = async (fileReaders: InMemoryFileReaders) =>
  (await fileReaders.readFilesRecursively(new URL(`file://${repo}/.cw/charter/vendor/`))).map(
    ({ fileUrl }) => fileUrl.href,
  );

test("an installed charter is taken away by the folder it was installed as, owner, repository and name (CORE Story 37 scenario 2)", async () => {
  const { code, commandOutput, fileReaders } = await running(
    ["vendor", "remove", "team/charter/root"],
    undefined,
    fileReadersHoldingVendor("team/charter/root"),
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(await vendoredFiles(fileReaders), []);
  assert.equal(
    await fileReaders.readFile(new URL(`file://${repo}/work.txt`)),
    "In hand.\n",
    "the work in hand is as it was",
  );
});

test("a source an earlier version named by its repository alone is refused, saying to install it again, and nothing is taken away (FR-180)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`]: "---\nkind: guide\n---\n",
  });
  const { code, commandOutput } = await running(["vendor", "remove", "charter"], undefined, fileReaders);

  assert.equal(code, EXIT_FAILURE, commandOutput);
  assert.match(
    commandOutput,
    /\.cw\/charter\/vendor\/charter is laid out the way an earlier version installed a vendor/,
  );
  assert.match(commandOutput, /install each source again with "cw vendor add"/);
  assert.equal((await vendoredFiles(fileReaders)).length, 1);
});

test("a name no vendor folder answers to is refused, and nothing changes (CORE Story 37 scenario 3)", async () => {
  for (const name of ["absent/charter/root", "team/charter", "team"]) {
    const { code, commandOutput, fileReaders } = await running(
      ["vendor", "remove", name],
      undefined,
      fileReadersHoldingVendor("team/charter/root"),
    );

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
    const { code, commandOutput, fileReaders } = await running(
      ["vendor", "remove", name],
      undefined,
      fileReadersHoldingVendor("team/charter/root"),
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.equal((await vendoredFiles(fileReaders)).length, 2, name);
    assert.match(commandOutput, /No vendor folder is named/, name);
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
  sourceFetcher.sourceFilesBySource["team/skills"] = {
    "skills/grill/SKILL.md": "---\nname: grill-me\ndescription: Ask questions.\n---\nAsk.\n",
  };
  const { code, commandOutput } = await running(
    ["vendor", "inject", "team/skills", "--ref", "v1", "--skill", "grill-me"],
    sourceFetcher,
  );
  assert.equal(code, EXIT_OK);
  assert.match(commandOutput, /Injected skill grill-me/);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/skills", version: "v1" }]);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

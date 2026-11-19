import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IN_MEMORY_COMMIT_ID,
  InMemorySources,
} from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, installedFoldersOf } from "./use-cases-of.js";

const repo = "/repo";

/** What every source here publishes unless a test says otherwise: one charter,
 *  `published`, holding one guide. */
const publishedCharterFiles = {
  ".cw/charter/published/primitive/guide/published/index.md":
    "---\nkind: guide\nid: published\ndescription: Published.\n---\n",
  "README.md": "# Published\n",
};

/** Sources held in memory, each of these addresses publishing the charter
 *  `published`. The sources held in memory read the version asked for after
 *  an `@`, so an address holding one is published by what comes before it. */
const sourcesPublishing = (sources: readonly string[], fileReaders?: InMemoryFileReaders) => {
  const sourceFetcher = new InMemorySources(fileReaders);
  for (const source of sources)
    sourceFetcher.sourceFilesBySource[source.split("@")[0] ?? source] = publishedCharterFiles;
  return sourceFetcher;
};

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

test("a source's charter is installed under the folder of its name, among the repository's charters (FR-050, CORE Story 30 scenario 1, VENDOR Story 3 scenario 14)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(
    ["vendor", "add", "git@github.com:team/charter.git"],
    sourcesPublishing(["git@github.com:team/charter.git"]),
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "git@github.com:team/charter.git" }]);
  assert.deepEqual(installedFoldersOf(sourceFetcher), [
    {
      commit: "git@github.com:team/charter.git",
      fromFolder: ".cw/charter/published/primitive/guide/published",
      intoSubFolder: ".cw/charter/published/primitive/guide/published",
    },
  ]);
  assert.match(commandOutput, /\.cw\/charter\/published/);
  assert.match(commandOutput, /cw build/, "what is installed is compiled by the one command that writes");
});

test("the source is passed on as it was typed, whatever transport it names, and its cw-vendor.json names it so (FR-050, VENDOR Story 3 scenario 14)", async () => {
  for (const source of [
    "https://github.com/team/charter.git",
    "git@github.com:team/charter.git",
    "ssh://git@git.example.com:2222/team/charter",
    "https://gitlab.com/charter/team/charter",
    "/srv/charters/charter",
  ]) {
    const fileReaders = new InMemoryFileReaders({});
    const sourceFetcher = sourcesPublishing([source], fileReaders);
    await running(["vendor", "add", source], sourceFetcher, fileReaders);
    assert.equal(sourceFetcher.fetchedSources[0]?.source, source);
    assert.equal(
      installedFoldersOf(sourceFetcher)[0]?.intoSubFolder,
      ".cw/charter/published/primitive/guide/published",
      source,
    );
    assert.deepEqual(
      JSON.parse(await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/published/cw-vendor.json`))),
      { charter: "published", source, version: IN_MEMORY_COMMIT_ID },
      source,
    );
  }
});

test("two sources publishing one charter name land side by side once the second is installed --as another name, and not before (FR-050, SC-051, CORE Story 2 scenario 1, CORE Story 30 scenario 2, VENDOR Story 3 scenarios 18, 19)", async () => {
  const fileReaders = new InMemoryFileReaders({});
  const sourceFetcher = sourcesPublishing(["acme/skills"], fileReaders);
  // The same charter name, holding an id of its own: one id names one primitive
  // in the whole charter.
  sourceFetcher.sourceFilesBySource["other/skills"] = {
    ".cw/charter/published/primitive/guide/other-guide/index.md":
      "---\nkind: guide\nid: other-guide\ndescription: Other.\n---\n",
  };
  assert.equal((await running(["vendor", "add", "acme/skills"], sourceFetcher, fileReaders)).code, EXIT_OK);

  const refusedRun = await running(["vendor", "add", "other/skills"], sourceFetcher, fileReaders);
  assert.equal(refusedRun.code, EXIT_FAILURE);
  assert.match(refusedRun.commandOutput, /installed from acme\/skills/);
  assert.match(refusedRun.commandOutput, /--as/);
  const asRun = await running(["vendor", "add", "other/skills", "--as=other-published"], sourceFetcher, fileReaders);
  assert.equal(asRun.code, EXIT_OK, asRun.commandOutput);

  assert.deepEqual(
    installedFoldersOf(sourceFetcher).map(({ intoSubFolder }) => intoSubFolder),
    [".cw/charter/published/primitive/guide/published", ".cw/charter/other-published/primitive/guide/other-guide"],
  );
});

test("a source whose address names its repository alone is installed, its charter landing under its own name; one naming no repository folder is refused, and nothing is installed (FR-044, FR-049, FR-050)", async () => {
  const { code: lonePathCode, sourceFetcher: lonePathFetcher } = await running(
    ["vendor", "add", "charter"],
    sourcesPublishing(["charter"]),
  );
  assert.equal(lonePathCode, EXIT_OK);
  assert.equal(lonePathFetcher.fetchedSources[0]?.source, "charter");

  for (const source of ["https://example.com/", "team/.."]) {
    const { code, commandOutput, sourceFetcher } = await running(["vendor", "add", source]);

    assert.equal(code, EXIT_FAILURE, source);
    assert.deepEqual(installedFoldersOf(sourceFetcher), [], source);
    assert.match(commandOutput, /names no repository folder/, source);
  }
});

test("a version is what the source is pinned to (CORE Story 2 scenario 1)", async () => {
  const { commandOutput, sourceFetcher } = await running(
    ["vendor", "add", "team/charter", "--ref", "v1.2.0"],
    sourcesPublishing(["team/charter"]),
  );

  assert.equal(sourceFetcher.fetchedSources[0]?.version, "v1.2.0");
  assert.match(commandOutput, /v1\.2\.0/);
});

test("a source authoring no charter at the version asked for is refused as no vendor, saying how to make it one, and nothing is installed (CORE Story 2 scenario 4, CORE-FR-042, CORE Story 55 scenario 8)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/notes");

  const { code, commandOutput, fileReaders } = await running(
    ["vendor", "add", "team/notes", "--ref", "v1.2.0"],
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.deepEqual(await vendoredFiles(fileReaders), []);
  assert.match(commandOutput, /is no vendor: it authors no charter\./);
  assert.match(commandOutput, /at the version asked for/);
});

test("a source keeping vendors of its own the old way, under .cw/charter/vendor/, is refused as laid out the old way (VENDOR Story 3 scenario 4)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/stacked"] = {
    ...publishedCharterFiles,
    ".cw/charter/vendor/other/guide/x/index.md": "x",
  };

  const { code, commandOutput } = await running(["vendor", "add", "team/stacked"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.match(commandOutput, /team\/stacked is laid out the old way: \.cw\/charter\/vendor\/ sits/);
});

test("a machine with no git is told so, and nothing is installed (CORE Story 37 scenario 4)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.hasNoGit = true;

  const { code, commandOutput } = await running(["vendor", "add", "team/charter"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.match(commandOutput, /needs git/);
});

test("what was fetched is let go of, installed or refused", async () => {
  const sourceFetcher = sourcesPublishing(["team/charter"]);
  sourceFetcher.sourcesWithoutSubFolder.push("team/empty");

  await running(["vendor", "add", "team/charter"], sourceFetcher);
  await running(["vendor", "add", "team/empty"], sourceFetcher);

  await running(["vendor", "inject", "team/empty"], sourceFetcher);

  assert.deepEqual(sourceFetcher.forgottenCommits, ["team/charter", "team/empty", "team/empty"]);
});

test("a repository with work in hand installs all the same, and that work is as it was", async () => {
  const { code, sourceFetcher, fileReaders } = await running(
    ["vendor", "add", "team/charter"],
    sourcesPublishing(["team/charter"]),
    fileReadersHoldingVendor("charter"),
  );

  assert.equal(code, EXIT_OK);
  assert.equal(installedFoldersOf(sourceFetcher)[0]?.intoSubFolder, ".cw/charter/published/primitive/guide/published");
  assert.equal(await fileReaders.readFile(new URL(`file://${repo}/work.txt`)), "In hand.\n");
});

/** One repository holding this installed charter, two guides beside its
 *  cw-vendor.json, beside work of its own. */
const fileReadersHoldingVendor = (charterName: string) =>
  new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/${charterName}/cw-vendor.json`]: `${JSON.stringify({ charter: charterName, source: "other/charter", version: "HEAD" })}\n`,
    [`file://${repo}/.cw/charter/${charterName}/primitive/guide/one/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/.cw/charter/${charterName}/primitive/guide/two/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/work.txt`]: "In hand.\n",
  });

/** Every file left among the repository's charters. */
const vendoredFiles = async (fileReaders: InMemoryFileReaders) =>
  (await fileReaders.readFilesRecursively(new URL(`file://${repo}/.cw/charter/`))).map(({ fileUrl }) => fileUrl.href);

test("an installed charter is taken away whole by its name (CORE Story 37 scenario 2, VENDOR Story 3 scenario 21)", async () => {
  const { code, commandOutput, fileReaders } = await running(
    ["vendor", "remove", "charter"],
    undefined,
    fileReadersHoldingVendor("charter"),
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(await vendoredFiles(fileReaders), []);
  assert.equal(
    await fileReaders.readFile(new URL(`file://${repo}/work.txt`)),
    "In hand.\n",
    "the work in hand is as it was",
  );
});

test("vendor commands leave what the engine brings alone: it is listed as no vendor, removed by no name, and still read after a vendor goes (CORE Story 12 scenario 6, FR-023, CORE Story 55 scenario 3)", async () => {
  const builtSkillUrls = [".cw/out/skill/cw-author/index.md", ".claude/skills/cw-author/SKILL.md"].map(
    (path) => new URL(`file://${repo}/${path}`),
  );
  const fileReaders = fileReadersHoldingVendor("charter");
  for (const builtSkillUrl of builtSkillUrls) fileReaders.writeFile(builtSkillUrl, "As the last build wrote it.\n");

  const listingRun = await running(["vendor", "list"], undefined, fileReaders);
  assert.equal(listingRun.code, EXIT_OK, listingRun.commandOutput);
  assert.match(listingRun.commandOutput, /charter {2}other\/charter HEAD/);
  assert.doesNotMatch(listingRun.commandOutput, /builtin|built into cw|cw-author/);
  for (const builtinName of ["builtin", "cw-author", "builtin/skill/cw-author"]) {
    const removingRun = await running(["vendor", "remove", builtinName], undefined, fileReaders);
    assert.equal(removingRun.code, EXIT_FAILURE, builtinName);
    assert.match(removingRun.commandOutput, /No charter is named/, builtinName);
  }
  assert.equal((await running(["vendor", "remove", "charter"], undefined, fileReaders)).code, EXIT_OK);

  for (const builtSkillUrl of builtSkillUrls)
    assert.equal(await fileReaders.readFile(builtSkillUrl), "As the last build wrote it.\n", builtSkillUrl.href);
  const cwAuthorExplanation = answerOf(
    await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter()).explainPrimitive(
      "cw-author",
    ),
  );
  assert.match(JSON.stringify(cwAuthorExplanation), /"builtin"/);
});

test("a vendor laid out the old way, removed and installed again, lands in a charter of its own, and the old folder is gone (CORE Story 30 scenario 4, FR-050, CORE Story 55 scenario 7, VENDOR Story 3 scenario 4)", async () => {
  const oldGuideUrl = new URL(`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`);
  const fileReaders = new InMemoryFileReaders({ [oldGuideUrl.href]: "---\nkind: guide\n---\n" });
  const sourceFetcher = sourcesPublishing(["team/charter"], fileReaders);
  assert.equal((await running(["vendor", "list"], sourceFetcher, fileReaders)).code, EXIT_FAILURE);

  // What the refusal says to do: delete the folder, then install the source again.
  fileReaders.removeFile(oldGuideUrl);
  const { code, commandOutput } = await running(["vendor", "add", "team/charter"], sourceFetcher, fileReaders);

  assert.equal(code, EXIT_OK, commandOutput);
  const vendoredPaths = await vendoredFiles(fileReaders);
  assert.ok(vendoredPaths.length > 0);
  for (const vendoredPath of vendoredPaths)
    assert.ok(vendoredPath.startsWith(`file://${repo}/.cw/charter/published/`), vendoredPath);
  const listingRun = await running(["vendor", "list"], sourceFetcher, fileReaders);
  assert.equal(listingRun.code, EXIT_OK, listingRun.commandOutput);
  assert.match(listingRun.commandOutput, new RegExp(`published {2}team/charter ${IN_MEMORY_COMMIT_ID}`));
});

test("a source an earlier version named by its repository alone is refused as the old layout, saying to install it again, and nothing is taken away (FR-180, VENDOR Story 3 scenario 4)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`]: "---\nkind: guide\n---\n",
  });
  const { code, commandOutput } = await running(["vendor", "remove", "charter"], undefined, fileReaders);

  assert.equal(code, EXIT_FAILURE, commandOutput);
  assert.match(commandOutput, /is laid out the old way: \.cw\/charter\/vendor\/ sits/);
  assert.match(
    commandOutput,
    /delete each vendor under \.cw\/charter\/vendor\/ and install it again with "cw vendor add"/,
  );
  assert.equal(
    await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`)),
    "---\nkind: guide\n---\n",
  );
});

test("a name no installed charter answers to is refused, and nothing changes (CORE Story 37 scenario 3, VENDOR Story 3 scenario 21)", async () => {
  for (const name of ["absent", "other/charter", "charter/guide"]) {
    const { code, commandOutput, fileReaders } = await running(
      ["vendor", "remove", name],
      undefined,
      fileReadersHoldingVendor("charter"),
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(commandOutput, /No charter is named/, name);
    assert.equal((await vendoredFiles(fileReaders)).length, 3, name);
  }
});

test("a source nobody named is a usage error, not a vendoring one", async () => {
  const { code, sourceFetcher } = await running(["vendor", "add"]);

  assert.equal(code, EXIT_USAGE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a name that is no folder is refused, and nothing is taken away (FR-044)", async () => {
  for (const name of ["..", ".", "team/..", "../../src", "charter/team/charter/more"]) {
    const { code, commandOutput, fileReaders } = await running(
      ["vendor", "remove", name],
      undefined,
      fileReadersHoldingVendor("charter"),
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.equal((await vendoredFiles(fileReaders)).length, 3, name);
    assert.match(commandOutput, /No charter is named/, name);
  }
});

test("vendor inject exposes the same source, version and charter flags as add (CORE-FR-198)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(
    ["vendor", "inject", "team/charter", "--ref", "v1", "--charter", "published"],
    sourcesPublishing(["team/charter"]),
  );
  assert.equal(code, EXIT_OK, commandOutput);
  assert.match(commandOutput, /Injected guide published/);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/charter", version: "v1" }]);
  assert.deepEqual(installedFoldersOf(sourceFetcher), [
    {
      commit: "team/charter@v1",
      fromFolder: ".cw/charter/published/primitive/guide/published",
      intoSubFolder: ".cw/charter/published/primitive/guide/published",
    },
  ]);
});

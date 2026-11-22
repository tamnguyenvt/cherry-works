import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthoringCharter } from "../src/module/charter/app/authoring-charter.use-case.js";
import { loadCharterService } from "../src/module/charter/app/services/load-charter.service.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import {
  IN_MEMORY_COMMIT_ID,
  InMemorySources,
} from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { UnwritableFileFault } from "../src/module/shared/domain/models/adapter.fault.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { SystemClock } from "../src/module/shared/infra/system-clock.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf } from "./answer-of.js";
import {
  authoringCharterOf,
  buildingCharterOf,
  charterRepositoryOf,
  commandLineOf,
  installedFoldersOf,
} from "./use-cases-of.js";

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
    ["charter", "pull", "git@github.com:team/charter.git"],
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

test("the source is passed on as it was typed, whatever transport it names, and its cw-package.json names it so (FR-050, VENDOR Story 3 scenario 14)", async () => {
  for (const source of [
    "https://github.com/team/charter.git",
    "git@github.com:team/charter.git",
    "ssh://git@git.example.com:2222/team/charter",
    "https://gitlab.com/charter/team/charter",
    "/srv/charters/charter",
  ]) {
    const fileReaders = new InMemoryFileReaders({});
    const sourceFetcher = sourcesPublishing([source], fileReaders);
    await running(["charter", "pull", source], sourceFetcher, fileReaders);
    assert.equal(sourceFetcher.fetchedSources[0]?.source, source);
    assert.equal(
      installedFoldersOf(sourceFetcher)[0]?.intoSubFolder,
      ".cw/charter/published/primitive/guide/published",
      source,
    );
    assert.deepEqual(
      JSON.parse(await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/published/cw-package.json`))),
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
  assert.equal((await running(["charter", "pull", "acme/skills"], sourceFetcher, fileReaders)).code, EXIT_OK);

  const refusedRun = await running(["charter", "pull", "other/skills"], sourceFetcher, fileReaders);
  assert.equal(refusedRun.code, EXIT_FAILURE);
  assert.match(refusedRun.commandOutput, /installed from acme\/skills/);
  assert.match(refusedRun.commandOutput, /--as/);
  const asRun = await running(["charter", "pull", "other/skills", "--as=other-published"], sourceFetcher, fileReaders);
  assert.equal(asRun.code, EXIT_OK, asRun.commandOutput);

  assert.deepEqual(
    installedFoldersOf(sourceFetcher).map(({ intoSubFolder }) => intoSubFolder),
    [".cw/charter/published/primitive/guide/published", ".cw/charter/other-published/primitive/guide/other-guide"],
  );
});

test("a source whose address names its repository alone is installed, its charter landing under its own name; one naming no repository folder is refused, and nothing is installed (FR-044, FR-049, FR-050)", async () => {
  const { code: lonePathCode, sourceFetcher: lonePathFetcher } = await running(
    ["charter", "pull", "charter"],
    sourcesPublishing(["charter"]),
  );
  assert.equal(lonePathCode, EXIT_OK);
  assert.equal(lonePathFetcher.fetchedSources[0]?.source, "charter");

  for (const source of ["https://example.com/", "team/.."]) {
    const { code, commandOutput, sourceFetcher } = await running(["charter", "pull", source]);

    assert.equal(code, EXIT_FAILURE, source);
    assert.deepEqual(installedFoldersOf(sourceFetcher), [], source);
    assert.match(commandOutput, /names no repository folder/, source);
  }
});

test("a version is what the source is pinned to (CORE Story 2 scenario 1)", async () => {
  const { commandOutput, sourceFetcher } = await running(
    ["charter", "pull", "team/charter", "--ref", "v1.2.0"],
    sourcesPublishing(["team/charter"]),
  );

  assert.equal(sourceFetcher.fetchedSources[0]?.version, "v1.2.0");
  assert.match(commandOutput, /v1\.2\.0/);
});

test("a source holding no charter at the version asked for is refused as no charter source, saying how to make it one, and nothing is installed (CORE Story 2 scenario 4, CORE-FR-042, CORE Story 55 scenario 8)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/notes");

  const { code, commandOutput, fileReaders } = await running(
    ["charter", "pull", "team/notes", "--ref", "v1.2.0"],
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.deepEqual(await installedFiles(fileReaders), []);
  assert.match(commandOutput, /is no charter source: it holds no charter\./);
  assert.match(commandOutput, /at the version asked for/);
});

test("a source keeping installed charters of its own the old way, under .cw/charter/vendor/, is refused as laid out the old way (CORE-FR-226, CORE Story 52 scenario 9)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/stacked"] = {
    ...publishedCharterFiles,
    ".cw/charter/vendor/other/guide/x/index.md": "x",
  };

  const { code, commandOutput } = await running(["charter", "pull", "team/stacked"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.match(commandOutput, /team\/stacked is laid out the old way: \.cw\/charter\/vendor\/ sits/);
});

test("a machine with no git is told so, and nothing is installed (CORE Story 37 scenario 4)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.hasNoGit = true;

  const { code, commandOutput } = await running(["charter", "pull", "team/charter"], sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.match(commandOutput, /needs git/);
});

test("what was fetched is let go of, installed or refused", async () => {
  const sourceFetcher = sourcesPublishing(["team/charter"]);
  sourceFetcher.sourcesWithoutSubFolder.push("team/empty");

  await running(["charter", "pull", "team/charter"], sourceFetcher);
  await running(["charter", "pull", "team/empty"], sourceFetcher);

  await running(["charter", "pull", "team/empty", "--fork"], sourceFetcher);

  assert.deepEqual(sourceFetcher.forgottenCommits, ["team/charter", "team/empty", "team/empty"]);
});

test("a repository with work in hand installs all the same, and that work is as it was", async () => {
  const { code, sourceFetcher, fileReaders } = await running(
    ["charter", "pull", "team/charter"],
    sourcesPublishing(["team/charter"]),
    fileReadersHoldingInstalledCharter("charter"),
  );

  assert.equal(code, EXIT_OK);
  assert.equal(installedFoldersOf(sourceFetcher)[0]?.intoSubFolder, ".cw/charter/published/primitive/guide/published");
  assert.equal(await fileReaders.readFile(new URL(`file://${repo}/work.txt`)), "In hand.\n");
});

/** One repository holding this installed charter, two guides beside its
 *  cw-package.json, beside work of its own. */
const fileReadersHoldingInstalledCharter = (charterName: string) =>
  new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/${charterName}/cw-package.json`]: `${JSON.stringify({ charter: charterName, source: "other/charter", version: "HEAD" })}\n`,
    [`file://${repo}/.cw/charter/${charterName}/primitive/guide/one/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/.cw/charter/${charterName}/primitive/guide/two/index.md`]: "---\nkind: guide\n---\n",
    [`file://${repo}/work.txt`]: "In hand.\n",
  });

/** Every file left among the repository's charters. */
const installedFiles = async (fileReaders: InMemoryFileReaders) =>
  (await fileReaders.readFilesRecursively(new URL(`file://${repo}/.cw/charter/`))).map(({ fileUrl }) => fileUrl.href);

test("cw list --charter lists that charter's primitives alone, and refuses a name no charter is held under, naming those held (VENDOR Story 3 scenario 33, VENDOR-FR-016)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/charter/cw-package.json`]: `${JSON.stringify({ charter: "charter", source: "other/charter", version: "HEAD" })}\n`,
    [`file://${repo}/.cw/charter/charter/primitive/guide/one/index.md`]:
      "---\nkind: guide\nid: one\ndescription: One.\n---\n",
    [`file://${repo}/.cw/charter/team/primitive/guide/three/index.md`]:
      "---\nkind: guide\nid: three\ndescription: Three.\n---\n",
  });

  const listingRun = await running(["list", "--charter=team"], undefined, fileReaders);
  assert.equal(listingRun.code, EXIT_OK, listingRun.commandOutput);
  assert.match(listingRun.commandOutput, /\bthree\b/);
  assert.doesNotMatch(listingRun.commandOutput, /\bone\b/);

  const unknownRun = await running(["list", "--charter=nope"], undefined, fileReaders);
  assert.equal(unknownRun.code, EXIT_FAILURE, unknownRun.commandOutput);
  assert.match(unknownRun.commandOutput, /charter, team/);
});

test("an installed charter is taken away whole by its name (CORE Story 37 scenario 2, VENDOR Story 3 scenario 21)", async () => {
  const { code, commandOutput, fileReaders } = await running(
    ["charter", "remove", "--charter=charter"],
    undefined,
    fileReadersHoldingInstalledCharter("charter"),
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(await installedFiles(fileReaders), []);
  assert.equal(
    await fileReaders.readFile(new URL(`file://${repo}/work.txt`)),
    "In hand.\n",
    "the work in hand is as it was",
  );
});

test("installed charter commands leave what the engine brings alone: it is listed as no installed charter, removed or updated by no name, and still read after an installed charter goes (CORE Story 12 scenario 6, FR-023, CORE Story 55 scenario 3)", async () => {
  const builtSkillUrls = [".cw/out/skill/cw-author/index.md", ".claude/skills/cw-author/SKILL.md"].map(
    (path) => new URL(`file://${repo}/${path}`),
  );
  const fileReaders = fileReadersHoldingInstalledCharter("charter");
  for (const builtSkillUrl of builtSkillUrls) fileReaders.writeFile(builtSkillUrl, "As the last build wrote it.\n");

  const listingRun = await running(["charter"], undefined, fileReaders);
  assert.equal(listingRun.code, EXIT_OK, listingRun.commandOutput);
  assert.match(listingRun.commandOutput, /charter {2}installed {2}other\/charter HEAD/);
  assert.doesNotMatch(listingRun.commandOutput, /builtin|built into cw|cw-author/);
  for (const builtinName of ["builtin", "cw-author", "builtin/skill/cw-author"]) {
    const removingRun = await running(["charter", "remove", `--charter=${builtinName}`], undefined, fileReaders);
    assert.equal(removingRun.code, EXIT_FAILURE, builtinName);
    assert.match(removingRun.commandOutput, /holds no charter/, builtinName);
    const updatingRun = await running(["charter", "update", `--charter=${builtinName}`], undefined, fileReaders);
    assert.equal(updatingRun.code, EXIT_FAILURE, builtinName);
  }
  assert.equal((await running(["charter", "remove", "--charter=charter"], undefined, fileReaders)).code, EXIT_OK);

  for (const builtSkillUrl of builtSkillUrls)
    assert.equal(await fileReaders.readFile(builtSkillUrl), "As the last build wrote it.\n", builtSkillUrl.href);
  const cwAuthorExplanation = answerOf(
    await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter()).explainPrimitive(
      "cw-author",
    ),
  );
  assert.match(JSON.stringify(cwAuthorExplanation), /"builtin"/);
});

test("an installed charter laid out the old way, removed and installed again, lands in a charter of its own, and the old folder is gone (CORE Story 30 scenario 4, FR-050, CORE Story 55 scenario 7, VENDOR Story 3 scenario 4)", async () => {
  const oldGuideUrl = new URL(`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`);
  const fileReaders = new InMemoryFileReaders({ [oldGuideUrl.href]: "---\nkind: guide\n---\n" });
  const sourceFetcher = sourcesPublishing(["team/charter"], fileReaders);
  assert.equal((await running(["charter"], sourceFetcher, fileReaders)).code, EXIT_FAILURE);

  // What the refusal says to do: delete the folder, then install the source again.
  fileReaders.removeFile(oldGuideUrl);
  const { code, commandOutput } = await running(["charter", "pull", "team/charter"], sourceFetcher, fileReaders);

  assert.equal(code, EXIT_OK, commandOutput);
  const installedPaths = await installedFiles(fileReaders);
  assert.ok(installedPaths.length > 0);
  for (const installedPath of installedPaths)
    assert.ok(installedPath.startsWith(`file://${repo}/.cw/charter/published/`), installedPath);
  const listingRun = await running(["charter"], sourceFetcher, fileReaders);
  assert.equal(listingRun.code, EXIT_OK, listingRun.commandOutput);
  assert.match(listingRun.commandOutput, new RegExp(`published {2}installed {2}team/charter ${IN_MEMORY_COMMIT_ID}`));
});

test("a source an earlier version named by its repository alone is refused as the old layout, saying to install it again, and nothing is taken away (FR-180, VENDOR Story 3 scenario 4)", async () => {
  const fileReaders = new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`]: "---\nkind: guide\n---\n",
  });
  const { code, commandOutput } = await running(["charter", "remove", "--charter=charter"], undefined, fileReaders);

  assert.equal(code, EXIT_FAILURE, commandOutput);
  assert.match(commandOutput, /is laid out the old way: \.cw\/charter\/vendor\/ sits/);
  assert.match(
    commandOutput,
    /delete each installed charter under \.cw\/charter\/vendor\/ and install it again with "cw charter pull"/,
  );
  assert.equal(
    await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/vendor/charter/guide/one/index.md`)),
    "---\nkind: guide\n---\n",
  );
});

test("a name no installed charter answers to is refused, and nothing changes (CORE Story 37 scenario 3, VENDOR Story 3 scenario 21)", async () => {
  for (const name of ["absent", "other/charter", "charter/guide"]) {
    const { code, commandOutput, fileReaders } = await running(
      ["charter", "remove", `--charter=${name}`],
      undefined,
      fileReadersHoldingInstalledCharter("charter"),
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(commandOutput, /holds no charter/, name);
    assert.equal((await installedFiles(fileReaders)).length, 3, name);
  }
});

test("a source nobody named is a usage error, not a installing one", async () => {
  const { code, sourceFetcher } = await running(["charter", "pull"]);

  assert.equal(code, EXIT_USAGE);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a name that is no folder is refused, and nothing is taken away (FR-044)", async () => {
  for (const name of ["..", ".", "team/..", "../../src", "charter/team/charter/more"]) {
    const { code, commandOutput, fileReaders } = await running(
      ["charter", "remove", `--charter=${name}`],
      undefined,
      fileReadersHoldingInstalledCharter("charter"),
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.equal((await installedFiles(fileReaders)).length, 3, name);
    assert.match(commandOutput, /holds no charter/, name);
  }
});

test("cw charter pull --fork takes the same source, version and charter flags as a pull (CORE-FR-198, VENDOR Story 6 scenario 3)", async () => {
  const { code, commandOutput, sourceFetcher } = await running(
    ["charter", "pull", "team/charter", "--fork", "--ref", "v1", "--charter", "published"],
    sourcesPublishing(["team/charter"]),
  );
  assert.equal(code, EXIT_OK, commandOutput);
  assert.match(commandOutput, /Forked team\/charter under \.cw\/charter\/published/);
  assert.match(commandOutput, /guide {2}published/);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/charter", version: "v1" }]);
  assert.deepEqual(installedFoldersOf(sourceFetcher), [
    {
      commit: "team/charter@v1",
      fromFolder: ".cw/charter/published/primitive/guide/published",
      intoSubFolder: ".cw/charter/published/primitive/guide/published",
    },
  ]);
});

test("cw vendor and every command it held are refused as commands cw does not have, writing nothing (VENDOR Story 6 scenario 4, VENDOR Story 8 scenario 3, VENDOR Story 1 scenario 2, VENDOR-FR-033, VENDOR-SC-007)", async () => {
  for (const commandArgs of [
    ["vendor"],
    ["vendor", "add", "team/charter"],
    ["vendor", "inject", "team/charter"],
    ["vendor", "list"],
    ["vendor", "remove", "charter"],
    ["vendor", "init"],
  ]) {
    const { code, sourceFetcher, fileReaders } = await running(
      commandArgs,
      sourcesPublishing(["team/charter"]),
      fileReadersHoldingInstalledCharter("charter"),
    );

    assert.equal(code, EXIT_USAGE, commandArgs.join(" "));
    assert.deepEqual(sourceFetcher.fetchedSources, [], commandArgs.join(" "));
    assert.equal((await installedFiles(fileReaders)).length, 3, commandArgs.join(" "));
  }
});

test("a cw charter command mistyped is refused as a usage fault, not run as the listing, writing nothing (VENDOR Story 6 scenario 4)", async () => {
  const { code, commandOutput, sourceFetcher, fileReaders } = await running(
    ["charter", "pul", "team/charter"],
    sourcesPublishing(["team/charter"]),
    fileReadersHoldingInstalledCharter("charter"),
  );

  assert.equal(code, EXIT_USAGE);
  assert.match(commandOutput, /Unknown arguments: pul, team\/charter/);
  assert.doesNotMatch(commandOutput, /installed {2}team\/charter/);
  assert.deepEqual(sourceFetcher.fetchedSources, []);
  assert.equal((await installedFiles(fileReaders)).length, 3);
});

/** One repository holding an authored charter `team` and this installed
 *  charter `published`, pulled from `team/charter`. */
const fileReadersHoldingTeamAndPublished = () =>
  new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/team/primitive/guide/mine/index.md`]:
      "---\nkind: guide\nid: mine\ndescription: Mine.\n---\n",
    [`file://${repo}/.cw/charter/published/cw-package.json`]: `${JSON.stringify({ charter: "published", source: "team/charter", version: "v1" })}\n`,
    [`file://${repo}/.cw/charter/published/primitive/guide/published/index.md`]:
      "---\nkind: guide\nid: published\ndescription: Published.\n---\n",
  });

test("cw charter names every charter held, authored or installed, an installed one with its source and version (VENDOR Story 7 scenario 1, VENDOR-FR-021)", async () => {
  const { code, commandOutput } = await running(["charter"], undefined, fileReadersHoldingTeamAndPublished());

  assert.equal(code, EXIT_OK, commandOutput);
  assert.equal(commandOutput, "Charters\n  published  installed  team/charter v1\n  team       authored\n");
});

test("cw charter create makes an empty charter of the repository's own, and refuses a name held or one no charter may take, writing nothing (VENDOR Story 7 scenarios 2, 3, VENDOR-FR-029)", async () => {
  const fileReaders = fileReadersHoldingTeamAndPublished();

  const createRun = await running(["charter", "create", "review"], undefined, fileReaders);
  assert.equal(createRun.code, EXIT_OK, createRun.commandOutput);
  assert.match(createRun.commandOutput, /Created \.cw\/charter\/review/);
  assert.match((await running(["charter"], undefined, fileReaders)).commandOutput, /review {5}authored/);

  for (const charterName of ["team", "published", "review", "test", "guide", "Not An Id"]) {
    const heldFiles = await installedFiles(fileReaders);
    const refusedRun = await running(["charter", "create", charterName], undefined, fileReaders);
    assert.equal(refusedRun.code, EXIT_FAILURE, charterName);
    assert.match(refusedRun.commandOutput, /already held|cannot name a charter/, charterName);
    assert.deepEqual(await installedFiles(fileReaders), heldFiles, charterName);
  }
});

test("cw charter update pulls an installed charter again from the source its cw-package.json names, at the newest version (VENDOR Story 7 scenario 4, VENDOR-FR-030)", async () => {
  const fileReaders = fileReadersHoldingTeamAndPublished();
  const sourceFetcher = new InMemorySources(fileReaders);
  sourceFetcher.sourceFilesBySource["team/charter"] = {
    ".cw/charter/published/primitive/guide/published/index.md":
      "---\nkind: guide\nid: published\ndescription: Published anew.\n---\n",
  };

  const { code, commandOutput } = await running(
    ["charter", "update", "--charter=published"],
    sourceFetcher,
    fileReaders,
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.match(commandOutput, /Updated \.cw\/charter\/published/);
  assert.deepEqual(sourceFetcher.fetchedSources, [{ source: "team/charter" }]);
  assert.deepEqual(
    JSON.parse(await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/published/cw-package.json`))),
    { charter: "published", source: "team/charter", version: IN_MEMORY_COMMIT_ID },
  );
  assert.match(
    await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/published/primitive/guide/published/index.md`)),
    /Published anew\./,
  );
});

test("cw charter update --all pulls every installed charter from its own source, and with one source unreachable changes none (VENDOR Story 7 scenario 5, VENDOR-FR-030)", async () => {
  const twoInstalledFiles = () => {
    const fileReaders = fileReadersHoldingTeamAndPublished();
    fileReaders.writeFile(
      new URL(`file://${repo}/.cw/charter/other/cw-package.json`),
      `${JSON.stringify({ charter: "other", source: "team/other", version: "v1" })}\n`,
    );
    fileReaders.writeFile(
      new URL(`file://${repo}/.cw/charter/other/primitive/guide/other-rule/index.md`),
      "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
    );
    return fileReaders;
  };
  const otherSourceFiles = {
    ".cw/charter/other/primitive/guide/other-rule/index.md":
      "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
  };

  const fileReaders = twoInstalledFiles();
  const sourceFetcher = sourcesPublishing(["team/charter"], fileReaders);
  sourceFetcher.sourceFilesBySource["team/other"] = otherSourceFiles;
  const updateRun = await running(["charter", "update", "--all"], sourceFetcher, fileReaders);
  assert.equal(updateRun.code, EXIT_OK, updateRun.commandOutput);
  assert.deepEqual(
    sourceFetcher.fetchedSources.map(({ source }) => source),
    ["team/other", "team/charter"],
  );
  assert.deepEqual(
    installedFoldersOf(sourceFetcher)
      .map(({ intoSubFolder }) => intoSubFolder)
      .sort(),
    [".cw/charter/other/primitive/guide/other-rule", ".cw/charter/published/primitive/guide/published"],
  );
  for (const charterName of ["other", "published"])
    assert.equal(
      JSON.parse(await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/${charterName}/cw-package.json`)))
        .version,
      IN_MEMORY_COMMIT_ID,
      charterName,
    );

  const unreachableFileReaders = twoInstalledFiles();
  const heldFiles = await installedFiles(unreachableFileReaders);
  const unreachableFetcher = sourcesPublishing(["team/charter"], unreachableFileReaders);
  unreachableFetcher.unreachableSources.push("team/other");
  const refusedRun = await running(["charter", "update", "--all"], unreachableFetcher, unreachableFileReaders);
  assert.equal(refusedRun.code, EXIT_FAILURE);
  assert.match(refusedRun.commandOutput, /team\/other could not be fetched/);
  assert.deepEqual(installedFoldersOf(unreachableFetcher), []);
  assert.deepEqual(await installedFiles(unreachableFileReaders), heldFiles);
});

test("cw charter update refuses an authored charter, and update and remove refuse neither --charter nor --all, or both, writing nothing (VENDOR Story 7 scenarios 6, 7, VENDOR-FR-030, VENDOR-FR-031)", async () => {
  for (const commandArgs of [
    ["charter", "update", "--charter=team"],
    ["charter", "update"],
    ["charter", "update", "--charter=published", "--all"],
    ["charter", "remove"],
    ["charter", "remove", "--charter=team", "--all"],
  ]) {
    const fileReaders = fileReadersHoldingTeamAndPublished();
    const heldFiles = await installedFiles(fileReaders);
    const { code, sourceFetcher } = await running(
      commandArgs,
      sourcesPublishing(["team/charter"], fileReaders),
      fileReaders,
    );

    assert.equal(code, EXIT_FAILURE, commandArgs.join(" "));
    assert.deepEqual(sourceFetcher.fetchedSources, [], commandArgs.join(" "));
    assert.deepEqual(await installedFiles(fileReaders), heldFiles, commandArgs.join(" "));
  }
});

test("cw charter remove deletes an authored charter as an installed one, asking nothing, and --all deletes every charter (VENDOR Story 7 scenario 8, VENDOR-FR-031)", async () => {
  const fileReaders = fileReadersHoldingTeamAndPublished();

  const removeRun = await running(["charter", "remove", "--charter=team"], undefined, fileReaders);
  assert.equal(removeRun.code, EXIT_OK, removeRun.commandOutput);
  assert.match(removeRun.commandOutput, /Removed \.cw\/charter\/team/);
  assert.ok((await installedFiles(fileReaders)).every((filePath) => filePath.includes("/.cw/charter/published/")));

  fileReaders.writeFile(
    new URL(`file://${repo}/.cw/charter/team/primitive/guide/mine/index.md`),
    "---\nkind: guide\n---\n",
  );
  const removeAllRun = await running(["charter", "remove", "--all"], undefined, fileReaders);
  assert.equal(removeAllRun.code, EXIT_OK, removeAllRun.commandOutput);
  assert.deepEqual(await installedFiles(fileReaders), []);
  assert.match((await running(["charter"], undefined, fileReaders)).commandOutput, /No charter is held/);
});

test("cw charter update --all refuses two sources whose new versions claim one id, naming both files, and writes nothing (VENDOR-FR-020, VENDOR-FR-030)", async () => {
  const fileReaders = fileReadersHoldingTeamAndPublished();
  fileReaders.writeFile(
    new URL(`file://${repo}/.cw/charter/other/cw-package.json`),
    `${JSON.stringify({ charter: "other", source: "team/other", version: "v1" })}\n`,
  );
  fileReaders.writeFile(
    new URL(`file://${repo}/.cw/charter/other/primitive/guide/other-rule/index.md`),
    "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
  );
  const heldFiles = await installedFiles(fileReaders);
  const sourceFetcher = new InMemorySources(fileReaders);
  const sharedGuide = "---\nkind: guide\nid: shared-rule\ndescription: Shared.\n---\n";
  sourceFetcher.sourceFilesBySource["team/charter"] = {
    ".cw/charter/published/primitive/guide/published/index.md":
      "---\nkind: guide\nid: published\ndescription: Published.\n---\n",
    ".cw/charter/published/primitive/guide/shared-rule/index.md": sharedGuide,
  };
  sourceFetcher.sourceFilesBySource["team/other"] = {
    ".cw/charter/other/primitive/guide/other-rule/index.md":
      "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
    ".cw/charter/other/primitive/guide/shared-rule/index.md": sharedGuide,
  };

  const { code, commandOutput } = await running(["charter", "update", "--all"], sourceFetcher, fileReaders);

  assert.equal(code, EXIT_FAILURE, commandOutput);
  assert.match(commandOutput, /\.cw\/charter\/other\/primitive\/guide\/shared-rule[\s\S]*claim id "shared-rule"/);
  assert.match(commandOutput, /\.cw\/charter\/published\/primitive\/guide\/shared-rule/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
  assert.deepEqual(await installedFiles(fileReaders), heldFiles);
});

test("updating and removing charters through the driver port refuse neither a name nor every charter, or both, and an authored charter is refused as pulled from no source (VENDOR-FR-030, VENDOR-FR-031)", async () => {
  const fileReaders = fileReadersHoldingTeamAndPublished();
  const heldFiles = await installedFiles(fileReaders);
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    {
      sourceFetcher: sourcesPublishing(["team/charter"], fileReaders),
    },
  );

  for (const refusedDTO of [
    await charterAuthoringApp.updateCharters("", false),
    await charterAuthoringApp.updateCharters("published", true),
    await charterAuthoringApp.removeCharters("", false, false),
    await charterAuthoringApp.removeCharters("team", true, false),
  ])
    assert.deepEqual(refusedDTO.type === "Fault" && refusedDTO.data.name, "UnchosenChartersFault");
  const authoredDTO = await charterAuthoringApp.updateCharters("team", false);
  assert.deepEqual(authoredDTO.type === "Fault" && authoredDTO.data.name, "UninstalledCharterFault");
  assert.deepEqual(await installedFiles(fileReaders), heldFiles);
});

test("cw charter update --all pulls again a charter the source itself installed, which came in included by one it authored (VENDOR-FR-019, VENDOR-FR-030)", async () => {
  const sddSkill = (description: string) =>
    `---\nkind: skill\nid: greet\ndescription: ${description}\ntriggers: ["say hello"]\n---\n\nAs [[grill-me]] asks.\n`;
  const grillSkill = '---\nkind: skill\nid: grill-me\ndescription: Grill.\ntriggers: ["grill me"]\n---\n';
  const fileReaders = new InMemoryFileReaders({
    [`file://${repo}/.cw/charter/sdd/cw-package.json`]: `${JSON.stringify({ charter: "sdd", source: "team/charter", version: "v1" })}\n`,
    [`file://${repo}/.cw/charter/sdd/primitive/skill/greet/index.md`]: sddSkill("Say hello."),
    [`file://${repo}/.cw/charter/grill/cw-package.json`]: `${JSON.stringify({ charter: "grill", source: "team/charter", version: "v1" })}\n`,
    [`file://${repo}/.cw/charter/grill/primitive/skill/grill-me/index.md`]: grillSkill,
  });
  const sourceFetcher = new InMemorySources(fileReaders);
  sourceFetcher.sourceFilesBySource["team/charter"] = {
    ".cw/charter/sdd/primitive/skill/greet/index.md": sddSkill("Say hello anew."),
    ".cw/charter/grill/cw-package.json": `${JSON.stringify({ charter: "grill", source: "mattpocock/skills", version: "v2" })}\n`,
    ".cw/charter/grill/primitive/skill/grill-me/index.md": grillSkill,
  };

  const { code, commandOutput } = await running(["charter", "update", "--all"], sourceFetcher, fileReaders);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.equal(commandOutput.match(/Updated \.cw\/charter\/grill/g)?.length, 1, "each charter is said once");
  assert.match(commandOutput, /Updated \.cw\/charter\/sdd/);
  assert.deepEqual(
    JSON.parse(await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/grill/cw-package.json`))),
    { charter: "grill", source: "team/charter", version: IN_MEMORY_COMMIT_ID },
  );
});

test("cw charter update --all takes an id one source gives up and another takes up in the same update (VENDOR-FR-030)", async () => {
  const movedGuide = "---\nkind: guide\nid: moved-rule\ndescription: Moved.\n---\n";
  const fileReaders = fileReadersHoldingTeamAndPublished();
  fileReaders.writeFile(
    new URL(`file://${repo}/.cw/charter/other/cw-package.json`),
    `${JSON.stringify({ charter: "other", source: "team/other", version: "v1" })}\n`,
  );
  fileReaders.writeFile(new URL(`file://${repo}/.cw/charter/other/primitive/guide/moved-rule/index.md`), movedGuide);
  const sourceFetcher = new InMemorySources(fileReaders);
  sourceFetcher.sourceFilesBySource["team/charter"] = {
    ".cw/charter/published/primitive/guide/published/index.md":
      "---\nkind: guide\nid: published\ndescription: Published.\n---\n",
    ".cw/charter/published/primitive/guide/moved-rule/index.md": movedGuide,
  };
  sourceFetcher.sourceFilesBySource["team/other"] = {
    ".cw/charter/other/primitive/guide/other-rule/index.md":
      "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
  };

  const { code, commandOutput } = await running(["charter", "update", "--all"], sourceFetcher, fileReaders);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.equal(
    await fileReaders.readIfThere(new URL(`file://${repo}/.cw/charter/other/primitive/guide/moved-rule/index.md`)),
    undefined,
  );
  assert.match(
    await fileReaders.readFile(new URL(`file://${repo}/.cw/charter/published/primitive/guide/moved-rule/index.md`)),
    /Moved\./,
  );
});

test("cw charter update that stops writing after another charter was written names the charters written where the fault is the person's, and answers the system's own as internal (VENDOR-FR-030, SDK-FR-017)", async () => {
  for (const raisedFault of [
    new UnwritableFileFault("The disk is full.", "Free some space.", { internal: false }),
    new Error("EIO at block 7."),
  ]) {
    const fileReaders = fileReadersHoldingTeamAndPublished();
    fileReaders.writeFile(
      new URL(`file://${repo}/.cw/charter/other/cw-package.json`),
      `${JSON.stringify({ charter: "other", source: "team/other", version: "v1" })}\n`,
    );
    fileReaders.writeFile(
      new URL(`file://${repo}/.cw/charter/other/primitive/guide/other-rule/index.md`),
      "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
    );
    const sourceFetcher = sourcesPublishing(["team/charter"], fileReaders);
    sourceFetcher.sourceFilesBySource["team/other"] = {
      ".cw/charter/other/primitive/guide/other-rule/index.md":
        "---\nkind: guide\nid: other-rule\ndescription: Other.\n---\n",
    };
    const charterRepository = charterRepositoryOf(fileReaders, new InMemoryFileOutput(fileReaders), sourceFetcher);
    let storeCount = 0;
    // The repository as it is, but for its second write, which fails.
    const failingCharterRepository = new Proxy(charterRepository, {
      get(heldRepository, propertyKey) {
        if (propertyKey === "storeCharters")
          return async (...storeArgs: Parameters<typeof charterRepository.storeCharters>) => {
            storeCount += 1;
            if (storeCount === 2) throw raisedFault;
            await heldRepository.storeCharters(...storeArgs);
          };
        const heldValue = Reflect.get(heldRepository, propertyKey);
        return typeof heldValue === "function" ? heldValue.bind(heldRepository) : heldValue;
      },
    });
    const charterAuthoringApp = new AuthoringCharter(
      loadCharterService,
      failingCharterRepository,
      new InMemoryCredentialsRepository(),
      new InMemoryOAuthAuthorizer(),
      new SystemClock(),
      new InMemoryReporter(),
    );

    const updateDTO = await charterAuthoringApp.updateCharters("", true);

    assert.equal(updateDTO.type, "Fault");
    const updateFaultData = updateDTO.type === "Fault" ? updateDTO.data : undefined;
    if (raisedFault instanceof UnwritableFileFault) {
      assert.equal(updateFaultData?.name, "UnfinishedCharterUpdateFault");
      assert.match(updateFaultData?.message ?? "", /The disk is full\. other was updated before it stopped\./);
    } else {
      assert.notEqual(updateFaultData?.name, "UnfinishedCharterUpdateFault");
      assert.doesNotMatch(updateFaultData?.message ?? "", /EIO/);
    }
  }
});

test("cw charter update --all and cw charter remove --all with no charter to act on say so, and write nothing (VENDOR-FR-030, VENDOR-FR-031)", async () => {
  const fileReaders = new InMemoryFileReaders({ [`file://${repo}/work.txt`]: "In hand.\n" });

  const updateRun = await running(["charter", "update", "--all"], undefined, fileReaders);
  assert.equal(updateRun.code, EXIT_OK, updateRun.commandOutput);
  assert.match(updateRun.commandOutput, /No charter is installed: nothing to update\./);
  const removeRun = await running(["charter", "remove", "--all"], undefined, fileReaders);
  assert.equal(removeRun.code, EXIT_OK, removeRun.commandOutput);
  assert.match(removeRun.commandOutput, /No charter is held: nothing to remove\./);
  assert.equal(await fileReaders.readFile(new URL(`file://${repo}/work.txt`)), "In hand.\n");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/presentation/cli/commands/command.interface.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { answerOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf, loadCharterRoot } from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const pickedAt = (charterName: string, path: string) =>
  new URL(`.cw/charter/vendor/acme/charters/${charterName}/primitive/${path}`, repoPath).href;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");
const skillMd = (name: string) =>
  ["---", `name: ${name}`, `description: About ${name}.`, "---", "", "Do it.", ""].join("\n");

/** `acme/charters` as a source of many publishes it: `baseline` and `sdd`,
 *  each under `charters/` laid out as a single-charter source holds its one. */
const acmeCharters = (): Record<string, string> => ({
  "charters/baseline/.cw/charter/primitive/guide/small-diffs/index.md": guide("small-diffs"),
  "charters/baseline/README.md": "# Baseline\n",
  "charters/sdd/.cw/charter/primitive/guide/spec-first/index.md": guide("spec-first"),
  "README.md": "# Charters\n",
});

/** One run of the command line over a repository and sources held in
 *  memory, and what it wrote. */
async function running(argv: readonly string[], fileReaders: InMemoryFileReaders, sourceFetcher: InMemorySources) {
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
      cwd: "/repo",
      version: "0.0.0",
      charterAuthoringApp: authoringCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryReporter(),
        { sourceFetcher },
      ),
      charterRuntimeApp: buildingCharterOf(
        fileReaders,
        new InMemoryFileOutput(fileReaders),
        new InMemoryTokenCounter(),
        { claude: new InMemoryAgentCli() },
        new InMemoryReporter(),
      ),
    };
    const code = await new Commander(
      commandLineOf(fileReaders, new InMemoryFileOutput(fileReaders), context, context.cwd),
      COMMANDS,
    ).runCommandLine(argv);
    return { code, commandOutput: commandOutput.join("") };
  } finally {
    for (const [index, stream] of streams.entries()) stream.write = kept[index] as typeof stream.write;
  }
}

/** A repository holding nothing yet, the files it is held in and version
 *  control over them, with `acme/charters` published. */
function withChartersPublished(
  sourceFiles: Record<string, string> = acmeCharters(),
  heldFiles: Record<string, string> = {},
) {
  const fileReaders = new InMemoryFileReaders(heldFiles);
  const sourceFetcher = new InMemorySources(fileReaders);
  sourceFetcher.sourceFilesBySource["acme/charters"] = sourceFiles;
  return { fileReaders, sourceFetcher };
}

const checkedOutFolders = (sourceFetcher: InMemorySources) =>
  sourceFetcher.checkedOutFolders.map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]);

test("a charter picked from a source of many lands in a vendor folder of its own, left unstaged, and the others do not arrive (CORE-FR-195, CORE-FR-196, CORE-SC-052)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
  ]);
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("baseline", "guide/small-diffs/index.md"))),
    guide("small-diffs"),
  );
  await assert.rejects(() => fileReaders.readFile(new URL(pickedAt("sdd", "guide/spec-first/index.md"))));
  await assert.rejects(
    () => fileReaders.readFile(new URL(".cw/charter/vendor/acme/charters/baseline/README.md", repoPath)),
    "no README is copied, the charter's own nor the source's",
  );
  assert.match(
    commandOutput,
    /Installed acme\/charters under \.cw\/charter\/vendor\/acme\/charters\/baseline\.\n {2}guide small-diffs\n/,
  );
});

test("each charter picked is a vendor of its own: listed, read, brought up to date, and removed on its own (CORE-FR-196)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();
  await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "sdd"],
    fileReaders,
    sourceFetcher,
  );
  const charterAuthoringApp = authoringCharterOf(
    fileReaders,
    new InMemoryFileOutput(fileReaders),
    new InMemoryReporter(),
    { sourceFetcher },
  );

  assert.deepEqual(answerOf(await charterAuthoringApp.listVendors()).data.folders, [
    "file:///repo/.cw/charter/vendor/acme/charters/baseline",
    "file:///repo/.cw/charter/vendor/acme/charters/sdd",
  ]);
  const charterRoot = await loadCharterRoot(fileReaders);
  assert.deepEqual(
    charterRoot.primitives
      .filter(({ layer }) => layer.vendorName !== undefined)
      .map(({ headers, layer }) => [headers.id, layer.vendorName])
      .sort(),
    [
      ["small-diffs", "acme/charters/baseline"],
      ["spec-first", "acme/charters/sdd"],
    ],
  );

  sourceFetcher.checkedOutFolders.length = 0;
  await running(["vendor", "add", "acme/charters", "--charter", "baseline"], fileReaders, sourceFetcher);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
  ]);
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("sdd", "guide/spec-first/index.md"))),
    guide("spec-first"),
    "sdd left as it was",
  );

  const removeOutcome = await running(["vendor", "remove", "acme/charters/baseline"], fileReaders, sourceFetcher);
  assert.equal(removeOutcome.code, EXIT_OK, removeOutcome.commandOutput);
  await assert.rejects(
    () => fileReaders.readFile(new URL(pickedAt("baseline", "guide/small-diffs/index.md"))),
    "baseline is gone",
  );
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("sdd", "guide/spec-first/index.md"))),
    guide("spec-first"),
    "sdd left as it was",
  );
});

test("a source holding charters under charters/ alone, given neither flag, installs every charter it holds, asking nothing (CORE-FR-193)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
    ["charters/sdd/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/sdd/primitive"],
  ]);
});

test("a source of every shape gives its one charter with neither flag, skills alone with --skill, and both with both (CORE-FR-193)", async () => {
  const everyShape = {
    ".cw/charter/primitive/guide/own/index.md": guide("own"),
    ...acmeCharters(),
    "skills/grill-me/SKILL.md": skillMd("grill-me"),
  };

  const withNeither = withChartersPublished(everyShape);
  const ownCharter = await running(
    ["vendor", "add", "acme/charters"],
    withNeither.fileReaders,
    withNeither.sourceFetcher,
  );
  assert.equal(ownCharter.code, EXIT_OK, ownCharter.commandOutput);
  assert.deepEqual(checkedOutFolders(withNeither.sourceFetcher), [
    [".cw/charter/primitive", ".cw/charter/vendor/acme/charters/root/primitive"],
  ]);

  const withSkill = withChartersPublished(everyShape);
  const skillsAlone = await running(
    ["vendor", "add", "acme/charters", "--skill", "grill-me"],
    withSkill.fileReaders,
    withSkill.sourceFetcher,
  );
  assert.equal(skillsAlone.code, EXIT_OK, skillsAlone.commandOutput);
  assert.deepEqual(checkedOutFolders(withSkill.sourceFetcher), [
    ["skills/grill-me", ".cw/charter/vendor/acme/charters/root/primitive/skill/grill-me"],
  ]);

  const withBoth = withChartersPublished(everyShape);
  const bothOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "sdd", "--skill", "grill-me"],
    withBoth.fileReaders,
    withBoth.sourceFetcher,
  );
  assert.equal(bothOutcome.code, EXIT_OK, bothOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(withBoth.sourceFetcher), [
    ["charters/sdd/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/sdd/primitive"],
    ["skills/grill-me", ".cw/charter/vendor/acme/charters/root/primitive/skill/grill-me"],
  ]);
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        withBoth.fileReaders,
        new InMemoryFileOutput(withBoth.fileReaders),
        new InMemoryReporter(),
        { sourceFetcher: withBoth.sourceFetcher },
      ).listVendors(),
    ).data.folders,
    ["file:///repo/.cw/charter/vendor/acme/charters/root", "file:///repo/.cw/charter/vendor/acme/charters/sdd"],
  );
});

test("a --charter the source does not hold installs nothing, naming the charters it holds (CORE-FR-197)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "nothing-here"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters holds no charter nothing-here/);
  assert.match(commandOutput, /baseline, sdd/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a flag for a shape the source does not hold is refused, taking nothing, saying which shapes it holds (CORE-FR-193)", async () => {
  const skillsOnly = withChartersPublished({ "skills/grill-me/SKILL.md": skillMd("grill-me") });
  const charterRefuseOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    skillsOnly.fileReaders,
    skillsOnly.sourceFetcher,
  );
  assert.equal(charterRefuseOutcome.code, EXIT_FAILURE);
  assert.match(charterRefuseOutcome.commandOutput, /acme\/charters holds no "charters\/"/);
  assert.match(charterRefuseOutcome.commandOutput, /skills under "skills\/"/);
  assert.deepEqual(skillsOnly.sourceFetcher.checkedOutFolders, []);

  const chartersOnly = withChartersPublished();
  const skillRefuseOutcome = await running(
    ["vendor", "add", "acme/charters", "--skill", "grill-me"],
    chartersOnly.fileReaders,
    chartersOnly.sourceFetcher,
  );
  assert.equal(skillRefuseOutcome.code, EXIT_FAILURE);
  assert.match(skillRefuseOutcome.commandOutput, /acme\/charters holds no "skills\/"/);
  assert.match(skillRefuseOutcome.commandOutput, /charters under "charters\/"/);
  assert.deepEqual(chartersOnly.sourceFetcher.checkedOutFolders, []);
});

test("a folder under charters/ named as a kind is refused when picked, naming the folder (CORE-FR-197)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    "charters/guide/.cw/charter/primitive/guide/x/index.md": guide("x"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "guide"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /charters\/guide/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a folder under charters/ holding no charter folder is refused when picked, naming the folder (CORE-FR-197)", async () => {
  for (const [name, sourceFiles] of [
    ["notes", { ...acmeCharters(), "charters/notes/README.md": "# Notes\n" }],
  ] as const) {
    const { fileReaders, sourceFetcher } = withChartersPublished(sourceFiles);

    const { code, commandOutput } = await running(
      ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", name],
      fileReaders,
      sourceFetcher,
    );

    assert.equal(code, EXIT_FAILURE, name);
    assert.match(commandOutput, new RegExp(`charters/${name}`), name);
    assert.deepEqual(sourceFetcher.checkedOutFolders, [], name);
  }
});

test("a charter picked that installed vendors of its own is refused, since vendoring is one level deep (FR-170)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    "charters/sdd/.cw/charter/vendor/other/guide/x/index.md": guide("x"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "sdd"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /one level deep/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("the source's own charter and the charters picked from it are installed side by side, each a vendor of its own (CORE-FR-196)", async () => {
  const intoOwnCharter = withChartersPublished(acmeCharters(), {
    [pickedAt("root", "guide/own/index.md")]: guide("own"),
  });
  const pickOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    intoOwnCharter.fileReaders,
    intoOwnCharter.sourceFetcher,
  );
  assert.equal(pickOutcome.code, EXIT_OK, pickOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(intoOwnCharter.sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
  ]);
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        intoOwnCharter.fileReaders,
        new InMemoryFileOutput(intoOwnCharter.fileReaders),
        new InMemoryReporter(),
        { sourceFetcher: intoOwnCharter.sourceFetcher },
      ).listVendors(),
    ).data.folders,
    ["file:///repo/.cw/charter/vendor/acme/charters/baseline", "file:///repo/.cw/charter/vendor/acme/charters/root"],
  );

  const intoPicked = withChartersPublished(
    { ".cw/charter/primitive/guide/own/index.md": guide("own") },
    { [pickedAt("baseline", "guide/small-diffs/index.md")]: guide("small-diffs") },
  );
  const ownOutcome = await running(
    ["vendor", "add", "acme/charters"],
    intoPicked.fileReaders,
    intoPicked.sourceFetcher,
  );
  assert.equal(ownOutcome.code, EXIT_OK, ownOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(intoPicked.sourceFetcher), [
    [".cw/charter/primitive", ".cw/charter/vendor/acme/charters/root/primitive"],
  ]);
  assert.equal(
    await intoPicked.fileReaders.readFile(new URL(pickedAt("baseline", "guide/small-diffs/index.md"))),
    guide("small-diffs"),
    "baseline left as it was",
  );
});

test("installing into root again writes the latest over what it held, a charter or skills alike", async () => {
  const everyShape = {
    ".cw/charter/primitive/guide/own/index.md": guide("own"),
    ...acmeCharters(),
    "skills/grill-me/SKILL.md": skillMd("grill-me"),
  };
  const rootFilePathsOf = async (fileReaders: InMemoryFileReaders) =>
    (await fileReaders.readFilesRecursively(new URL(".cw/charter/vendor/acme/charters/root/", repoPath)))
      .map(({ path }) => path)
      .sort();

  const intoOwnCharter = withChartersPublished(everyShape, { [pickedAt("root", "guide/own/index.md")]: guide("own") });
  const skillOutcome = await running(
    ["vendor", "add", "acme/charters", "--skill", "grill-me"],
    intoOwnCharter.fileReaders,
    intoOwnCharter.sourceFetcher,
  );
  assert.equal(skillOutcome.code, EXIT_OK);
  assert.deepEqual(await rootFilePathsOf(intoOwnCharter.fileReaders), [
    ".cw/charter/vendor/acme/charters/root/primitive/guide/own/index.md",
    ".cw/charter/vendor/acme/charters/root/primitive/skill/grill-me/index.md",
  ]);

  const intoSkills = withChartersPublished(everyShape, {
    [pickedAt("root", "skill/grill-me/index.md")]:
      "---\nkind: skill\nid: grill-me\ndescription: About grill-me.\n---\n",
  });
  const ownOutcome = await running(
    ["vendor", "add", "acme/charters"],
    intoSkills.fileReaders,
    intoSkills.sourceFetcher,
  );
  assert.equal(ownOutcome.code, EXIT_OK);
  assert.deepEqual(await rootFilePathsOf(intoSkills.fileReaders), [
    ".cw/charter/vendor/acme/charters/root/primitive/guide/own/index.md",
  ]);
});

test("a charter under charters/ named root is refused when picked, since root is the source's own charter's folder (CORE-FR-196)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    "charters/root/.cw/charter/primitive/guide/x/index.md": guide("x"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "root"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /charters\/root" is named "root"/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

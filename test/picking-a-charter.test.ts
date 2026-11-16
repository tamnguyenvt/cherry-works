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

test("a charter picked from a source of many lands in a vendor folder of its own, left unstaged, and the others do not arrive (CORE-FR-195, CORE-FR-196, CORE-SC-052, CORE Story 33 scenario 1)", async () => {
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
    /^✔ Installed acme\/charters under \.cw\/charter\/vendor\/acme\/charters\/baseline\.\n {2}guide {2,}small-diffs\n/m,
  );
});

test("each charter picked is a vendor of its own: listed, read, brought up to date, and removed on its own (CORE-FR-196, CORE Story 33 scenario 2)", async () => {
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

test("a source holding charters under charters/ alone, given neither flag, installs every charter it holds, asking nothing (CORE-FR-193, CORE Story 33 scenario 3)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
    ["charters/sdd/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/sdd/primitive"],
  ]);
});

test("a source of every shape gives every charter and every skill with neither flag, skills alone with --skill, and both with both, its root charter never read (CORE-FR-193, CORE Story 33 scenario 4)", async () => {
  const everyShape = {
    ".cw/charter/primitive/guide/own/index.md": guide("own"),
    ...acmeCharters(),
    "skills/grill-me/SKILL.md": skillMd("grill-me"),
  };

  const withNeither = withChartersPublished(everyShape);
  const everyOutcome = await running(
    ["vendor", "add", "acme/charters"],
    withNeither.fileReaders,
    withNeither.sourceFetcher,
  );
  assert.equal(everyOutcome.code, EXIT_OK, everyOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(withNeither.sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
    ["charters/sdd/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/sdd/primitive"],
    ["skills/grill-me", ".cw/charter/vendor/acme/charters/root/primitive/skill/grill-me"],
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

test("a source holding a charter at its root alone is no vendor, and nothing of it is installed (CORE-FR-193, CORE-FR-042)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ".cw/charter/primitive/guide/own/index.md": guide("own"),
    "README.md": "# Own\n",
  });

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters is no vendor/);
  assert.deepEqual(sourceFetcher.checkedOutFolders, []);
});

test("a charter set up by cw init, its vendors' folder holding its .gitkeep alone, is installed (FR-170)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    "charters/baseline/.cw/charter/vendor/.gitkeep": "",
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
  ]);
});

test("a --charter the source does not hold installs nothing, naming the charters it holds (CORE-FR-197, CORE Story 33 scenario 5)", async () => {
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

test("a flag for a shape the source does not hold is refused, taking nothing, saying which shapes it holds (CORE-FR-193, CORE Story 33 scenario 6)", async () => {
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

test("a folder under charters/ named as a kind is refused when picked, naming the folder (CORE-FR-197, CORE Story 33 scenario 7)", async () => {
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

test("a folder under charters/ holding no charter folder is refused when picked, naming the folder (CORE-FR-197, CORE Story 33 scenario 7)", async () => {
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

test("the charters picked are installed beside the skills already installed into root, each a vendor of its own (CORE-FR-196)", async () => {
  const intoRoot = withChartersPublished(acmeCharters(), {
    [pickedAt("root", "skill/grill-me/index.md")]:
      "---\nkind: skill\nid: grill-me\ndescription: About grill-me.\n---\n",
  });
  const pickOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    intoRoot.fileReaders,
    intoRoot.sourceFetcher,
  );
  assert.equal(pickOutcome.code, EXIT_OK, pickOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(intoRoot.sourceFetcher), [
    ["charters/baseline/.cw/charter/primitive", ".cw/charter/vendor/acme/charters/baseline/primitive"],
  ]);
  assert.deepEqual(
    answerOf(
      await authoringCharterOf(
        intoRoot.fileReaders,
        new InMemoryFileOutput(intoRoot.fileReaders),
        new InMemoryReporter(),
        { sourceFetcher: intoRoot.sourceFetcher },
      ).listVendors(),
    ).data.folders,
    ["file:///repo/.cw/charter/vendor/acme/charters/baseline", "file:///repo/.cw/charter/vendor/acme/charters/root"],
  );
});

test("installing skills into root again writes the latest over what it held", async () => {
  const rootFilePathsOf = async (fileReaders: InMemoryFileReaders) =>
    (await fileReaders.readFilesRecursively(new URL(".cw/charter/vendor/acme/charters/root/", repoPath)))
      .map(({ path }) => path)
      .sort();

  const intoRoot = withChartersPublished(
    { "skills/grill-me/SKILL.md": skillMd("grill-me") },
    {
      [pickedAt("root", "guide/own/index.md")]: guide("own"),
      [pickedAt("root", "skill/grill-me/index.md")]: "---\nkind: skill\nid: grill-me\ndescription: Old.\n---\n",
    },
  );
  const skillOutcome = await running(["vendor", "add", "acme/charters"], intoRoot.fileReaders, intoRoot.sourceFetcher);
  assert.equal(skillOutcome.code, EXIT_OK, skillOutcome.commandOutput);
  assert.deepEqual(await rootFilePathsOf(intoRoot.fileReaders), [
    ".cw/charter/vendor/acme/charters/root/primitive/guide/own/index.md",
    ".cw/charter/vendor/acme/charters/root/primitive/skill/grill-me/index.md",
  ]);
  assert.match(
    await intoRoot.fileReaders.readFile(new URL(pickedAt("root", "skill/grill-me/index.md"))),
    /About grill-me\./,
  );
});

test("a charter under charters/ named root is refused when picked, since root is the folder the source's skills are installed in (CORE-FR-196)", async () => {
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

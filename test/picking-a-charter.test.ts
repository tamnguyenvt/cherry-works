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
import {
  authoringCharterOf,
  buildingCharterOf,
  commandLineOf,
  installedFoldersOf,
  loadCharterRoot,
} from "./use-cases-of.js";

const repoPath = new URL("file:///repo/");
const pickedAt = (charterName: string, path: string) => new URL(`.cw/charter/${charterName}/${path}`, repoPath).href;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");
const vendorRecordTextOf = (charterName: string, source: string) =>
  `${JSON.stringify({ charter: charterName, source, version: "HEAD" })}\n`;

/** `acme/charters` as a source of many charters publishes it: `baseline` and
 *  `sdd`, each a charter of its charter. */
const acmeCharters = (): Record<string, string> => ({
  ".cw/charter/baseline/primitive/guide/small-diffs/index.md": guide("small-diffs"),
  ".cw/charter/sdd/primitive/guide/spec-first/index.md": guide("spec-first"),
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
  installedFoldersOf(sourceFetcher).map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]);

/** The installed charters the repository lists, by name. */
const installedCharterNamesOf = async (fileReaders: InMemoryFileReaders, sourceFetcher: InMemorySources) =>
  answerOf(
    await authoringCharterOf(fileReaders, new InMemoryFileOutput(fileReaders), new InMemoryReporter(), {
      sourceFetcher,
    }).listVendors(),
  ).data.charters.map(({ data: { name } }) => name);

test("a charter picked from a source of many lands in a charter of its own, left unstaged, and the others do not arrive (CORE-FR-195, CORE-FR-196, CORE-SC-052, CORE Story 33 scenario 1, VENDOR Story 3 scenario 14)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
  ]);
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("baseline", "primitive/guide/small-diffs/index.md"))),
    guide("small-diffs"),
  );
  await assert.rejects(() => fileReaders.readFile(new URL(pickedAt("sdd", "primitive/guide/spec-first/index.md"))));
  await assert.rejects(
    () => fileReaders.readFile(new URL(pickedAt("baseline", "README.md"))),
    "the source's README is not copied",
  );
  assert.match(
    commandOutput,
    /^✔ Installed acme\/charters under \.cw\/charter\/baseline\.\n {2}guide {2,}small-diffs\n/m,
  );
});

test("each charter picked is a vendor of its own: listed, read, brought up to date, and removed on its own (CORE-FR-196, CORE Story 33 scenario 2, VENDOR Story 3 scenarios 19, 21)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();
  await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "sdd"],
    fileReaders,
    sourceFetcher,
  );

  assert.deepEqual(await installedCharterNamesOf(fileReaders, sourceFetcher), ["baseline", "sdd"]);
  const charterRoot = await loadCharterRoot(fileReaders);
  assert.deepEqual(
    charterRoot.primitives
      .filter(({ layer }) => layer.name === "vendor")
      .map(({ headers, layer }) => [headers.id, layer.charterName])
      .sort(),
    [
      ["small-diffs", "baseline"],
      ["spec-first", "sdd"],
    ],
  );

  sourceFetcher.checkedOutFolders.length = 0;
  await running(["vendor", "add", "acme/charters", "--charter", "baseline"], fileReaders, sourceFetcher);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
  ]);
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("sdd", "primitive/guide/spec-first/index.md"))),
    guide("spec-first"),
    "sdd left as it was",
  );

  const removeOutcome = await running(["vendor", "remove", "baseline"], fileReaders, sourceFetcher);
  assert.equal(removeOutcome.code, EXIT_OK, removeOutcome.commandOutput);
  await assert.rejects(
    () => fileReaders.readFile(new URL(pickedAt("baseline", "primitive/guide/small-diffs/index.md"))),
    "baseline is gone",
  );
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("sdd", "primitive/guide/spec-first/index.md"))),
    guide("spec-first"),
    "sdd left as it was",
  );
});

test("a source holding charters alone, given neither flag, installs every charter it authored, asking nothing (CORE-FR-193, CORE Story 33 scenario 3, VENDOR Story 3 scenario 15)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
    [".cw/charter/sdd/primitive/guide/spec-first", ".cw/charter/sdd/primitive/guide/spec-first"],
  ]);
});

test("a source keeping other files beside its charters — a README, a file kept on its own in a kind's folder — gives every charter it authored with no flag, each primitive with its files, and nothing else of it (CORE-FR-193, CORE-FR-196, CORE Story 33 scenario 4)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    ".cw/charter/baseline/primitive/guide/small-diffs/example.md": "An example.\n",
    ".cw/charter/baseline/primitive/guide/NOTES.md": "Kept on its own.\n",
  });

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
    [".cw/charter/sdd/primitive/guide/spec-first", ".cw/charter/sdd/primitive/guide/spec-first"],
  ]);
  assert.equal(
    await fileReaders.readFile(new URL(pickedAt("baseline", "primitive/guide/small-diffs/example.md"))),
    "An example.\n",
  );
  await assert.rejects(
    () => fileReaders.readFile(new URL(pickedAt("baseline", "primitive/guide/NOTES.md"))),
    "the file kept on its own in a kind's folder is not copied",
  );
  assert.deepEqual(await installedCharterNamesOf(fileReaders, sourceFetcher), ["baseline", "sdd"]);
});

test("a source whose charter holds no charter is no vendor, and nothing of it is installed (CORE-FR-193, CORE-FR-042, VENDOR-FR-017)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ".cw/charter/.gitkeep": "",
    "README.md": "# Own\n",
  });

  const { code, commandOutput } = await running(["vendor", "add", "acme/charters"], fileReaders, sourceFetcher);

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters is no vendor/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a source set up by cw init, its charters' folder holding its .gitkeep beside its charters, is installed (FR-170, VENDOR Story 3 scenario 6)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    ".cw/charter/.gitkeep": "",
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_OK, commandOutput);
  assert.deepEqual(checkedOutFolders(sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
  ]);
});

test("a --charter the source does not author installs nothing, naming the charters it authors (CORE-FR-197, CORE Story 33 scenario 5, VENDOR Story 3 scenario 20)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished();

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "nothing-here"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters authors no charter nothing-here/);
  assert.match(commandOutput, /baseline, sdd/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a source authoring no charter, given --charter, is refused, taking nothing, saying it authors no charter (CORE-FR-193, CORE Story 33 scenario 6)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({ "README.md": "# Notes\n" });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters is no vendor: it authors no charter/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a folder under the source's charters named as a kind is refused as the old layout, naming the folder (CORE-FR-197, CORE Story 33 scenario 7, VENDOR Story 3 scenario 7)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    ".cw/charter/guide/x/index.md": guide("x"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters is laid out the old way: \.cw\/charter\/guide\//);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a charter the source itself installed, picked, is refused naming the charters it authors, and nothing is installed (CORE-FR-197, CORE Story 33 scenario 7)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    ".cw/charter/grill/cw-vendor.json": vendorRecordTextOf("grill", "mattpocock/skills"),
    ".cw/charter/grill/primitive/guide/grill-rule/index.md": guide("grill-rule"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline", "--charter", "grill"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters authors no charter grill/);
  assert.match(commandOutput, /baseline, sdd/);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("a source that installed vendors of its own the old way is refused as laid out the old way (FR-170, VENDOR Story 3 scenario 4)", async () => {
  const { fileReaders, sourceFetcher } = withChartersPublished({
    ...acmeCharters(),
    ".cw/charter/vendor/other/guide/x/index.md": guide("x"),
  });

  const { code, commandOutput } = await running(
    ["vendor", "add", "acme/charters", "--charter", "sdd"],
    fileReaders,
    sourceFetcher,
  );

  assert.equal(code, EXIT_FAILURE);
  assert.match(commandOutput, /acme\/charters is laid out the old way: \.cw\/charter\/vendor\//);
  assert.deepEqual(installedFoldersOf(sourceFetcher), []);
});

test("the charters picked are installed beside a charter already installed from the source, each a vendor of its own (CORE-FR-196, VENDOR Story 3 scenario 19)", async () => {
  const besideInstalledCharter = withChartersPublished(acmeCharters(), {
    [pickedAt("sdd", "cw-vendor.json")]: vendorRecordTextOf("sdd", "acme/charters"),
    [pickedAt("sdd", "primitive/guide/spec-first/index.md")]: guide("spec-first"),
  });
  const pickOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "baseline"],
    besideInstalledCharter.fileReaders,
    besideInstalledCharter.sourceFetcher,
  );
  assert.equal(pickOutcome.code, EXIT_OK, pickOutcome.commandOutput);
  assert.deepEqual(checkedOutFolders(besideInstalledCharter.sourceFetcher), [
    [".cw/charter/baseline/primitive/guide/small-diffs", ".cw/charter/baseline/primitive/guide/small-diffs"],
  ]);
  assert.deepEqual(
    await installedCharterNamesOf(besideInstalledCharter.fileReaders, besideInstalledCharter.sourceFetcher),
    ["baseline", "sdd"],
  );
});

test("installing a charter again replaces it whole with the latest (VENDOR Story 3 scenario 19)", async () => {
  const sddFilePathsOf = async (fileReaders: InMemoryFileReaders) =>
    (await fileReaders.readFilesRecursively(new URL(".cw/charter/sdd/", repoPath))).map(({ path }) => path).sort();

  const intoInstalledCharter = withChartersPublished(acmeCharters(), {
    [pickedAt("sdd", "cw-vendor.json")]: vendorRecordTextOf("sdd", "acme/charters"),
    [pickedAt("sdd", "primitive/guide/own/index.md")]: guide("own"),
    [pickedAt("sdd", "primitive/guide/spec-first/index.md")]:
      "---\nkind: guide\nid: spec-first\ndescription: Old.\n---\n",
  });
  const pickOutcome = await running(
    ["vendor", "add", "acme/charters", "--charter", "sdd"],
    intoInstalledCharter.fileReaders,
    intoInstalledCharter.sourceFetcher,
  );
  assert.equal(pickOutcome.code, EXIT_OK, pickOutcome.commandOutput);
  assert.deepEqual(await sddFilePathsOf(intoInstalledCharter.fileReaders), [
    ".cw/charter/sdd/cw-vendor.json",
    ".cw/charter/sdd/primitive/guide/spec-first/index.md",
  ]);
  assert.equal(
    await intoInstalledCharter.fileReaders.readFile(new URL(pickedAt("sdd", "primitive/guide/spec-first/index.md"))),
    guide("spec-first"),
  );
});

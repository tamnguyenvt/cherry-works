import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IN_MEMORY_COMMIT_ID,
  InMemorySources,
} from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf } from "./use-cases-of.js";

const guideTextOf = (id: string, body = `Keep ${id}.`) =>
  `---\nkind: guide\nid: ${id}\ndescription: Keep ${id}.\nglobs: ["src/**"]\n---\n${body}\n`;
const installedCharterRecordTextOf = (charterName: string, source: string, version: string) =>
  `${JSON.stringify({ charter: charterName, source, version })}\n`;

/** A source authoring `sdd`, which names `baseline-rule` of `baseline`, and
 *  `baseline`; and holding `grill`, which it installed from mattpocock/skills,
 *  and `lone`, which nothing names. */
const SOURCE = "acme/charters";
const sourceFiles = {
  ".cw/charter/sdd/primitive/guide/sdd-rule/index.md": guideTextOf("sdd-rule", "Then follow [[baseline-rule]]."),
  ".cw/charter/sdd/test/sdd.json": "{}\n",
  ".cw/charter/sdd/eval/sdd.json": "{}\n",
  ".cw/charter/baseline/primitive/guide/baseline-rule/index.md": guideTextOf("baseline-rule", "And [[grill-rule]]."),
  ".cw/charter/baseline/test/baseline.json": "{}\n",
  ".cw/charter/grill/cw-package.json": installedCharterRecordTextOf("grill", "mattpocock/skills", "v2"),
  ".cw/charter/grill/primitive/guide/grill-rule/index.md": guideTextOf("grill-rule"),
  ".cw/charter/lone/primitive/guide/lone-rule/index.md": guideTextOf("lone-rule"),
  "README.md": "# Charters\n",
};

/** Authoring over a repository held in memory, the two sources published,
 *  and the repository's files. */
function repositoryWith(files: Readonly<Record<string, string>> = {}) {
  const fileReader = new InMemoryFileReaders(
    Object.fromEntries(Object.entries(files).map(([path, text]) => [new URL(path, "file:///repo/").href, text])),
  );
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource[SOURCE] = sourceFiles;
  const charterAuthoringApp = authoringCharterOf(
    fileReader,
    new InMemoryFileOutput(fileReader),
    new InMemoryReporter(),
    {
      sourceFetcher,
    },
  );
  return { fileReader, sourceFetcher, charterAuthoringApp };
}

/** Every file the repository holds under one charter, by its path in it. */
const charterFilePathsOf = async (fileReader: InMemoryFileReaders, charterName: string) =>
  (await fileReader.readBytesRecursively(`.cw/charter/${charterName}`))
    .map(({ path }) => path.slice(`.cw/charter/${charterName}/`.length))
    .sort();

/** The charters the repository holds. */
const charterNamesOf = async (fileReader: InMemoryFileReaders) =>
  (await fileReader.listFolders(".cw/charter")).map((path) => path.split("/").pop()).sort();

const installedCharterRecordOf = async (fileReader: InMemoryFileReaders, charterName: string) =>
  JSON.parse((await fileReader.readIfThere(`.cw/charter/${charterName}/cw-package.json`)) ?? "null");

test("cw charter pull --charter=sdd installs the whole charter, its test and eval cases, beside a cw-package.json naming it, the source and the version (VENDOR Story 3 scenario 14, VENDOR Story 6 scenario 1, CORE Story 33 scenario 1)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, "v1.0.0", ["sdd"]));

  assert.deepEqual(await charterFilePathsOf(fileReader, "sdd"), [
    "cw-package.json",
    "eval/sdd.json",
    "primitive/guide/sdd-rule/index.md",
    "test/sdd.json",
  ]);
  assert.deepEqual(await installedCharterRecordOf(fileReader, "sdd"), {
    charter: "sdd",
    source: SOURCE,
    version: "v1.0.0",
  });
  // Nothing is built.
  assert.deepEqual(await fileReader.readBytesRecursively(".cw/out"), []);
});

test("with no --charter, every charter the source holds is installed, one it installed itself among them; --charter takes the one named, one it installed itself as any other (VENDOR Story 3 scenario 15, VENDOR-FR-019)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "lone", "sdd"]);

  for (const charterName of ["lone", "grill"]) {
    const { fileReader: pickedFileReader, charterAuthoringApp: pickedAuthoringApp } = repositoryWith();
    answerOf(await pickedAuthoringApp.pullCharters(SOURCE, false, "v1", [charterName]));
    assert.deepEqual(await charterNamesOf(pickedFileReader), [charterName]);
    assert.deepEqual(await installedCharterRecordOf(pickedFileReader, charterName), {
      charter: charterName,
      source: SOURCE,
      version: "v1",
    });
  }
});

test("a charter naming an id another charter of the source holds installs that charter with it, and so on (VENDOR Story 3 scenario 16)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["sdd"]));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "sdd"]);
  assert.deepEqual(await charterFilePathsOf(fileReader, "baseline"), [
    "cw-package.json",
    "primitive/guide/baseline-rule/index.md",
    "test/baseline.json",
  ]);
  assert.deepEqual(await installedCharterRecordOf(fileReader, "baseline"), {
    charter: "baseline",
    source: SOURCE,
    version: IN_MEMORY_COMMIT_ID,
  });
});

test("a charter the source itself installed is copied as it stands, its cw-package.json written here naming the source asked, never the source's own, and no other source is reached (CORE Story 2 scenario 5, VENDOR Story 3 scenario 17)", async () => {
  const { fileReader, sourceFetcher, charterAuthoringApp } = repositoryWith();
  sourceFetcher.sourceFilesBySource[SOURCE] = { ...sourceFiles, ".cw/charter/grill/cw-package.json": "not json\n" };

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, "v1", ["sdd"]));

  assert.deepEqual(await charterFilePathsOf(fileReader, "grill"), [
    "cw-package.json",
    "primitive/guide/grill-rule/index.md",
  ]);
  assert.deepEqual(await installedCharterRecordOf(fileReader, "grill"), {
    charter: "grill",
    source: SOURCE,
    version: "v1",
  });
  assert.deepEqual(
    sourceFetcher.fetchedSources.map(({ source }) => source),
    [SOURCE],
  );
});

test("--as installs the charter under that name, its cw-package.json naming the charter it was in the source (VENDOR Story 3 scenario 18)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["lone"], "solo"));

  assert.deepEqual(await charterNamesOf(fileReader), ["solo"]);
  assert.deepEqual(await installedCharterRecordOf(fileReader, "solo"), {
    charter: "lone",
    source: SOURCE,
    version: IN_MEMORY_COMMIT_ID,
  });
});

test("--as names the charter picked alone: a charter it includes keeps its own name (VENDOR-FR-020, VENDOR-FR-018)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["sdd"], "team"));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "team"]);
  assert.equal((await installedCharterRecordOf(fileReader, "team")).charter, "sdd");
  assert.equal((await installedCharterRecordOf(fileReader, "baseline")).charter, "baseline");
});

test("--as a name a charter may not take installs nothing, saying it cannot name a charter (VENDOR-FR-020)", async () => {
  for (const asName of ["root", "guide", "Not An Id"]) {
    const { fileReader, charterAuthoringApp } = repositoryWith();

    const refusalText = faultTextOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["lone"], asName));

    assert.match(refusalText, /cannot name a charter/, asName);
    assert.deepEqual(await charterNamesOf(fileReader), [], asName);
  }
});

test("a name held by a charter installed from the same source is replaced whole; one authored, or installed from another source, is refused suggesting --as (VENDOR Story 3 scenario 19)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith({
    ".cw/charter/lone/cw-package.json": installedCharterRecordTextOf("lone", SOURCE, "v0"),
    ".cw/charter/lone/primitive/guide/old-rule/index.md": guideTextOf("old-rule"),
  });
  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, "v1", ["lone"]));
  assert.deepEqual(await charterFilePathsOf(fileReader, "lone"), [
    "cw-package.json",
    "primitive/guide/lone-rule/index.md",
  ]);
  assert.equal((await installedCharterRecordOf(fileReader, "lone")).version, "v1");

  for (const heldFiles of [
    { ".cw/charter/lone/primitive/guide/mine/index.md": guideTextOf("mine") },
    {
      ".cw/charter/lone/cw-package.json": installedCharterRecordTextOf("lone", "other/source", "v0"),
      ".cw/charter/lone/primitive/guide/theirs/index.md": guideTextOf("theirs"),
    },
  ]) {
    const { fileReader: heldFileReader, charterAuthoringApp: heldAuthoringApp } = repositoryWith(heldFiles);
    const heldPaths = await charterFilePathsOf(heldFileReader, "lone");
    const refusalText = faultTextOf(await heldAuthoringApp.pullCharters(SOURCE, false, undefined, ["lone"]));
    assert.match(refusalText, /lone/);
    assert.match(refusalText, /--as/);
    assert.deepEqual(await charterFilePathsOf(heldFileReader, "lone"), heldPaths);
  }
});

test("a charter installed --as another name, then under its own, is refused naming both files of the id they share, and nothing is written (VENDOR-FR-009, VENDOR-FR-020)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();
  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["lone"], "solo"));

  const refusalText = faultTextOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["lone"]));

  assert.match(refusalText, /charter\/solo\/primitive\/guide\/lone-rule\/index\.md/);
  assert.match(refusalText, /lone-rule/);
  assert.deepEqual(await charterNamesOf(fileReader), ["solo"]);
});

test("--charter naming a charter the source does not hold installs nothing, naming those it holds (VENDOR Story 3 scenario 20)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  const refusalText = faultTextOf(await charterAuthoringApp.pullCharters(SOURCE, false, undefined, ["nothing-here"]));

  assert.match(refusalText, /holds no charter nothing-here/);
  assert.match(refusalText, /baseline, grill, lone, sdd/);
  assert.deepEqual(await charterNamesOf(fileReader), []);
});

test("cw charter names each installed charter with its source and version; cw charter remove deletes one whole (VENDOR Story 3 scenario 21)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith({
    ".cw/charter/team/primitive/guide/mine/index.md": guideTextOf("mine"),
  });
  answerOf(await charterAuthoringApp.pullCharters(SOURCE, false, "v1", ["lone"]));

  const charterMetadataListDTO = answerOf(await charterAuthoringApp.listCharters(true));
  assert.deepEqual(
    charterMetadataListDTO.data.charters.map(({ data: { name, source, version } }) => ({ name, source, version })),
    [{ name: "lone", source: SOURCE, version: "v1" }],
  );

  answerOf(await charterAuthoringApp.removeCharters("lone", false, false));
  assert.deepEqual(await charterNamesOf(fileReader), ["team"]);
  assert.match(faultTextOf(await charterAuthoringApp.removeCharters("absent", false, false)), /absent/);
  assert.deepEqual(await charterNamesOf(fileReader), ["team"]);
  answerOf(await charterAuthoringApp.removeCharters("team", false, false));
  assert.deepEqual(await charterNamesOf(fileReader), []);
});

test("cw charter pull --fork --charter=sdd copies sdd and what it includes whole, with no cw-package.json, editable as the repository's own (VENDOR Story 3 scenario 22)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.pullCharters(SOURCE, true, undefined, ["sdd"]));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "sdd"]);
  for (const charterName of ["baseline", "grill", "sdd"])
    assert.equal(await fileReader.readIfThere(`.cw/charter/${charterName}/cw-package.json`), undefined);
  assert.deepEqual(await charterFilePathsOf(fileReader, "sdd"), [
    "eval/sdd.json",
    "primitive/guide/sdd-rule/index.md",
    "test/sdd.json",
  ]);
  const openedPrimitive = answerOf(await charterAuthoringApp.openPrimitive("sdd-rule")).data;
  assert.equal(openedPrimitive.layerName, "repo");
  answerOf(
    await charterAuthoringApp.rewritePrimitive("sdd-rule", openedPrimitive.headers, "Changed.", openedPrimitive.hash),
  );
});

test("injecting a charter whose name, or one of whose ids, the repository holds is refused naming both, and nothing is written (VENDOR Story 3 scenario 23)", async () => {
  for (const heldFiles of [
    { ".cw/charter/lone/primitive/guide/mine/index.md": guideTextOf("mine") },
    { ".cw/charter/team/primitive/guide/lone-rule/index.md": guideTextOf("lone-rule") },
  ]) {
    const { fileReader, charterAuthoringApp } = repositoryWith(heldFiles);
    const heldNames = await charterNamesOf(fileReader);

    const refusalText = faultTextOf(await charterAuthoringApp.pullCharters(SOURCE, true, undefined, ["lone"]));

    assert.match(refusalText, /lone/);
    assert.deepEqual(await charterNamesOf(fileReader), heldNames);
  }
});

test("a charter of a source refused while it is copied replaces no charter held, and leaves nothing aside (VENDOR-FR-017)", async () => {
  const { fileReader, sourceFetcher, charterAuthoringApp } = repositoryWith({
    ".cw/charter/sdd/cw-package.json": installedCharterRecordTextOf("sdd", SOURCE, "v0"),
    ".cw/charter/sdd/primitive/guide/sdd-rule/index.md": guideTextOf("sdd-rule", "Then follow [[baseline-rule]]."),
    ".cw/charter/baseline/cw-package.json": installedCharterRecordTextOf("baseline", SOURCE, "v0"),
    ".cw/charter/baseline/primitive/guide/old-rule/index.md": guideTextOf("old-rule"),
  });
  const heldPathsByCharterName = {
    sdd: await charterFilePathsOf(fileReader, "sdd"),
    baseline: await charterFilePathsOf(fileReader, "baseline"),
  };
  // The last charter's copy is refused, as a link on its way would be.
  const checkOutFolder = sourceFetcher.checkOutFolder.bind(sourceFetcher);
  sourceFetcher.checkOutFolder = async (commit, fromFolder, intoSubFolder) => {
    if (fromFolder.startsWith(".cw/charter/grill/")) throw new Error("A link is on the way.");
    await checkOutFolder(commit, fromFolder, intoSubFolder);
  };

  assert.equal((await charterAuthoringApp.pullCharters(SOURCE, false, "v1", ["sdd"])).type, "Fault");

  assert.deepEqual(await charterFilePathsOf(fileReader, "sdd"), heldPathsByCharterName.sdd);
  assert.deepEqual(await charterFilePathsOf(fileReader, "baseline"), heldPathsByCharterName.baseline);
  assert.deepEqual(await fileReader.readBytesRecursively(".cw/installing"), []);
});

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
const vendorRecordTextOf = (charterName: string, source: string, version: string) =>
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
  ".cw/charter/grill/cw-vendor.json": vendorRecordTextOf("grill", "mattpocock/skills", "v2"),
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

const vendorRecordOf = async (fileReader: InMemoryFileReaders, charterName: string) =>
  JSON.parse((await fileReader.readIfThere(`.cw/charter/${charterName}/cw-vendor.json`)) ?? "null");

test("cw vendor add --charter=sdd installs the whole charter, its test and eval cases, beside a cw-vendor.json naming it, the source and the version (VENDOR Story 3 scenario 14)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.addVendor(SOURCE, "v1.0.0", ["sdd"]));

  assert.deepEqual(await charterFilePathsOf(fileReader, "sdd"), [
    "cw-vendor.json",
    "eval/sdd.json",
    "primitive/guide/sdd-rule/index.md",
    "test/sdd.json",
  ]);
  assert.deepEqual(await vendorRecordOf(fileReader, "sdd"), { charter: "sdd", source: SOURCE, version: "v1.0.0" });
  // Nothing is built.
  assert.deepEqual(await fileReader.readBytesRecursively(".cw/out"), []);
});

test("with no --charter, every charter the source authored is installed, and a charter the source installed only where one installed includes it (VENDOR Story 3 scenario 15)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.addVendor(SOURCE));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "lone", "sdd"]);

  const { fileReader: loneFileReader, charterAuthoringApp: loneAuthoringApp } = repositoryWith();
  answerOf(await loneAuthoringApp.addVendor(SOURCE, undefined, ["lone"]));
  assert.deepEqual(await charterNamesOf(loneFileReader), ["lone"]);
});

test("a charter naming an id another charter of the source holds installs that charter with it, and so on (VENDOR Story 3 scenario 16)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.addVendor(SOURCE, undefined, ["sdd"]));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "sdd"]);
  assert.deepEqual(await charterFilePathsOf(fileReader, "baseline"), [
    "cw-vendor.json",
    "primitive/guide/baseline-rule/index.md",
    "test/baseline.json",
  ]);
  assert.deepEqual(await vendorRecordOf(fileReader, "baseline"), {
    charter: "baseline",
    source: SOURCE,
    version: IN_MEMORY_COMMIT_ID,
  });
});

test("a charter included that the source itself installed is copied as it stands, its cw-vendor.json written here naming the source asked, never the source's own, and no other source is reached (CORE Story 2 scenario 5, VENDOR Story 3 scenario 17)", async () => {
  const { fileReader, sourceFetcher, charterAuthoringApp } = repositoryWith();
  sourceFetcher.sourceFilesBySource[SOURCE] = { ...sourceFiles, ".cw/charter/grill/cw-vendor.json": "not json\n" };

  answerOf(await charterAuthoringApp.addVendor(SOURCE, "v1", ["sdd"]));

  assert.deepEqual(await charterFilePathsOf(fileReader, "grill"), [
    "cw-vendor.json",
    "primitive/guide/grill-rule/index.md",
  ]);
  assert.deepEqual(await vendorRecordOf(fileReader, "grill"), { charter: "grill", source: SOURCE, version: "v1" });
  assert.deepEqual(
    sourceFetcher.fetchedSources.map(({ source }) => source),
    [SOURCE],
  );
});

test("--as installs the charter under that name, its cw-vendor.json naming the charter it was in the source (VENDOR Story 3 scenario 18)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.addVendor(SOURCE, undefined, ["lone"], "solo"));

  assert.deepEqual(await charterNamesOf(fileReader), ["solo"]);
  assert.deepEqual(await vendorRecordOf(fileReader, "solo"), {
    charter: "lone",
    source: SOURCE,
    version: IN_MEMORY_COMMIT_ID,
  });
});

test("--as a name a charter may not take installs nothing, saying it cannot name a charter (VENDOR-FR-020)", async () => {
  for (const asName of ["root", "guide", "Not An Id"]) {
    const { fileReader, charterAuthoringApp } = repositoryWith();

    const refusalText = faultTextOf(await charterAuthoringApp.addVendor(SOURCE, undefined, ["lone"], asName));

    assert.match(refusalText, /cannot name a charter/, asName);
    assert.deepEqual(await charterNamesOf(fileReader), [], asName);
  }
});

test("a name held by a charter installed from the same source is replaced whole; one authored, or installed from another source, is refused suggesting --as (VENDOR Story 3 scenario 19)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith({
    ".cw/charter/lone/cw-vendor.json": vendorRecordTextOf("lone", SOURCE, "v0"),
    ".cw/charter/lone/primitive/guide/old-rule/index.md": guideTextOf("old-rule"),
  });
  answerOf(await charterAuthoringApp.addVendor(SOURCE, "v1", ["lone"]));
  assert.deepEqual(await charterFilePathsOf(fileReader, "lone"), [
    "cw-vendor.json",
    "primitive/guide/lone-rule/index.md",
  ]);
  assert.equal((await vendorRecordOf(fileReader, "lone")).version, "v1");

  for (const heldFiles of [
    { ".cw/charter/lone/primitive/guide/mine/index.md": guideTextOf("mine") },
    {
      ".cw/charter/lone/cw-vendor.json": vendorRecordTextOf("lone", "other/source", "v0"),
      ".cw/charter/lone/primitive/guide/theirs/index.md": guideTextOf("theirs"),
    },
  ]) {
    const { fileReader: heldFileReader, charterAuthoringApp: heldAuthoringApp } = repositoryWith(heldFiles);
    const heldPaths = await charterFilePathsOf(heldFileReader, "lone");
    const refusalText = faultTextOf(await heldAuthoringApp.addVendor(SOURCE, undefined, ["lone"]));
    assert.match(refusalText, /lone/);
    assert.match(refusalText, /--as/);
    assert.deepEqual(await charterFilePathsOf(heldFileReader, "lone"), heldPaths);
  }
});

test("a charter installed --as another name, then under its own, is refused naming both files of the id they share, and nothing is written (VENDOR Story 3 scenario 19)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();
  answerOf(await charterAuthoringApp.addVendor(SOURCE, undefined, ["lone"], "solo"));

  const refusalText = faultTextOf(await charterAuthoringApp.addVendor(SOURCE, undefined, ["lone"]));

  assert.match(refusalText, /charter\/solo\/primitive\/guide\/lone-rule\/index\.md/);
  assert.match(refusalText, /lone-rule/);
  assert.deepEqual(await charterNamesOf(fileReader), ["solo"]);
});

test("--charter naming a charter the source does not author installs nothing, naming those it authors (VENDOR Story 3 scenario 20)", async () => {
  for (const charterName of ["nothing-here", "grill"]) {
    const { fileReader, charterAuthoringApp } = repositoryWith();

    const refusalText = faultTextOf(await charterAuthoringApp.addVendor(SOURCE, undefined, [charterName]));

    assert.match(refusalText, /baseline, lone, sdd/);
    assert.deepEqual(await charterNamesOf(fileReader), []);
  }
});

test("cw vendor list names each installed charter with its source and version; cw vendor remove deletes one whole, and refuses an authored one (VENDOR Story 3 scenario 21)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith({
    ".cw/charter/team/primitive/guide/mine/index.md": guideTextOf("mine"),
  });
  answerOf(await charterAuthoringApp.addVendor(SOURCE, "v1", ["lone"]));

  const chartersDTO = answerOf(await charterAuthoringApp.listVendors());
  assert.deepEqual(
    chartersDTO.data.charters.map(({ data: { name, source, version } }) => ({ name, source, version })),
    [{ name: "lone", source: SOURCE, version: "v1" }],
  );

  answerOf(await charterAuthoringApp.removeVendor("lone"));
  assert.deepEqual(await charterNamesOf(fileReader), ["team"]);
  assert.match(faultTextOf(await charterAuthoringApp.removeVendor("team")), /team/);
  assert.deepEqual(await charterNamesOf(fileReader), ["team"]);
});

test("cw vendor inject --charter=sdd copies sdd and what it includes whole, with no cw-vendor.json, editable as the repository's own (VENDOR Story 3 scenario 22)", async () => {
  const { fileReader, charterAuthoringApp } = repositoryWith();

  answerOf(await charterAuthoringApp.injectVendor(SOURCE, undefined, ["sdd"]));

  assert.deepEqual(await charterNamesOf(fileReader), ["baseline", "grill", "sdd"]);
  for (const charterName of ["baseline", "grill", "sdd"])
    assert.equal(await fileReader.readIfThere(`.cw/charter/${charterName}/cw-vendor.json`), undefined);
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

    const refusalText = faultTextOf(await charterAuthoringApp.injectVendor(SOURCE, undefined, ["lone"]));

    assert.match(refusalText, /lone/);
    assert.deepEqual(await charterNamesOf(fileReader), heldNames);
  }
});

test("a charter of a source refused while it is copied replaces no charter held, and leaves nothing aside (VENDOR-FR-017)", async () => {
  const { fileReader, sourceFetcher, charterAuthoringApp } = repositoryWith({
    ".cw/charter/sdd/cw-vendor.json": vendorRecordTextOf("sdd", SOURCE, "v0"),
    ".cw/charter/sdd/primitive/guide/sdd-rule/index.md": guideTextOf("sdd-rule", "Then follow [[baseline-rule]]."),
    ".cw/charter/baseline/cw-vendor.json": vendorRecordTextOf("baseline", SOURCE, "v0"),
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

  assert.equal((await charterAuthoringApp.addVendor(SOURCE, "v1", ["sdd"])).type, "Fault");

  assert.deepEqual(await charterFilePathsOf(fileReader, "sdd"), heldPathsByCharterName.sdd);
  assert.deepEqual(await charterFilePathsOf(fileReader, "baseline"), heldPathsByCharterName.baseline);
  assert.deepEqual(await fileReader.readBytesRecursively(".cw/installing"), []);
});

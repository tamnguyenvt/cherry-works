import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { GitSources } from "../src/module/charter/infra/git-sources.adapter.js";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { FileOutput } from "../src/module/shared/infra/file-output.adapter.js";
import { FileReaders } from "../src/module/shared/infra/file-readers.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { answerOf, faultTextOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf } from "./use-cases-of.js";

const runCommand = promisify(execFile);

/** A PNG's signature and bytes no text decoder takes back as they were: what a
 *  diagram beside a skill holds. */
const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x0a,
]);

const skillMarkdown =
  '---\nkind: skill\nid: diagrams\ndescription: Draw the flow.\ntriggers: ["draw"]\n---\n\nSee diagram.png.\n';
/** Where the source authors the skill `diagrams`: in its charter `drawing`. */
const SOURCE_SKILL_FOLDER = ".cw/charter/drawing/primitive/skill/diagrams";

/** A temporary directory, taken away when the test that asked for it is done. */
async function temporaryFolderOf(t: { after(fn: () => unknown): void }, name: string): Promise<string> {
  const temporaryFolder = await mkdtemp(join(tmpdir(), `cw-${name}-`));
  t.after(() => rm(temporaryFolder, { recursive: true, force: true }));
  return temporaryFolder;
}

/** A folder on disk holding one skill with a PNG beside its index.md, and the
 *  charter's use cases over the disk's own adapters. */
async function authorDiagramsSkill(t: { after(fn: () => unknown): void }) {
  const repo = await temporaryFolderOf(t, "repo");
  const skillFolder = join(repo, ".cw", "charter", "team", "primitive", "skill", "diagrams");
  await mkdir(skillFolder, { recursive: true });
  await writeFile(join(skillFolder, "index.md"), skillMarkdown);
  await writeFile(join(skillFolder, "diagram.png"), pngBytes);
  await writeFile(join(repo, ".cw", "settings.json"), '{"agents":["claude"]}');
  const charterAuthoringApp = authoringCharterOf(
    new FileReaders(pathToFileURL(`${repo}/`)),
    new FileOutput(pathToFileURL(`${repo}/`)),
    new InMemoryReporter(),
  );
  const charterRuntimeApps = buildingCharterOf(
    new FileReaders(pathToFileURL(`${repo}/`)),
    new FileOutput(pathToFileURL(`${repo}/`)),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  return { repo, skillFolder, charterAuthoringApp, charterRuntimeApps };
}

/** A repository to take from: one charter, `drawing`, authoring one skill with
 *  a PNG beside its index.md, one commit, one tag. */
async function publishedSourceFolderOf(t: { after(fn: () => unknown): void }): Promise<string> {
  const sourceFolder = await temporaryFolderOf(t, "source");
  await mkdir(join(sourceFolder, SOURCE_SKILL_FOLDER), { recursive: true });
  await writeFile(join(sourceFolder, SOURCE_SKILL_FOLDER, "index.md"), skillMarkdown);
  await writeFile(join(sourceFolder, SOURCE_SKILL_FOLDER, "diagram.png"), pngBytes);
  await runCommand("git", ["init", "-q", "-b", "main"], { cwd: sourceFolder });
  await runCommand("git", ["add", "."], { cwd: sourceFolder });
  await runCommand(
    "git",
    ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgSign=false", "commit", "-qm", "one"],
    { cwd: sourceFolder },
  );
  await runCommand("git", ["-c", "tag.gpgSign=false", "-c", "tag.forceSignAnnotated=false", "tag", "v1.0.0"], {
    cwd: sourceFolder,
  });
  return sourceFolder;
}

test("a built binary asset is identical to its source, byte for byte (CORE Story 38 scenario 1, CORE-FR-207)", async (t) => {
  const { repo, charterRuntimeApps } = await authorDiagramsSkill(t);

  const planSummaryDTO = await charterRuntimeApps.buildCharter();

  assert.equal(planSummaryDTO.type, "ProjectionPlanSummary");
  assert.deepEqual(
    new Uint8Array(await readFile(join(repo, ".cw", "out", "skill", "diagrams", "diagram.png"))),
    pngBytes,
  );
});

test("a binary file a source holds lands identical, installed or injected (CORE Story 38 scenario 2, CORE-FR-207)", async (t) => {
  const sourceFolder = await publishedSourceFolderOf(t);
  for (const isForked of [false, true]) {
    const repo = await temporaryFolderOf(t, `repo-${isForked ? "forked" : "installed"}`);
    const charterAuthoringApp = authoringCharterOf(
      new FileReaders(pathToFileURL(`${repo}/`)),
      new FileOutput(pathToFileURL(`${repo}/`)),
      new InMemoryReporter(),
      { sourceFetcher: new GitSources(pathToFileURL(`${repo}/`)) },
    );

    answerOf(await charterAuthoringApp.pullCharters(sourceFolder, isForked, "v1.0.0", ["drawing"]));

    const landedFile = join(repo, ".cw", "charter", "drawing", "primitive", "skill", "diagrams", "diagram.png");
    assert.deepEqual(
      new Uint8Array(await readFile(landedFile)),
      pngBytes,
      `${isForked ? "forking" : "installing"} damaged the file`,
    );
  }
});

test("a binary asset is listed, read, validated and previewed as any asset is, and unchanged it is no change (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { charterAuthoringApp, charterRuntimeApps } = await authorDiagramsSkill(t);

  const catalogueDTO = await charterAuthoringApp.listCatalogue();
  assert.equal(catalogueDTO.type, "Catalogue");
  assert.equal(answerOf(await charterAuthoringApp.openPrimitive("diagrams")).data.id, "diagrams");
  assert.equal(answerOf(await charterRuntimeApps.diagnoseCharter()).data.errorCount, 0);

  await charterRuntimeApps.buildCharter();
  const planSummaryDTO = await charterRuntimeApps.previewCharterBuild();

  assert.ok(planSummaryDTO.type === "ProjectionPlanSummary");
  assert.ok(planSummaryDTO.data.unchanged.includes(".cw/out/skill/diagrams/diagram.png"));
  assert.deepEqual([...planSummaryDTO.data.added, ...planSummaryDTO.data.edited, ...planSummaryDTO.data.deleted], []);
});

test("a binary asset edited on disk after a build is an edit to the preview (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { repo, skillFolder, charterRuntimeApps } = await authorDiagramsSkill(t);
  await charterRuntimeApps.buildCharter();

  // 0x80 for 0x81: two bytes a text decoder reads as the same replacement
  // character, so only bytes compared as bytes tell them apart.
  await writeFile(
    join(skillFolder, "diagram.png"),
    pngBytes.map((pngByte) => (pngByte === 0x80 ? 0x81 : pngByte)),
  );
  const planSummaryDTO = await charterRuntimeApps.previewCharterBuild();

  assert.ok(planSummaryDTO.type === "ProjectionPlanSummary");
  assert.deepEqual(planSummaryDTO.data.edited, [".cw/out/skill/diagrams/diagram.png"]);
  assert.ok((await stat(join(repo, ".cw", "out", "skill", "diagrams", "diagram.png"))).isFile());
});

test("a file's bytes cross the file ports whole, on disk and in memory (CORE Story 38 scenario 4, CORE-FR-208)", async (t) => {
  const folder = pathToFileURL(`${await temporaryFolderOf(t, "ports")}/`);
  const inMemoryFileReaders = new InMemoryFileReaders({}, folder);
  for (const [fileReaders, fileWriter] of [
    [new FileReaders(folder), new FileOutput(folder)],
    [inMemoryFileReaders, new InMemoryFileOutput(inMemoryFileReaders)],
  ] as const) {
    await fileWriter.writeFile("deep/diagram.png", pngBytes);

    assert.deepEqual(await fileReaders.readBytesIfThere("deep/diagram.png"), pngBytes);
    assert.deepEqual(
      (await fileReaders.readBytesRecursively("")).map(({ contents }) => contents),
      [pngBytes],
    );
    assert.equal(await fileReaders.readBytesIfThere("missing.png"), undefined);
  }
});

test("a fetched file's bytes cross the source port whole, from git and in memory (CORE Story 38 scenario 4, CORE-FR-208)", async (t) => {
  const sourceFolder = await publishedSourceFolderOf(t);
  const gitSources = new GitSources(pathToFileURL(`${await temporaryFolderOf(t, "repo")}/`));
  const fetchedCommit = await gitSources.fetchCommit(sourceFolder, "v1.0.0");
  t.after(() => gitSources.removeFetchedCommit(fetchedCommit));
  assert.deepEqual(await gitSources.readBytesAt(fetchedCommit, `${SOURCE_SKILL_FOLDER}/diagram.png`), pngBytes);

  const inMemorySources = new InMemorySources();
  inMemorySources.sourceFilesBySource["team/source"] = { [`${SOURCE_SKILL_FOLDER}/diagram.png`]: pngBytes };
  assert.deepEqual(
    await inMemorySources.readBytesAt(
      await inMemorySources.fetchCommit("team/source"),
      `${SOURCE_SKILL_FOLDER}/diagram.png`,
    ),
    pngBytes,
  );
});

test("an index.md a source holds lands as its bytes when it is injected unconverted (CORE Story 38 scenario 2, CORE-FR-207)", async () => {
  const guideBytes = Uint8Array.from([
    ...new TextEncoder().encode("---\nkind: guide\nid: published\ndescription: Published.\n---\nBody "),
    0xff,
    0x0a,
  ]);
  const fileReader = new InMemoryFileReaders();
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = {
    ".cw/charter/published/primitive/guide/published/index.md": guideBytes,
  };
  const charterAuthoringApp = authoringCharterOf(
    fileReader,
    new InMemoryFileOutput(fileReader),
    new InMemoryReporter(),
    { sourceFetcher },
  );

  await charterAuthoringApp.pullCharters("team/source", true);

  assert.deepEqual(
    await fileReader.readBytesIfThere(new URL("file:///repo/.cw/charter/published/primitive/guide/published/index.md")),
    guideBytes,
  );
});

test("a file a source names with a `..` to land outside its primitive's folder is refused, and nothing is written (CORE Story 37 scenario 5, CORE-FR-044)", async () => {
  const fileReader = new InMemoryFileReaders();
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = {
    [`${SOURCE_SKILL_FOLDER}/index.md`]: skillMarkdown,
    [`${SOURCE_SKILL_FOLDER}/../../../escape.png`]: pngBytes,
  };
  const charterAuthoringApp = authoringCharterOf(
    fileReader,
    new InMemoryFileOutput(fileReader),
    new InMemoryReporter(),
    { sourceFetcher },
  );

  assert.match(
    faultTextOf(await charterAuthoringApp.pullCharters("team/source", true, undefined, ["drawing"])),
    /would land outside the folder it is copied into/,
  );

  assert.deepEqual(await fileReader.readBytesRecursively(new URL("file:///")), []);
});

test("an in-memory worktree holds a binary file as the repository does (CORE Story 38 scenario 4, CORE-FR-208)", async () => {
  const fileReader = new InMemoryFileReaders({ "file:///repo/diagram.png": pngBytes });

  await new InMemoryWorktrees(fileReader).addWorktree(".worktrees/one");

  assert.deepEqual(await fileReader.readBytesIfThere(".worktrees/one/diagram.png"), pngBytes);
});

test("a deleted primitive takes its binary asset with it (CORE Story 38 scenario 5, CORE-FR-076)", async (t) => {
  const { skillFolder, charterAuthoringApp } = await authorDiagramsSkill(t);

  await charterAuthoringApp.removePrimitive("diagrams");

  await assert.rejects(stat(join(skillFolder, "diagram.png")), { code: "ENOENT" });
  await assert.rejects(stat(join(skillFolder, "index.md")), { code: "ENOENT" });
});

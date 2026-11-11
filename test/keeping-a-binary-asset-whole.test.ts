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
const sourceSkillMarkdown = "---\nname: diagrams\ndescription: Draw the flow.\n---\nSee diagram.png.\n";

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
  const skillFolder = join(repo, ".cw", "charter", "primitive", "skill", "diagrams");
  await mkdir(skillFolder, { recursive: true });
  await writeFile(join(skillFolder, "index.md"), skillMarkdown);
  await writeFile(join(skillFolder, "diagram.png"), pngBytes);
  await writeFile(join(repo, ".cw", "settings.json"), '{"agents":["claude"]}');
  const charterAuthoringApp = authoringCharterOf(
    new FileReaders(pathToFileURL(`${repo}/`)),
    new FileOutput(pathToFileURL(`${repo}/`)),
    new InMemoryReporter(),
  );
  const charterRuntimeApp = buildingCharterOf(
    new FileReaders(pathToFileURL(`${repo}/`)),
    new FileOutput(pathToFileURL(`${repo}/`)),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  return { repo, skillFolder, charterAuthoringApp, charterRuntimeApp };
}

/** A repository to take from: one skill with a PNG beside its `SKILL.md`, one
 *  commit, one tag. */
async function publishedSourceFolderOf(t: { after(fn: () => unknown): void }): Promise<string> {
  const sourceFolder = await temporaryFolderOf(t, "source");
  await mkdir(join(sourceFolder, "skills", "diagrams"), { recursive: true });
  await writeFile(join(sourceFolder, "skills", "diagrams", "SKILL.md"), sourceSkillMarkdown);
  await writeFile(join(sourceFolder, "skills", "diagrams", "diagram.png"), pngBytes);
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
  const { repo, charterRuntimeApp } = await authorDiagramsSkill(t);

  const planSummaryDTO = await charterRuntimeApp.build();

  assert.equal(planSummaryDTO.type, "PlanSummary");
  assert.deepEqual(
    new Uint8Array(await readFile(join(repo, ".cw", "out", "skill", "diagrams", "diagram.png"))),
    pngBytes,
  );
});

test("a binary file a source holds lands identical, installed or injected (CORE Story 38 scenario 2, CORE-FR-207)", async (t) => {
  const sourceFolder = await publishedSourceFolderOf(t);
  for (const vendoringMethodName of ["addVendor", "injectVendor"] as const) {
    const repo = await temporaryFolderOf(t, `repo-${vendoringMethodName}`);
    const charterAuthoringApp = authoringCharterOf(
      new FileReaders(pathToFileURL(`${repo}/`)),
      new FileOutput(pathToFileURL(`${repo}/`)),
      new InMemoryReporter(),
      { sourceFetcher: new GitSources(pathToFileURL(`${repo}/`)) },
    );

    await charterAuthoringApp[vendoringMethodName](sourceFolder, "v1.0.0", ["diagrams"]);

    const landedFolder =
      vendoringMethodName === "addVendor"
        ? join(repo, ".cw", "charter", "vendor")
        : join(repo, ".cw", "charter", "primitive", "skill", "diagrams");
    const landedFile =
      vendoringMethodName === "addVendor"
        ? (await runCommand("find", [landedFolder, "-name", "diagram.png"])).stdout.trim()
        : join(landedFolder, "diagram.png");
    assert.deepEqual(new Uint8Array(await readFile(landedFile)), pngBytes, `${vendoringMethodName} damaged the file`);
  }
});

test("a binary asset is listed, read, validated and previewed as any asset is, and unchanged it is no change (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { charterAuthoringApp, charterRuntimeApp } = await authorDiagramsSkill(t);

  const catalogueDTO = await charterAuthoringApp.list();
  assert.equal(catalogueDTO.type, "Catalogue");
  assert.equal(answerOf(await charterAuthoringApp.open("diagrams")).data.id, "diagrams");
  assert.equal(answerOf(await charterRuntimeApp.doctor()).data.errorCount, 0);

  await charterRuntimeApp.build();
  const planSummaryDTO = await charterRuntimeApp.preview();

  assert.ok(planSummaryDTO.type === "PlanSummary");
  assert.ok(planSummaryDTO.data.unchanged.includes(".cw/out/skill/diagrams/diagram.png"));
  assert.deepEqual([...planSummaryDTO.data.added, ...planSummaryDTO.data.edited, ...planSummaryDTO.data.deleted], []);
});

test("a binary asset edited on disk after a build is an edit to the preview (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { repo, skillFolder, charterRuntimeApp } = await authorDiagramsSkill(t);
  await charterRuntimeApp.build();

  // 0x80 for 0x81: two bytes a text decoder reads as the same replacement
  // character, so only bytes compared as bytes tell them apart.
  await writeFile(
    join(skillFolder, "diagram.png"),
    pngBytes.map((pngByte) => (pngByte === 0x80 ? 0x81 : pngByte)),
  );
  const planSummaryDTO = await charterRuntimeApp.preview();

  assert.ok(planSummaryDTO.type === "PlanSummary");
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
    await fileWriter.write("deep/diagram.png", pngBytes);

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
  t.after(() => gitSources.forgetCommit(fetchedCommit));
  assert.deepEqual(await gitSources.readBytesAt(fetchedCommit, "skills/diagrams/diagram.png"), pngBytes);

  const inMemorySources = new InMemorySources();
  inMemorySources.sourceFilesBySource["team/source"] = { "skills/diagrams/diagram.png": pngBytes };
  assert.deepEqual(
    await inMemorySources.readBytesAt(await inMemorySources.fetchCommit("team/source"), "skills/diagrams/diagram.png"),
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
  sourceFetcher.sourceFilesBySource["team/source"] = { ".cw/charter/primitive/guide/published/index.md": guideBytes };
  const charterAuthoringApp = authoringCharterOf(
    fileReader,
    new InMemoryFileOutput(fileReader),
    new InMemoryReporter(),
    { sourceFetcher },
  );

  await charterAuthoringApp.injectVendor("team/source");

  assert.deepEqual(
    await fileReader.readBytesIfThere(new URL("file:///repo/.cw/charter/primitive/guide/published/index.md")),
    guideBytes,
  );
});

test("a file a source names with a `..` to land outside its primitive's folder is refused, and nothing is written (CORE Story 37 scenario 5, CORE-FR-044)", async () => {
  const fileReader = new InMemoryFileReaders();
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = {
    "skills/diagrams/SKILL.md": sourceSkillMarkdown,
    "skills/diagrams/../../../escape.png": pngBytes,
  };
  const charterAuthoringApp = authoringCharterOf(
    fileReader,
    new InMemoryFileOutput(fileReader),
    new InMemoryReporter(),
    { sourceFetcher },
  );

  assert.match(
    faultTextOf(await charterAuthoringApp.injectVendor("team/source", undefined, ["diagrams"])),
    /would land outside/,
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

  await charterAuthoringApp.remove("diagrams");

  await assert.rejects(stat(join(skillFolder, "diagram.png")), { code: "ENOENT" });
  await assert.rejects(stat(join(skillFolder, "index.md")), { code: "ENOENT" });
});

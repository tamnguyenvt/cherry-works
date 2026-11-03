import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { FileOutput } from "../src/zdriven/FileOutput.js";
import { FileReaders } from "../src/zdriven/FileReaders.js";
import { GitSources } from "../src/zdriven/GitSources.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemorySources } from "../src/zdriven/InMemorySources.js";
import { InMemoryWorktrees } from "../src/zdriven/InMemoryWorktrees.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const runCommand = promisify(execFile);

/** A PNG's signature and bytes no text decoder takes back as they were: what a
 *  diagram beside a skill holds. */
const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x0a]);

const skillMarkdown = "---\nkind: skill\nid: diagrams\ndescription: Draw the flow.\ntriggers: [\"draw\"]\n---\n\nSee diagram.png.\n";
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
  const skillFolder = join(repo, ".cw", "charter", "skill", "diagrams");
  await mkdir(skillFolder, { recursive: true });
  await writeFile(join(skillFolder, "index.md"), skillMarkdown);
  await writeFile(join(skillFolder, "diagram.png"), pngBytes);
  await writeFile(join(repo, ".cw", "settings.json"), '{"agents":["claude"]}');
  const charterAuthoringApp = new CharterAuthoring(pathToFileURL(`${repo}/`), new FileReaders(), new YamlParser(), new FileOutput(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  return { repo, skillFolder, charterAuthoringApp };
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
  await runCommand("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgSign=false", "commit", "-qm", "one"], { cwd: sourceFolder });
  await runCommand("git", ["-c", "tag.gpgSign=false", "-c", "tag.forceSignAnnotated=false", "tag", "v1.0.0"], { cwd: sourceFolder });
  return sourceFolder;
}

test("a built binary asset is identical to its source, byte for byte (CORE Story 38 scenario 1, CORE-FR-207)", async (t) => {
  const { repo, charterAuthoringApp } = await authorDiagramsSkill(t);

  const planSummaryDTO = await charterAuthoringApp.build();

  assert.equal(planSummaryDTO.type, "PlanSummary");
  assert.deepEqual(new Uint8Array(await readFile(join(repo, ".cw", "out", "skill", "diagrams", "diagram.png"))), pngBytes);
});

test("a binary file a source holds lands identical, installed or injected (CORE Story 38 scenario 2, CORE-FR-207)", async (t) => {
  const sourceFolder = await publishedSourceFolderOf(t);
  for (const vendoringMethodName of ["add", "inject"] as const) {
    const repo = await temporaryFolderOf(t, `repo-${vendoringMethodName}`);
    const charterVendoringApp = new CharterVendoring(pathToFileURL(`${repo}/`), new FileReaders(), new GitSources(), new FileOutput(), new YamlParser());

    await charterVendoringApp[vendoringMethodName](sourceFolder, "v1.0.0", ["diagrams"]);

    const landedFolder = vendoringMethodName === "add" ? join(repo, ".cw", "vendor") : join(repo, ".cw", "charter", "skill", "diagrams");
    const landedFile = vendoringMethodName === "add"
      ? (await runCommand("find", [landedFolder, "-name", "diagram.png"])).stdout.trim()
      : join(landedFolder, "diagram.png");
    assert.deepEqual(new Uint8Array(await readFile(landedFile)), pngBytes, `${vendoringMethodName} damaged the file`);
  }
});

test("a binary asset is listed, read, validated and previewed as any asset is, and unchanged it is no change (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { charterAuthoringApp } = await authorDiagramsSkill(t);

  const catalogueDTO = await charterAuthoringApp.list();
  assert.equal(catalogueDTO.type, "Catalogue");
  assert.equal((await charterAuthoringApp.open("diagrams")).data.id, "diagrams");
  assert.equal((await charterAuthoringApp.doctor()).data.errorCount, 0);

  await charterAuthoringApp.build();
  const planSummaryDTO = await charterAuthoringApp.preview();

  assert.ok(planSummaryDTO.type === "PlanSummary");
  assert.ok(planSummaryDTO.data.unchanged.includes(".cw/out/skill/diagrams/diagram.png"));
  assert.deepEqual([...planSummaryDTO.data.added, ...planSummaryDTO.data.edited, ...planSummaryDTO.data.deleted], []);
});

test("a binary asset edited on disk after a build is an edit to the preview (CORE Story 38 scenario 3, CORE-FR-207)", async (t) => {
  const { repo, skillFolder, charterAuthoringApp } = await authorDiagramsSkill(t);
  await charterAuthoringApp.build();

  // 0x80 for 0x81: two bytes a text decoder reads as the same replacement
  // character, so only bytes compared as bytes tell them apart.
  await writeFile(join(skillFolder, "diagram.png"), pngBytes.map((pngByte) => (pngByte === 0x80 ? 0x81 : pngByte)));
  const planSummaryDTO = await charterAuthoringApp.preview();

  assert.ok(planSummaryDTO.type === "PlanSummary");
  assert.deepEqual(planSummaryDTO.data.edited, [".cw/out/skill/diagrams/diagram.png"]);
  assert.ok((await stat(join(repo, ".cw", "out", "skill", "diagrams", "diagram.png"))).isFile());
});

test("a file's bytes cross the file ports whole, on disk and in memory (CORE Story 38 scenario 4, CORE-FR-208)", async (t) => {
  const folder = pathToFileURL(`${await temporaryFolderOf(t, "ports")}/`);
  const inMemoryFileReaders = new InMemoryFileReaders();
  for (const [fileReaders, fileWriter] of [[new FileReaders(), new FileOutput()], [inMemoryFileReaders, new InMemoryFileOutput(inMemoryFileReaders)]] as const) {
    const file = new URL("deep/diagram.png", folder);

    await fileWriter.write(file, pngBytes);

    assert.deepEqual(await fileReaders.readBytesIfThere(file), pngBytes);
    assert.deepEqual((await fileReaders.readBytesRecursively(folder)).map(({ contents }) => contents), [pngBytes]);
    assert.equal(await fileReaders.readBytesIfThere(new URL("missing.png", folder)), undefined);
  }
});

test("a fetched file's bytes cross the source port whole, from git and in memory (CORE Story 38 scenario 4, CORE-FR-208)", async (t) => {
  const sourceFolder = await publishedSourceFolderOf(t);
  const gitSources = new GitSources();
  const fetchedCommit = await gitSources.fetchCommit(sourceFolder, pathToFileURL(`${await temporaryFolderOf(t, "repo")}/`), "v1.0.0");
  t.after(() => gitSources.forgetCommit(fetchedCommit));
  assert.deepEqual(await gitSources.readBytesAt(fetchedCommit, "skills/diagrams/diagram.png"), pngBytes);

  const inMemorySources = new InMemorySources();
  inMemorySources.sourceFilesBySource["team/source"] = { "skills/diagrams/diagram.png": pngBytes };
  assert.deepEqual(await inMemorySources.readBytesAt(await inMemorySources.fetchCommit("team/source", new URL("file:///repo/")), "skills/diagrams/diagram.png"), pngBytes);
});

test("an index.md a source holds lands as its bytes when it is injected unconverted (CORE Story 38 scenario 2, CORE-FR-207)", async () => {
  const guideBytes = Uint8Array.from([...new TextEncoder().encode("---\nkind: guide\nid: published\ndescription: Published.\n---\nBody "), 0xff, 0x0a]);
  const fileReader = new InMemoryFileReaders();
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = { ".cw/charter/guide/published/index.md": guideBytes };
  const charterVendoringApp = new CharterVendoring(new URL("file:///repo/"), fileReader, sourceFetcher, new InMemoryFileOutput(fileReader), new YamlParser());

  await charterVendoringApp.inject("team/source");

  assert.deepEqual(await fileReader.readBytesIfThere(new URL("file:///repo/.cw/charter/guide/published/index.md")), guideBytes);
});

test("a file a source names with a `..` to land outside its primitive's folder is refused, and nothing is written (CORE Story 37 scenario 5, CORE-FR-044)", async () => {
  const fileReader = new InMemoryFileReaders();
  const sourceFetcher = new InMemorySources(fileReader);
  sourceFetcher.sourceFilesBySource["team/source"] = { "skills/diagrams/SKILL.md": sourceSkillMarkdown, "skills/diagrams/../../../escape.png": pngBytes };
  const charterVendoringApp = new CharterVendoring(new URL("file:///repo/"), fileReader, sourceFetcher, new InMemoryFileOutput(fileReader), new YamlParser());

  await assert.rejects(charterVendoringApp.inject("team/source", undefined, ["diagrams"]), /would land outside/);

  assert.deepEqual(await fileReader.readBytesRecursively(new URL("file:///")), []);
});

test("an in-memory worktree holds a binary file as the repository does (CORE Story 38 scenario 4, CORE-FR-208)", async () => {
  const fileReader = new InMemoryFileReaders({ "file:///repo/diagram.png": pngBytes });

  await new InMemoryWorktrees(fileReader).addWorktree(new URL("file:///repo/"), new URL("file:///worktrees/one/"));

  assert.deepEqual(await fileReader.readBytesIfThere(new URL("file:///worktrees/one/diagram.png")), pngBytes);
});

test("a deleted primitive takes its binary asset with it (CORE Story 38 scenario 5, CORE-FR-076)", async (t) => {
  const { skillFolder, charterAuthoringApp } = await authorDiagramsSkill(t);

  await charterAuthoringApp.remove("diagrams");

  await assert.rejects(stat(join(skillFolder, "diagram.png")), { code: "ENOENT" });
  await assert.rejects(stat(join(skillFolder, "index.md")), { code: "ENOENT" });
});

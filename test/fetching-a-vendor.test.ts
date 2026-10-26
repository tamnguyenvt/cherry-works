import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { Git } from "../src/zdriven/Git.js";
import { AdapterFault } from "../src/hexagon/port/zdriven/AdapterFault.js";

const run = promisify(execFile);
const git = new Git();

/** Git as a test runs it: an author of its own, nothing signed, so what is
 *  committed here does not depend on whose machine this is. */
const commit = (cwd: string, message: string) =>
  run(
    "git",
    ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgSign=false", "commit", "-qm", message],
    { cwd },
  );

/** A temporary directory, taken away when the test that asked for it is done. */
async function temporary(t: { after(fn: () => unknown): void }, name: string): Promise<string> {
  const at = await mkdtemp(join(tmpdir(), `cw-${name}-`));
  t.after(() => rm(at, { recursive: true, force: true }));
  return at;
}

/** A repository to install from: one guide under its charter folder, a README
 *  beside it, one commit, one tag. A path on disk is a source git fetches like
 *  any other, so the adapter is exercised whole without a network. */
async function published(t: { after(fn: () => unknown): void }, body = "Reject any."): Promise<string> {
  const source = join(await temporary(t, "source"), "charter");
  await mkdir(join(source, ".cw", "charter", "guide", "no-any"), { recursive: true });
  await writeFile(join(source, ".cw", "charter", "guide", "no-any", "index.md"), `---\nkind: guide\n---\n\n${body}\n`);
  await writeFile(join(source, "README.md"), "Not part of the charter.\n");
  await run("git", ["init", "-q", "-b", "main"], { cwd: source });
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "one");
  await run("git", ["-c", "tag.gpgSign=false", "-c", "tag.forceSignAnnotated=false", "tag", "v1.0.0"], {
    cwd: source,
  });
  return source;
}

/** A repository to install into: versioned, with the one commit a subtree needs
 *  to land on, and nothing in hand. */
async function repository(t: { after(fn: () => unknown): void }): Promise<string> {
  const repo = await temporary(t, "repo");
  await run("git", ["init", "-q", "-b", "main"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "one\n");
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "one");
  return repo;
}

/** One source installed into one repository the way vendoring does it: the
 *  source fetched at this version, and its charter folder checked out at
 *  `.cw/vendor/charter`. Which folders those are is the hexagon's to decide; the
 *  adapter is told. */
async function installed(source: string, repo: string, version?: string): Promise<void> {
  const repoUrl = pathToFileURL(`${repo}/`);
  await git.checkoutFolderAt(repoUrl, await git.fetchCommit(source, repoUrl, version), ".cw/charter", ".cw/vendor/charter");
}

/** What the vendored guide says in this repository, read off disk. */
const vendored = (repo: string) => readFile(join(repo, ".cw", "vendor", "charter", "guide", "no-any", "index.md"), "utf8");

test("a source's charter folder checked out at its commit lands where it is told, left unstaged and uncommitted", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject any\./);
  await assert.rejects(readFile(join(repo, ".cw", "vendor", "charter", "README.md")), "only the folder asked for lands");
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});

test("installing with work in hand leaves that work as it was, staged or not", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await writeFile(join(repo, "README.md"), "two\n");
  await writeFile(join(repo, "staged.md"), "staged\n");
  await run("git", ["add", "staged.md"], { cwd: repo });

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject any\./);
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
});

test("a version names what is fetched", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await installed(source, repo, "v1.0.0");

  assert.match(await vendored(repo), /Reject any\./);
});

test("installing a source already there brings it up to date", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);

  await writeFile(join(source, ".cw", "charter", "guide", "no-any", "index.md"), "---\nkind: guide\n---\n\nReject it everywhere.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await installed(source, repo);

  assert.match(await vendored(repo), /Reject it everywhere\./);
});

test("installing again what is already committed there leaves nothing in hand", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");

  await installed(source, repo);

  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), true);
});

test("a version the source has not got is refused in git's own words, fetching nothing", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  const raised = await git.fetchCommit(source, pathToFileURL(`${repo}/`), "v9.9.9").catch((one: unknown) => one);

  assert.ok(raised instanceof AdapterFault, String(raised));
  assert.match(raised.fix, /tag or branch/);
  await assert.rejects(vendored(repo));
});

test("a source that cannot be reached is refused in git's own words", async (t) => {
  const repo = await repository(t);

  const raised = await git.fetchCommit(join(repo, "nothing-here"), pathToFileURL(`${repo}/`)).catch((one: unknown) => one);

  assert.ok(raised instanceof AdapterFault, String(raised));
  assert.match(raised.message, /repository|does not exist/);
});

test("an installed folder is taken away, and that it is gone is committed", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await installed(source, repo);
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");

  await git.removeSubFolder(pathToFileURL(`${repo}/`), ".cw/vendor/charter");

  await assert.rejects(vendored(repo));
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd: repo });
  assert.equal(stdout.trim(), "", "what went is committed, not left in hand");
});

test("a folder this repository has not got is refused in git's own words", async (t) => {
  const repo = await repository(t);

  const raised = await git
    .removeSubFolder(pathToFileURL(`${repo}/`), ".cw/vendor/absent")
    .catch((one: unknown) => one);

  assert.ok(raised instanceof AdapterFault, String(raised));
  assert.match(raised.fix, /\.cw\/vendor\/absent/);
});

test("a repository with work in hand says so before anything is installed", async (t) => {
  const repo = await repository(t);
  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), true);

  await writeFile(join(repo, "README.md"), "two\n");

  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), false);
});

test("a folder that is no repository is not clean either", async (t) => {
  const folder = await temporary(t, "bare");

  assert.equal(await git.isClean(pathToFileURL(`${folder}/`)), false);
});

/** A skills repository to take from: two skills, one with an asset two folders
 *  down, one commit. */
async function publishedSkills(t: { after(fn: () => unknown): void }): Promise<string> {
  const source = join(await temporary(t, "skills"), "skills");
  await mkdir(join(source, "skills", "grill-me", "agents", "deep"), { recursive: true });
  await mkdir(join(source, "skills", "grilling"), { recursive: true });
  await writeFile(join(source, "skills", "grill-me", "SKILL.md"), "---\nname: grill-me\ndescription: Grill.\n---\n\nGrill me.\n");
  await writeFile(join(source, "skills", "grill-me", "agents", "deep", "openai.yaml"), "model: x\n");
  await writeFile(join(source, "skills", "grilling", "SKILL.md"), "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n");
  await run("git", ["init", "-q", "-b", "main"], { cwd: source });
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "one");
  return source;
}

test("a source fetched once is read at its commit: every file it holds, and what one holds (CORE-FR-185)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);

  const fetchedCommit = await git.fetchCommit(source, repoUrl);

  assert.deepEqual([...(await git.listFilesAt(repoUrl, fetchedCommit))].sort(), [
    "skills/grill-me/SKILL.md",
    "skills/grill-me/agents/deep/openai.yaml",
    "skills/grilling/SKILL.md",
  ]);
  assert.equal(await git.readFileAt(repoUrl, fetchedCommit, "skills/grilling/SKILL.md"), "---\nname: grilling\ndescription: Grilling.\n---\n\nGrill.\n");
});

test("one folder of a commit fetched is checked out over a folder here, whole, left unstaged and uncommitted (CORE-FR-187, CORE-FR-189)", async (t) => {
  const [source, repo] = [await publishedSkills(t), await repository(t)];
  const repoUrl = pathToFileURL(`${repo}/`);
  const fetchedCommit = await git.fetchCommit(source, repoUrl);
  const intoSubFolder = ".cw/vendor/team/skills/skill/grill-me";
  await mkdir(join(repo, intoSubFolder), { recursive: true });
  await writeFile(join(repo, intoSubFolder, "stale.md"), "From before.\n");
  await mkdir(join(repo, ".cw/vendor/team/skills/skill/grilling"), { recursive: true });
  await writeFile(join(repo, ".cw/vendor/team/skills/skill/grilling/index.md"), "Kept.\n");
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  await git.checkoutFolderAt(repoUrl, fetchedCommit, "skills/grill-me", intoSubFolder);

  assert.equal(await readFile(join(repo, intoSubFolder, "agents", "deep", "openai.yaml"), "utf8"), "model: x\n");
  assert.match(await readFile(join(repo, intoSubFolder, "SKILL.md"), "utf8"), /name: grill-me/);
  await assert.rejects(() => readFile(join(repo, intoSubFolder, "stale.md"), "utf8"), "what the folder held is replaced whole");
  assert.equal(await readFile(join(repo, ".cw/vendor/team/skills/skill/grilling/index.md"), "utf8"), "Kept.\n", "a folder beside it is left as it was");
  const { stdout: headAfter } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });
  assert.equal(headAfter, headBefore, "nothing is committed");
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "", "nothing is staged");
});

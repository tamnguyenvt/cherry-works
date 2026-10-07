import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { Git } from "../src/zdriven/Git.js";
import { DrivenFault } from "../src/hexagon/port/zdriven/DrivenFault.js";

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

/** One repository, and where a vendor installs under it, as the adapter is
 *  handed the two. Which folder that is is the hexagon's to decide; the adapter
 *  is told. */
const at = (repo: string) => [[".cw/charter"], pathToFileURL(`${repo}/`), ".cw/vendor/charter"] as const;

/** What the vendored guide says in this repository, read off disk. */
const vendored = (repo: string) => readFile(join(repo, ".cw", "vendor", "charter", "guide", "no-any", "index.md"), "utf8");

test("a source's charter folder installs under the folder its address names, its README beside it, left unstaged and uncommitted", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  const { stdout: headBefore } = await run("git", ["rev-parse", "HEAD"], { cwd: repo });

  assert.equal(await git.subtreeAdd(source, [".cw/charter", "README.md", "CHANGELOG.md"], pathToFileURL(`${repo}/`), ".cw/vendor/charter"), ".cw/vendor/charter");

  assert.match(await vendored(repo), /Reject any\./);
  assert.equal(await readFile(join(repo, ".cw", "vendor", "charter", "README.md"), "utf8"), "Not part of the charter.\n");
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

  await git.subtreeAdd(source, ...at(repo));

  assert.match(await vendored(repo), /Reject any\./);
  const { stdout: stagedFiles } = await run("git", ["diff", "--cached", "--name-only"], { cwd: repo });
  assert.equal(stagedFiles.trim(), "staged.md");
  assert.equal(await readFile(join(repo, "README.md"), "utf8"), "two\n");
});

test("a version names what is installed", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await git.subtreeAdd(source, ...at(repo), "v1.0.0");

  assert.match(await vendored(repo), /Reject any\./);
});

test("installing a source already there brings it up to date", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await git.subtreeAdd(source, ...at(repo));

  await writeFile(join(source, ".cw", "charter", "guide", "no-any", "index.md"), "---\nkind: guide\n---\n\nReject it everywhere.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await git.subtreeAdd(source, ...at(repo));

  assert.match(await vendored(repo), /Reject it everywhere\./);
});

test("installing again what is already committed there leaves nothing in hand", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await git.subtreeAdd(source, ...at(repo));
  await run("git", ["add", "."], { cwd: repo });
  await commit(repo, "vendored");

  await git.subtreeAdd(source, ...at(repo));

  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), true);
});

test("a source without the folder asked for says so, installing nothing", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  const raised = await git.subtreeAdd(source, ["not-there", "README.md"], pathToFileURL(`${repo}/`), ".cw/vendor/charter").catch((one: unknown) => one);

  assert.ok(raised instanceof DrivenFault, String(raised));
  assert.match(raised.message, /no "not-there"/);

  await assert.rejects(readFile(join(repo, ".cw", "vendor", "charter", "README.md")));
  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), true);
});

test("a source holding the folder it is refused for says so, installing nothing", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await mkdir(join(source, ".cw", "vendor", "other", "guide", "x"), { recursive: true });
  await writeFile(join(source, ".cw", "vendor", "other", "guide", "x", "index.md"), "---\nkind: guide\n---\n\nX.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "vendored");

  const raised = await git.subtreeAdd(source, ...at(repo), undefined, ".cw/vendor").catch((one: unknown) => one);

  assert.ok(raised instanceof DrivenFault, String(raised));
  assert.match(raised.message, /holds "\.cw\/vendor"/);

  await assert.rejects(vendored(repo));
  assert.equal(await git.isClean(pathToFileURL(`${repo}/`)), true);
});

test("a source without the folder it is refused for installs as any other", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  assert.equal(await git.subtreeAdd(source, ...at(repo), undefined, ".cw/vendor"), ".cw/vendor/charter");
});

test("a version the source has not got is refused in git's own words, installing nothing", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  const raised = await git.subtreeAdd(source, ...at(repo), "v9.9.9").catch((one: unknown) => one);

  assert.ok(raised instanceof DrivenFault, String(raised));
  assert.match(raised.fix, /tag or branch/);
  await assert.rejects(vendored(repo));
});

test("a source that cannot be reached is refused in git's own words", async (t) => {
  const repo = await repository(t);
  const source = join(repo, "nothing-here");

  const raised = await git.subtreeAdd(source, ...at(repo)).catch((one: unknown) => one);

  assert.ok(raised instanceof DrivenFault, String(raised));
  assert.match(raised.message, /repository|does not exist/);
});

test("an installed folder is taken away, and that it is gone is committed", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await git.subtreeAdd(source, ...at(repo));
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

  assert.ok(raised instanceof DrivenFault, String(raised));
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

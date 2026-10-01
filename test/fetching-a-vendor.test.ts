import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { Git } from "../src/zdriven/Git.js";
import { FileReaders } from "../src/zdriven/FileReaders.js";
import { DrivenFault } from "../src/hexagon/port/zdriven/DrivenFault.js";

const run = promisify(execFile);
const git = new Git(new FileReaders());

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

/** A repository to install from: one guide, one commit, one tag. A path on disk
 *  is a source git fetches like any other, so the adapter is exercised whole
 *  without a network. */
async function published(t: { after(fn: () => unknown): void }, body = "Reject any."): Promise<string> {
  const source = join(await temporary(t, "source"), "charter");
  await mkdir(join(source, "guide", "no-any"), { recursive: true });
  await writeFile(join(source, "guide", "no-any", "index.md"), `---\nkind: guide\n---\n\n${body}\n`);
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
const at = (repo: string) => [pathToFileURL(`${repo}/`), ".cw/vendor/charter"] as const;

/** What the vendored guide says in this repository, read off disk. */
const vendored = (repo: string) => readFile(join(repo, ".cw", "vendor", "charter", "guide", "no-any", "index.md"), "utf8");

test("a source installs under the folder its address names, and is committed there", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await git.subtreeAdd(source, ...at(repo));

  assert.match(await vendored(repo), /Reject any\./);
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd: repo });
  assert.equal(stdout.trim(), "", "what was installed is committed, not left in hand");
});

test("a version names what is installed", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];

  await git.subtreeAdd(source, ...at(repo), "v1.0.0");

  assert.match(await vendored(repo), /Reject any\./);
});

test("installing a source already there brings it up to date", async (t) => {
  const [source, repo] = [await published(t), await repository(t)];
  await git.subtreeAdd(source, ...at(repo));

  await writeFile(join(source, "guide", "no-any", "index.md"), "---\nkind: guide\n---\n\nReject it everywhere.\n");
  await run("git", ["add", "."], { cwd: source });
  await commit(source, "two");

  await git.subtreeAdd(source, ...at(repo));

  assert.match(await vendored(repo), /Reject it everywhere\./);
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

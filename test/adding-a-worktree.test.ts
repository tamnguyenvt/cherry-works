import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { AdapterFault, RefusedWorktreeFault } from "../src/module/runtime/app/port/out/keeping-worktrees.port.js";
import { GitWorktrees } from "../src/module/runtime/infra/git-worktrees.adapter.js";
import { InMemoryWorktrees } from "../src/module/runtime/infra/in-memory/in-memory-worktrees.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";

const run = promisify(execFile);

test("a worktree holds the last commit and none of the work in hand, and once removed git holds no record of it (EVAL-FR-021)", async () => {
  const repoFolder = await mkdtemp(join(tmpdir(), "cw-repo-"));
  try {
    await run("git", ["init", "-q"], { cwd: repoFolder });
    await writeFile(join(repoFolder, ".gitignore"), ".cw/log/\n");
    await writeFile(join(repoFolder, "committed.md"), "as committed\n");
    await run("git", ["add", "."], { cwd: repoFolder });
    await run(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "first"],
      { cwd: repoFolder },
    );
    await writeFile(join(repoFolder, "committed.md"), "edited since\n");
    await writeFile(join(repoFolder, "untracked.md"), "not added\n");

    const gitWorktrees = new GitWorktrees(pathToFileURL(`${repoFolder}/`));
    const caseWorktreePath = `${gitWorktrees.worktreesFolderPath}/1`;
    await gitWorktrees.addWorktree(caseWorktreePath);

    const worktreePath = join(repoFolder, caseWorktreePath);
    assert.equal(await readFile(join(worktreePath, "committed.md"), "utf8"), "as committed\n");
    assert.equal(existsSync(join(worktreePath, "untracked.md")), false);
    // The work in hand is where it was, and the worktree is no change to it.
    assert.equal(await readFile(join(repoFolder, "committed.md"), "utf8"), "edited since\n");
    const { stdout: statusText } = await run("git", ["status", "--porcelain"], { cwd: repoFolder });
    assert.equal(statusText.includes(".cw/"), false);

    await gitWorktrees.removeWorktree(caseWorktreePath);
    assert.equal(existsSync(worktreePath), false);
    const { stdout: worktreeListText } = await run("git", ["worktree", "list"], { cwd: repoFolder });
    assert.equal(worktreeListText.trim().split("\n").length, 1);

    // A folder left by a run stopped halfway, git's record of it gone or not,
    // is removed all the same.
    await gitWorktrees.addWorktree(caseWorktreePath);
    await rm(worktreePath, { recursive: true, force: true });
    await gitWorktrees.removeWorktree(caseWorktreePath);
    await gitWorktrees.addWorktree(caseWorktreePath);
    await gitWorktrees.removeWorktree(caseWorktreePath);
    assert.equal(existsSync(worktreePath), false);
  } finally {
    await rm(repoFolder, { recursive: true, force: true });
  }
});

test("a worktree of a repository with nothing committed is refused, saying to commit", async () => {
  const repoFolder = await mkdtemp(join(tmpdir(), "cw-repo-"));
  try {
    await run("git", ["init", "-q"], { cwd: repoFolder });
    const repo = pathToFileURL(`${repoFolder}/`);
    await assert.rejects(
      new GitWorktrees(repo).addWorktree(".worktrees/1"),
      (raised) => raised instanceof AdapterFault && /Commit once first/.test(raised.fix),
    );
  } finally {
    await rm(repoFolder, { recursive: true, force: true });
  }
});

test("a worktree of a folder under no repository is refused in git's words, naming git init, and nothing is left behind (CORE-FR-206)", async () => {
  const folder = await mkdtemp(join(tmpdir(), "cw-plain-"));
  try {
    const repo = pathToFileURL(`${folder}/`);
    await assert.rejects(
      new GitWorktrees(repo).addWorktree(".worktrees/1"),
      (adapterFault) =>
        adapterFault instanceof AdapterFault &&
        /not a git repository/.test(adapterFault.message) &&
        /git init/.test(adapterFault.fix),
    );
    assert.deepEqual(await readdir(folder), []);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("a worktree folder left in a folder under no repository is removed without a word from git (CORE-FR-206)", async () => {
  const folder = await mkdtemp(join(tmpdir(), "cw-plain-"));
  try {
    const repo = pathToFileURL(`${folder}/`);
    const gitWorktrees = new GitWorktrees(repo);
    const leftWorktreePath = `${gitWorktrees.worktreesFolderPath}/left`;
    await mkdir(join(folder, leftWorktreePath), { recursive: true });
    await gitWorktrees.removeWorktree(leftWorktreePath);
    assert.deepEqual(await readdir(join(folder, gitWorktrees.worktreesFolderPath)), []);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("a folder outside the worktrees' folder is never removed: it is refused, and left as it was", async () => {
  const folder = await mkdtemp(join(tmpdir(), "cw-plain-"));
  try {
    const gitWorktrees = new GitWorktrees(pathToFileURL(`${folder}/`));
    await mkdir(join(folder, "src"));
    await writeFile(join(folder, "src/kept.ts"), "kept\n");
    for (const outsideWorktreePath of [
      "src",
      "",
      gitWorktrees.worktreesFolderPath,
      `${gitWorktrees.worktreesFolderPath}/`,
      `${gitWorktrees.worktreesFolderPath}//`,
      `${gitWorktrees.worktreesFolderPath}/./`,
      `${gitWorktrees.worktreesFolderPath}/../../../../src`,
      `${gitWorktrees.worktreesFolderPath}-sibling/1`,
    ])
      await assert.rejects(
        gitWorktrees.removeWorktree(outsideWorktreePath),
        // The repository's own root, refused before any path is resolved.
        (refusedFault) =>
          outsideWorktreePath === ""
            ? refusedFault instanceof AdapterFault
            : refusedFault instanceof RefusedWorktreeFault,
        outsideWorktreePath,
      );
    assert.equal(await readFile(join(folder, "src/kept.ts"), "utf8"), "kept\n");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("a machine with no git is told to install it, not to run git init (CORE-FR-206)", async () => {
  const folder = await mkdtemp(join(tmpdir(), "cw-plain-"));
  const keptPath = process.env.PATH;
  try {
    process.env.PATH = "";
    const repo = pathToFileURL(`${folder}/`);
    await assert.rejects(
      new GitWorktrees(repo).addWorktree(".worktrees/1"),
      (adapterFault) =>
        adapterFault instanceof AdapterFault &&
        /install it/.test(adapterFault.fix) &&
        !/git init/.test(adapterFault.fix),
    );
  } finally {
    process.env.PATH = keptPath;
    await rm(folder, { recursive: true, force: true });
  }
});

test("the worktrees held in memory refuse, as the port promises, a folder outside the worktrees' folder, and leave it as it was", async () => {
  const fileReader = new InMemoryFileReaders({ "file:///repo/src/kept.ts": new TextEncoder().encode("kept\n") });
  const inMemoryWorktrees = new InMemoryWorktrees(fileReader);
  for (const outsideWorktreePath of [
    "src",
    inMemoryWorktrees.worktreesFolderPath,
    `${inMemoryWorktrees.worktreesFolderPath}/`,
    `${inMemoryWorktrees.worktreesFolderPath}/./`,
    `${inMemoryWorktrees.worktreesFolderPath}-sibling/1`,
  ])
    await assert.rejects(
      inMemoryWorktrees.removeWorktree(outsideWorktreePath),
      RefusedWorktreeFault,
      outsideWorktreePath,
    );
  assert.deepEqual(await fileReader.readBytesIfThere("src/kept.ts"), new TextEncoder().encode("kept\n"));
});

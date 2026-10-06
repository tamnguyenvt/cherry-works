import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Git } from "../src/zdriven/Git.js";
import { DrivenFault } from "../src/hexagon/port/zdriven/ForVCS.js";

const run = promisify(execFile);

test("a worktree holds the last commit and none of the work in hand, and once removed git holds no record of it (EVAL-FR-021)", async () => {
  const repoFolder = await mkdtemp(join(tmpdir(), "cw-repo-"));
  try {
    await run("git", ["init", "-q"], { cwd: repoFolder });
    await writeFile(join(repoFolder, ".gitignore"), ".worktrees/\n");
    await writeFile(join(repoFolder, "committed.md"), "as committed\n");
    await run("git", ["add", "."], { cwd: repoFolder });
    await run("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "first"], { cwd: repoFolder });
    await writeFile(join(repoFolder, "committed.md"), "edited since\n");
    await writeFile(join(repoFolder, "untracked.md"), "not added\n");

    const git = new Git();
    const repo = pathToFileURL(`${repoFolder}/`);
    const worktreeFolder = new URL(".worktrees/1/", repo);
    await git.addWorktree(repo, worktreeFolder);

    const worktreePath = join(repoFolder, ".worktrees/1");
    assert.equal(await readFile(join(worktreePath, "committed.md"), "utf8"), "as committed\n");
    assert.equal(existsSync(join(worktreePath, "untracked.md")), false);
    // The work in hand is where it was, and the worktree is no change to it.
    assert.equal(await readFile(join(repoFolder, "committed.md"), "utf8"), "edited since\n");
    const { stdout: statusText } = await run("git", ["status", "--porcelain"], { cwd: repoFolder });
    assert.equal(statusText.includes(".worktrees"), false);

    await git.removeWorktree(repo, worktreeFolder);
    assert.equal(existsSync(worktreePath), false);
    const { stdout: worktreeListText } = await run("git", ["worktree", "list"], { cwd: repoFolder });
    assert.equal(worktreeListText.trim().split("\n").length, 1);

    // A folder left by a run stopped halfway, git's record of it gone or not,
    // is removed all the same.
    await git.addWorktree(repo, worktreeFolder);
    await rm(worktreePath, { recursive: true, force: true });
    await git.removeWorktree(repo, worktreeFolder);
    await git.addWorktree(repo, worktreeFolder);
    await git.removeWorktree(repo, worktreeFolder);
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
      new Git().addWorktree(repo, new URL(".worktrees/1/", repo)),
      (raised) => raised instanceof DrivenFault && /Commit what is to be evaluated first/.test(raised.fix),
    );
  } finally {
    await rm(repoFolder, { recursive: true, force: true });
  }
});

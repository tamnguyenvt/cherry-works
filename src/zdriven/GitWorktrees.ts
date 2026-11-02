import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { AdapterFault, type ForKeepingWorktrees } from "#hexagon/port/zdriven/ForKeepingWorktrees.js";

const runGit = promisify(execFile);

/** DRIVEN ADAPTER: git worktrees, as the command everyone already has. */
export class GitWorktrees implements ForKeepingWorktrees {
  /** `git rev-parse --git-dir`: a refusal is a folder under no repository. */
  async #isRepository(folder: URL): Promise<boolean> {
    return runGit("git", ["rev-parse", "--git-dir"], { cwd: fileURLToPath(folder) }).then(
      () => true,
      () => false,
    );
  }

  /** `git worktree add --detach` at `HEAD`, forced over a record of one
   *  left at that folder by a run stopped halfway. */
  async addWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    try {
      await runGit("git", ["worktree", "add", "--quiet", "--detach", "--force", fileURLToPath(worktreeFolder), "HEAD"], { cwd: fileURLToPath(repo) });
    } catch (gitError) {
      if ((gitError as NodeJS.ErrnoException).code === "ENOENT") throw new AdapterFault(`${gitError}`, "Evaluating needs git: install it, and run this again.");
      throw new AdapterFault(
        `${gitError}`,
        (await this.#isRepository(repo)) ? "Commit what is to be evaluated first: a worktree holds the last commit." : 'Evaluating needs a git repository: run "git init" here and commit what is to be evaluated.',
      );
    }
  }

  /** `git worktree remove --force`, then the folder removed whatever git
   *  said, and `git worktree prune` for a record whose folder is gone, which a
   *  folder under no repository has none of. */
  async removeWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    const cwd = fileURLToPath(repo);
    await runGit("git", ["worktree", "remove", "--force", "--force", fileURLToPath(worktreeFolder)], { cwd }).catch(() => undefined);
    await rm(fileURLToPath(worktreeFolder), { recursive: true, force: true });
    if (await this.#isRepository(repo)) await runGit("git", ["worktree", "prune"], { cwd });
  }
}

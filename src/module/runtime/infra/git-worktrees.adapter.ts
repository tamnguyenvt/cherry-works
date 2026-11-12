import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FolderAddress, type FolderURL, resolveFileUrl } from "../../shared/module.js";
import {
  type ForKeepingWorktrees,
  MissingGitFault,
  RefusedWorktreeFault,
} from "../app/port/out/keeping-worktrees.port.js";

const runGit = promisify(execFile);

/** DRIVEN ADAPTER: git worktrees, as the command everyone already has. */
export class GitWorktrees implements ForKeepingWorktrees {
  readonly #repoFolder: FolderURL;

  constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL,
  ) {
    this.#repoFolder = FolderAddress.parseFolderUrl(repoFolder);
  }

  /** `git rev-parse --git-dir`: a refusal is a folder under no repository. */
  async #isRepository(folderUrl: URL): Promise<boolean> {
    return runGit("git", ["rev-parse", "--git-dir"], { cwd: fileURLToPath(folderUrl) }).then(
      () => true,
      () => false,
    );
  }

  /** `git worktree add --detach` at `HEAD`, forced over a record of one
   *  left at that folder by a run stopped halfway. */
  async addWorktree(worktreePath: string): Promise<void> {
    const worktreeFolder = resolveFileUrl(this.#repoFolder, `${worktreePath}/`);
    try {
      await runGit(
        "git",
        ["worktree", "add", "--quiet", "--detach", "--force", fileURLToPath(worktreeFolder), "HEAD"],
        { cwd: fileURLToPath(this.#repoFolder) },
      );
    } catch (gitError) {
      if ((gitError as NodeJS.ErrnoException).code === "ENOENT")
        throw new MissingGitFault(
          "git is not installed here.",
          "Evaluating needs git: install it, and run this again.",
          {
            internal: false,
            cause: gitError,
          },
        );
      // Refused in git's own words (CORE-FR-206): what git says of the
      // person's own repository is theirs to read.
      throw new RefusedWorktreeFault(
        `${gitError}`,
        (await this.#isRepository(this.#repoFolder))
          ? "Commit once first: each case runs in a worktree of the last commit, the charter as it stands built into it."
          : 'Evaluating needs a git repository: run "git init" here and commit once.',
        { internal: false, cause: gitError },
      );
    }
  }

  /** `git worktree remove --force`, then the folder removed whatever git
   *  said, and `git worktree prune` for a record whose folder is gone, which a
   *  folder under no repository has none of. */
  async removeWorktree(worktreePath: string): Promise<void> {
    const worktreeFolder = resolveFileUrl(this.#repoFolder, `${worktreePath}/`);
    const repoFolderPath = fileURLToPath(this.#repoFolder);
    await runGit("git", ["worktree", "remove", "--force", "--force", fileURLToPath(worktreeFolder)], {
      cwd: repoFolderPath,
    }).catch(() => undefined);
    await rm(fileURLToPath(worktreeFolder), { recursive: true, force: true });
    if (await this.#isRepository(this.#repoFolder)) await runGit("git", ["worktree", "prune"], { cwd: repoFolderPath });
  }
}

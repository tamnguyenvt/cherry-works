import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { FolderAddress, type FolderURL, resolveFileUrl } from "#module/shared/module.js";
import {
  type ForKeepingWorktrees,
  logPath,
  MissingGitFault,
  RefusedWorktreeFault,
} from "../app/port/out/keeping-worktrees.port.js";

const runGit = promisify(execFile);

/** DRIVEN ADAPTER: git worktrees, as the command everyone already has. */
/** What follows the worktrees' folder in a worktree's address: named folders,
 *  each ending in `/`, none of them empty, `.` or `..`. */
const WORKTREE_FOLDER_REST = /^(?:(?!\.{1,2}\/)[^/]+\/)+$/;

export class GitWorktrees implements ForKeepingWorktrees {
  readonly #repoFolder: FolderURL;

  /** Under the log, which version control ignores (CORE-FR-225). */
  readonly worktreesFolderPath = logPath.evalWorktreesFolderPath;

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
   *  folder under no repository has none of. A folder that is not one under
   *  `worktreesFolderPath` is refused before anything is removed: what the
   *  repository holds anywhere else is never this adapter's to delete. */
  async removeWorktree(worktreePath: string): Promise<void> {
    const worktreeFolder = resolveFileUrl(this.#repoFolder, `${worktreePath}/`);
    const worktreesFolder = resolveFileUrl(this.#repoFolder, `${this.worktreesFolderPath}/`);
    // One or more named folders under it, none empty, `.` or `..`, however
    // the path was written: never the folder itself.
    if (
      !worktreeFolder.href.startsWith(worktreesFolder.href) ||
      !WORKTREE_FOLDER_REST.test(worktreeFolder.href.slice(worktreesFolder.href.length))
    )
      throw new RefusedWorktreeFault(
        `"${worktreePath}" is no worktree under ${this.worktreesFolderPath}/, so it is not removed.`,
        `Name a worktree under ${this.worktreesFolderPath}/.`,
        { internal: false },
      );
    const repoFolderPath = fileURLToPath(this.#repoFolder);
    await runGit("git", ["worktree", "remove", "--force", "--force", fileURLToPath(worktreeFolder)], {
      cwd: repoFolderPath,
    }).catch(() => undefined);
    await rm(fileURLToPath(worktreeFolder), { recursive: true, force: true });
    if (await this.#isRepository(this.#repoFolder)) await runGit("git", ["worktree", "prune"], { cwd: repoFolderPath });
  }
}

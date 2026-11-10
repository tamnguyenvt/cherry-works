import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { AdapterFault, type ForKeepingWorktrees } from "../app/port/out/keeping-worktrees.port.js";
import { FolderAddress, type FolderURL, urlAt } from "../../shared/module.js";

const runGit = promisify(execFile);

/** DRIVEN ADAPTER: git worktrees, as the command everyone already has. */
export class GitWorktrees implements ForKeepingWorktrees {
  readonly #repoFolder: FolderURL;

  constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL,
  ) {
    this.#repoFolder = FolderAddress.urlOf(repoFolder);
  }

  /** `git rev-parse --git-dir`: a refusal is a folder under no repository. */
  async #isRepository(folder: URL): Promise<boolean> {
    return runGit("git", ["rev-parse", "--git-dir"], { cwd: fileURLToPath(folder) }).then(
      () => true,
      () => false,
    );
  }

  /** `git worktree add --detach` at `HEAD`, forced over a record of one
   *  left at that folder by a run stopped halfway. */
  async addWorktree(worktreePath: string): Promise<void> {
    const worktreeFolder = urlAt(this.#repoFolder, `${worktreePath}/`);
    try {
      await runGit("git", ["worktree", "add", "--quiet", "--detach", "--force", fileURLToPath(worktreeFolder), "HEAD"], { cwd: fileURLToPath(this.#repoFolder) });
    } catch (gitError) {
      if ((gitError as NodeJS.ErrnoException).code === "ENOENT") throw new AdapterFault("git is not installed here.", "Evaluating needs git: install it, and run this again.", { internal: false, cause: gitError });
      // Refused in git's own words (CORE-FR-206): what git says of the
      // person's own repository is theirs to read.
      throw new AdapterFault(
        `${gitError}`,
        (await this.#isRepository(this.#repoFolder)) ? "Commit what is to be evaluated first: a worktree holds the last commit." : 'Evaluating needs a git repository: run "git init" here and commit what is to be evaluated.',
        { internal: false, cause: gitError },
      );
    }
  }

  /** `git worktree remove --force`, then the folder removed whatever git
   *  said, and `git worktree prune` for a record whose folder is gone, which a
   *  folder under no repository has none of. */
  async removeWorktree(worktreePath: string): Promise<void> {
    const worktreeFolder = urlAt(this.#repoFolder, `${worktreePath}/`);
    const repoFolderPath = fileURLToPath(this.#repoFolder);
    await runGit("git", ["worktree", "remove", "--force", "--force", fileURLToPath(worktreeFolder)], { cwd: repoFolderPath }).catch(() => undefined);
    await rm(fileURLToPath(worktreeFolder), { recursive: true, force: true });
    if (await this.#isRepository(this.#repoFolder)) await runGit("git", ["worktree", "prune"], { cwd: repoFolderPath });
  }
}

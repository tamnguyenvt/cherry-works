/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export { AdapterFault, MissingGitFault, RefusedWorktreeFault } from "#module/shared/module.js";
/** The log's layout, where cw's own adapters keep their worktrees. */
export { logPath } from "../../../domain/constants.js";

/**
 * DRIVEN PORT — worktrees of a repository's last commit, the one thing
 * evaluating asks of version control, apart from what fetching a source asks
 * (CORE-FR-206).
 */
export interface ForKeepingWorktrees {
  /** The folder every worktree is added under, from the repository's root:
   *  where a run stopped halfway left any, swept before the next one, and
   *  where each case's worktree is added. The adapter's to say, not the
   *  application's (CORE-FR-217); cw's own keep them in the log,
   *  `.cw/log/eval/worktrees` (EVAL-FR-021). */
  readonly worktreesFolderPath: string;

  /**
   * A worktree of this repository's last commit, checked out detached at this
   * path from the repository: its files as committed, and none of the work in hand
   * (EVAL-FR-021). A repository with nothing committed, and a folder under no
   * repository, each raise an `AdapterFault` in git's words.
   */
  addWorktree(worktreePath: string): Promise<void>;

  /** One worktree taken away: its folder, and version control's record of
   *  it. A folder that is no worktree any more, or is not there, is removed
   *  all the same; a path that is not one under `worktreesFolderPath` is
   *  refused, and nothing is removed. */
  removeWorktree(worktreePath: string): Promise<void>;
}

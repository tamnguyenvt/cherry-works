/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */
export { AdapterFault, MissingGitFault, RefusedWorktreeFault } from "../../../../shared/module.js";

/**
 * DRIVEN PORT — worktrees of a repository's last commit, the one thing
 * evaluating asks of version control, apart from what fetching a source asks
 * (CORE-FR-206).
 */
export interface ForKeepingWorktrees {
  /**
   * A worktree of this repository's last commit, checked out detached at this
   * path from the repository: its files as committed, and none of the work in hand
   * (EVAL-FR-021). A repository with nothing committed, and a folder under no
   * repository, each raise an `AdapterFault` in git's words.
   */
  addWorktree(worktreePath: string): Promise<void>;

  /** One worktree taken away: its folder, and version control's record of
   *  it. A folder that is no worktree any more, or is not there, is removed
   *  all the same. */
  removeWorktree(worktreePath: string): Promise<void>;
}

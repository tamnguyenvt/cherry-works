/**
 * Where the log is kept under a repository, each folder by its path from the
 * repository's root, and nothing of where the repository is (CORE-FR-217):
 * what the tool writes for itself beside the compiled output, which version
 * control ignores (CORE-FR-225).
 */
export class LogPath {
  /** The log's folder under a repository. */
  readonly logFolderPath = ".cw/log";

  /** The folder every evaluation's working copy is added under, one per case,
   *  within the log (EVAL-FR-021). */
  readonly evalWorktreesFolderPath = `${this.logFolderPath}/eval/worktrees`;

  /** The folder every evaluation run's folder is kept under, within the log:
   *  the evaluations' part of it (CORE-FR-225). */
  readonly evalRunsFolderPath = `${this.logFolderPath}/eval/runs`;
}

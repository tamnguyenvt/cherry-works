/** The log's folder under a repository: what the tool writes for itself
 *  beside a build's output, which version control ignores (CORE-FR-225). */
const LOG_DIRECTORY = ".cw/log";

/** The folder an evaluation keeps what it writes under, within the log. */
const EVAL_DIRECTORY = "eval";

/** The log, by its path from the repository's root, and nothing of where the
 *  repository is (CORE-FR-217). */
export class LogFolder {
  static readonly path = LOG_DIRECTORY;

  /** The folder every evaluation's working copy is added under, one per case
   *  (EVAL-FR-021). */
  static readonly evalWorktreesPath = `${LOG_DIRECTORY}/${EVAL_DIRECTORY}/worktrees`;

  private constructor() {}
}

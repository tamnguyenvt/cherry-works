/**
 * The runtime module's constants: the log by its path from the repository's
 * root, and nothing of where the repository is (CORE-FR-217).
 */

/** The log's folder under a repository: what the tool writes for itself
 *  beside a build's output, which version control ignores (CORE-FR-225). */
export const LOG_FOLDER_PATH = ".cw/log";

/** The folder every evaluation's working copy is added under, one per case,
 *  within the log (EVAL-FR-021). */
export const EVAL_WORKTREES_FOLDER_PATH = `${LOG_FOLDER_PATH}/eval/worktrees`;

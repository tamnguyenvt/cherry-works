/**
 * The workspace module's constants: where a repository keeps what it
 * configured itself with, from its root (CORE-FR-231), and the ignore file of
 * the workspace beside it, with the line of it that keeps the log out of
 * version control (CORE-FR-225).
 */

/** The settings file, from the repository's root. */
export const SETTINGS_FILE_PATH = ".cw/settings.json";

/** The workspace's ignore file, from the repository's root. */
export const GITIGNORE_FILE_PATH = ".cw/.gitignore";

/** The line of the ignore file that keeps the log out of version control. */
export const LOG_IGNORE_LINE = "log/";

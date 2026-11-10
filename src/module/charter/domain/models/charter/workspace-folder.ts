import { RepoFolder } from "./repo-folder.js";

/** The workspace folder's name under a repository. */
const WORKSPACE_DIRECTORY = ".cw";

/**
 * Where a repository keeps everything this engine reads and writes (plan §3).
 *
 * One directory holds all three: what the repository configured itself with,
 * the charter it authored, and what the charter compiles to. Named here and
 * nowhere else, so the directory the settings are read from, the one a charter
 * is loaded from and the one a build owns are the same string rather than three
 * that drift.
 */
export class WorkspaceFolder extends RepoFolder {
  static readonly path = WORKSPACE_DIRECTORY;
}

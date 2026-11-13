import { type InMemoryFileReaders, resolveFileUrl } from "../../../shared/module.js";
import { type ForKeepingWorktrees, logPath, RefusedWorktreeFault } from "../../app/port/out/keeping-worktrees.port.js";

/** What follows the worktrees' folder in a worktree's path: named folders,
 *  each ending in `/`, none of them empty, `.` or `..`. */
const WORKTREE_FOLDER_REST = /^(?:(?!\.{1,2}\/)[^/]+\/)+$/;
/** Worktrees held in memory: a worktree is the files it is handed copied to the
 *  folder named, as if they were all committed, and a test says whether there
 *  is a repository to take one of. */
export class InMemoryWorktrees implements ForKeepingWorktrees {
  constructor(
    private readonly fileReaders: InMemoryFileReaders,
    private readonly isVersioned: boolean = true,
  ) {}

  readonly worktreesFolderPath = logPath.evalWorktreesFolderPath;

  /** Every worktree added and not yet removed, by its path from the repository. */
  readonly worktreePaths: string[] = [];

  async addWorktree(worktreePath: string): Promise<void> {
    if (!this.isVersioned)
      throw new RefusedWorktreeFault(
        "fatal: not a git repository (or any of the parent directories): .git",
        'Evaluating needs a git repository: run "git init" here and commit once.',
        { internal: false },
      );
    // What the folder holding worktrees holds is no part of a commit.
    // Copied as bytes, as git checks a file out, so nothing is decoded on the way.
    for (const { path, contents } of await this.fileReaders.readBytesRecursively(""))
      if (!path.startsWith(`${this.worktreesFolderPath}/`))
        this.fileReaders.writeFile(resolveFileUrl(this.fileReaders.rootFolder, `${worktreePath}/${path}`), contents);
    this.worktreePaths.push(worktreePath);
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    // Refused as the port promises: only a named folder under the worktrees' folder.
    if (
      !worktreePath.startsWith(`${this.worktreesFolderPath}/`) ||
      !WORKTREE_FOLDER_REST.test(`${worktreePath.slice(this.worktreesFolderPath.length + 1)}/`)
    )
      throw new RefusedWorktreeFault(
        `"${worktreePath}" is no worktree under ${this.worktreesFolderPath}/, so it is not removed.`,
        `Name a worktree under ${this.worktreesFolderPath}/.`,
        { internal: false },
      );
    for (const { path } of await this.fileReaders.readFilesRecursively(worktreePath))
      this.fileReaders.removeFile(resolveFileUrl(this.fileReaders.rootFolder, path));
    const worktreeIndex = this.worktreePaths.indexOf(worktreePath);
    if (worktreeIndex >= 0) this.worktreePaths.splice(worktreeIndex, 1);
  }
}

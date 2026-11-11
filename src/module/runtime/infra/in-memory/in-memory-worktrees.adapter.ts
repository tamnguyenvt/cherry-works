import { type InMemoryFileReaders, urlAt } from "../../../shared/module.js";
import { AdapterFault, type ForKeepingWorktrees } from "../../app/port/out/keeping-worktrees.port.js";

/** Worktrees held in memory: a worktree is the files it is handed copied to the
 *  folder named, as if they were all committed, and a test says whether there
 *  is a repository to take one of. */
export class InMemoryWorktrees implements ForKeepingWorktrees {
  constructor(
    private readonly fileReaders: InMemoryFileReaders,
    private readonly isVersioned: boolean = true,
  ) {}

  /** Every worktree added and not yet removed, by its path from the repository. */
  readonly worktreePaths: string[] = [];

  async addWorktree(worktreePath: string): Promise<void> {
    if (!this.isVersioned)
      throw new AdapterFault(
        "fatal: not a git repository (or any of the parent directories): .git",
        'Evaluating needs a git repository: run "git init" here and commit what is to be evaluated.',
        { internal: false },
      );
    // What the folder holding worktrees holds is no part of a commit.
    const worktreesFolderPath = `${worktreePath.split("/").slice(0, -1).join("/")}/`;
    // Copied as bytes, as git checks a file out, so nothing is decoded on the way.
    for (const { path, contents } of await this.fileReaders.readBytesRecursively(""))
      if (!path.startsWith(worktreesFolderPath))
        this.fileReaders.write(urlAt(this.fileReaders.rootFolder, `${worktreePath}/${path}`), contents);
    this.worktreePaths.push(worktreePath);
  }

  async removeWorktree(worktreePath: string): Promise<void> {
    for (const { path } of await this.fileReaders.readFilesRecursively(worktreePath))
      this.fileReaders.remove(urlAt(this.fileReaders.rootFolder, path));
    const worktreeIndex = this.worktreePaths.indexOf(worktreePath);
    if (worktreeIndex >= 0) this.worktreePaths.splice(worktreeIndex, 1);
  }
}

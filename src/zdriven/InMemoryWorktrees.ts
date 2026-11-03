import { AdapterFault, type ForKeepingWorktrees } from "#hexagon/port/zdriven/ForKeepingWorktrees.js";
import type { InMemoryFileReaders } from "./InMemoryFileReaders.js";

/** Worktrees held in memory: a worktree is the files it is handed copied to the
 *  folder named, as if they were all committed, and a test says whether there
 *  is a repository to take one of. */
export class InMemoryWorktrees implements ForKeepingWorktrees {
  constructor(
    private readonly fileReaders: InMemoryFileReaders,
    private readonly isVersioned: boolean = true,
  ) {}

  /** Every worktree added and not yet removed. */
  readonly worktreeFolders: URL[] = [];

  async addWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    if (!this.isVersioned) throw new AdapterFault("fatal: not a git repository (or any of the parent directories): .git", 'Evaluating needs a git repository: run "git init" here and commit what is to be evaluated.');
    // What the folder holding worktrees holds is no part of a commit.
    const worktreesFolderHref = new URL("../", worktreeFolder).href;
    // Copied as bytes, as git checks a file out, so nothing is decoded on the way.
    for (const { file, contents } of await this.fileReaders.readBytesRecursively(repo))
      if (!file.href.startsWith(worktreesFolderHref)) this.fileReaders.write(new URL(file.href.slice(repo.href.length), worktreeFolder), contents);
    this.worktreeFolders.push(worktreeFolder);
  }

  async removeWorktree(_repo: URL, worktreeFolder: URL): Promise<void> {
    for (const { file } of await this.fileReaders.readFilesRecursively(worktreeFolder)) this.fileReaders.remove(file);
    const worktreeIndex = this.worktreeFolders.findIndex(({ href }) => href === worktreeFolder.href);
    if (worktreeIndex >= 0) this.worktreeFolders.splice(worktreeIndex, 1);
  }
}

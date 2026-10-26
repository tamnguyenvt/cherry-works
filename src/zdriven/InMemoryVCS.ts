import { AdapterFault, type ForVCS } from "#hexagon/port/zdriven/ForVCS.js";
import type { InMemoryFileReaders } from "./InMemoryFileReaders.js";

/** Version control held in memory: a test says whether the folder it is setting
 *  up is inside a repository, and nothing shells out. The second implementation
 *  that earns `ForVCS` its place (plan §2.4). A worktree is the files it is
 *  handed copied to the folder named, as if they were all committed. */
export class InMemoryVCS implements ForVCS {
  constructor(
    private readonly versioned: boolean = true,
    private readonly clean: boolean = true,
    private readonly files?: InMemoryFileReaders,
  ) {}

  /** Every worktree added and not yet removed. */
  readonly worktreeFolders: URL[] = [];

  /** Every source it was asked to fetch, and the version asked for: what a test
   *  about vendoring looks at, since nothing was fetched. */
  readonly fetched: { source: string; version?: string }[] = [];

  /** Every folder of a fetched commit it was asked to put in place, in the
   *  order it was asked. */
  readonly checkedOut: { commit: string; fromFolder: string; intoSubFolder: string }[] = [];

  /** Every source a test says holds neither a charter folder nor a skill. */
  readonly sourcesWithoutSubFolder: string[] = [];

  /** Every source a test says holds a charter with vendors of its own. */
  readonly sourcesHoldingRefusedFolder: string[] = [];

  async isInstalled(_folder: URL): Promise<boolean> {
    return this.versioned;
  }

  /** Every folder it was asked to take away, in the order it was asked. */
  readonly removed: { repo: URL; subFolder: string }[] = [];

  async isClean(_folder: URL): Promise<boolean> {
    return this.clean;
  }

  /** Every file this repository is holding a change to, as a test says it:
   *  paths under the repository, whichever folder they sit in. What
   *  `changedUnder` answers out of, narrowed to the folder it was asked
   *  about. */
  readonly changed: string[] = [];

  async changedUnder(_repo: URL, subFolder: string): Promise<readonly string[]> {
    const folder = subFolder.endsWith("/") ? subFolder : `${subFolder}/`;
    return this.changed.filter((path) => path.startsWith(folder));
  }

  /** Every source a test publishes, by the address it is fetched at: the files
   *  it holds, by their paths in it. A source a test publishes nothing for holds
   *  a charter, as every source did before skills were taken, unless the test
   *  says it holds no charter folder either. */
  readonly sourceFilesBySource: Record<string, Record<string, string>> = {};


  /** Every source a test says cannot be reached: what `fetchCommit` raises
   *  for. */
  readonly unreachableSources: string[] = [];

  /** The files a source holds, as a test published them. A commit here is the
   *  source it was fetched from, and the version asked for after an `@`:
   *  nothing is fetched, so nothing else names it. */
  #listSourceFiles(commit: string): Record<string, string> {
    const source = commit.split("@")[0] ?? commit;
    const publishedCharter = { ".cw/charter/guide/published/index.md": "---\nkind: guide\nid: published\ndescription: Published.\n---\n", "README.md": "# Published\n" };
    if (this.sourcesWithoutSubFolder.includes(source)) return { "README.md": "# Notes\n" };
    if (this.sourcesHoldingRefusedFolder.includes(source)) return { ...publishedCharter, ".cw/vendor/other/guide/x/index.md": "x" };
    return this.sourceFilesBySource[source] ?? publishedCharter;
  }

  async fetchCommit(source: string, _repo: URL, version?: string): Promise<string> {
    if (this.unreachableSources.includes(source)) throw new AdapterFault(`${source} could not be fetched.`, "Check the address, and that you can reach it from here.");
    this.fetched.push({ source, ...(version === undefined ? {} : { version }) });
    return version === undefined ? source : `${source}@${version}`;
  }

  async listFilesAt(_repo: URL, commit: string): Promise<readonly string[]> {
    return Object.keys(this.#listSourceFiles(commit));
  }

  async readFileAt(_repo: URL, commit: string, path: string): Promise<string> {
    const contents = this.#listSourceFiles(commit)[path];
    if (contents === undefined) throw new AdapterFault(`${commit} has no "${path}".`, "Read a file the commit holds.");
    return contents;
  }

  /** The folder written over in the files a test handed it, every file of
   *  the source under `fromFolder` put under it. */
  async checkoutFolderAt(repo: URL, commit: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    this.checkedOut.push({ commit, fromFolder, intoSubFolder });
    const intoFolder = new URL(`${intoSubFolder}/`, repo);
    for (const { file } of (await this.files?.readFilesRecursively(intoFolder)) ?? []) this.files?.remove(file);
    const fromPrefix = fromFolder === "" ? "" : `${fromFolder}/`;
    for (const [path, contents] of Object.entries(this.#listSourceFiles(commit)))
      if (path.startsWith(fromPrefix)) this.files?.write(new URL(path.slice(fromPrefix.length), intoFolder), contents);
  }

  async removeSubFolder(repo: URL, subFolder: string): Promise<void> {
    this.removed.push({ repo, subFolder });
  }

  async addWorktree(repo: URL, worktreeFolder: URL): Promise<void> {
    // What the folder holding worktrees holds is no part of a commit.
    const worktreesFolderHref = new URL("../", worktreeFolder).href;
    for (const { file, contents } of (await this.files?.readFilesRecursively(repo)) ?? [])
      if (!file.href.startsWith(worktreesFolderHref)) this.files?.write(new URL(file.href.slice(repo.href.length), worktreeFolder), contents);
    this.worktreeFolders.push(worktreeFolder);
  }

  async removeWorktree(_repo: URL, worktreeFolder: URL): Promise<void> {
    for (const { file } of (await this.files?.readFilesRecursively(worktreeFolder)) ?? []) this.files?.remove(file);
    const worktreeIndex = this.worktreeFolders.findIndex(({ href }) => href === worktreeFolder.href);
    if (worktreeIndex >= 0) this.worktreeFolders.splice(worktreeIndex, 1);
  }
}

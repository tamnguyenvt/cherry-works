import { AdapterFault, type ForFetchingSources } from "#hexagon/port/zdriven/ForFetchingSources.js";
import type { InMemoryFileReaders } from "./InMemoryFileReaders.js";

/** Sources held in memory: a test publishes what each holds, and nothing shells
 *  out. The second implementation that earns `ForFetchingSources` its place
 *  (plan §2.4). */
export class InMemorySources implements ForFetchingSources {
  constructor(private readonly files?: InMemoryFileReaders) {}

  /** Every source it was asked to fetch, and the version asked for: what a test
   *  about vendoring looks at, since nothing was fetched. */
  readonly fetchedSources: { source: string; version?: string }[] = [];

  /** Every folder of a fetched commit it was asked to put in place, in the
   *  order it was asked. */
  readonly checkedOutFolders: { commit: string; fromFolder: string; intoSubFolder: string }[] = [];

  /** Every source a test says holds neither a charter folder nor a skill. */
  readonly sourcesWithoutSubFolder: string[] = [];

  /** Every source a test says holds a charter with vendors of its own. */
  readonly sourcesHoldingRefusedFolder: string[] = [];

  /** Every commit let go of, in the order it was asked. */
  readonly forgottenCommits: string[] = [];

  /** Every source a test publishes, by the address it is fetched at: the files
   *  it holds, by their paths in it. A source a test publishes nothing for holds
   *  a charter, as every source did before skills were taken, unless the test
   *  says it holds no charter folder either. */
  readonly sourceFilesBySource: Record<string, Record<string, string>> = {};

  /** Every source a test says cannot be reached: what `fetchCommit` raises
   *  for. */
  readonly unreachableSources: string[] = [];

  /** Whether a test says this machine has nothing to fetch with. */
  hasNoGit = false;

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
    if (this.hasNoGit) throw new AdapterFault("spawn git ENOENT", "Reaching a source needs git: install it, and run this again.");
    if (this.unreachableSources.includes(source)) throw new AdapterFault(`${source} could not be fetched.`, "Check the address, and that you can reach it from here.");
    this.fetchedSources.push({ source, ...(version === undefined ? {} : { version }) });
    return version === undefined ? source : `${source}@${version}`;
  }

  async listFilesAt(commit: string): Promise<readonly string[]> {
    return Object.keys(this.#listSourceFiles(commit));
  }

  async readFileAt(commit: string, path: string): Promise<string> {
    const contents = this.#listSourceFiles(commit)[path];
    if (contents === undefined) throw new AdapterFault(`${commit} has no "${path}".`, "Read a file the commit holds.");
    return contents;
  }

  /** The folder written over in the files a test handed it, every file of
   *  the source under `fromFolder` put under it. */
  async checkoutFolderAt(repo: URL, commit: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    this.checkedOutFolders.push({ commit, fromFolder, intoSubFolder });
    const intoFolder = new URL(`${intoSubFolder}/`, repo);
    for (const { file } of (await this.files?.readFilesRecursively(intoFolder)) ?? []) this.files?.remove(file);
    const fromPrefix = fromFolder === "" ? "" : `${fromFolder}/`;
    for (const [path, contents] of Object.entries(this.#listSourceFiles(commit)))
      if (path.startsWith(fromPrefix)) this.files?.write(new URL(path.slice(fromPrefix.length), intoFolder), contents);
  }

  async forgetCommit(commit: string): Promise<void> {
    this.forgottenCommits.push(commit);
  }
}

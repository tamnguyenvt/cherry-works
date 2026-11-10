import { AdapterFault, type ForFetchingCharterSources } from "../../app/port/out/fetching-charter-sources.port.js";
import { type InMemoryFileReaders, decodeContents, encodeContents, urlAt } from "../../../shared/module.js";

/** Sources held in memory: a test publishes what each holds, and nothing shells
 *  out. The second implementation that earns `ForFetchingCharterSources` its place
 *  (plan §2.4). */
export class InMemorySources implements ForFetchingCharterSources {
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
  readonly sourceFilesBySource: Record<string, Record<string, string | Uint8Array>> = {};

  /** Every source a test says cannot be reached: what `fetchCommit` raises
   *  for. */
  readonly unreachableSources: string[] = [];

  /** Whether a test says this machine has nothing to fetch with. */
  hasNoGit = false;

  /** The files a source holds, as a test published them. A commit here is the
   *  source it was fetched from, and the version asked for after an `@`:
   *  nothing is fetched, so nothing else names it. */
  #listSourceFiles(commit: string): Record<string, string | Uint8Array> {
    const source = commit.split("@")[0] ?? commit;
    const publishedCharter = { ".cw/charter/primitive/guide/published/index.md": "---\nkind: guide\nid: published\ndescription: Published.\n---\n", "README.md": "# Published\n" };
    if (this.sourcesWithoutSubFolder.includes(source)) return { "README.md": "# Notes\n" };
    if (this.sourcesHoldingRefusedFolder.includes(source)) return { ...publishedCharter, ".cw/charter/vendor/other/guide/x/index.md": "x" };
    return this.sourceFilesBySource[source] ?? publishedCharter;
  }

  async fetchCommit(source: string, version?: string): Promise<string> {
    if (this.hasNoGit) throw new AdapterFault("spawn git ENOENT", "Reaching a source needs git: install it, and run this again.", { internal: false });
    if (this.unreachableSources.includes(source)) throw new AdapterFault(`${source} could not be fetched.`, "Check the address, and that you can reach it from here.", { internal: false });
    this.fetchedSources.push({ source, ...(version === undefined ? {} : { version }) });
    return version === undefined ? source : `${source}@${version}`;
  }

  async listFilesAt(commit: string): Promise<readonly string[]> {
    return Object.keys(this.#listSourceFiles(commit));
  }

  async readFileAt(commit: string, path: string): Promise<string> {
    const contents = this.#listSourceFiles(commit)[path];
    if (contents === undefined) throw new AdapterFault(`${commit} has no "${path}".`, "Read a file the commit holds.", { internal: false });
    return decodeContents(contents);
  }

  async readBytesAt(commit: string, path: string): Promise<Uint8Array> {
    const contents = this.#listSourceFiles(commit)[path];
    if (contents === undefined) throw new AdapterFault(`${commit} has no "${path}".`, "Read a file the commit holds.", { internal: false });
    return encodeContents(contents);
  }

  /** The folder written over in the files a test handed it, every file of
   *  the source under `fromFolder` put under it. */
  async checkoutFolderAt(commit: string, fromFolder: string, intoSubFolder: string): Promise<void> {
    this.checkedOutFolders.push({ commit, fromFolder, intoSubFolder });
    if (this.files === undefined) return;
    const intoFolder = urlAt(this.files.rootFolder, `${intoSubFolder}/`);
    for (const { path } of await this.files.readFilesRecursively(intoSubFolder)) this.files.remove(urlAt(this.files.rootFolder, path));
    const fromPrefix = fromFolder === "" ? "" : `${fromFolder}/`;
    for (const [path, contents] of Object.entries(this.#listSourceFiles(commit)))
      if (path.startsWith(fromPrefix)) this.files.write(urlAt(intoFolder, path.slice(fromPrefix.length)), contents);
  }

  async forgetCommit(commit: string): Promise<void> {
    this.forgottenCommits.push(commit);
  }
}

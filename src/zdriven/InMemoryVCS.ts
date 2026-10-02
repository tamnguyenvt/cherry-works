import { DrivenFault, type ForVCS } from "#hexagon/port/zdriven/ForVCS.js";

/** Version control held in memory: a test says whether the folder it is setting
 *  up is inside a repository, and nothing shells out. The second implementation
 *  that earns `ForVCS` its place (plan §2.4). */
export class InMemoryVCS implements ForVCS {
  constructor(
    private readonly versioned: boolean = true,
    private readonly clean: boolean = true,
  ) {}

  /** Every source it was asked to install, in the order it was asked: what a
   *  test about vendoring looks at, since nothing was fetched. */
  readonly installed: { source: string; sourceSubFolder: string; repo: URL; intoSubFolder: string; version?: string }[] = [];

  /** Every source a test says holds no folder of the name asked for: what
   *  `subtreeAdd` raises for, copying nothing. */
  readonly sourcesWithoutSubFolder: string[] = [];

  /** Every source a test says holds the folder `subtreeAdd` is told to refuse:
   *  what it raises for, copying nothing. */
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

  async subtreeAdd(
    source: string,
    sourceSubFolder: string,
    repo: URL,
    intoSubFolder: string,
    version?: string,
    refusedIfSourceHolds?: string,
  ): Promise<string> {
    if (this.sourcesWithoutSubFolder.includes(source))
      throw new DrivenFault(`${source} has no folder "${sourceSubFolder}".`, `Check that the source holds "${sourceSubFolder}".`);
    if (refusedIfSourceHolds !== undefined && this.sourcesHoldingRefusedFolder.includes(source))
      throw new DrivenFault(`${source} holds "${refusedIfSourceHolds}".`, `Remove "${refusedIfSourceHolds}" from the source.`);
    this.installed.push({ source, sourceSubFolder, repo, intoSubFolder, ...(version === undefined ? {} : { version }) });
    return intoSubFolder;
  }

  async removeSubFolder(repo: URL, subFolder: string): Promise<void> {
    this.removed.push({ repo, subFolder });
  }
}

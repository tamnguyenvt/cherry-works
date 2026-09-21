import { Fault } from "../domain/models/Fault.js";
import { VENDOR_DIRECTORY } from "../domain/path.js";
import type { ForVendoringCharters } from "../port/driver/ForVendoringCharters.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";

/**
 * APPLICATION SERVICE — the charters a repository installs rather than authors
 * (FR-023, FR-027).
 *
 * One driven port and no other: version control fetches the source and commits
 * what it fetched, so this holds neither a reading port nor a writing one and
 * cannot touch a file itself (FR-041). What is here is the two questions asked
 * before the fetching, and where it lands.
 */
export class CharterVendoring implements ForVendoringCharters {
  readonly #repoPath: URL;
  readonly #vcs: ForVCS;

  constructor(
    /** The repository this speaks for, named once: a vendor is installed into
     *  one repository and removed from the same one, so it is what this is
     *  constructed with rather than what every call carries. */
    repoPath: URL,
    vcs: ForVCS,
  ) {
    this.#repoPath = repoPath;
    this.#vcs = vcs;
  }

  async add(source: string, version?: string): Promise<string> {
    await this.#ensureVCSReady("installing a vendor commits what it installs");

    // The last thing the address names is what this is called here, and the
    // address itself is version control's to read (FR-024, FR-025).
    const name = source.replace(/\.git$/, "").split(/[/:]/).filter(Boolean).at(-1) ?? "";
    const folder = `${VENDOR_DIRECTORY}/${name}`;
    await this.#vcs.subtreeAdd(source, this.#repoPath, folder, version);
    return folder;
  }

  async remove(name: string): Promise<string> {
    await this.#ensureVCSReady("removing a vendor commits that it is gone");

    const folder = `${VENDOR_DIRECTORY}/${name}`;
    await this.#vcs.removeSubFolder(this.#repoPath, folder);
    return folder;
  }

  /**
   * The two questions asked before either of them touches anything.
   *
   * Both commit, so both need a repository to commit into and nothing already
   * in hand: a commit made while somebody's work is in the index would carry
   * that work along with it, and whoever is holding it is the one who decides
   * what to do with it.
   */
  async #ensureVCSReady(because: string): Promise<void> {
    if (!(await this.#vcs.isInstalled(this.#repoPath)))
      throw new Fault(
        "This folder is not inside a git repository, and a vendor lives in one.",
        'Run "git init" here, or run this again where your repository is.',
      );

    if (!(await this.#vcs.isClean(this.#repoPath)))
      throw new Fault(
        `This repository has work in hand, and ${because}.`,
        "Commit or stash what you are holding, then run this again.",
      );
  }
}

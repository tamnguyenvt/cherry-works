import { addVendor, loadVendorNames, removeVendor } from "../service/vendorRepo.js";
import type { ForVendoringCharters } from "../port/driver/ForVendoringCharters.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";

/**
 * APPLICATION SERVICE — the charters a repository installs rather than authors
 * (FR-023, FR-027).
 *
 * Version control fetches the source and commits what it fetched, so this
 * holds no writing port and cannot touch a file itself (FR-041). Installing,
 * removing and listing, and what is asked before either writes, are
 * `vendorRepo`'s.
 */
export class CharterVendoring implements ForVendoringCharters {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #vcs: ForVCS;

  constructor(
    /** The repository this speaks for, named once: a vendor is installed into
     *  one repository and removed from the same one, so it is what this is
     *  constructed with rather than what every call carries. */
    repoPath: URL,
    fileReader: ForReadingFiles,
    vcs: ForVCS,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#vcs = vcs;
  }

  async add(source: string, version?: string): Promise<string> {
    return addVendor(this.#repoPath, this.#vcs, source, version);
  }

  async remove(name: string): Promise<string> {
    return removeVendor(this.#repoPath, this.#vcs, name);
  }

  async installed(): Promise<readonly string[]> {
    return loadVendorNames(this.#repoPath, this.#fileReader);
  }
}

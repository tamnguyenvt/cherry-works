import { InvalidSourceAddressFault } from "../charter.fault.js";
import { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** Makes the origin of a vendor out of the source as it was typed. */
export class VendorSourceOriginFactory {
  /**
   * The vendor source a source names, the address itself version control's to
   * read (FR-049). Its path, after a scheme and a host or a `user@host:`, names
   * a repository, its last folder without a trailing `.git`; where a charter
   * lands is its own name, never the address's (VENDOR-FR-017).
   *
   * Refused where the path names no folder, or one that is no folder — `.` or
   * `..` — since only a crafted address names one (FR-044, FR-049).
   */
  static create(sourceUri: string): VendorSourceOrigin {
    const addressPath = sourceUri
      .replace(/\.git$/, "")
      .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
      .replace(/^[^/\\:@]+@[^/\\:]+:/, "");
    const repositoryFolderName = addressPath.split(/[/\\]/).filter(Boolean).at(-1);
    if (repositoryFolderName === undefined || repositoryFolderName === "." || repositoryFolderName === "..")
      throw new InvalidSourceAddressFault(
        `${sourceUri} names no repository folder.`,
        "Give the address of the repository itself, as git fetches it.",
        { internal: false },
      );
    return new VendorSourceOrigin(sourceUri);
  }

  private constructor() {}
}

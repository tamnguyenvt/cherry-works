import { InvalidSourceAddressFault } from "../charter.fault.js";
import { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** Makes the origin of a vendor out of the source as it was typed. */
export class VendorSourceOriginFactory {
  /**
   * The vendor source a source names, the address itself version control's to
   * read (FR-050). Its path, after a scheme and a host or a `user@host:`, names
   * an owner and a repository, its last two folders without a trailing `.git`.
   *
   * Refused where the path names no owner, or where either folder is no folder —
   * empty, `.` or `..` — since only a crafted address names one (FR-044).
   */
  static create(sourceUri: string): VendorSourceOrigin {
    const addressPath = sourceUri
      .replace(/\.git$/, "")
      .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
      .replace(/^[^/\\:@]+@[^/\\:]+:/, "");
    const folderNames = addressPath.split(/[/\\]/).filter(Boolean).slice(-2);
    if (folderNames.length < 2 || folderNames.some((folderName) => folderName === "." || folderName === ".."))
      throw new InvalidSourceAddressFault(
        `Invalid path "${sourceUri}".`,
        "Use correct git path, naming its owner and its repository.",
        { internal: false },
      );
    return new VendorSourceOrigin(sourceUri);
  }

  private constructor() {}
}

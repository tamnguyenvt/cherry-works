import { VendorSourceOrigin } from "./vendor-source-origin.js";
import { VendorFault } from "../charter.fault.js";

/** Makes the origin of a vendor out of the source as it was typed. */
export class VendorSourceOriginFactory {
  /**
   * The vendor source a source names: the last two folders of the path its
   * address names, its owner and its repository without a trailing `.git`, are
   * what it is called here — `team/charter` — and the address itself is
   * version control's to read (FR-050). What comes before the path, a scheme and
   * a host or a `user@host:`, is no part of the name.
   *
   * Refused where the path names no owner, or where either folder is no folder —
   * empty, `.` or `..` — since only a crafted address names one, and the folder
   * would sit on the vendor folder itself or above it (FR-044).
   */
  static create(sourceUri: string): VendorSourceOrigin {
    const addressPath = sourceUri
      .replace(/\.git$/, "")
      .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
      .replace(/^[^/\\:@]+@[^/\\:]+:/, "");
    const folderNames = addressPath.split(/[/\\]/).filter(Boolean).slice(-2);
    if (folderNames.length < 2 || folderNames.some((folderName) => folderName === "." || folderName === ".."))
      throw new VendorFault(`Invalid path "${sourceUri}".`, "Use correct git path, naming its owner and its repository.", { internal: false });
    return new VendorSourceOrigin(sourceUri, folderNames.join("/"));
  }

  private constructor() {}
}

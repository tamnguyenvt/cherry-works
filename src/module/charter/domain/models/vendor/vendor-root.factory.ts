import { VendorRoot } from "./vendor-root.js";
import { VendorsFolder } from "../charter/vendors-folder.js";
import { Primitives } from "../primitive/primitive.js";
import { VendorFault } from "../charter.fault.js";

/** How deep a vendor's name goes: `<owner>/<repository>/<name>`. */
const VENDOR_NAME_DEPTH = 3;

/** Makes what this repository installed from others out of the files kept
 *  under its vendor folder. */
export class VendorRootFactory {
  /**
   * Each vendor at `<owner>/<repository>/<name>/primitive/` under the vendor
   * folder, named by those three folders (FR-050, CORE-FR-196).
   *
   * A file kept anywhere else is a vendor installed the way an earlier
   * version laid one, refused naming the folder to take away before it is
   * installed again: nothing of it is read as a vendor.
   *
   * `uriOf` says where a folder is kept, in its keeper's words: said back,
   * never read.
   */
  static create(vendorFilePaths: readonly string[], uriOf: (folderPath: string) => string): VendorRoot {
    const vendorPathPrefix = `${VendorsFolder.path}/`;
    // A file kept right in the vendor folder, its `.gitkeep`, is no vendor's.
    const pathsUnderVendor = vendorFilePaths
      .filter((filePath) => filePath.startsWith(vendorPathPrefix))
      .map((filePath) => filePath.slice(vendorPathPrefix.length))
      .filter((filePath) => filePath.includes("/"));

    const oldFolderNames = [
      ...new Set(
        pathsUnderVendor
          .filter((filePath) => filePath.split("/")[VENDOR_NAME_DEPTH] !== VendorRoot.primitivesFolder || filePath.split("/").length <= VENDOR_NAME_DEPTH + 1)
          // A kind's folder right under the first is a vendor named by that
          // one folder alone; otherwise the owner and the repository name it.
          .map((filePath) => filePath.split("/").slice(0, Primitives.isKind(filePath.split("/")[1]) ? 1 : 2).join("/")),
      ),
    ].sort();
    if (oldFolderNames.length > 0)
      throw new VendorFault(
        `${oldFolderNames.map((folderName) => `${VendorsFolder.path}/${folderName}`).join(", ")} ${oldFolderNames.length === 1 ? "is" : "are"} laid out the way an earlier version installed a vendor, not as <owner>/<repository>/<name>/${VendorRoot.primitivesFolder}/.`,
        `Delete ${oldFolderNames.length === 1 ? "it" : "them"}, then install each source again with "cw vendor add".`,
        { internal: false },
      );

    const vendorNames = [...new Set(pathsUnderVendor.map((filePath) => filePath.split("/").slice(0, VENDOR_NAME_DEPTH).join("/")))].sort();
    return new VendorRoot(
      vendorNames.map((vendorName) => ({ name: vendorName, uri: uriOf(`${VendorsFolder.path}/${vendorName}`) })),
    );
  }

  private constructor() {}
}

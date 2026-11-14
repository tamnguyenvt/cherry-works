import type { RawVendorRoot } from "./raw-vendor-root.js";
import { VendorRoot } from "./vendor-root.js";

/** Makes what this repository installed from others out of the vendors its
 *  store keeps. */
export class VendorRootFactory {
  /**
   * Each vendor by the name its store keeps it under, whichever store keeps
   * it, and `uriOf` where it is kept, in its keeper's words, said back and
   * never read (FR-050, FR-053).
   */
  static create(rawVendorRoot: RawVendorRoot, uriOf: (vendorName: string) => string): VendorRoot {
    return new VendorRoot(
      [...rawVendorRoot.vendorNames].sort().map((vendorName) => ({ name: vendorName, uri: uriOf(vendorName) })),
    );
  }

  private constructor() {}
}

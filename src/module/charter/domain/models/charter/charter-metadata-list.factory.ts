import { InvalidVendorRecordFault } from "../charter.fault.js";
import { CharterMetadata, CharterMetadataList } from "./charter-metadata-list.js";
import type { RawCharterMetadata } from "./raw-charter-metadata.js";
import { VendorRecordFactory } from "./vendor-record.factory.js";

/** Makes the charters of a charter root out of what its store keeps of them. */
export class CharterMetadataListFactory {
  /**
   * Each charter by its name, installed where it holds a `cw-vendor.json`
   * naming the charter, the source and the version as strings; the first that does
   * not read so is refused, naming its file (VENDOR-FR-010).
   */
  static create(rawCharters: readonly RawCharterMetadata[]): CharterMetadataList {
    const charterMetadatas = [...rawCharters]
      .sort((leftCharter, rightCharter) => leftCharter.name.localeCompare(rightCharter.name))
      .map((rawCharter) => {
        if (rawCharter.vendorRecordText === undefined)
          return new CharterMetadata(rawCharter.name, undefined, rawCharter.uri);
        const vendorRecord = VendorRecordFactory.create(rawCharter.vendorRecordText);
        if (vendorRecord === undefined)
          throw new InvalidVendorRecordFault(
            `${rawCharter.vendorRecordUri} does not read as the charter, the source and the version it was installed from.`,
            `Delete ${rawCharter.uri} and run "cw vendor add" again, or delete ${rawCharter.vendorRecordUri} to make the charter your own.`,
            { internal: false },
          );
        return new CharterMetadata(rawCharter.name, vendorRecord, rawCharter.uri);
      });
    return new CharterMetadataList(charterMetadatas);
  }

  private constructor() {}
}

import { VendorRecord } from "./vendor-record.value-object.js";

/** Makes the record of where an installed charter came from out of its
 *  `cw-vendor.json`. */
export class VendorRecordFactory {
  /** What a `cw-vendor.json` says, or nothing where it does not read as
   *  `VendorRecord.schema` (VENDOR-FR-010). */
  static create(vendorRecordText: string): VendorRecord | undefined {
    let vendorRecordJson: unknown;
    try {
      vendorRecordJson = JSON.parse(vendorRecordText);
    } catch {
      return undefined;
    }
    const vendorRecordParse = VendorRecord.schema.safeParse(vendorRecordJson);
    if (!vendorRecordParse.success) return undefined;
    const { charter, source, version } = vendorRecordParse.data;
    return new VendorRecord(charter, source, version);
  }

  private constructor() {}
}

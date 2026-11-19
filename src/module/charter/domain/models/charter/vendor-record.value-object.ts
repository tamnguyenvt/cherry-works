import { z } from "#module/shared/module.js";

/** What a `cw-vendor.json` holds: the charter, the source and the version,
 *  each a string (VENDOR-FR-010). Whatever else it holds is left unread. */
const VendorRecordSchema = z.object({ charter: z.string(), source: z.string(), version: z.string() });

/** Where an installed charter came from, as its `cw-vendor.json` says: the
 *  charter's name in its source, the source as it was typed, and the version
 *  installed (VENDOR-FR-010, VENDOR-FR-017). */
export class VendorRecord {
  static get schema(): typeof VendorRecordSchema {
    return VendorRecordSchema;
  }

  constructor(
    readonly charterName: string,
    readonly source: string,
    readonly version: string,
  ) {}

  /** What a `cw-vendor.json` holds of it. */
  toJSON(): z.infer<typeof VendorRecordSchema> {
    return { charter: this.charterName, source: this.source, version: this.version };
  }
}

import { InstalledCharterRecord } from "./installed-charter-record.value-object.js";

/** Makes the record of where an installed charter came from out of its
 *  `cw-package.json`. */
export class InstalledCharterRecordFactory {
  /** What a `cw-package.json` says, or nothing where it does not read as
   *  `InstalledCharterRecord.schema` (VENDOR-FR-010). */
  static create(installedCharterRecordText: string): InstalledCharterRecord | undefined {
    let installedCharterRecordJson: unknown;
    try {
      installedCharterRecordJson = JSON.parse(installedCharterRecordText);
    } catch {
      return undefined;
    }
    const installedCharterRecordParse = InstalledCharterRecord.schema.safeParse(installedCharterRecordJson);
    if (!installedCharterRecordParse.success) return undefined;
    const { charter, source, version } = installedCharterRecordParse.data;
    return new InstalledCharterRecord(charter, source, version);
  }

  private constructor() {}
}

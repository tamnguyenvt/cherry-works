import { InvalidInstalledCharterRecordFault } from "../charter.fault.js";
import { CharterMetadata, CharterMetadataList } from "./charter-metadata-list.js";
import { InstalledCharterRecordFactory } from "./installed-charter-record.factory.js";
import type { RawCharterMetadata } from "./raw-charter-metadata.js";

/** Makes the charters of a charter root out of what its store keeps of them. */
export class CharterMetadataListFactory {
  /**
   * Each charter by its name, installed where it holds a `cw-package.json`
   * naming the charter, the source and the version as strings; the first that does
   * not read so is refused, naming its file (VENDOR-FR-010).
   */
  static create(rawCharters: readonly RawCharterMetadata[]): CharterMetadataList {
    const charterMetadatas = [...rawCharters]
      .sort((leftCharter, rightCharter) => leftCharter.name.localeCompare(rightCharter.name))
      .map((rawCharter) => {
        if (rawCharter.installedCharterRecordText === undefined)
          return new CharterMetadata(rawCharter.name, undefined, rawCharter.uri);
        const installedCharterRecord = InstalledCharterRecordFactory.create(rawCharter.installedCharterRecordText);
        if (installedCharterRecord === undefined)
          throw new InvalidInstalledCharterRecordFault(
            `${rawCharter.installedCharterRecordUri} does not read as the charter, the source and the version it was installed from.`,
            `Delete ${rawCharter.uri} and run "cw charter pull" again, or delete ${rawCharter.installedCharterRecordUri} to make the charter your own.`,
            { internal: false },
          );
        return new CharterMetadata(rawCharter.name, installedCharterRecord, rawCharter.uri);
      });
    return new CharterMetadataList(charterMetadatas);
  }

  private constructor() {}
}

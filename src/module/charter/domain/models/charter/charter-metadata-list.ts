import { UnknownCharterFault } from "../charter.fault.js";
import type { VendorRecord } from "./vendor-record.value-object.js";

/** One charter of a repository's charter root: its name, where it came from where it
 *  was installed, and where it is kept, said back and never read
 *  (VENDOR-FR-009, VENDOR-FR-010). */
export class CharterMetadata {
  constructor(
    readonly name: string,
    readonly vendorRecord: VendorRecord | undefined,
    readonly uri: string,
  ) {}

  /** Whether it was installed, and so is read-only (VENDOR-FR-010). */
  get isInstalled(): boolean {
    return this.vendorRecord !== undefined;
  }
}

/** Every charter a repository's charter holds, in the order their names sort
 *  in (VENDOR-FR-009). */
export class CharterMetadataList {
  constructor(readonly charters: readonly CharterMetadata[]) {}

  /** The charters this repository authored itself. */
  get authoredCharters(): readonly CharterMetadata[] {
    return this.charters.filter((charterMetadata) => !charterMetadata.isInstalled);
  }

  /** The charters this repository installed. */
  get installedCharters(): readonly CharterMetadata[] {
    return this.charters.filter((charterMetadata) => charterMetadata.isInstalled);
  }

  /** The charter held under this name, if any. */
  findCharter(charterName: string): CharterMetadata | undefined {
    return this.charters.find((charterMetadata) => charterMetadata.name === charterName);
  }

  /** The charter held under this name, refused naming the charters held where
   *  none is (VENDOR-FR-026). */
  findCharterOrFault(charterName: string): CharterMetadata {
    const heldCharter = this.findCharter(charterName);
    if (heldCharter === undefined)
      throw new UnknownCharterFault(
        `The charter root holds no charter "${charterName}".`,
        this.charters.length === 0
          ? "It holds no charter yet."
          : `Name one it holds: ${this.charters.map(({ name }) => name).join(", ")}.`,
        { internal: false },
      );
    return heldCharter;
  }
}

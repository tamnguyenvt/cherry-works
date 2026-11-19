import type { VendorRecord } from "../charter/vendor-record.value-object.js";
import type { SourceCharter } from "./vendor-source.js";
import type { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** One charter a source's install or injection puts in the repository, every
 *  refusal settled: the name it is held under here; the source's charter
 *  copied into it; and what its `cw-vendor.json` says once it is down, written
 *  on this machine, or none for a charter the repository now owns
 *  (VENDOR-FR-017 to VENDOR-FR-022). What the name held before is replaced
 *  whole. */
export class CharterInstall {
  constructor(
    readonly charterName: string,
    readonly sourceCharter: SourceCharter,
    readonly vendorRecord: VendorRecord | undefined,
  ) {}
}

/** What is asked of one source: where it comes from, the charters named, the
 *  name `--as` gives, the version asked for, and whether the charters become
 *  the repository's own rather than installed (VENDOR-FR-017 to
 *  VENDOR-FR-022). */
export class CharterInstallRequest {
  constructor(
    readonly vendorSourceOrigin: VendorSourceOrigin,
    readonly selectedCharterNames: readonly string[],
    readonly asName: string | undefined,
    readonly version: string | undefined,
    readonly isInjected: boolean,
  ) {}
}

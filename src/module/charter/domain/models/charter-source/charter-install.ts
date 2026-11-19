import type { InstalledCharterRecord } from "../charter/installed-charter-record.value-object.js";
import type { CharterSource } from "./charter-source.js";
import type { CharterSourceOrigin } from "./charter-source-origin.value-object.js";

/** One charter a source's pull or fork puts in the repository, every
 *  refusal settled: the name it is held under here; the source's charter
 *  copied into it; and what its `cw-package.json` says once it is down, written
 *  on this machine, or none for a charter the repository now owns
 *  (VENDOR-FR-017 to VENDOR-FR-022). What the name held before is replaced
 *  whole. */
export class CharterInstall {
  constructor(
    readonly charterName: string,
    readonly charterSource: CharterSource,
    readonly installedCharterRecord: InstalledCharterRecord | undefined,
  ) {}
}

/** What is asked of one source: where it comes from, the charters named, the
 *  name `--as` gives, the version asked for, and whether the charters become
 *  the repository's own rather than installed (VENDOR-FR-017 to
 *  VENDOR-FR-022). */
export class CharterInstallRequest {
  constructor(
    readonly charterSourceOrigin: CharterSourceOrigin,
    readonly selectedCharterNames: readonly string[],
    readonly asName: string | undefined,
    readonly version: string | undefined,
    readonly isForked: boolean,
  ) {}
}

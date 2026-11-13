import type { AssetFile } from "../primitive/asset-file.js";
import type { SourceCharter } from "./vendor-source.js";
import type { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** One skill a skills repository keeps, as it is handed in, before the engine
 *  converts it (CORE-FR-185): the text of its `SKILL.md`, every other file of
 *  its folder, where it sits in the source, said back and never read, and the
 *  folder it sits in, for what copies it. */
export class RawSourceSkill {
  constructor(
    readonly text: string,
    readonly assets: readonly AssetFile[],
    readonly uri: string,
    readonly sourceFolder: string,
  ) {}
}

/** What one commit of a source holds, as what fetched it read it, before the
 *  engine reads its skills: its own charter, the charters it keeps apart, and
 *  the skills it publishes (CORE-FR-193). `commit` is what was fetched, for
 *  what fetched it alone to read again. */
export class RawVendorSource {
  constructor(
    readonly origin: VendorSourceOrigin,
    readonly commit: string,
    readonly ownCharter: SourceCharter | undefined,
    readonly charters: readonly SourceCharter[],
    readonly rawSourceSkills: readonly RawSourceSkill[],
  ) {}
}

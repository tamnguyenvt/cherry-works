import { ContentHelper } from "../../helper.js";
import type { RawPrimitive } from "../primitive/raw-primitive.js";
import type { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** One charter a source keeps, `.cw/charter/<charter>/`, named by its
 *  folder (VENDOR-FR-017): whether the source installed it itself, holding a
 *  `cw-vendor.json`, and its primitives as the source keeps them, what
 *  tells which other charters it includes (VENDOR-FR-018, VENDOR-FR-019).
 *  `sourceFolder` is where it sits in the source, for what copies it. */
export class SourceCharter {
  constructor(
    readonly name: string,
    /** Whether the source installed it from elsewhere, rather than authored
     *  it (VENDOR-FR-019). */
    readonly isInstalled: boolean,
    readonly rawPrimitives: readonly RawPrimitive[],
    readonly sourceFolder: string,
    /** The folders of it that are copied, by their paths in it: each
     *  primitive's, and those of its test cases and eval cases. */
    readonly keptFolderPaths: readonly string[],
  ) {}

  /** The description one of its primitives declares, empty where it
   *  declares none. Shown, never refused: the charter is installed whole, as
   *  its source holds it (VENDOR-FR-017). */
  descriptionOf(rawPrimitive: RawPrimitive): string {
    try {
      const declaredDescription = ContentHelper.parseFrontmatter(rawPrimitive.text)?.headers.description;
      return typeof declaredDescription === "string" ? declaredDescription : "";
    } catch {
      // Headers that do not parse are the source's to fix; what is shown is
      // still where the primitive sits.
      return "";
    }
  }
}

/** What one commit of a source holds, as what fetched it read it: the
 *  charters it keeps (VENDOR-FR-017). `commit` is what was fetched, for what
 *  fetched it alone to read again; `commitId` is its id in version control. */
export class VendorSource {
  constructor(
    readonly origin: VendorSourceOrigin,
    readonly commit: string,
    readonly commitId: string,
    readonly charters: readonly SourceCharter[],
  ) {}
}

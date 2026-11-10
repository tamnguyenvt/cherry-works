/** The folder a vendor keeps its primitives in, one folder per kind under it,
 *  as the charter keeps its own. */
const PRIMITIVES_FOLDER = "primitive";

/** What this repository installed from others: every vendor, by the name it
 *  was installed as, `<owner>/<repository>/<name>` (FR-050, CORE-FR-196), and
 *  where it is kept, said back and never read. */
export class VendorRoot {
  static get primitivesFolder(): typeof PRIMITIVES_FOLDER {
    return PRIMITIVES_FOLDER;
  }

  constructor(
    /** Every vendor installed, as `cw vendor list` names them (FR-053). */
    readonly vendors: readonly { readonly name: string; readonly uri: string }[],
  ) {}
}

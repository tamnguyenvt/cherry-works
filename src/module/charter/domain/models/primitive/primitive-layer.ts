/** The names a layer goes by: what this repository authored itself; what it
 *  installed from someone else, under the name it installed it as (FR-023);
 *  and what the running engine brings itself, supplied on every read and kept
 *  nowhere in the repository, so nothing can refresh, edit or remove it
 *  (FR-015, FR-016). */
const LAYER_NAMES = ["repo", "vendor", "builtin"] as const;

/** Whose layer a primitive came from, and there are only the three. It says
 *  where a primitive was written, never what it is called: one charter has one
 *  id space, whichever layer a file arrived in (FR-014, FR-019). */
export type LayerName = (typeof LAYER_NAMES)[number];

/** The layer a primitive was read in: whose it is, and for a vendor's, the
 *  name this repository installed it as (FR-023). Where it is kept is what
 *  keeps it to know, never the layer's (CORE-FR-213). */
export class PrimitiveLayer<Name extends LayerName = LayerName> {
  /** This repository's own layer: where a primitive is written when it is
   *  authored here (FR-039). */
  static readonly REPO = new PrimitiveLayer("repo" as const);

  /** The engine's own layer: kept nowhere, so there is nothing to open (FR-015,
   *  FR-018). */
  static readonly BUILTIN = new PrimitiveLayer("builtin" as const);

  private constructor(
    readonly name: Name,
    /** The name a vendor's layer was installed as: `team/charter`. */
    readonly vendorName?: string,
  ) {}

  /** The name every vendor's layer goes by. */
  static get vendorName(): "vendor" {
    return "vendor";
  }

  /** The layer of the vendor this repository installed under this name. */
  static ofVendor(vendorName: string): PrimitiveLayer<"vendor"> {
    return new PrimitiveLayer("vendor" as const, vendorName);
  }
}

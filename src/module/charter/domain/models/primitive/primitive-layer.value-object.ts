/** The names a layer goes by: what this repository authored itself, in a
 *  charter of its own; what it installed from someone else, in a charter holding
 *  where it came from (VENDOR-FR-010); and what the running engine brings
 *  itself, supplied on every read and kept nowhere in the repository, so
 *  nothing can refresh, edit or remove it (FR-015, FR-016). */
const LAYER_NAMES = ["repo", "package", "builtin"] as const;

/** Whose layer a primitive came from, and there are only the three. It says
 *  where a primitive was written, never what it is called: one charter has one
 *  id space, whichever layer or charter a file arrived in (FR-014, FR-019,
 *  VENDOR-FR-009). */
export type LayerName = (typeof LAYER_NAMES)[number];

/** The layer a primitive was read in: whose it is, and for one kept in the
 *  repository, the charter it is kept in (VENDOR-FR-009). Where it is kept is
 *  what keeps it to know, never the layer's (CORE-FR-213). */
export class PrimitiveLayer<Name extends LayerName = LayerName> {
  /** This repository's own layer, before a charter is named for it: a
   *  primitive an author answered, not kept yet (FR-039). */
  static readonly REPO = new PrimitiveLayer("repo" as const);

  /** The engine's own layer: kept nowhere, so there is nothing to open (FR-015,
   *  FR-018). */
  static readonly BUILTIN = new PrimitiveLayer("builtin" as const);

  private constructor(
    readonly name: Name,
    /** The charter it is kept in: `sdd`. None for the engine's own. */
    readonly charterName?: string,
  ) {}

  /** The name every layer the repository installed goes by, as its
   *  `cw-package.json` makes it one (VENDOR-FR-010). */
  static get packageName(): "package" {
    return "package";
  }

  /** The layer of a charter this repository authored: where a primitive is
   *  written when it is authored here (FR-039, VENDOR-FR-010). */
  static authoredLayerOf(charterName: string): PrimitiveLayer<"repo"> {
    return new PrimitiveLayer("repo" as const, charterName);
  }

  /** The layer of a charter this repository installed, read-only
   *  (VENDOR-FR-010). */
  static installedLayerOf(charterName: string): PrimitiveLayer<"package"> {
    return new PrimitiveLayer("package" as const, charterName);
  }
}

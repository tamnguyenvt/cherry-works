import { CHARTER_DIRECTORY } from "../../path.js";

/** What this repository authored itself. */
export const REPO_LAYER = "repo";

/** What it installed from someone else, under `vendor/<name>/` (FR-023). */
export const VENDOR_LAYER = "vendor";

/** What the running engine brings itself: supplied on every read and kept
 *  nowhere in the repository, so nothing can refresh, edit or remove it
 *  (FR-015, FR-016). */
export const BUILTIN_LAYER = "builtin";

/** Whose layer a primitive came from, and there are only the three. It says
 *  where a primitive was written, never what it is called: one charter has one
 *  id space, whichever layer a file arrived in (FR-014, FR-019). */
export type LayerName = typeof REPO_LAYER | typeof VENDOR_LAYER | typeof BUILTIN_LAYER;

/** The layer a primitive was read in: whose it is, and its charter folder,
 *  from the repository — `.cw/charter`, `.cw/vendor/<name>`, or the engine's
 *  own name for its layer (FR-023, FR-141). */
export interface PrimitiveLayer {
  readonly name: LayerName;
  readonly charterFolder: string;
}

/** This repository's own layer: where a primitive is written when it is
 *  authored here (FR-039). */
export const REPO_PRIMITIVE_LAYER: PrimitiveLayer = { name: REPO_LAYER, charterFolder: CHARTER_DIRECTORY };

/** The engine's own layer. It has no folder: what stands for one is a name,
 *  not a location — there is no file to open — and it says which layer a
 *  primitive came from the way `.cw/vendor/<name>/` does (FR-015, FR-018,
 *  plan §3.1). */
export const BUILTIN_PRIMITIVE_LAYER: PrimitiveLayer = { name: BUILTIN_LAYER, charterFolder: "(built into cw)" };

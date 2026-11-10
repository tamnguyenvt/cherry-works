import type { Primitive } from "../primitive/primitive.js";
import { PrimitiveLayer } from "../primitive/primitive-layer.js";

/**
 * SPECIFICATION — a primitive this repository authored, and so one it may
 * rewrite or delete (FR-075, FR-076). What a vendor installed is changed by
 * installing it again, and what the engine brings has no file here to change
 * (FR-077).
 */
export class RepoLayerPrimitive {
  static isSatisfiedBy(primitive: Primitive): boolean {
    return primitive.layerName === PrimitiveLayer.REPO.name;
  }
}

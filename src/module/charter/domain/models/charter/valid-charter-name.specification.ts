import { BasePrimitive } from "../primitive/base-primitive.js";
import { Primitives } from "../primitive/primitive.js";

/** The names a charter is never made or installed under: the folders an
 *  earlier layout kept right under the charter root (VENDOR-FR-011), and
 *  `root` (VENDOR-FR-020, VENDOR-FR-029). */
const RESERVED_CHARTER_NAMES = ["primitive", "test", "eval", "vendor", "root"];

/**
 * SPECIFICATION — a name a charter may be made or installed under: written as
 * an id is, and never as a kind is, as a folder an earlier layout kept right
 * under the charter root, or as `root` (VENDOR-FR-011, VENDOR-FR-020,
 * VENDOR-FR-029).
 */
export class ValidCharterNameSpec {
  isSatisfiedBy(charterName: string): boolean {
    return (
      BasePrimitive.headersSchema().shape.id.safeParse(charterName).success &&
      !Primitives.isKind(charterName) &&
      !RESERVED_CHARTER_NAMES.includes(charterName)
    );
  }
}

import { BasePrimitive } from "../primitive/base-primitive.js";
import { Primitives } from "../primitive/primitive.js";

/** The names a charter can never have: the folders an earlier layout kept
 *  right under the charter root (VENDOR-FR-011), and `root`, which names the
 *  charter root itself where a charter is named, as the portal's routes do. */
const RESERVED_CHARTER_NAMES = ["primitive", "test", "eval", "vendor", "root"];

/**
 * SPECIFICATION — a name a charter may have: written as an id is, and never as
 * a kind is, as a folder an earlier layout kept right under the charter root,
 * or as `root`, so `.cw/charter/<charter>/` is never read as the old layout
 * (VENDOR-FR-009, VENDOR-FR-011).
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

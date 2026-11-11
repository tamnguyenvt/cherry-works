import type { Primitive } from "../models/primitive/primitive.js";
import { RawPrimitive } from "../models/primitive/raw-primitive.js";
import { CwAuthorSkill } from "./cw-author-skill.js";
import { CwSessionCostSkill } from "./cw-session-cost-skill.js";
import { CwSessionTokensCounterScript } from "./cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "./cw-session-tokens-sensor.js";

/** What this engine brings to every charter it reads, as its layer of it
 *  (FR-015, FR-022). Held as primitives of each kind's own class, so a kind
 *  that changes its headers stops this compiling rather than a user's build
 *  (plan §3.2). */
const BUILTIN_PRIMITIVES: readonly Primitive[] = [
  new CwAuthorSkill(),
  new CwSessionTokensCounterScript(),
  new CwSessionTokensSensor(),
  new CwSessionCostSkill(),
];

/** The engine's layer as kept primitives written out in memory, on every
 *  read, so it is read as every other layer is: nothing is read or written on
 *  disk for it (FR-015, FR-016, FR-018). */
function builtinRawPrimitivesOf(): readonly RawPrimitive[] {
  return BUILTIN_PRIMITIVES.map(
    (primitive) =>
      new RawPrimitive(
        primitive.layer,
        primitive.kind,
        primitive.headers.id,
        primitive.toMarkdown(),
        primitive.assets,
        primitive.uri,
      ),
  );
}

/** What this engine brings to every charter it reads, as its layer of it (FR-015, FR-022). */
export class BuiltinPrimitives {
  static get all(): typeof BUILTIN_PRIMITIVES {
    return BUILTIN_PRIMITIVES;
  }

  static readonly rawPrimitivesOf: typeof builtinRawPrimitivesOf = builtinRawPrimitivesOf;

  private constructor() {}
}

import type { Primitive } from "../models/primitive/primitive.js";
import { CwAuthorSkill } from "./cw-author-skill.js";
import { CwSessionCostSkill } from "./cw-session-cost-skill.js";
import { CwSessionTokensCounterScript } from "./cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "./cw-session-tokens-sensor.js";

/** What this engine brings to every charter it reads, as its layer of it (FR-015, FR-022). */
export class BuiltinPrimitives {
  /** Held as primitives of each kind's own class, so a kind that changes its
   *  headers stops this compiling rather than a user's build (plan §3.2). */
  readonly primitives: readonly Primitive[] = [
    new CwAuthorSkill(),
    new CwSessionTokensCounterScript(),
    new CwSessionTokensSensor(),
    new CwSessionCostSkill(),
  ];
}

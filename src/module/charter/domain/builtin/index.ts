import type { Primitive } from "../models/primitive/primitive.js";
import { CharterReleaseActionScript } from "./charter-release-action-script.js";
import { CharterReleaseSkill } from "./charter-release-skill.js";
import { CwAuthorSkill } from "./cw-author-skill.js";
import { CwSessionTokensCounterScript } from "./cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "./cw-session-tokens-sensor.js";

/** What this engine brings to every charter it reads, as its layer of it (FR-015, FR-022). */
export class BuiltinPrimitives {
  /** The ids of `/charter-release` and its script: no primitive of any
   *  repository holds or names one (VENDOR-FR-028). */
  static readonly reservedIds: readonly string[] = [CharterReleaseSkill.id, CharterReleaseActionScript.id];

  /** Held as primitives of each kind's own class, so a kind that changes its
   *  headers stops this compiling rather than a user's build (plan §3.2).
   *  `/charter-release` and its script come to every repository
   *  (VENDOR-FR-027). */
  readonly primitives: readonly Primitive[];

  constructor() {
    this.primitives = [
      new CwAuthorSkill(),
      new CwSessionTokensCounterScript(),
      new CwSessionTokensSensor(),
      new CharterReleaseSkill(),
      new CharterReleaseActionScript(),
    ];
  }
}

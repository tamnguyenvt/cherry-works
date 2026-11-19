import type { Primitive } from "../models/primitive/primitive.js";
import { CwAuthorSkill } from "./cw-author-skill.js";
import { CwSessionTokensCounterScript } from "./cw-session-tokens-counter-script.js";
import { CwSessionTokensSensor } from "./cw-session-tokens-sensor.js";
import { VendorReleaseActionScript } from "./vendor-release-action-script.js";
import { VendorReleaseSkill } from "./vendor-release-skill.js";

/** What this engine brings to every charter it reads, as its layer of it (FR-015, FR-022). */
export class BuiltinPrimitives {
  /** The ids of what the engine brings to a repository `cw vendor init` set
   *  up alone: no primitive of any repository holds or names one
   *  (VENDOR-FR-028). */
  static readonly reservedVendorIds: readonly string[] = [VendorReleaseSkill.id, VendorReleaseActionScript.id];

  /** Held as primitives of each kind's own class, so a kind that changes its
   *  headers stops this compiling rather than a user's build (plan §3.2).
   *  `/vendor-release` and its script come where `isVendor` says
   *  `cw vendor init` set the repository up (VENDOR-FR-027). */
  readonly primitives: readonly Primitive[];

  constructor(isVendor = false) {
    this.primitives = [
      new CwAuthorSkill(),
      new CwSessionTokensCounterScript(),
      new CwSessionTokensSensor(),
      ...(isVendor ? [new VendorReleaseSkill(), new VendorReleaseActionScript()] : []),
    ];
  }
}

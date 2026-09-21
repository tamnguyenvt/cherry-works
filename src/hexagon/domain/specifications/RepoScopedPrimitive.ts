import { REPO_SCOPE, type ScopedPrimitive } from "../models/charter/CharterRoot.js";

/**
 * SPECIFICATION — a primitive this repository authored, and so one it may
 * rewrite or delete (FR-075, FR-076). What a vendor installed is changed by
 * installing it again, and what the engine brings has no file here to change
 * (FR-077).
 */
export class RepoScopedPrimitive {
  static isSatisfiedBy(scopedPrimitive: ScopedPrimitive): boolean {
    return scopedPrimitive.scope === REPO_SCOPE;
  }
}

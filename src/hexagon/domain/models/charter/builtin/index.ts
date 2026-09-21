import type { Primitive } from "../primitive/Primitive.js";
import { CwAuthorSkill } from "./CwAuthorSkill.js";

/** What this engine brings to every charter it reads, as its layer of it
 *  (FR-015, FR-022). Held as primitives of each kind's own class, so a kind
 *  that changes its headers stops this compiling rather than a user's build
 *  (plan §3.2). */
export const BUILTIN_PRIMITIVES: readonly Primitive[] = [new CwAuthorSkill()];

import type { DomainFault } from "../domain.fault.js";

/** Faults under no file yet: what an author's answers were refused for before
 *  anything was written, every one of them rather than the first (FR-004,
 *  FR-009). */
export class Faults {
  constructor(readonly faults: readonly DomainFault[]) {}
}

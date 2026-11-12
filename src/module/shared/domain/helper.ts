import { type DomainFault, ManyFindingsFault } from "./models/domain.fault.js";

/** What several models share in saying what is wrong: how many faults are thrown at once. */
export class FaultHelper {
  /** Throws every fault at once: what is wrong is said once and in full rather
   *  than one exception at a time, so a caller reading a whole charter can
   *  name them all (FR-009). It asks for faults and not for a class of them:
   *  anything that is a fault can be thrown this way. */
  static throwAggregate(faults: readonly DomainFault[]): never {
    throw new ManyFindingsFault(faults.map((fault) => fault.message).join(" "), "Correct each fault it carries.", {
      cause: faults,
    });
  }

  private constructor() {}
}

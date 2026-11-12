import { DomainFault, UnfaultedRaiseFault } from "./domain.fault.js";

/** Makes a fault out of whatever was raised. */
export class DomainFaultFactory {
  /** What was raised, as a fault: a fault as it is, and anything else as an
   *  internal one carrying it as its cause, so nothing raised is left without a
   *  message and a next move (SDK-FR-004). */
  static create(raisedValue: unknown): DomainFault {
    if (raisedValue instanceof DomainFault) return raisedValue;
    return new UnfaultedRaiseFault(
      `What was raised is no fault: ${raisedValue instanceof Error ? raisedValue.name : typeof raisedValue}.`,
      "Read its cause in the log, and fix what raised it.",
      { cause: raisedValue },
    );
  }

  private constructor() {}
}

import type { DomainFault } from "../domain/models/DomainFault.js";
import type { ForWritingLogs } from "../port/zdriven/ForWritingLogs.js";

/**
 * SERVICE — logic every use case follows, so it lives once, here: named verb
 * first, `Service` last. An internal fault is cooked into the system's own
 * words before a driver reads it, so what it really said — and its fix, for
 * whoever runs the system — is kept in the log alone.
 */
export class LogFaultService {
  readonly #logs: ForWritingLogs;

  constructor(logs: ForWritingLogs) {
    this.#logs = logs;
  }

  /** Writes an internal fault to the log; the person's own faults are theirs, and are not. */
  logFault(fault: DomainFault): void {
    if (!fault.internal) return;
    this.#logs.writeLogEntry({
      level: "error",
      message: fault.message,
      fields: {
        fault: fault.name,
        fix: fault.fix,
        ...(fault.cause === undefined ? {} : { cause: String(fault.cause) }),
      },
    });
  }
}

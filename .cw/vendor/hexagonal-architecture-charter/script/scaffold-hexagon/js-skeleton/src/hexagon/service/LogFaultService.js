/**
 * @typedef {import("../domain/models/DomainFault.js").DomainFault} DomainFault
 * @typedef {import("../port/zdriven/ForWritingLogs.js").ForWritingLogs} ForWritingLogs
 */

/**
 * SERVICE — logic every use case follows, so it lives once, here: named verb
 * first, `Service` last. An internal fault is cooked into the system's own
 * words before a driver reads it, so what it really said — and its fix, for
 * whoever runs the system — is kept in the log alone.
 */
export class LogFaultService {
  /** @type {ForWritingLogs} */
  #logs;

  /** @param {ForWritingLogs} logs */
  constructor(logs) {
    this.#logs = logs;
  }

  /**
   * Writes an internal fault to the log; the person's own faults are theirs, and are not.
   * @param {DomainFault} fault
   */
  logFault(fault) {
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

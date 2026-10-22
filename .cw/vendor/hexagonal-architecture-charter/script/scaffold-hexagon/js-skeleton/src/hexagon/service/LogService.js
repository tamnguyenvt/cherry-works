/**
 * @typedef {import("../domain/models/DomainFault.js").DomainFault} DomainFault
 * @typedef {import("../port/zdriven/ForWritingLogs.js").ForWritingLogs} ForWritingLogs
 * @typedef {import("../port/zdriven/ForWritingLogs.js").LogEntry} LogEntry
 * @typedef {NonNullable<LogEntry["fields"]>} LogFields
 */

/**
 * SERVICE — logic several use cases follow, so it lives once, here: named
 * verb first, `Service` last. It writes the log for every use case and
 * whatever it logs: one place that knows what a log entry holds, so a use case
 * only says what happened. Logic and nothing else — it holds no state and is
 * never constructed: a use case hands it the port to write through, call by
 * call. Never a secret in a message or a field.
 */
export const LogService = {
  /**
   * @param {ForWritingLogs} logs
   * @param {string} message
   * @param {LogFields} [fields]
   */
  logInfo(logs, message, fields) {
    writeLogEntry(logs, "info", message, fields);
  },

  /**
   * @param {ForWritingLogs} logs
   * @param {string} message
   * @param {LogFields} [fields]
   */
  logWarning(logs, message, fields) {
    writeLogEntry(logs, "warn", message, fields);
  },

  /**
   * @param {ForWritingLogs} logs
   * @param {string} message
   * @param {LogFields} [fields]
   */
  logError(logs, message, fields) {
    writeLogEntry(logs, "error", message, fields);
  },

  /**
   * Logs a fault before a use case answers with it: an internal one is cooked
   * into the system's own words for the client, so what it really said — and
   * its fix, for whoever runs the system — is kept in the log alone. The
   * person's own faults are theirs, and are not logged.
   * @param {ForWritingLogs} logs
   * @param {DomainFault} fault
   */
  logFault(logs, fault) {
    if (!fault.internal) return;
    LogService.logError(logs, fault.message, {
      fault: fault.name,
      fix: fault.fix,
      ...(fault.cause === undefined ? {} : { cause: String(fault.cause) }),
    });
  },
};

/**
 * @param {ForWritingLogs} logs
 * @param {LogEntry["level"]} level
 * @param {string} message
 * @param {LogFields | undefined} fields
 */
function writeLogEntry(logs, level, message, fields) {
  logs.writeLogEntry(fields === undefined ? { level, message } : { level, message, fields });
}

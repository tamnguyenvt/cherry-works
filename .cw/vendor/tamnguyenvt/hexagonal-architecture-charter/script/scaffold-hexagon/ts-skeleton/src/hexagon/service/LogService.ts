import type { DomainFault } from "../domain/models/DomainFault.js";
import type { ForWritingLogs, LogEntry } from "../port/zdriven/ForWritingLogs.js";

type LogFields = NonNullable<LogEntry["fields"]>;

/**
 * SERVICE — logic several use cases follow, so it lives once, here: named
 * verb first, `Service` last. It writes the log for every use case and whatever it logs:
 * one place that knows what a log entry holds, so a use case only says what
 * happened. Logic and nothing else — it holds no state and is never
 * constructed: a use case hands it the port to write through, call by call.
 * Never a secret in a message or a field.
 */
export const LogService = {
  logInfo(logs: ForWritingLogs, message: string, fields?: LogFields): void {
    writeLogEntry(logs, "info", message, fields);
  },

  logWarning(logs: ForWritingLogs, message: string, fields?: LogFields): void {
    writeLogEntry(logs, "warn", message, fields);
  },

  logError(logs: ForWritingLogs, message: string, fields?: LogFields): void {
    writeLogEntry(logs, "error", message, fields);
  },

  /**
   * Logs a fault before a use case answers with it: an internal one is cooked
   * into the system's own words for the client, so what it really said — and its fix,
   * for whoever runs the system — is kept in the log alone. The person's own
   * faults are theirs, and are not logged.
   */
  logFault(logs: ForWritingLogs, fault: DomainFault): void {
    if (!fault.internal) return;
    LogService.logError(logs, fault.message, {
      fault: fault.name,
      fix: fault.fix,
      ...(fault.cause === undefined ? {} : { cause: String(fault.cause) }),
    });
  },
};

function writeLogEntry(logs: ForWritingLogs, level: LogEntry["level"], message: string, fields: LogFields | undefined): void {
  logs.writeLogEntry(fields === undefined ? { level, message } : { level, message, fields });
}

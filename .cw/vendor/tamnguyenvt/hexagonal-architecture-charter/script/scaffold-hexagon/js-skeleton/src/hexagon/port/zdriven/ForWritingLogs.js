/**
 * DRIVEN PORT — where the system's log goes. It knows log entries, nothing of the domain.
 *
 * @typedef {object} LogEntry
 * @property {"error" | "warn" | "info"} level
 * @property {string} message
 * @property {Readonly<Record<string, string>>} [fields]  What else the entry carries, as plain values — never a secret.
 *
 * @typedef {object} ForWritingLogs
 * @property {(logEntry: LogEntry) => void} writeLogEntry  Writes one entry to the log.
 */

export {};

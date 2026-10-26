/**
 * @typedef {import("../hexagon/port/zdriven/ForWritingLogs.js").ForWritingLogs} ForWritingLogs
 * @typedef {import("../hexagon/port/zdriven/ForWritingLogs.js").LogEntry} LogEntry
 */

/**
 * DRIVEN ADAPTER — the log held in memory, so a test can read what was written.
 *
 * @implements {ForWritingLogs}
 */
export class InMemoryLogs {
  /** @type {LogEntry[]} */
  logEntries = [];

  /** @param {LogEntry} logEntry */
  writeLogEntry(logEntry) {
    this.logEntries.push(logEntry);
  }
}

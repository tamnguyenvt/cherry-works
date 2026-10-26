/**
 * @typedef {import("../hexagon/port/zdriven/ForWritingLogs.js").ForWritingLogs} ForWritingLogs
 * @typedef {import("../hexagon/port/zdriven/ForWritingLogs.js").LogEntry} LogEntry
 */

/**
 * DRIVEN ADAPTER — the log as JSON lines on stderr, where whoever runs the system collects them.
 *
 * @implements {ForWritingLogs}
 */
export class StderrLogs {
  /** @param {LogEntry} logEntry */
  writeLogEntry(logEntry) {
    process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), ...logEntry })}\n`);
  }
}

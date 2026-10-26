import type { ForWritingLogs, LogEntry } from "../hexagon/port/zdriven/ForWritingLogs.js";

/** DRIVEN ADAPTER — the log as JSON lines on stderr, where whoever runs the system collects them. */
export class StderrLogs implements ForWritingLogs {
  writeLogEntry(logEntry: LogEntry): void {
    process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), ...logEntry })}\n`);
  }
}

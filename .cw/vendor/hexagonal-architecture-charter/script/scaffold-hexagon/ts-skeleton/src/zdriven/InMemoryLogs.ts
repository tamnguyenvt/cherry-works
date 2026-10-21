import type { ForWritingLogs, LogEntry } from "../hexagon/port/zdriven/ForWritingLogs.js";

/** DRIVEN ADAPTER — the log held in memory, so a test can read what was written. */
export class InMemoryLogs implements ForWritingLogs {
  readonly logEntries: LogEntry[] = [];

  writeLogEntry(logEntry: LogEntry): void {
    this.logEntries.push(logEntry);
  }
}

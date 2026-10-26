/** DRIVEN PORT — where the system's log goes. It knows log entries, nothing of the domain. */
export interface ForWritingLogs {
  /** Writes one entry to the log. */
  writeLogEntry(logEntry: LogEntry): void;
}

export interface LogEntry {
  readonly level: "error" | "warn" | "info";
  readonly message: string;
  /** What else the entry carries, as plain values — never a secret. */
  readonly fields?: Readonly<Record<string, string>>;
}

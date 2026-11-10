/**
 * DRIVEN PORT — recipient. The application reports and forgets.
 *
 * Named for what the application wants, not for what carries it: a terminal
 * today, a window in the later interface, a CI log tomorrow. None of that is
 * the application's business.
 */
export interface ForReportingProgress {
  /** A result the user asked for. */
  report(text: string): void;
  /** A problem, and the next move after it (FR-009, SC-003). */
  problem(text: string): void;
}

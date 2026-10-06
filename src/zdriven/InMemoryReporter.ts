import type { ForReportingProgress } from "#hexagon/port/zdriven/ForReportingProgress.js";

/** What a use case reported, held in memory for a test to read: the twin of
 *  `ConsoleReporter`. */
export class InMemoryReporter implements ForReportingProgress {
  readonly reports: string[] = [];
  readonly problems: string[] = [];

  report(text: string): void {
    this.reports.push(text);
  }

  problem(text: string): void {
    this.problems.push(text);
  }
}

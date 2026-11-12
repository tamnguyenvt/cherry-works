import type { ForReportingProgress } from "../../app/port/out/reporting-progress.port.js";

/** What a use case reported, held in memory for a test to read: the twin of
 *  `ConsoleReporter`. */
export class InMemoryReporter implements ForReportingProgress {
  readonly reports: string[] = [];
  readonly problems: string[] = [];

  reportProgress(text: string): void {
    this.reports.push(text);
  }

  reportProblem(text: string): void {
    this.problems.push(text);
  }
}

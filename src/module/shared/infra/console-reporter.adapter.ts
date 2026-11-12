import type { ForReportingProgress } from "../app/port/out/reporting-progress.port.js";

/** DRIVEN ADAPTER: the terminal. Results on stdout, problems on stderr, so a
 *  pipeline can separate what it asked for from what went wrong. */
export class ConsoleReporter implements ForReportingProgress {
  reportProgress(text: string): void {
    process.stdout.write(text);
  }

  reportProblem(text: string): void {
    process.stderr.write(text);
  }
}

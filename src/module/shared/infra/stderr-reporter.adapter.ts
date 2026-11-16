import type { ForReportingProgress } from "../app/port/out/reporting-progress.port.js";

/** DRIVEN ADAPTER: the terminal's standard error, progress and problems both,
 *  where standard output holds an answer read as data alone (CORE-FR-241). */
export class StderrReporter implements ForReportingProgress {
  reportProgress(text: string): void {
    process.stderr.write(text);
  }

  reportProblem(text: string): void {
    process.stderr.write(text);
  }
}

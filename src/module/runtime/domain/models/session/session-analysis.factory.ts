import { SessionAnalysis } from "./session-analysis.js";
import { SessionAnalysisLine } from "./session-analysis-line.value-object.js";

/** Makes the sessions' analysis out of the logs their store read. */
export class SessionAnalysisFactory {
  /** The stops the sessions' logs hold, read off the folder they are kept in. A
   *  line that does not read as a stop is left out, as one the counter never
   *  finished writing. */
  static create(sessionsFolder: string, logTexts: readonly string[]): SessionAnalysis {
    const sessionAnalysisLines = logTexts.flatMap((logText) =>
      logText.split("\n").flatMap((logLine) => {
        try {
          const sessionAnalysisLineParse = SessionAnalysisLine.schema.safeParse(JSON.parse(logLine));
          return sessionAnalysisLineParse.success ? [new SessionAnalysisLine(sessionAnalysisLineParse.data)] : [];
        } catch {
          return [];
        }
      }),
    );
    return new SessionAnalysis(sessionsFolder, sessionAnalysisLines);
  }

  private constructor() {}
}

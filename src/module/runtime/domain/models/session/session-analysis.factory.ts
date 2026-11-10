import { SessionAnalysis } from "./session-analysis.js";
import { SessionAnalysisLines } from "./session-analysis-line.js";

/** Makes the sessions' analysis out of the logs their store read. */
export class SessionAnalysisFactory {
  /** The stops the sessions' logs hold, read off the folder they are kept in. A
   *  line that does not read as a stop is left out, as one the counter never
   *  finished writing. */
  static create(sessionsFolder: string, logTexts: readonly string[]): SessionAnalysis {
    const sessionAnalysisLines = logTexts.flatMap((logText) =>
      logText.split("\n").flatMap((logLine) => {
        try {
          const sessionAnalysisLineParse = SessionAnalysisLines.schema.safeParse(JSON.parse(logLine));
          return sessionAnalysisLineParse.success ? [sessionAnalysisLineParse.data] : [];
        } catch {
          return [];
        }
      }),
    );
    return new SessionAnalysis(sessionsFolder, sessionAnalysisLines);
  }

  private constructor() {}
}

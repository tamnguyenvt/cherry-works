import type { SessionAnalysisLine } from "./session-analysis-line.value-object.js";
import { SessionAnalysisSummary } from "./session-analysis-summary.js";
import { SessionSpan } from "./session-span.value-object.js";

/**
 * The stops of the sessions kept for one repository, as they were read off
 * the folder they are kept in (EVAL-FR-009), and that folder. Summed up by
 * `summarizeSessions`, over one span or day by day.
 */
export class SessionAnalysis {
  constructor(
    /** The folder the logs were read from, as a person names it. */
    readonly sessionsFolder: string,
    readonly sessionAnalysisLines: readonly SessionAnalysisLine[],
  ) {}

  /**
   * The sessions whose last stop falls within the span, each once at that
   * stop (EVAL-FR-012). The last stop is the session's last of all, so a
   * session stopping on two days is counted on the later one only.
   */
  summarizeSessions(span: SessionSpan): SessionAnalysisSummary {
    const lastAnalysisLineBySessionId = new Map<string, SessionAnalysisLine>();
    for (const sessionAnalysisLine of this.sessionAnalysisLines) {
      const lastAnalysisLine = lastAnalysisLineBySessionId.get(sessionAnalysisLine.sessionId);
      if (
        lastAnalysisLine === undefined ||
        Date.parse(sessionAnalysisLine.stopTimeText) >= Date.parse(lastAnalysisLine.stopTimeText)
      )
        lastAnalysisLineBySessionId.set(sessionAnalysisLine.sessionId, sessionAnalysisLine);
    }
    const sessions = [...lastAnalysisLineBySessionId.values()]
      .filter((lastAnalysisLine) => {
        const stopDay = SessionSpan.localDayOf(new Date(lastAnalysisLine.stopTimeText));
        return stopDay >= span.since && stopDay <= span.until;
      })
      .map(({ sessionId, model, stopTimeText, tokens, totalTokens }) => ({
        sessionId,
        model,
        lastStopAt: stopTimeText,
        tokens,
        totalTokens,
      }))
      .sort(
        (session, otherSession) =>
          otherSession.totalTokens - session.totalTokens || session.sessionId.localeCompare(otherSession.sessionId),
      );
    return new SessionAnalysisSummary(span, sessions);
  }

  /** Each day of the span a session's last stop fell on, summarized as a span
   *  of that day alone, the largest day first (EVAL-FR-012). */
  summarizeByDay(span: SessionSpan): Readonly<Record<string, SessionAnalysisSummary>> {
    const stopDays = [
      ...new Set(
        this.summarizeSessions(span).sessions.map(({ lastStopAt }) => SessionSpan.localDayOf(new Date(lastStopAt))),
      ),
    ];
    return Object.fromEntries(
      stopDays
        .map(
          (stopDay) => [stopDay, this.summarizeSessions(new SessionSpan({ since: stopDay, until: stopDay }))] as const,
        )
        .sort(
          ([stopDay, daySummary], [otherStopDay, otherDaySummary]) =>
            otherDaySummary.totalTokens - daySummary.totalTokens || otherStopDay.localeCompare(stopDay),
        ),
    );
  }
}

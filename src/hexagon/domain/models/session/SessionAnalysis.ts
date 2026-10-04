import type { SessionAnalysisLine } from "./SessionAnalysisLine.js";
import { localDayOf, type SessionSpan } from "./SessionSpan.js";
import type { SessionAnalysisSummary } from "./SessionAnalysisSummary.js";

/**
 * The stops of the sessions kept for one repository, as they were read off
 * the folder they are kept in (EVAL-FR-009), and that folder. Summed up by
 * `summarize`, over one span or day by day.
 */
export class SessionAnalysis {
  constructor(
    readonly sessionsFolder: URL,
    readonly sessionAnalysisLines: readonly SessionAnalysisLine[],
  ) {}

  /**
   * The sessions whose last stop falls within the span, each once at that
   * stop (EVAL-FR-012). The last stop is the session's last of all, so a
   * session stopping on two days is counted on the later one only.
   */
  summarize(span: SessionSpan): SessionAnalysisSummary {
    const lastAnalysisLineBySessionId = new Map<string, SessionAnalysisLine>();
    for (const sessionAnalysisLine of this.sessionAnalysisLines) {
      const lastAnalysisLine = lastAnalysisLineBySessionId.get(sessionAnalysisLine.sessionId);
      if (lastAnalysisLine === undefined || Date.parse(sessionAnalysisLine.time) >= Date.parse(lastAnalysisLine.time))
        lastAnalysisLineBySessionId.set(sessionAnalysisLine.sessionId, sessionAnalysisLine);
    }
    const sessions = [...lastAnalysisLineBySessionId.values()]
      .filter((lastAnalysisLine) => {
        const stopDay = localDayOf(new Date(lastAnalysisLine.time));
        return stopDay >= span.since && stopDay <= span.until;
      })
      .map(({ sessionId, model, time, tokens, total }) => ({ sessionId, model, lastStopAt: time, tokens, totalTokens: total }))
      .sort((session, otherSession) => otherSession.totalTokens - session.totalTokens || session.sessionId.localeCompare(otherSession.sessionId));
    return {
      span,
      sessions,
      sessionCount: sessions.length,
      totalTokens: sessions.reduce((total, session) => total + session.totalTokens, 0),
    };
  }

  /** Each day of the span a session's last stop fell on, summarized as a span
   *  of that day alone, the largest day first (EVAL-FR-012). */
  summarizeByDay(span: SessionSpan): Readonly<Record<string, SessionAnalysisSummary>> {
    const stopDays = [...new Set(this.summarize(span).sessions.map(({ lastStopAt }) => localDayOf(new Date(lastStopAt))))];
    return Object.fromEntries(
      stopDays
        .map((stopDay) => [stopDay, this.summarize({ since: stopDay, until: stopDay })] as const)
        .sort(([stopDay, daySummary], [otherStopDay, otherDaySummary]) => otherDaySummary.totalTokens - daySummary.totalTokens || otherStopDay.localeCompare(stopDay)),
    );
  }
}

import type { SessionAnalysisLine } from "./session-analysis-line.value-object.js";
import type { SessionSpan } from "./session-span.value-object.js";

/**
 * The sessions kept within a span, summed up (EVAL-FR-012): each session
 * once, at the last stop it was kept at, the largest first, how many, and
 * their total. What `SessionAnalysis.summarizeSessions` answers; it holds no
 * line of the log.
 */
export class SessionAnalysisSummary {
  constructor(
    readonly span: SessionSpan,
    readonly sessions: readonly {
      readonly sessionId: string;
      readonly model: string;
      readonly lastStopAt: string;
      /** Its tokens by kind at that stop (EVAL-FR-008). */
      readonly tokens: SessionAnalysisLine["tokens"];
      /** Its tokens so far, subagents included (EVAL-FR-008). */
      readonly totalTokens: number;
    }[],
  ) {}

  get sessionCount(): number {
    return this.sessions.length;
  }

  get totalTokens(): number {
    return this.sessions.reduce((totalTokens, session) => totalTokens + session.totalTokens, 0);
  }
}

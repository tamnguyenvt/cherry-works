import type { SessionSpan } from "./SessionSpan.js";

/**
 * The sessions kept within a span, summed up (EVAL-FR-012): each session
 * once, at the last stop it was kept at, the largest first, how many, and
 * their total. What `SessionAnalysis.summarize` answers; it holds no line of
 * the log.
 */
export interface SessionAnalysisSummary {
  readonly span: SessionSpan;
  readonly sessions: readonly {
    readonly sessionId: string;
    readonly model: string;
    readonly lastStopAt: string;
    /** Its tokens so far, subagents included (EVAL-FR-008). */
    readonly totalTokens: number;
  }[];
  readonly sessionCount: number;
  readonly totalTokens: number;
}

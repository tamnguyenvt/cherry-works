import type { OutcomeDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — the sessions kept on this machine for this repository, read
 * back (EVAL-FR-012, EVAL-FR-013).
 *
 * Apart from `ForManagingCharter` because it reads no charter: what it reads
 * is the log `cw-session-tokens-counter` keeps each time the agent stops, outside
 * the repository. It holds no port that writes, so nothing on it can change
 * the log or the repository.
 */
export interface ForReviewingSessions {
  /**
   * The sessions kept, summed up by day and by session, in tokens, the
   * largest first, each session counted once at the last stop it was kept at,
   * over the days from `since` to `until`, both counted in and each
   * `YYYY-MM-DD`: the last 31 days where neither is given, 31 from or up to
   * the one given (EVAL-FR-030). A day written any other way, and a span
   * longer than 31 days, are raised before anything is read.
   *
   * No session kept is an answer rather than a failure: no day, and the
   * folder it was looked for in.
   */
  sessionSummary(since?: string, until?: string): Promise<OutcomeDTOs.SessionReviewOutcome>;
}

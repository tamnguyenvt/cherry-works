import type { SessionLogs } from "../../../domain/models/session/session-logs.js";

/** What an adapter answers in, named again here so it imports nothing of the
 *  hexagon but its port. */
export { SessionLogs } from "../../../domain/models/session/session-logs.js";

/** Reads the logs `cw-session-tokens-counter` keeps, one per session. */
export interface ForLoadingSessionAnalysis {
  /**
   * The text of every session's log under the folder this repository's
   * sessions are kept in, last written from `writtenFromMs` until
   * `writtenUntilMs`, in milliseconds since the epoch (EVAL-FR-009,
   * EVAL-SC-007), with the name of that folder. Which folder that is — the
   * `sessionAnalysisFolder` the repository's settings name, or else one under
   * the developer's home named after the repository — is the adapter's to
   * find, since where the repository and the home are is its alone
   * (CORE-FR-218). Each session keeps one folder of its own, its log directly
   * in it; a folder that is not there holds none.
   */
  loadSessionLogs(sessionAnalysisFolder: string | undefined, writtenFromMs: number, writtenUntilMs: number): Promise<SessionLogs>;
}

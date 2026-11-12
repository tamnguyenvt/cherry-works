const DAY_MS = 24 * 60 * 60 * 1000;

/** How far a log's last write may sit outside a span's days and still hold a
 *  stop within them: a day each side, for this machine's clock against UTC. */
const SPAN_MARGIN_MS = DAY_MS;

/** The days a summary spans, each `YYYY-MM-DD` and both counted in, at most
 *  31 days apart (EVAL-FR-012, EVAL-FR-030). */
export class SessionSpan {
  readonly since: string;
  readonly until: string;

  constructor(sessionSpan: Pick<SessionSpan, "since" | "until">) {
    this.since = sessionSpan.since;
    this.until = sessionSpan.until;
  }

  /** The day a moment falls on, `YYYY-MM-DD`, on this machine's clock. */
  static localDayOf(moment: Date): string {
    return `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, "0")}-${String(moment.getDate()).padStart(2, "0")}`;
  }

  /** When a log that may hold a stop within the span was last written, from
   *  and until, in milliseconds since the epoch: a session's log is last
   *  written at its last stop, so one written outside these is never read
   *  (EVAL-SC-007). The span's last day ends a day after it starts. */
  get logWindow(): { readonly writtenFromMs: number; readonly writtenUntilMs: number } {
    return {
      writtenFromMs: Date.parse(this.since) - SPAN_MARGIN_MS,
      writtenUntilMs: Date.parse(this.until) + DAY_MS + SPAN_MARGIN_MS,
    };
  }
}

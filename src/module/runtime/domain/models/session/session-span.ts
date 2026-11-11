import { DomainFault } from "../../../../shared/module.js";

/** The most days a summary of the sessions kept spans (EVAL-FR-030). */
const MAX_SESSION_SPAN_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days a summary spans, each `YYYY-MM-DD` and both counted in, at most
 *  `MAX_SESSION_SPAN_DAYS` apart (EVAL-FR-012, EVAL-FR-030). */
export class SessionSpan {
  declare readonly since: string;
  declare readonly until: string;

  constructor(fields: SessionSpan) {
    Object.assign(this, fields);
  }
}

/** The day a moment falls on, `YYYY-MM-DD`, on this machine's clock. */
function localDayOf(moment: Date): string {
  return `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, "0")}-${String(moment.getDate()).padStart(2, "0")}`;
}

/**
 * The span a summary is asked for (EVAL-FR-030): the last 31 days, today
 * among them, where neither end is named; 31 days from `since`, or up to
 * `until`, where only one is. A day written other than `YYYY-MM-DD`, a span
 * ending before it starts, and one longer than 31 days are raised.
 */
function sessionSpanOf(today: Date, since?: string, until?: string): SessionSpan {
  // A day the calendar does not hold, as 2026-02-31, is read as another
  // rather than refused, so it is held to the day it reads back as.
  for (const spanDay of [since, until])
    if (
      spanDay !== undefined &&
      !(
        /^\d{4}-\d{2}-\d{2}$/.test(spanDay) &&
        !Number.isNaN(Date.parse(spanDay)) &&
        new Date(Date.parse(spanDay)).toISOString().slice(0, 10) === spanDay
      )
    )
      throw new DomainFault(`"${spanDay}" is no day.`, `Write a day as YYYY-MM-DD, as in "2026-10-01".`, {
        internal: false,
      });

  // Days counted on the calendar alone: a date with no time is midnight UTC,
  // so adding whole days to one never crosses a clock change.
  const dayShiftedBy = (day: string, dayCount: number) =>
    new Date(Date.parse(day) + dayCount * DAY_MS).toISOString().slice(0, 10);
  const untilDay = until ?? (since === undefined ? localDayOf(today) : dayShiftedBy(since, MAX_SESSION_SPAN_DAYS - 1));
  const sinceDay = since ?? dayShiftedBy(untilDay, -(MAX_SESSION_SPAN_DAYS - 1));

  if (sinceDay > untilDay)
    throw new DomainFault(
      `The span ends on ${untilDay}, before it starts on ${sinceDay}.`,
      `Write the earlier day after --since and the later after --until.`,
      { internal: false },
    );
  const spanDayCount = (Date.parse(untilDay) - Date.parse(sinceDay)) / DAY_MS + 1;
  if (spanDayCount > MAX_SESSION_SPAN_DAYS)
    throw new DomainFault(
      `The span from ${sinceDay} until ${untilDay} is ${spanDayCount} days, and a summary spans ${MAX_SESSION_SPAN_DAYS} at most.`,
      `Name a span of ${MAX_SESSION_SPAN_DAYS} days or fewer, as in --since ${sinceDay} --until ${dayShiftedBy(sinceDay, MAX_SESSION_SPAN_DAYS - 1)}.`,
      { internal: false },
    );
  return new SessionSpan({ since: sinceDay, until: untilDay });
}

/** How far a log's last write may sit outside a span's days and still hold a
 *  stop within them: a day each side, for this machine's clock against UTC. */
const SPAN_MARGIN_MS = DAY_MS;

/** When a log that may hold a stop within the span was last written, from and
 *  until, in milliseconds since the epoch: a session's log is last written at
 *  its last stop, so one written outside these is never read (EVAL-SC-007). */
function logWindowOf(span: SessionSpan): { readonly writtenFromMs: number; readonly writtenUntilMs: number } {
  // The span's last day ends a day after it starts.
  return {
    writtenFromMs: Date.parse(span.since) - SPAN_MARGIN_MS,
    writtenUntilMs: Date.parse(span.until) + DAY_MS + SPAN_MARGIN_MS,
  };
}

/** The days a summary of the sessions spans, and the logs that may hold a stop within them. */
export class SessionSpans {
  static get maxDays(): typeof MAX_SESSION_SPAN_DAYS {
    return MAX_SESSION_SPAN_DAYS;
  }

  static readonly localDayOf: typeof localDayOf = localDayOf;

  static readonly of: typeof sessionSpanOf = sessionSpanOf;

  static readonly logWindowOf: typeof logWindowOf = logWindowOf;

  private constructor() {}
}

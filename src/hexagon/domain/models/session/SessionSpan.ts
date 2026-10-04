import { DomainFault } from "../DomainFault.js";

/** The most days a summary of the sessions kept spans (EVAL-FR-030). */
export const MAX_SESSION_SPAN_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The days a summary spans, each `YYYY-MM-DD` and both counted in, at most
 *  `MAX_SESSION_SPAN_DAYS` apart (EVAL-FR-012, EVAL-FR-030). */
export interface SessionSpan {
  readonly since: string;
  readonly until: string;
}

/** The day a moment falls on, `YYYY-MM-DD`, on this machine's clock. */
export function localDayOf(moment: Date): string {
  return `${moment.getFullYear()}-${String(moment.getMonth() + 1).padStart(2, "0")}-${String(moment.getDate()).padStart(2, "0")}`;
}

/**
 * The span a summary is asked for (EVAL-FR-030): the last 31 days, today
 * among them, where neither end is named; 31 days from `since`, or up to
 * `until`, where only one is. A day written other than `YYYY-MM-DD`, a span
 * ending before it starts, and one longer than 31 days are raised.
 */
export function sessionSpanOf(today: Date, since?: string, until?: string): SessionSpan {
  for (const spanDay of [since, until])
    // A day the calendar does not hold, as 2026-02-31, is read as another
    // rather than refused, so it is held to the day it reads back as.
    if (spanDay !== undefined && !(/^\d{4}-\d{2}-\d{2}$/.test(spanDay) && !Number.isNaN(Date.parse(spanDay)) && new Date(Date.parse(spanDay)).toISOString().slice(0, 10) === spanDay))
      throw new DomainFault(`"${spanDay}" is no day.`, `Write a day as YYYY-MM-DD, as in "2026-10-01".`);

  // Days counted on the calendar alone: a date with no time is midnight UTC,
  // so adding whole days to one never crosses a clock change.
  const dayShiftedBy = (day: string, dayCount: number) => new Date(Date.parse(day) + dayCount * DAY_MS).toISOString().slice(0, 10);
  const untilDay = until ?? (since === undefined ? localDayOf(today) : dayShiftedBy(since, MAX_SESSION_SPAN_DAYS - 1));
  const sinceDay = since ?? dayShiftedBy(untilDay, -(MAX_SESSION_SPAN_DAYS - 1));

  if (sinceDay > untilDay)
    throw new DomainFault(`The span ends on ${untilDay}, before it starts on ${sinceDay}.`, `Write the earlier day after --since and the later after --until.`);
  const spanDayCount = (Date.parse(untilDay) - Date.parse(sinceDay)) / DAY_MS + 1;
  if (spanDayCount > MAX_SESSION_SPAN_DAYS)
    throw new DomainFault(
      `The span from ${sinceDay} until ${untilDay} is ${spanDayCount} days, and a summary spans ${MAX_SESSION_SPAN_DAYS} at most.`,
      `Name a span of ${MAX_SESSION_SPAN_DAYS} days or fewer, as in --since ${sinceDay} --until ${dayShiftedBy(sinceDay, MAX_SESSION_SPAN_DAYS - 1)}.`,
    );
  return { since: sinceDay, until: untilDay };
}

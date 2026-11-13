import { InvalidDayFault, OverlongSessionSpanFault, ReversedSessionSpanFault } from "../runtime.fault.js";
import { SessionSpan } from "./session-span.value-object.js";

/** The most days a summary of the sessions spans (EVAL-FR-030). */
const MAX_SESSION_SPAN_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Makes the span a summary of the sessions is asked for. */
export class SessionSpanFactory {
  /**
   * The span a summary is asked for (EVAL-FR-030): the last 31 days, today
   * among them, where neither end is named; 31 days from `since`, or up to
   * `until`, where only one is. A day written other than `YYYY-MM-DD`, a span
   * ending before it starts, and one longer than 31 days are raised.
   */
  static create(today: Date, since?: string, until?: string): SessionSpan {
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
        throw new InvalidDayFault(`"${spanDay}" is no day.`, `Write a day as YYYY-MM-DD, as in "2026-10-01".`, {
          internal: false,
        });

    // Days counted on the calendar alone: a date with no time is midnight UTC,
    // so adding whole days to one never crosses a clock change.
    const addDaysToDay = (day: string, dayCount: number) =>
      new Date(Date.parse(day) + dayCount * DAY_MS).toISOString().slice(0, 10);
    const untilDay =
      until ?? (since === undefined ? SessionSpan.localDayOf(today) : addDaysToDay(since, MAX_SESSION_SPAN_DAYS - 1));
    const sinceDay = since ?? addDaysToDay(untilDay, -(MAX_SESSION_SPAN_DAYS - 1));

    if (sinceDay > untilDay)
      throw new ReversedSessionSpanFault(
        `The span ends on ${untilDay}, before it starts on ${sinceDay}.`,
        `Write the earlier day after --since and the later after --until.`,
        { internal: false },
      );
    const spanDayCount = (Date.parse(untilDay) - Date.parse(sinceDay)) / DAY_MS + 1;
    if (spanDayCount > MAX_SESSION_SPAN_DAYS)
      throw new OverlongSessionSpanFault(
        `The span from ${sinceDay} until ${untilDay} is ${spanDayCount} days, and a summary spans ${MAX_SESSION_SPAN_DAYS} at most.`,
        `Name a span of ${MAX_SESSION_SPAN_DAYS} days or fewer, as in --since ${sinceDay} --until ${addDaysToDay(sinceDay, MAX_SESSION_SPAN_DAYS - 1)}.`,
        { internal: false },
      );
    return new SessionSpan({ since: sinceDay, until: untilDay });
  }

  private constructor() {}
}

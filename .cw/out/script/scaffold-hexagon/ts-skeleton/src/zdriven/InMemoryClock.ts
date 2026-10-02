import type { ForReadingClock } from "../hexagon/port/zdriven/ForReadingClock.js";

/** DRIVEN ADAPTER — a clock stopped at one instant, for tests. The second
 *  implementation that earns the port its place. */
export class InMemoryClock implements ForReadingClock {
  constructor(private instant: Date) {}

  /** Move the clock, so a test can watch the answer change with the hour. */
  setTo(instant: Date): void {
    this.instant = instant;
  }

  now(): Date {
    return this.instant;
  }
}

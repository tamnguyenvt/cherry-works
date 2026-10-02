/** @typedef {import("../hexagon/port/zdriven/ForReadingClock.js").ForReadingClock} ForReadingClock */

/**
 * DRIVEN ADAPTER — a clock stopped at one instant, for tests. The second
 * implementation that earns the port its place.
 *
 * @implements {ForReadingClock}
 */
export class InMemoryClock {
  /** @param {Date} instant */
  constructor(instant) {
    this.instant = instant;
  }

  /**
   * Move the clock, so a test can watch the answer change with the hour.
   * @param {Date} instant
   */
  setTo(instant) {
    this.instant = instant;
  }

  now() {
    return this.instant;
  }
}

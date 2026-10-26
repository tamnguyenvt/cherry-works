import { ClockUnreadableFault } from "../hexagon/port/zdriven/ForReadingClock.js";

/** @typedef {import("../hexagon/port/zdriven/ForReadingClock.js").ForReadingClock} ForReadingClock */

/**
 * DRIVEN ADAPTER — a clock stopped at one instant, for tests. The second
 * implementation that earns the port its place.
 *
 * @implements {ForReadingClock}
 */
export class InMemoryClock {
  #isBroken = false;

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

  /** Break the clock, so a test can watch an internal fault reach the log and not the visitor. */
  breakDown() {
    this.#isBroken = true;
  }

  now() {
    if (this.#isBroken) throw new ClockUnreadableFault("The clock could not be read.", "Check the machine's clock.");
    return this.instant;
  }
}

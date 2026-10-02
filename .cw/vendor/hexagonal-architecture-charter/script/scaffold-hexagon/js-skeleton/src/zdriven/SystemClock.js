/** @typedef {import("../hexagon/port/zdriven/ForReadingClock.js").ForReadingClock} ForReadingClock */

/**
 * DRIVEN ADAPTER — the machine's own clock.
 *
 * @implements {ForReadingClock}
 */
export class SystemClock {
  now() {
    return new Date();
  }
}

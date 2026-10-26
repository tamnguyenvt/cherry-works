import { ClockUnreadableFault, type ForReadingClock } from "../hexagon/port/zdriven/ForReadingClock.js";

/** DRIVEN ADAPTER — a clock stopped at one instant, for tests. The second
 *  implementation that earns the port its place. */
export class InMemoryClock implements ForReadingClock {
  #isBroken = false;

  constructor(private instant: Date) {}

  /** Move the clock, so a test can watch the answer change with the hour. */
  setTo(instant: Date): void {
    this.instant = instant;
  }

  /** Break the clock, so a test can watch an internal fault reach the log and not the visitor. */
  breakDown(): void {
    this.#isBroken = true;
  }

  now(): Date {
    if (this.#isBroken) throw new ClockUnreadableFault("The clock could not be read.", "Check the machine's clock.");
    return this.instant;
  }
}

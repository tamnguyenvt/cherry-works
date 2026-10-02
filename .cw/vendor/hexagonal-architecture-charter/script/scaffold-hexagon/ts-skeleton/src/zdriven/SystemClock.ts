import type { ForReadingClock } from "../hexagon/port/zdriven/ForReadingClock.js";

/** DRIVEN ADAPTER — the machine's own clock. */
export class SystemClock implements ForReadingClock {
  now(): Date {
    return new Date();
  }
}

import type { ForTellingTime } from "#hexagon/port/zdriven/ForTellingTime.js";

/** DRIVEN ADAPTER: the system clock. */
export class SystemClock implements ForTellingTime {
  now(): Date {
    return new Date();
  }
}

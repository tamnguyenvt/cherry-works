import type { ForTellingTime } from "../app/port/out/telling-time.port.js";

/** DRIVEN ADAPTER: the system clock. */
export class SystemClock implements ForTellingTime {
  now(): Date {
    return new Date();
  }
}
